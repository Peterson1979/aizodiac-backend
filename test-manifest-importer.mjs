// test-manifest-importer.mjs
import assert from "node:assert/strict";
import { importManifestBatch } from "./scripts/import-social-manifests.mjs";
import { getManifestKey } from "./lib/social/stateHelper.js";
import { resolveManifestForDate } from "./lib/social/contentManifest.js";
import { executeSocialPublishing } from "./lib/social/publishCoordinator.js";
import { PLATFORMS, PUBLISH_STATUS, MEDIA_TYPES } from "./lib/social/types.js";
import { getSocialConfig } from "./lib/social/config.js";

console.log("==================================================");
console.log("RUNNING SOCIAL MANIFEST BATCH IMPORTER TEST SUITE");
console.log("==================================================");

/**
 * In-Memory Mock Redis tracking all key reads, writes, and expirations.
 */
class MockRedis {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
    this.writes = [];
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async set(key, value, options = {}) {
    this.writes.push({ key, value: String(value), options });
    this.store.set(key, String(value));
    if (options.ex) {
      this.expirations.set(key, options.ex);
    }
    return "OK";
  }

  async del(key) {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async eval(script, keys, args) {
    const key = keys[0];
    const expected = String(args[0]);
    if (this.store.get(key) === expected) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
}

// Sample test batch data
const validBatch = [
  {
    date: "2026-09-01",
    id: "m_2026_09_01",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://media.example.invalid/img1.png", altText: "Day 1" }],
    captions: {
      instagram: "IG 1",
      facebook: "FB 1",
      pinterest: { title: "Pin 1", description: "Desc 1", link: "https://aizodiac.app" },
    },
  },
  {
    date: "2026-09-02",
    id: "m_2026_09_02",
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://media.example.invalid/slide1.png" },
      { url: "https://media.example.invalid/slide2.png" },
    ],
    captions: {
      instagram: "IG 2",
      facebook: "FB 2",
      pinterest: { title: "Pin 2", description: "Desc 2", link: "https://aizodiac.app" },
    },
  },
  {
    date: "2026-09-03",
    id: "m_2026_09_03",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://media.example.invalid/img3.png" }],
    captions: {
      instagram: "IG 3",
      facebook: "FB 3",
      pinterest: { title: "Pin 3", description: "Desc 3", link: "https://aizodiac.app" },
    },
  },
];

// ============================================================================
// TEST 1: Valid Multi-Day Batch in Dry-Run Mode (Zero Redis Writes)
// ============================================================================
{
  console.log("\n[TEST 1] Valid Multi-Day Batch in Dry-Run Mode");

  const redis = new MockRedis();
  const res = await importManifestBatch({
    manifests: validBatch,
    redis,
    apply: false,
  });

  assert.equal(res.success, true);
  assert.equal(res.dryRun, true);
  assert.equal(res.total, 3);
  assert.equal(res.validated, 3);
  assert.equal(res.imported, 0, "Dry-run must import 0 items");
  assert.equal(redis.writes.length, 0, "Dry-run must perform zero Redis writes");

  console.log("  ✓ Dry-run validation passed with zero Redis writes");
}

// ============================================================================
// TEST 2: Invalid Entry Rejects Entire Batch (Fail-Closed)
// ============================================================================
{
  console.log("\n[TEST 2] Invalid Entry Rejects Entire Batch (Fail-Closed)");

  const redis = new MockRedis();
  const corruptBatch = [
    ...validBatch,
    {
      date: "2026-09-04",
      id: "m_2026_09_04",
      type: "invalid_type", // Invalid type!
      media: [],
      captions: {},
    },
  ];

  const res = await importManifestBatch({
    manifests: corruptBatch,
    redis,
    apply: true,
  });

  assert.equal(res.success, false);
  assert.equal(res.validated, 0);
  assert.ok(res.errors.length > 0);
  assert.equal(redis.writes.length, 0, "No Redis writes allowed when batch has errors");

  console.log("  ✓ Entire batch rejected when a single entry is invalid (0 writes)");
}

// ============================================================================
// TEST 3: Duplicate Dates & Conflicting Manifest IDs Rejection
// ============================================================================
{
  console.log("\n[TEST 3] Duplicate Dates & Conflicting Manifest IDs Rejection");

  const redis = new MockRedis();

  // Duplicate dates
  const dupDateBatch = [
    validBatch[0],
    { ...validBatch[1], date: "2026-09-01" }, // Duplicate date 2026-09-01
  ];
  const resDupDate = await importManifestBatch({
    manifests: dupDateBatch,
    redis,
    apply: true,
  });
  assert.equal(resDupDate.success, false);
  assert.ok(resDupDate.errors.some(e => e.includes("Duplicate date")));

  // Duplicate IDs
  const dupIdBatch = [
    validBatch[0],
    { ...validBatch[1], id: validBatch[0].id }, // Duplicate ID
  ];
  const resDupId = await importManifestBatch({
    manifests: dupIdBatch,
    redis,
    apply: true,
  });
  assert.equal(resDupId.success, false);
  assert.ok(resDupId.errors.some(e => e.includes("Duplicate manifest ID")));

  console.log("  ✓ Duplicate dates and conflicting manifest IDs within batch rejected");
}

// ============================================================================
// TEST 4: Apply Writes Only Manifest Namespace Keys & Preserves Existing
// ============================================================================
{
  console.log("\n[TEST 4] Apply Writes to Manifest Namespace & Preserves Existing");

  const redis = new MockRedis();

  // 1. Initial Apply Import
  const res1 = await importManifestBatch({
    manifests: validBatch,
    redis,
    apply: true,
    overwrite: false,
  });

  assert.equal(res1.success, true);
  assert.equal(res1.imported, 3);
  assert.equal(res1.skipped, 0);
  assert.equal(redis.writes.length, 3);

  // Verify all written keys match exact namespace: aiz:social:manifest:<YYYY-MM-DD>
  for (const write of redis.writes) {
    assert.ok(write.key.startsWith("aiz:social:manifest:2026-09-0"));
    assert.equal(write.options.ex, 180 * 86400, "Must have 180-day retention");
  }

  // 2. Re-importing same batch without --overwrite should skip existing
  const res2 = await importManifestBatch({
    manifests: validBatch,
    redis,
    apply: true,
    overwrite: false,
  });

  assert.equal(res2.success, true);
  assert.equal(res2.imported, 0, "Should import 0 existing items");
  assert.equal(res2.skipped, 3, "Should skip all 3 existing items");

  // 3. Re-importing with --overwrite should overwrite existing
  const res3 = await importManifestBatch({
    manifests: validBatch,
    redis,
    apply: true,
    overwrite: true,
  });

  assert.equal(res3.success, true);
  assert.equal(res3.imported, 3, "Should overwrite 3 existing items");
  assert.equal(res3.skipped, 0);

  console.log("  ✓ Manifests written strictly to aiz:social:manifest:<date> namespace");
  console.log("  ✓ Existing records preserved by default; overwritten only with explicit flag");
}

// ============================================================================
// TEST 5: Sample Fixture File Import Test (fixtures/sample-social-batch.json)
// ============================================================================
{
  console.log("\n[TEST 5] Sample Batch Fixture Import from File");

  const redis = new MockRedis();
  const res = await importManifestBatch({
    filePath: "./fixtures/sample-social-batch.json",
    redis,
    apply: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.imported, 3);

  // Verify stored manifests can be loaded via resolveManifestForDate
  const loadedManifest = await resolveManifestForDate("2026-09-01", { redis });
  assert.ok(loadedManifest);
  assert.equal(loadedManifest.id, "manifest_2026_09_01_virgo_overview");
  assert.equal(loadedManifest.type, "single_image");
  assert.ok(loadedManifest.captions.instagram.includes("Virgo Season Alignment"));

  console.log("  ✓ fixtures/sample-social-batch.json verified and loaded from Redis");
}

// ============================================================================
// TEST 6: Production Coordinator Loads Imported Redis Manifest End-to-End
// ============================================================================
{
  console.log("\n[TEST 6] End-to-End: Coordinator Loads Imported Manifest & Executes");

  const redis = new MockRedis();

  // Import manifest into Redis
  await importManifestBatch({
    manifests: [validBatch[0]],
    redis,
    apply: true,
  });

  const config = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_test",
    metaPageId: "page_123",
    instagramAccountId: "ig_456",
    pinterestAccessToken: "pina_test",
    pinterestBoardId: "board_789",
    pinterestAccessTier: "standard",
  });

  const mockAdapters = {
    [PLATFORMS.INSTAGRAM]: {
      publish: async () => ({ success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_e2e_1" }),
    },
    [PLATFORMS.FACEBOOK]: {
      publish: async () => ({ success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_e2e_1" }),
    },
    [PLATFORMS.PINTEREST]: {
      publish: async () => ({ success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_e2e_1" }),
    },
  };

  // Run publishCoordinator with targetDate = 2026-09-01 (loads manifest directly from Redis!)
  const coordResult = await executeSocialPublishing({
    redis,
    config,
    targetDate: "2026-09-01",
    adapters: mockAdapters,
  });

  assert.equal(coordResult.success, true);
  assert.equal(coordResult.manifestId, "m_2026_09_01");
  assert.equal(coordResult.results.instagram.postId, "ig_e2e_1");
  assert.equal(coordResult.results.facebook.postId, "fb_e2e_1");
  assert.equal(coordResult.results.pinterest.postId, "pin_e2e_1");

  console.log("  ✓ publishCoordinator seamlessly resolved and executed manifest from Redis");
}

// ============================================================================
// TEST 7: Ambiguous Provider Write Handling & Zero Unintended Repost
// ============================================================================
{
  console.log("\n[TEST 7] Ambiguous Write Handling & Zero Unintended Repost");

  const redis = new MockRedis();

  await importManifestBatch({
    manifests: [validBatch[0]],
    redis,
    apply: true,
  });

  const config = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_test",
    metaPageId: "page_123",
    instagramAccountId: "ig_456",
    pinterestAccessToken: "pina_test",
    pinterestBoardId: "board_789",
    pinterestAccessTier: "standard",
  });

  let igCalls = 0;
  let fbCalls = 0;

  const mockAdapters = {
    [PLATFORMS.INSTAGRAM]: {
      publish: async () => {
        igCalls++;
        // Confirmed published
        return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_confirmed" };
      },
    },
    [PLATFORMS.FACEBOOK]: {
      publish: async () => {
        fbCalls++;
        // Ambiguous write failure (e.g. connection dropped after write)
        return {
          success: false,
          status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
          reconciliationData: { reason: "AMBIGUOUS_TRANSPORT_FAILURE" },
        };
      },
    },
    [PLATFORMS.PINTEREST]: {
      publish: async () => ({ success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_confirmed" }),
    },
  };

  // First run: Instagram succeeds, Facebook is ambiguous
  const run1 = await executeSocialPublishing({
    redis,
    config,
    targetDate: "2026-09-01",
    adapters: mockAdapters,
  });

  assert.equal(run1.status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);
  assert.equal(igCalls, 1);
  assert.equal(fbCalls, 1);

  // Second run: Retry without manual reconciliation
  const run2 = await executeSocialPublishing({
    redis,
    config,
    targetDate: "2026-09-01",
    adapters: mockAdapters,
  });

  // CRITICAL ASSERTION: Neither Instagram nor Facebook were called again!
  assert.equal(igCalls, 1, "Confirmed published destination MUST NOT be called again");
  assert.equal(fbCalls, 1, "Ambiguous write destination MUST NOT be automatically retried");
  assert.equal(run2.skipped.instagram.reason, "ALREADY_PUBLISHED");
  assert.equal(run2.skipped.facebook.reason, "AMBIGUOUS_STATE_RECONCILIATION_REQUIRED");

  console.log("  ✓ Confirmed PUBLISHED destination skipped on subsequent invocations");
  console.log("  ✓ Ambiguous writes safely held in RECONCILIATION_REQUIRED without automatic repost");
}

console.log("\n==================================================");
console.log("ALL MANIFEST IMPORTER TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
