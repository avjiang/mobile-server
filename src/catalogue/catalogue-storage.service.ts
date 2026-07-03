import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BusinessLogicError, CatalogueStorageLimitError } from "../api-helpers/error";

/**
 * Cloudflare R2 storage for online-catalogue item/variant images.
 *
 * R2 is S3-compatible, so we use the AWS S3 SDK pointed at the R2 endpoint.
 * Required env (flutter-server/.env): R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL.
 *
 * Flow: backend mints a short-lived pre-signed PUT URL → the Flutter client
 * uploads the (already WebP-compressed) bytes straight to R2 with NO credentials
 * → client stores the returned publicUrl on the item/variant via the normal
 * update endpoint. Image bytes never pass through this server.
 *
 * See docs/future/ONLINE_CATALOGUE.md.
 */

const UPLOAD_URL_TTL_SECONDS = 300; // 5 min to complete the PUT
const ALLOWED_CONTENT_TYPE = "image/webp"; // FE downsamples to WebP before upload

// Per-tenant catalogue storage cap (the free base). 50 MB ≈ ~420 compressed
// photos — beyond a typical UMKM catalogue, yet reachable enough that the future
// "+50 MB block" add-on has a reason to exist. Chosen over 500 MB deliberately;
// see docs/future/ONLINE_CATALOGUE.md. (Until the add-on ships, a maxed-out tenant
// frees space by deleting photos via the Catalogue Storage screen.)
export const CATALOGUE_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  _client = new S3Client({
    region: "auto", // R2 ignores region but the SDK requires a value
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

/**
 * Total bytes a tenant has stored under its `<tenantId>/` prefix in R2.
 * Computed on demand via ListObjectsV2 (no stored counter to drift; reflects
 * deletes/replaces exactly). Paginates past 1,000 objects.
 */
export async function getStorageUsage(
  tenantId: number,
  excludeKey?: string
): Promise<number> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  const client = getClient();
  const prefix = `${tenantId}/`;
  let total = 0;
  let token: string | undefined = undefined;
  do {
    const res: any = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      // Optionally exclude one key — used by the upload pre-check so a re-upload
      // (stable key, replaces in place) doesn't count its OLD bytes on top of new.
      if (excludeKey && obj.Key === excludeKey) continue;
      total += obj.Size ?? 0;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return total;
}

/** A single stored object under a tenant's `<tenantId>/` prefix. */
export interface StorageObject {
  key: string;
  sizeBytes: number;
  lastModified?: string; // ISO timestamp
}

/**
 * List every object a tenant has stored under its `<tenantId>/` prefix.
 * (Laundry photos are keyed `laundry/<tenantId>/…` so they fall OUTSIDE this
 * prefix and are correctly excluded.) Paginates past 1,000 objects.
 */
export async function listStorageObjects(
  tenantId: number
): Promise<StorageObject[]> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  const client = getClient();
  const prefix = `${tenantId}/`;
  const out: StorageObject[] = [];
  let token: string | undefined = undefined;
  do {
    const res: any = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({
        key: obj.Key,
        sizeBytes: obj.Size ?? 0,
        lastModified:
          obj.LastModified instanceof Date
            ? obj.LastModified.toISOString()
            : undefined,
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/**
 * Delete one stored object. Guards that the key belongs to THIS tenant's
 * prefix so a caller can never delete another tenant's (or a laundry) object.
 */
export async function deleteStorageObject(
  tenantId: number,
  key: string
): Promise<void> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  if (!key.startsWith(`${tenantId}/`)) {
    throw new BusinessLogicError("That photo does not belong to this account");
  }
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}

export type ImageTargetKind = "item" | "variant";

export interface UploadTicket {
  uploadUrl: string; // pre-signed PUT URL — client uploads bytes here (no creds)
  publicUrl: string; // permanent public URL to persist on the item/variant
  key: string; // object key within the bucket
  contentType: string;
  expiresIn: number; // seconds the uploadUrl is valid for
}

/**
 * Mint a pre-signed PUT URL for a tenant's item/variant image.
 *
 * The key is STABLE per target (one object per item/variant) → clean storage,
 * no orphans on re-upload. Because the public URL is reused, callers should
 * cache-bust on display with `?v=<updatedAt>`.
 */
export async function createImageUploadTicket(params: {
  tenantId: number;
  kind: ImageTargetKind;
  targetId: number;
  contentType: string;
  contentLength?: number; // compressed byte size the client is about to PUT
}): Promise<UploadTicket> {
  const { tenantId, kind, targetId, contentType, contentLength } = params;

  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (!bucket || !publicBase) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  if (contentType !== ALLOWED_CONTENT_TYPE) {
    throw new BusinessLogicError(
      `Unsupported content type '${contentType}'. Only ${ALLOWED_CONTENT_TYPE} is allowed.`
    );
  }

  const folder = kind === "variant" ? "variants" : "items";
  const key = `${tenantId}/${folder}/${targetId}.webp`;

  // Hard cap: project usage AFTER this upload and block if it would exceed the
  // limit. Exclude THIS key from current usage (uploads replace in place via the
  // stable key, so the old object's bytes are superseded, not added). When the
  // client doesn't report a size, fall back to the over-limit guard on its own.
  const incoming =
    typeof contentLength === "number" && contentLength > 0 ? contentLength : 0;
  const usedExcludingTarget = await getStorageUsage(tenantId, key);
  if (usedExcludingTarget + incoming > CATALOGUE_STORAGE_LIMIT_BYTES) {
    throw new CatalogueStorageLimitError(
      "Storage limit reached. Delete some product photos before uploading more."
    );
  }

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  const publicUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    contentType,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  };
}

export type BrandingKind = "logo" | "cover";

/**
 * Mint a pre-signed PUT URL for a tenant's storefront branding image
 * (logo or cover). Stable key `<tenantId>/branding/<kind>.webp` → one object
 * per slot, replaced in place on re-upload. Counts against the tenant's
 * catalogue storage cap like any other object under `<tenantId>/`.
 */
export async function createBrandingUploadTicket(params: {
  tenantId: number;
  kind: BrandingKind;
  contentType: string;
  contentLength?: number;
}): Promise<UploadTicket> {
  const { tenantId, kind, contentType, contentLength } = params;

  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (!bucket || !publicBase) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  if (contentType !== ALLOWED_CONTENT_TYPE) {
    throw new BusinessLogicError(
      `Unsupported content type '${contentType}'. Only ${ALLOWED_CONTENT_TYPE} is allowed.`
    );
  }

  const key = `${tenantId}/branding/${kind}.webp`;

  const incoming =
    typeof contentLength === "number" && contentLength > 0 ? contentLength : 0;
  const usedExcludingTarget = await getStorageUsage(tenantId, key);
  if (usedExcludingTarget + incoming > CATALOGUE_STORAGE_LIMIT_BYTES) {
    throw new CatalogueStorageLimitError(
      "Storage limit reached. Delete some product photos before uploading more."
    );
  }

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  const publicUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key, contentType, expiresIn: UPLOAD_URL_TTL_SECONDS };
}

/**
 * Mint a pre-signed PUT URL for a LAUNDRY condition photo.
 *
 * ⛔ Load-bearing key shape: the key MUST be top-level `laundry/<tenantId>/<orderRef>/<n>.webp`.
 * The LIVE R2 object-lifecycle rule ("Flush Laundry Images") expires the
 * `laundry/` prefix at 60 days — objects under any other prefix would linger
 * forever, and catalogue images (keyed `<tenantId>/…`) must NOT match it. See
 * docs/modules/SALES.md and reference_cloudflare_infra.md.
 */
export async function createLaundryPhotoUploadTicket(params: {
  tenantId: number;
  orderRef: string;
  index: number;
  contentType: string;
}): Promise<UploadTicket> {
  const { tenantId, orderRef, index, contentType } = params;

  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (!bucket || !publicBase) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  if (contentType !== ALLOWED_CONTENT_TYPE) {
    throw new BusinessLogicError(
      `Unsupported content type '${contentType}'. Only ${ALLOWED_CONTENT_TYPE} is allowed.`
    );
  }
  // Sanitize orderRef for safe key usage (UUIDs are already safe; guard anyway).
  const safeRef = orderRef.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeRef) {
    throw new BusinessLogicError("Invalid orderRef");
  }

  const key = `laundry/${tenantId}/${safeRef}/${index}.webp`;

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  const publicUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    contentType,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  };
}

const RECEIPT_CONTENT_TYPE = "application/pdf";

/**
 * Mint a pre-signed PUT URL for a digital receipt PDF.
 *
 * ⛔ Load-bearing key shape: ONE stable object per order —
 * `receipts/<tenantId>/<orderRef>.pdf`. The payment receipt and the later
 * pickup receipt (received-by + date) are the SAME order, so the pickup PDF
 * overwrites the payment PDF in place: exactly one receipt per order in R2, and
 * the shared WhatsApp link always resolves to the latest state. Overwriting
 * also resets the object's age, so an actively re-sent receipt keeps a fresh
 * retention window.
 *
 * The `receipts/` prefix is expired at 60 days by the LIVE R2 object-lifecycle
 * rule "Flush Receipts" (mirrors "Flush Laundry Images" on `laundry/`) — see
 * tools/ensure-receipt-lifecycle.ts, docs/modules/SALES.md and
 * reference_cloudflare_infra.md. Receipts fall OUTSIDE the `<tenantId>/`
 * catalogue prefix so they never count against the catalogue storage cap.
 */
export async function createReceiptUploadTicket(params: {
  tenantId: number;
  orderRef: string;
  contentType?: string;
}): Promise<UploadTicket> {
  const { tenantId, orderRef } = params;
  const contentType = params.contentType ?? RECEIPT_CONTENT_TYPE;

  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (!bucket || !publicBase) {
    throw new BusinessLogicError("R2 storage is not configured on the server");
  }
  if (contentType !== RECEIPT_CONTENT_TYPE) {
    throw new BusinessLogicError(
      `Unsupported content type '${contentType}'. Only ${RECEIPT_CONTENT_TYPE} is allowed.`
    );
  }
  // Sanitize orderRef for safe key usage (UUIDs are already safe; guard anyway).
  const safeRef = orderRef.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeRef) {
    throw new BusinessLogicError("Invalid orderRef");
  }

  const key = `receipts/${tenantId}/${safeRef}.pdf`;

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  const publicUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    contentType,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  };
}
