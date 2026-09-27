// test-promo-video-publishing-flow.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DESTINATIONS,
  PUBLISH_STATUS,
  MEDIA_TYPES,
  createDefaultPostState,
} from "./lib/social/types.js";
import {
  getLockKey,
  getPostStateKey,
  getManifestKey,
  getPostState,
  savePostState,
} from "./lib/social/stateHelper.js";
import {
  resolveManifestForDate,
  validateManifest,
} from "./lib/social/contentManifest.js";
import {
  PROMO_VIDEO_START_DATE,
  PROMO_VIDEO_END_DATE,
  PROMO_VIDEO_TOTAL_COUNT,
  PROMO_VIDEO_MANIFESTS_30,
  isPromoVideoCampaignDate,
  getPromoVideoManifestForDate,
  getPromoVideoManifestBySequence,
} from "./lib/social/content/promoVideoRegistry.js";
import {
  executeSocialPublishing,
  createDefaultAdapters,
} from "./lib/social/publishCoordinator.js";
import publishDailyVideoHandler, {
  PROMO_VIDEO_DESTINATIONS,
} from "./api/cron/publishDailyVideo.js";

// In-memory Redis Mock
class MockRedis {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const val = this.store.get(key);
    return val !== undefined ? val : null;
  }

  async set(key, value, options = {}) {
    if (options.nx && this.store.has(key)) {
      return null;
    }
    this.store.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    return "OK";
  }

  async del(key) {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async eval(script, keys = [], args = []) {
    const key = Array.isArray(keys) ? keys[0] : keys;
    const expectedVal = Array.isArray(args) ? args[0] : args;
    const current = this.store.get(key);
    if (current === expectedVal) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("TESTING 30-DAY PROMO VIDEO PUBLISHING FLOW");
  console.log("==================================================");

  // [TEST 1] Promo Video Registry & Exact 1:1 Mapping Verification
  console.log("\n[TEST 1] Promo Video Registry & Date Boundaries");
  assert.equal(PROMO_VIDEO_MANIFESTS_30.length, 30, "Must have exactly 30 video manifests");
  assert.equal(isPromoVideoCampaignDate("2026-09-27"), true, "Start date 2026-09-27 must be valid");
  assert.equal(isPromoVideoCampaignDate("2026-10-26"), true, "End date 2026-10-26 must be valid");
  assert.equal(isPromoVideoCampaignDate("2026-09-26"), false, "2026-09-26 must be outside campaign");
  assert.equal(isPromoVideoCampaignDate("2026-10-27"), false, "2026-10-27 must be outside campaign");

  const v1 = getPromoVideoManifestForDate("2026-09-27");
  assert.ok(v1, "Video 1 manifest must exist");
  assert.equal(v1.metadata.sequenceNumber, 1, "Video 1 sequence must be 1");
  assert.equal(v1.metadata.videoFileName, "1.mp4", "Video 1 file must be 1.mp4");
  assert.equal(v1.metadata.exactSourceTitle, "What does your zodiac sign REALLY say about you?");
  assert.deepEqual(v1.destinations, ["instagram", "facebook", "youtube"]);

  const v30 = getPromoVideoManifestForDate("2026-10-26");
  assert.ok(v30, "Video 30 manifest must exist");
  assert.equal(v30.metadata.sequenceNumber, 30, "Video 30 sequence must be 30");
  assert.equal(v30.metadata.videoFileName, "30.mp4", "Video 30 file must be 30.mp4");
  console.log("  ✓ All 30 video manifests mapped to 2026-09-27 through 2026-10-26");

  // [TEST 2] Manifest Resolution with Stream Isolation
  console.log("\n[TEST 2] Manifest Resolution with Stream Isolation");
  const redis = new MockRedis();

  // Without stream (carousel), resolution for 2026-09-27 checks carousel manifest key
  const carouselManifest = await resolveManifestForDate("2026-09-27", { redis });
  assert.equal(carouselManifest, null, "Carousel manifest must be null when not prepared in Redis");

  // With stream: "video", resolution for 2026-09-27 resolves Video 1
  const videoManifest = await resolveManifestForDate("2026-09-27", { redis, stream: "video" });
  assert.ok(videoManifest, "Video manifest must resolve when stream is 'video'");
  assert.equal(videoManifest.id, "promo-video-2026-09-27");
  assert.equal(videoManifest.media[0].fileName, "1.mp4");
  console.log("  ✓ Stream separation verified: video manifest resolves without affecting carousel");

  // [TEST 3] State Key Namespaces & Lock Isolation
  console.log("\n[TEST 3] State Key Namespaces & Lock Isolation");
  const date = "2026-09-27";
  assert.equal(getLockKey(date, "video"), "aiz:social:lock:video:2026-09-27");
  assert.equal(getLockKey(date), "aiz:social:lock:2026-09-27");
  assert.equal(getPostStateKey(date, "video"), "aiz:social:post:video:2026-09-27");
  assert.equal(getPostStateKey(date), "aiz:social:post:2026-09-27");
  assert.equal(getManifestKey(date, "video"), "aiz:social:manifest:video:2026-09-27");
  assert.equal(getManifestKey(date), "aiz:social:manifest:2026-09-27");
  console.log("  ✓ Keys for video stream are completely isolated from carousel stream");

  // [TEST 4] Dry-Run Publishing Execution for Video 1
  console.log("\n[TEST 4] Dry-Run Publishing Execution for Video 1 (2026-09-27)");
  const dryRunResult = await executeSocialPublishing({
    redis,
    targetDate: "2026-09-27",
    stream: "video",
    platforms: PROMO_VIDEO_DESTINATIONS,
    dryRun: true,
    isCanary: true,
  });

  assert.equal(dryRunResult.success, true);
  assert.equal(dryRunResult.dryRun, true);
  assert.equal(dryRunResult.manifestId, "promo-video-2026-09-27");
  assert.deepEqual(dryRunResult.targetPlatforms, [
    DESTINATIONS.INSTAGRAM_PRIMARY,
    DESTINATIONS.FACEBOOK_PRIMARY,
    DESTINATIONS.YOUTUBE,
  ]);
  assert.equal(redis.store.size, 0, "Dry-run must make 0 Redis writes");
  console.log("  ✓ Dry-run completed with zero writes");

  // [TEST 5] Full Video 1 Publishing Mock Execution (IG + FB + YT)
  console.log("\n[TEST 5] Full Video 1 Publishing Mock Execution (IG + FB + YT)");
  let publishedIG = false;
  let publishedFB = false;
  let publishedYT = false;

  const mockAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish({ manifest }) {
        publishedIG = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "ig_reel_123456",
          containerId: "ig_container_999",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish({ manifest }) {
        publishedFB = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "fb_video_789012",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish({ manifest }) {
        publishedYT = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "yt_video_abcdef",
          publishedAt: new Date().toISOString(),
        };
      },
    },
  };

  const publishResult = await executeSocialPublishing({
    redis,
    targetDate: "2026-09-27",
    stream: "video",
    platforms: PROMO_VIDEO_DESTINATIONS,
    adapters: mockAdapters,
    isCanary: true,
  });

  assert.equal(publishResult.success, true);
  assert.equal(publishResult.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(publishedIG, true, "Instagram Primary must be published");
  assert.equal(publishedFB, true, "Facebook Primary must be published");
  assert.equal(publishedYT, true, "YouTube must be published");

  // Verify state in Redis
  const videoState = await getPostState(redis, "2026-09-27", { stream: "video" });
  assert.ok(videoState, "Video post state must be saved in Redis");
  assert.equal(videoState.overallStatus, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].postId, "ig_reel_123456");
  assert.equal(videoState.platforms[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.FACEBOOK_PRIMARY].postId, "fb_video_789012");
  assert.equal(videoState.platforms[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.YOUTUBE].postId, "yt_video_abcdef");

  // Verify carousel state for the same date is UNTOUCHED (null)
  const carouselState = await getPostState(redis, "2026-09-27");
  assert.equal(carouselState, null, "Carousel state must remain null/untouched");
  console.log("  ✓ Video 1 published to Instagram, Facebook, and YouTube with complete carousel isolation");

  // [TEST 6] Strict Idempotency Guard on Retry
  console.log("\n[TEST 6] Strict Idempotency Guard on Retry");
  let reattemptedIG = false;
  let reattemptedFB = false;
  let reattemptedYT = false;

  const retryAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish() { reattemptedIG = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish() { reattemptedFB = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish() { reattemptedYT = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
  };

  const retryResult = await executeSocialPublishing({
    redis,
    targetDate: "2026-09-27",
    stream: "video",
    platforms: PROMO_VIDEO_DESTINATIONS,
    adapters: retryAdapters,
    isCanary: true,
  });

  assert.equal(retryResult.success, true);
  assert.equal(retryResult.status, "ALL_PLATFORMS_SKIPPED");
  assert.equal(reattemptedIG, false, "Must not re-publish Instagram");
  assert.equal(reattemptedFB, false, "Must not re-publish Facebook");
  assert.equal(reattemptedYT, false, "Must not re-publish YouTube");
  assert.equal(retryResult.skipped[DESTINATIONS.INSTAGRAM_PRIMARY].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.FACEBOOK_PRIMARY].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.YOUTUBE].reason, "ALREADY_PUBLISHED");
  console.log("  ✓ Strict idempotency verified: retry skips all 3 destinations with 0 write calls");

  // [TEST 7] Partial Failure Recovery & Isolation
  console.log("\n[TEST 7] Partial Failure Recovery & Isolation");
  const partialRedis = new MockRedis();
  let fbPublishCount = 0;
  let ytPublishCount = 0;

  const failYTAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish() { return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_1" }; },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish() { fbPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_1" }; },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish() { ytPublishCount++; return { success: false, status: PUBLISH_STATUS.FAILED, error: { message: "Quota exceeded" } }; },
    },
  };

  const initialRun = await executeSocialPublishing({
    redis: partialRedis,
    targetDate: "2026-09-28",
    stream: "video",
    platforms: PROMO_VIDEO_DESTINATIONS,
    adapters: failYTAdapters,
    isCanary: true,
  });

  assert.equal(initialRun.status, "PARTIAL_SUCCESS");
  assert.equal(initialRun.results[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(initialRun.results[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(initialRun.results[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.FAILED);

  // Retry with fixed YouTube adapter
  const fixedYTAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish() { throw new Error("Should not be called"); },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish() { throw new Error("Should not be called"); },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish() { ytPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "yt_fixed_1" }; },
    },
  };

  const recoveredRun = await executeSocialPublishing({
    redis: partialRedis,
    targetDate: "2026-09-28",
    stream: "video",
    platforms: PROMO_VIDEO_DESTINATIONS,
    adapters: fixedYTAdapters,
    isCanary: true,
  });

  assert.equal(recoveredRun.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(recoveredRun.skipped[DESTINATIONS.INSTAGRAM_PRIMARY].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.skipped[DESTINATIONS.FACEBOOK_PRIMARY].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.results[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(fbPublishCount, 1, "Facebook must only have been published once");
  assert.equal(ytPublishCount, 2, "YouTube was retried and succeeded");
  console.log("  ✓ Partial failure recovery verified: ONLY failed destination re-attempted");

  // [TEST 8] Serverless Cron Endpoint publishDailyVideo.js
  console.log("\n[TEST 8] Serverless Cron Endpoint api/cron/publishDailyVideo.js");
  const cronReq = {
    method: "GET",
    headers: { authorization: "Bearer aiz_test_cron_secret" },
    query: { date: "2026-09-27", dryRun: "true", canary: "true" },
  };

  let resStatus = null;
  let resJson = null;
  const cronRes = {
    status(code) { resStatus = code; return this; },
    json(data) { resJson = data; return this; },
  };

  process.env.CRON_SECRET = "aiz_test_cron_secret";
  process.env.SOCIAL_AUTO_PUBLISH_ENABLED = "true";

  await publishDailyVideoHandler(cronReq, cronRes);
  assert.equal(resStatus, 200);
  assert.equal(resJson.success, true);
  assert.equal(resJson.dryRun, true);
  assert.equal(resJson.manifestId, "promo-video-2026-09-27");

  // Unauthorized request rejected
  const unauthReq = { method: "GET", headers: {}, query: {} };
  let unauthStatus = null;
  await publishDailyVideoHandler(unauthReq, {
    status(code) { unauthStatus = code; return this; },
    json() { return this; },
  });
  assert.equal(unauthStatus, 401, "Missing authorization header must return 401");

  // Outside campaign window skipped cleanly
  const outsideReq = {
    method: "GET",
    headers: { authorization: "Bearer aiz_test_cron_secret" },
    query: { date: "2026-11-01" },
  };
  let outsideJson = null;
  await publishDailyVideoHandler(outsideReq, {
    status(code) { return this; },
    json(data) { outsideJson = data; return this; },
  });
  assert.equal(outsideJson.status, "SKIPPED_OUTSIDE_CAMPAIGN_WINDOW");
  console.log("  ✓ Cron handler authentication, campaign window checks, and dryRun verified");

  console.log("\n==================================================");
  console.log("ALL PROMO VIDEO PUBLISHING FLOW TESTS PASSED! 🎉");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
