/**
 * Idempotent: ensure the R2 object-lifecycle rule "Flush Receipts" exists so
 * digital-receipt PDFs keyed `receipts/<tenantId>/<orderRef>.pdf` auto-expire at
 * 60 days — mirroring the existing "Flush Laundry Images" rule on `laundry/`.
 *
 * SAFE by construction: it GETs the current lifecycle configuration, appends
 * (or updates) ONLY the receipts rule, and PUTs the full set back — every other
 * rule (notably "Flush Laundry Images") is preserved verbatim. Re-running is a
 * no-op once the rule is present with the right prefix + age.
 *
 * The R2 bucket is a single bucket shared by local + prod, so running this once
 * provisions both environments.
 *
 *   Inspect only (no write):  npx tsx -r dotenv/config scripts/ensure-receipt-lifecycle.ts --dry-run
 *   Apply:                    npx tsx -r dotenv/config scripts/ensure-receipt-lifecycle.ts
 *
 * ⚠️ TOKEN SCOPE: bucket-lifecycle is an ADMIN operation. The app's default
 * `R2_*` creds are an "Object Read & Write" token and get **403 AccessDenied**
 * here (they can PUT object bytes, not edit bucket config). Either run this with
 * an "Admin Read & Write" R2 token in `R2_ACCESS_KEY_ID/SECRET`, OR — the normal
 * path, matching how "Flush Laundry Images" was created — add the rule in the
 * **Cloudflare dashboard**: R2 → <bucket> → Settings → Object lifecycle rules →
 * Add rule: name "Flush Receipts", prefix `receipts/`, "Delete objects" after
 * **60 days**. This script stays the source of truth for the intended rule.
 *
 * See docs/future/LAUNDRY_DIGITAL_RECEIPT.md §2 and reference_cloudflare_infra.md.
 */
import "dotenv/config";
import {
  S3Client,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  type LifecycleRule,
} from "@aws-sdk/client-s3";

const RECEIPT_RULE_ID = "Flush Receipts";
const RECEIPT_PREFIX = "receipts/";
const RECEIPT_EXPIRY_DAYS = 60;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const endpoint = process.env.R2_ENDPOINT!;
  const bucket = process.env.R2_BUCKET!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_* env vars");
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  // 1. Read the CURRENT rules (R2 throws when none are configured yet).
  let existing: LifecycleRule[] = [];
  try {
    const res = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: bucket })
    );
    existing = res.Rules ?? [];
  } catch (e: any) {
    const code = e?.name ?? e?.Code ?? "";
    if (String(code).includes("NoSuchLifecycleConfiguration")) {
      existing = [];
    } else {
      throw e;
    }
  }

  console.log(`Bucket "${bucket}" currently has ${existing.length} lifecycle rule(s):`);
  for (const r of existing) {
    const prefix = r.Filter?.Prefix ?? (r as any).Prefix ?? "(all)";
    const days = r.Expiration?.Days ?? "-";
    console.log(`  • ${r.ID ?? "(unnamed)"}  prefix=${prefix}  expireDays=${days}  status=${r.Status}`);
  }

  // 2. Is the receipts rule already present and correct?
  const already = existing.find(
    (r) =>
      r.ID === RECEIPT_RULE_ID &&
      (r.Filter?.Prefix ?? (r as any).Prefix) === RECEIPT_PREFIX &&
      r.Expiration?.Days === RECEIPT_EXPIRY_DAYS &&
      r.Status === "Enabled"
  );
  if (already) {
    console.log(`\n✓ "${RECEIPT_RULE_ID}" already configured (${RECEIPT_PREFIX} → ${RECEIPT_EXPIRY_DAYS}d). Nothing to do.`);
    return;
  }

  // 3. Build the desired rule set: keep every non-receipts rule verbatim, then
  //    add our receipts rule (replacing any stale copy of it).
  const receiptRule: LifecycleRule = {
    ID: RECEIPT_RULE_ID,
    Filter: { Prefix: RECEIPT_PREFIX },
    Status: "Enabled",
    Expiration: { Days: RECEIPT_EXPIRY_DAYS },
  };
  const preserved = existing.filter((r) => r.ID !== RECEIPT_RULE_ID);
  const desired = [...preserved, receiptRule];

  console.log(
    `\nWill write ${desired.length} rule(s): ${preserved
      .map((r) => r.ID)
      .join(", ")}${preserved.length ? ", " : ""}${RECEIPT_RULE_ID} (${RECEIPT_PREFIX} → ${RECEIPT_EXPIRY_DAYS}d)`
  );

  if (dryRun) {
    console.log("\n--dry-run: no changes written.");
    return;
  }

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: { Rules: desired },
    })
  );
  console.log(`\n✓ Applied. "${RECEIPT_RULE_ID}" now expires ${RECEIPT_PREFIX} at ${RECEIPT_EXPIRY_DAYS} days.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
