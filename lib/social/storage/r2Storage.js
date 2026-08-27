// lib/social/storage/r2Storage.js
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

export const DEFAULT_R2_BUCKET_NAME = "aizodiac-social";
export const DEFAULT_R2_PUBLIC_BASE_URL = "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev";

/**
 * Loads and normalizes Cloudflare R2 configuration from environment or overrides.
 * @param {object} [overrides={}]
 * @returns {object}
 */
export function getR2Config(overrides = {}) {
  const env = process.env || {};

  return {
    accountId: overrides.accountId ?? env.R2_ACCOUNT_ID ?? "",
    accessKeyId: overrides.accessKeyId ?? env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: overrides.secretAccessKey ?? env.R2_SECRET_ACCESS_KEY ?? "",
    bucketName: overrides.bucketName ?? env.R2_BUCKET_NAME ?? DEFAULT_R2_BUCKET_NAME,
    publicBaseUrl: (overrides.publicBaseUrl ?? env.R2_PUBLIC_BASE_URL ?? DEFAULT_R2_PUBLIC_BASE_URL).replace(/\/+$/, ""),
  };
}

/**
 * Validates whether required R2 credentials are present.
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateR2Config(config) {
  const errors = [];
  if (!config.accountId) errors.push("Missing R2_ACCOUNT_ID");
  if (!config.accessKeyId) errors.push("Missing R2_ACCESS_KEY_ID");
  if (!config.secretAccessKey) errors.push("Missing R2_SECRET_ACCESS_KEY");
  if (!config.bucketName) errors.push("Missing R2_BUCKET_NAME");

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates an S3Client configured for Cloudflare R2.
 * @param {object} config - Loaded R2 config
 * @returns {S3Client}
 */
export function createR2Client(config) {
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error("Cannot create R2 client: missing required credentials");
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Constructs the canonical public URL for an R2 object key.
 * @param {string} key - e.g. "social/2026/09/01/slide-01.png"
 * @param {string} [publicBaseUrl=DEFAULT_R2_PUBLIC_BASE_URL]
 * @returns {string} - e.g. "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/2026/09/01/slide-01.png"
 */
export function getPublicR2Url(key, publicBaseUrl = DEFAULT_R2_PUBLIC_BASE_URL) {
  const cleanBase = String(publicBaseUrl || DEFAULT_R2_PUBLIC_BASE_URL).replace(/\/+$/, "");
  const cleanKey = String(key || "").replace(/^\/+/, "");
  return `${cleanBase}/${cleanKey}`;
}

/**
 * Checks if an object already exists in the R2 bucket using HeadObject.
 * @param {object} params
 * @param {S3Client} params.s3Client
 * @param {string} params.bucketName
 * @param {string} params.key
 * @returns {Promise<boolean>}
 */
export async function checkObjectExists({ s3Client, bucketName, key }) {
  if (!s3Client || !bucketName || !key) return false;

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // For other errors (e.g. auth error, network), rethrow so caller handles it
    throw err;
  }
}

/**
 * Uploads a single Buffer to Cloudflare R2.
 * @param {object} params
 * @param {S3Client} params.s3Client
 * @param {string} params.bucketName
 * @param {string} params.key
 * @param {Buffer} params.buffer
 * @param {string} [params.contentType="image/png"]
 * @param {string} [params.publicBaseUrl]
 * @returns {Promise<{ key: string, url: string, sizeBytes: number }>}
 */
export async function uploadBufferToR2({
  s3Client,
  bucketName,
  key,
  buffer,
  contentType = "image/png",
  publicBaseUrl = DEFAULT_R2_PUBLIC_BASE_URL,
}) {
  if (!s3Client) {
    throw new Error("Missing S3 client instance for R2 upload");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return {
    key,
    url: getPublicR2Url(key, publicBaseUrl),
    sizeBytes: buffer.length,
  };
}

/**
 * Uploads rendered carousel slides to Cloudflare R2 with idempotency and dry-run support.
 * @param {object} params
 * @param {Array<object>} params.slides - Rendered slide records with buffer & key
 * @param {object} [params.r2Config] - R2 configuration
 * @param {S3Client} [params.s3Client=null] - Mock or real S3Client instance
 * @param {boolean} [params.dryRun=false] - If true, performs zero network writes
 * @param {boolean} [params.overwriteExisting=false] - Whether to re-upload existing objects
 * @returns {Promise<Array<{ url: string, key: string, slideNumber: number, altText: string, sizeBytes: number, alreadyExisted: boolean }>>}
 */
export async function uploadCarouselSlides({
  slides,
  r2Config: r2ConfigOverrides = {},
  s3Client = null,
  dryRun = false,
  overwriteExisting = false,
}) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error("No slides provided for R2 upload");
  }

  const config = getR2Config(r2ConfigOverrides);

  // If dry-run mode, construct public URLs without any S3 client or network interaction
  if (dryRun) {
    return slides.map(slide => ({
      slideNumber: slide.slideNumber,
      key: slide.key,
      url: getPublicR2Url(slide.key, config.publicBaseUrl),
      altText: slide.altText || "",
      sizeBytes: slide.buffer?.length || 0,
      alreadyExisted: false,
      dryRun: true,
    }));
  }

  // Real upload mode: require valid S3 client
  let client = s3Client;
  if (!client) {
    const validation = validateR2Config(config);
    if (!validation.valid) {
      const err = new Error(`R2 Configuration invalid: ${validation.errors.join(", ")}`);
      err.status = 500;
      throw err;
    }
    client = createR2Client(config);
  }

  const results = [];

  for (const slide of slides) {
    let alreadyExisted = false;

    if (!overwriteExisting) {
      try {
        const exists = await checkObjectExists({
          s3Client: client,
          bucketName: config.bucketName,
          key: slide.key,
        });

        if (exists) {
          alreadyExisted = true;
          results.push({
            slideNumber: slide.slideNumber,
            key: slide.key,
            url: getPublicR2Url(slide.key, config.publicBaseUrl),
            altText: slide.altText || "",
            sizeBytes: slide.buffer?.length || 0,
            alreadyExisted: true,
          });
          continue;
        }
      } catch (checkErr) {
        console.warn(`⚠️ Warning checking R2 object existence for ${slide.key}:`, checkErr.message);
      }
    }

    const uploadRes = await uploadBufferToR2({
      s3Client: client,
      bucketName: config.bucketName,
      key: slide.key,
      buffer: slide.buffer,
      contentType: slide.mimeType || "image/png",
      publicBaseUrl: config.publicBaseUrl,
    });

    results.push({
      slideNumber: slide.slideNumber,
      key: slide.key,
      url: uploadRes.url,
      altText: slide.altText || "",
      sizeBytes: uploadRes.sizeBytes,
      alreadyExisted: false,
    });
  }

  return results;
}
