import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BusinessLogicError } from "../api-helpers/error";

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

// Per-tenant R2 storage cap (abuse guardrail, NOT a billing axis). At ~100KB/WebP
// this is ~5,000 images — generous for a catalogue, protects the free 10GB tier.
export const CATALOGUE_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB

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
export async function getStorageUsage(tenantId: number): Promise<number> {
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
      total += obj.Size ?? 0;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return total;
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
}): Promise<UploadTicket> {
  const { tenantId, kind, targetId, contentType } = params;

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

  // Abuse guardrail: block new uploads once over the per-tenant cap.
  const used = await getStorageUsage(tenantId);
  if (used >= CATALOGUE_STORAGE_LIMIT_BYTES) {
    throw new BusinessLogicError(
      "Storage limit reached. Delete some product photos before uploading more."
    );
  }

  const folder = kind === "variant" ? "variants" : "items";
  const key = `${tenantId}/${folder}/${targetId}.webp`;

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
