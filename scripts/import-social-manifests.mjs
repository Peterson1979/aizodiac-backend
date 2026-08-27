// scripts/import-social-manifests.mjs
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Redis } from "@upstash/redis";
import { validateManifest, normalizeManifest } from "../lib/social/contentManifest.js";
import { getManifestKey, SOCIAL_AUTH_TTL_SECONDS } from "../lib/social/stateHelper.js";
import { redactSecrets } from "../lib/social/config.js";

export const MANIFEST_RETENTION_SECONDS = SOCIAL_AUTH_TTL_SECONDS; // 180 days retention

/**
 * Core validation and batch import engine.
 * @param {object} params
 * @param {Array<object>} [params.manifests] - Array of manifest objects
 * @param {string} [params.filePath] - Path to JSON file
 * @param {object} [params.redis] - Redis client instance
 * @param {boolean} [params.apply=false] - If true, commits writes to Redis; otherwise dry-run
 * @param {boolean} [params.overwrite=false] - If true, overwrites existing Redis manifest keys
 * @param {string} [params.mediaBaseUrl=""] - Base URL for relative media paths
 * @returns {Promise<{
 *   success: boolean,
 *   dryRun: boolean,
 *   total: number,
 *   validated: number,
 *   imported: number,
 *   skipped: number,
 *   errors: string[],
 *   items: Array<object>
 * }>}
 */
export async function importManifestBatch({
  manifests = null,
  filePath = null,
  redis = null,
  apply = false,
  overwrite = false,
  mediaBaseUrl = "",
} = {}) {
  // 1. Load data from file if provided
  let batchData = manifests;
  if (!batchData && filePath) {
    const fullPath = resolve(process.cwd(), filePath);
    try {
      const fileContent = await readFile(fullPath, "utf8");
      batchData = JSON.parse(fileContent);
    } catch (readErr) {
      return {
        success: false,
        dryRun: !apply,
        total: 0,
        validated: 0,
        imported: 0,
        skipped: 0,
        errors: [`Failed to read or parse JSON file at ${fullPath}: ${readErr.message}`],
        items: [],
      };
    }
  }

  // Normalize batch structure (supports array or { manifests: [...] } or { batch: [...] })
  let items = [];
  if (Array.isArray(batchData)) {
    items = batchData;
  } else if (batchData && Array.isArray(batchData.manifests)) {
    items = batchData.manifests;
  } else if (batchData && Array.isArray(batchData.batch)) {
    items = batchData.batch;
  } else {
    return {
      success: false,
      dryRun: !apply,
      total: 0,
      validated: 0,
      imported: 0,
      skipped: 0,
      errors: ["Manifest batch must be a JSON array or an object containing a 'manifests' array"],
      items: [],
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      dryRun: !apply,
      total: 0,
      validated: 0,
      imported: 0,
      skipped: 0,
      errors: ["Manifest batch contains zero items"],
      items: [],
    };
  }

  // 2. Strict Validation & Intra-Batch Conflict Detection
  const validationErrors = [];
  const seenDates = new Map();
  const seenIds = new Map();
  const validatedItems = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const indexPrefix = `[Item index ${i}]`;

    if (!item || typeof item !== "object") {
      validationErrors.push(`${indexPrefix} Manifest must be an object`);
      continue;
    }

    const valResult = validateManifest(item, { mediaBaseUrl });
    if (!valResult.valid) {
      valResult.errors.forEach(err => validationErrors.push(`${indexPrefix} ${err}`));
      continue;
    }

    // Intra-batch duplicate date check
    if (seenDates.has(item.date)) {
      validationErrors.push(
        `${indexPrefix} Duplicate date '${item.date}' in batch (already declared at index ${seenDates.get(item.date)})`
      );
    } else {
      seenDates.set(item.date, i);
    }

    // Intra-batch duplicate ID check
    if (seenIds.has(item.id)) {
      validationErrors.push(
        `${indexPrefix} Duplicate manifest ID '${item.id}' in batch (already declared at index ${seenIds.get(item.id)})`
      );
    } else {
      seenIds.set(item.id, i);
    }

    validatedItems.push(normalizeManifest(item, mediaBaseUrl));
  }

  // ALL-OR-NOTHING: Reject entire batch if ANY item is invalid
  if (validationErrors.length > 0) {
    return {
      success: false,
      dryRun: !apply,
      total: items.length,
      validated: 0,
      imported: 0,
      skipped: 0,
      errors: validationErrors,
      items: [],
    };
  }

  // 3. Dry-Run Mode (Zero Redis Writes)
  if (!apply) {
    return {
      success: true,
      dryRun: true,
      total: validatedItems.length,
      validated: validatedItems.length,
      imported: 0,
      skipped: 0,
      errors: [],
      items: validatedItems.map(m => ({
        date: m.date,
        id: m.id,
        type: m.type,
        mediaCount: m.media.length,
        status: "DRY_RUN_VALIDATED",
      })),
    };
  }

  // 4. Apply Mode: Write Manifests to Redis
  if (!redis) {
    // If not injected, initialize from environment
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      return {
        success: false,
        dryRun: false,
        total: validatedItems.length,
        validated: validatedItems.length,
        imported: 0,
        skipped: 0,
        errors: ["Redis client not configured (Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN)"],
        items: [],
      };
    }
  }

  let importedCount = 0;
  let skippedCount = 0;
  const itemStatuses = [];

  for (const manifest of validatedItems) {
    const key = getManifestKey(manifest.date);

    try {
      const existing = await redis.get(key);

      if (existing && !overwrite) {
        skippedCount++;
        itemStatuses.push({
          date: manifest.date,
          id: manifest.id,
          redisKey: key,
          status: "SKIPPED_ALREADY_EXISTS",
        });
        continue;
      }

      const sanitizedManifest = redactSecrets(manifest);
      await redis.set(key, JSON.stringify(sanitizedManifest), {
        ex: MANIFEST_RETENTION_SECONDS,
      });

      importedCount++;
      itemStatuses.push({
        date: manifest.date,
        id: manifest.id,
        redisKey: key,
        status: existing ? "OVERWRITTEN" : "IMPORTED",
      });
    } catch (writeErr) {
      validationErrors.push(`Failed to write manifest for ${manifest.date} to Redis: ${writeErr.message}`);
      itemStatuses.push({
        date: manifest.date,
        id: manifest.id,
        redisKey: key,
        status: "WRITE_ERROR",
        error: writeErr.message,
      });
    }
  }

  const allSucceeded = validationErrors.length === 0;

  return {
    success: allSucceeded,
    dryRun: false,
    total: validatedItems.length,
    validated: validatedItems.length,
    imported: importedCount,
    skipped: skippedCount,
    errors: validationErrors,
    items: itemStatuses,
  };
}

// --- CLI Execution Handler ---
async function runCli() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
AI Zodiac Social Manifest Batch Importer (Local CLI)
====================================================
Usage:
  node scripts/import-social-manifests.mjs <path-to-batch.json> [options]

Options:
  --apply          Actually write validated manifests to Redis (Default: dry-run mode)
  --overwrite      Overwrite existing manifests for the same date in Redis
  --base-url=<url> Base URL to resolve relative media URLs against
  --help, -h       Show this help message

Examples:
  # Dry-run validation of a 30-day batch (zero Redis writes)
  node scripts/import-social-manifests.mjs fixtures/sample-social-batch.json

  # Apply batch to Redis (preserves existing scheduled dates)
  node scripts/import-social-manifests.mjs fixtures/sample-social-batch.json --apply

  # Apply batch with explicit overwrite of existing dates
  node scripts/import-social-manifests.mjs fixtures/sample-social-batch.json --apply --overwrite
`);
    process.exit(0);
  }

  let filePath = null;
  let apply = false;
  let overwrite = false;
  let mediaBaseUrl = "";

  for (const arg of args) {
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--overwrite") {
      overwrite = true;
    } else if (arg.startsWith("--base-url=")) {
      mediaBaseUrl = arg.split("=")[1];
    } else if (arg.startsWith("--file=")) {
      filePath = arg.split("=")[1];
    } else if (!arg.startsWith("--") && !filePath) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error("❌ Error: No JSON manifest file specified. Use --help for usage.");
    process.exit(1);
  }

  console.log("==================================================");
  console.log(`AI ZODIAC MANIFEST BATCH IMPORTER [${apply ? "APPLY MODE" : "DRY-RUN MODE"}]`);
  console.log("==================================================");
  console.log(`File:       ${filePath}`);
  console.log(`Action:     ${apply ? "WRITE TO REDIS" : "DRY-RUN VALIDATION ONLY (Zero Redis writes)"}`);
  console.log(`Overwrite:  ${overwrite ? "YES" : "NO (Existing dates preserved)"}`);
  if (mediaBaseUrl) console.log(`Base URL:   ${mediaBaseUrl}`);
  console.log("--------------------------------------------------");

  const result = await importManifestBatch({
    filePath,
    apply,
    overwrite,
    mediaBaseUrl,
  });

  if (!result.success) {
    console.error(`\n❌ Batch validation or import failed with ${result.errors.length} error(s):`);
    result.errors.forEach((err, i) => console.error(`   ${i + 1}. ${err}`));
    process.exit(1);
  }

  if (result.dryRun) {
    console.log(`\n✅ DRY-RUN COMPLETE: All ${result.validated} manifest(s) are valid and ready to import.`);
    console.log("Zero Redis writes were performed.\n");
    console.table(result.items);
    console.log("\nTo commit these manifests to Redis, re-run with --apply:");
    console.log(`  node scripts/import-social-manifests.mjs ${filePath} --apply\n`);
  } else {
    console.log(`\n🎉 IMPORT COMPLETE:`);
    console.log(`   - Total Validated: ${result.validated}`);
    console.log(`   - Newly Imported:  ${result.imported}`);
    console.log(`   - Skipped (Exist): ${result.skipped}`);
    console.log("");
    console.table(result.items);
    console.log("");
  }
}

// Run CLI when invoked directly from command line
if (process.argv[1] && process.argv[1].endsWith("import-social-manifests.mjs")) {
  runCli().catch(err => {
    console.error("❌ Unexpected CLI error:", err.message || err);
    process.exit(1);
  });
}
