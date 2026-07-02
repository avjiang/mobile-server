/**
 * One-off: upload the BayarYuk display font (Gilroy Bold) to R2 and configure
 * bucket CORS so the public catalogue page (<slug>.bayaryuk.net) can load it
 * cross-origin from images.bayaryuk.net. R2 is a single bucket shared by local
 * + prod, so running this once provisions both.
 *
 * Run: npx tsx -r dotenv/config scripts/upload_brand_font.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import {
  S3Client,
  PutObjectCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";

const FONT_SRC =
  "/Users/m1_macmini/Development/bayaryuk-frontend/assets/fonts/Gilroy-Bold.ttf";
const FONT_KEY = "fonts/gilroy-bold.ttf";

async function main() {
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

  const body = readFileSync(FONT_SRC);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: FONT_KEY,
      Body: body,
      ContentType: "font/ttf",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  console.log(`Uploaded ${FONT_KEY} (${body.length} bytes)`);

  // Allow cross-origin GET of static assets (fonts) from any https origin so the
  // <slug>.bayaryuk.net page can use @font-face. R2 images themselves don't need
  // CORS for <img>, but @font-face fetches are CORS-checked.
  // NOTE: the object-scoped R2 token used by the app CANNOT set bucket CORS
  // (PutBucketCors → 403 AccessDenied). Set this rule ONCE in the Cloudflare
  // dashboard (R2 → bucket → Settings → CORS Policy) instead. Until then the
  // page's @font-face falls back to system fonts via font-display:swap.
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["https://*.bayaryuk.net", "https://bayaryuk.net"],
              AllowedMethods: ["GET", "HEAD"],
              AllowedHeaders: ["*"],
              MaxAgeSeconds: 86400,
            },
          ],
        },
      })
    );
    console.log("CORS configured (GET/HEAD from *.bayaryuk.net)");
  } catch (e: any) {
    console.warn(
      `CORS NOT set (${e?.Code || e?.name || "error"}) — set it manually in the ` +
        `Cloudflare R2 dashboard: AllowedOrigins https://*.bayaryuk.net, Methods GET/HEAD.`
    );
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
