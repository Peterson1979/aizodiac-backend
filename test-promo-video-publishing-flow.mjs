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
  assert.deepEqual(v1.destinations, ["instagram", "facebook", "youtube", "youtube_lifemode", "pinterest", "pinterest_secondary"]);

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
    DESTINATIONS.INSTAGRAM_SECONDARY,
    DESTINATIONS.FACEBOOK_SECONDARY,
    DESTINATIONS.YOUTUBE,
    DESTINATIONS.YOUTUBE_LIFEMODE,
    DESTINATIONS.PINTEREST,
    DESTINATIONS.PINTEREST_SECONDARY,
  ]);
  assert.equal(redis.store.size, 0, "Dry-run must make 0 Redis writes");
  console.log("  ✓ Dry-run completed with zero writes across all 8 destinations");

  // [TEST 5] Full Video 1 Publishing Mock Execution (AI Zodiac IG/FB + LifeMode IG/FB + AI Zodiac YT + LifeMode YT + AI Zodiac Pinterest + LifeMode Pinterest)
  console.log("\n[TEST 5] Full Video 1 Publishing Mock Execution (8 destinations)");
  let publishedIGPrimary = false;
  let publishedFBPrimary = false;
  let publishedIGSecondary = false;
  let publishedFBSecondary = false;
  let publishedYT = false;
  let publishedYTLifeMode = false;
  let publishedPinterestPrimary = false;
  let publishedPinterestSecondary = false;

  const mockAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish({ manifest }) {
        publishedIGPrimary = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "ig_primary_reel_123",
          containerId: "ig_primary_container_999",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish({ manifest }) {
        publishedFBPrimary = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "fb_primary_video_456",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.INSTAGRAM_SECONDARY]: {
      name: DESTINATIONS.INSTAGRAM_SECONDARY,
      async publish({ manifest }) {
        publishedIGSecondary = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "ig_secondary_reel_789",
          containerId: "ig_secondary_container_888",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.FACEBOOK_SECONDARY]: {
      name: DESTINATIONS.FACEBOOK_SECONDARY,
      async publish({ manifest }) {
        publishedFBSecondary = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "fb_secondary_video_101",
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
    [DESTINATIONS.YOUTUBE_LIFEMODE]: {
      name: DESTINATIONS.YOUTUBE_LIFEMODE,
      async publish({ manifest }) {
        publishedYTLifeMode = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "yt_lifemode_video_999",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.PINTEREST]: {
      name: DESTINATIONS.PINTEREST,
      async publish({ manifest }) {
        publishedPinterestPrimary = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "pin_video_1110559658053621012",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [DESTINATIONS.PINTEREST_SECONDARY]: {
      name: DESTINATIONS.PINTEREST_SECONDARY,
      async publish({ manifest }) {
        publishedPinterestSecondary = true;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "pin_lifemode_astrology_video_01",
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
  assert.equal(publishedIGPrimary, true, "AI Zodiac Instagram Primary must be published");
  assert.equal(publishedFBPrimary, true, "AI Zodiac Facebook Primary must be published");
  assert.equal(publishedIGSecondary, true, "LifeMode Instagram Secondary must be published");
  assert.equal(publishedFBSecondary, true, "LifeMode Facebook Secondary must be published");
  assert.equal(publishedYT, true, "AI Zodiac YouTube must be published");
  assert.equal(publishedYTLifeMode, true, "LifeMode YouTube must be published");
  assert.equal(publishedPinterestPrimary, true, "AI Zodiac Pinterest Primary must be published");
  assert.equal(publishedPinterestSecondary, true, "LifeMode Pinterest Secondary must be published");

  // Verify state in Redis
  const videoState = await getPostState(redis, "2026-09-27", { stream: "video" });
  assert.ok(videoState, "Video post state must be saved in Redis");
  assert.equal(videoState.overallStatus, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].postId, "ig_primary_reel_123");
  assert.equal(videoState.platforms[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.FACEBOOK_PRIMARY].postId, "fb_primary_video_456");
  assert.equal(videoState.platforms[DESTINATIONS.INSTAGRAM_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.INSTAGRAM_SECONDARY].postId, "ig_secondary_reel_789");
  assert.equal(videoState.platforms[DESTINATIONS.FACEBOOK_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.FACEBOOK_SECONDARY].postId, "fb_secondary_video_101");
  assert.equal(videoState.platforms[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.YOUTUBE].postId, "yt_video_abcdef");
  assert.equal(videoState.platforms[DESTINATIONS.YOUTUBE_LIFEMODE].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.YOUTUBE_LIFEMODE].postId, "yt_lifemode_video_999");
  assert.equal(videoState.platforms[DESTINATIONS.PINTEREST].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.PINTEREST].postId, "pin_video_1110559658053621012");
  assert.equal(videoState.platforms[DESTINATIONS.PINTEREST_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(videoState.platforms[DESTINATIONS.PINTEREST_SECONDARY].postId, "pin_lifemode_astrology_video_01");

  // Verify carousel state for the same date is UNTOUCHED (null)
  const carouselState = await getPostState(redis, "2026-09-27");
  assert.equal(carouselState, null, "Carousel state must remain null/untouched");
  console.log("  ✓ Video 1 published to all 8 destinations (AI Zodiac IG/FB + LifeMode IG/FB + AI Zodiac YT + LifeMode YT + AI Zodiac Pinterest + LifeMode Pinterest) with complete carousel isolation");

  // [TEST 6] Strict Idempotency Guard on Retry
  console.log("\n[TEST 6] Strict Idempotency Guard on Retry");
  let reattemptedIGPrimary = false;
  let reattemptedFBPrimary = false;
  let reattemptedIGSecondary = false;
  let reattemptedFBSecondary = false;
  let reattemptedYT = false;
  let reattemptedYTLifeMode = false;
  let reattemptedPinterestPrimary = false;
  let reattemptedPinterestSecondary = false;

  const retryAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish() { reattemptedIGPrimary = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish() { reattemptedFBPrimary = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.INSTAGRAM_SECONDARY]: {
      name: DESTINATIONS.INSTAGRAM_SECONDARY,
      async publish() { reattemptedIGSecondary = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.FACEBOOK_SECONDARY]: {
      name: DESTINATIONS.FACEBOOK_SECONDARY,
      async publish() { reattemptedFBSecondary = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish() { reattemptedYT = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.YOUTUBE_LIFEMODE]: {
      name: DESTINATIONS.YOUTUBE_LIFEMODE,
      async publish() { reattemptedYTLifeMode = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.PINTEREST]: {
      name: DESTINATIONS.PINTEREST,
      async publish() { reattemptedPinterestPrimary = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
    },
    [DESTINATIONS.PINTEREST_SECONDARY]: {
      name: DESTINATIONS.PINTEREST_SECONDARY,
      async publish() { reattemptedPinterestSecondary = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
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
  assert.equal(reattemptedIGPrimary, false, "Must not re-publish Instagram Primary");
  assert.equal(reattemptedFBPrimary, false, "Must not re-publish Facebook Primary");
  assert.equal(reattemptedIGSecondary, false, "Must not re-publish LifeMode Instagram");
  assert.equal(reattemptedFBSecondary, false, "Must not re-publish LifeMode Facebook");
  assert.equal(reattemptedYT, false, "Must not re-publish YouTube");
  assert.equal(reattemptedYTLifeMode, false, "Must not re-publish LifeMode YouTube");
  assert.equal(reattemptedPinterestPrimary, false, "Must not re-publish AI Zodiac Pinterest");
  assert.equal(reattemptedPinterestSecondary, false, "Must not re-publish LifeMode Pinterest");
  assert.equal(retryResult.skipped[DESTINATIONS.INSTAGRAM_PRIMARY].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.FACEBOOK_PRIMARY].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.INSTAGRAM_SECONDARY].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.FACEBOOK_SECONDARY].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.YOUTUBE].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.YOUTUBE_LIFEMODE].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.PINTEREST].reason, "ALREADY_PUBLISHED");
  assert.equal(retryResult.skipped[DESTINATIONS.PINTEREST_SECONDARY].reason, "ALREADY_PUBLISHED");
  console.log("  ✓ Strict idempotency verified: retry skips all 8 destinations with 0 write calls");

  // [TEST 7] Partial Failure Recovery & Isolation
  console.log("\n[TEST 7] Partial Failure Recovery & Isolation");
  const partialRedis = new MockRedis();
  let fbPublishCount = 0;
  let lmFbPublishCount = 0;
  let ytPublishCount = 0;
  let lmYtPublishCount = 0;
  let pinPublishCount = 0;
  let lmPinPublishCount = 0;

  const failYTAdapters = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: {
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      async publish() { return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_1" }; },
    },
    [DESTINATIONS.FACEBOOK_PRIMARY]: {
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      async publish() { fbPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_1" }; },
    },
    [DESTINATIONS.INSTAGRAM_SECONDARY]: {
      name: DESTINATIONS.INSTAGRAM_SECONDARY,
      async publish() { return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "lm_ig_1" }; },
    },
    [DESTINATIONS.FACEBOOK_SECONDARY]: {
      name: DESTINATIONS.FACEBOOK_SECONDARY,
      async publish() { lmFbPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "lm_fb_1" }; },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish() { ytPublishCount++; return { success: false, status: PUBLISH_STATUS.FAILED, error: { message: "Quota exceeded" } }; },
    },
    [DESTINATIONS.YOUTUBE_LIFEMODE]: {
      name: DESTINATIONS.YOUTUBE_LIFEMODE,
      async publish() { lmYtPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "lm_yt_1" }; },
    },
    [DESTINATIONS.PINTEREST]: {
      name: DESTINATIONS.PINTEREST,
      async publish() { pinPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_1" }; },
    },
    [DESTINATIONS.PINTEREST_SECONDARY]: {
      name: DESTINATIONS.PINTEREST_SECONDARY,
      async publish() { lmPinPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "lm_pin_1" }; },
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
  assert.equal(initialRun.results[DESTINATIONS.INSTAGRAM_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(initialRun.results[DESTINATIONS.FACEBOOK_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(initialRun.results[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.FAILED);
  assert.equal(initialRun.results[DESTINATIONS.YOUTUBE_LIFEMODE].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(initialRun.results[DESTINATIONS.PINTEREST].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(initialRun.results[DESTINATIONS.PINTEREST_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);

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
    [DESTINATIONS.INSTAGRAM_SECONDARY]: {
      name: DESTINATIONS.INSTAGRAM_SECONDARY,
      async publish() { throw new Error("Should not be called"); },
    },
    [DESTINATIONS.FACEBOOK_SECONDARY]: {
      name: DESTINATIONS.FACEBOOK_SECONDARY,
      async publish() { throw new Error("Should not be called"); },
    },
    [DESTINATIONS.YOUTUBE]: {
      name: DESTINATIONS.YOUTUBE,
      async publish() { ytPublishCount++; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "yt_fixed_1" }; },
    },
    [DESTINATIONS.YOUTUBE_LIFEMODE]: {
      name: DESTINATIONS.YOUTUBE_LIFEMODE,
      async publish() { throw new Error("Should not be called"); },
    },
    [DESTINATIONS.PINTEREST]: {
      name: DESTINATIONS.PINTEREST,
      async publish() { throw new Error("Should not be called"); },
    },
    [DESTINATIONS.PINTEREST_SECONDARY]: {
      name: DESTINATIONS.PINTEREST_SECONDARY,
      async publish() { throw new Error("Should not be called"); },
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
  assert.equal(recoveredRun.skipped[DESTINATIONS.INSTAGRAM_SECONDARY].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.skipped[DESTINATIONS.FACEBOOK_SECONDARY].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.skipped[DESTINATIONS.YOUTUBE_LIFEMODE].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.skipped[DESTINATIONS.PINTEREST].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.skipped[DESTINATIONS.PINTEREST_SECONDARY].reason, "ALREADY_PUBLISHED");
  assert.equal(recoveredRun.results[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(fbPublishCount, 1, "Facebook Primary must only have been published once");
  assert.equal(lmFbPublishCount, 1, "LifeMode Facebook Secondary must only have been published once");
  assert.equal(lmYtPublishCount, 1, "LifeMode YouTube must only have been published once");
  assert.equal(pinPublishCount, 1, "Pinterest Primary must only have been published once");
  assert.equal(lmPinPublishCount, 1, "Pinterest Secondary must only have been published once");
  assert.equal(ytPublishCount, 2, "YouTube was retried and succeeded");
  console.log("  ✓ Partial failure recovery verified: ONLY failed destination re-attempted across all 8 destinations");

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
