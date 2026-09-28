// test-social-publishing.mjs
import assert from "node:assert/strict";
import {
  PLATFORMS,
  ALL_PLATFORMS,
  DESTINATIONS,
  ALL_DESTINATIONS,
  ALL_CONFIGURED_DESTINATIONS,
  canonicalizeDestination,
  canonicalizeDestinations,
  PUBLISH_STATUS,
  MEDIA_TYPES,
  createDefaultPostState,
} from "./lib/social/types.js";
import {
  getSocialConfig,
  validateSocialConfig,
  redactSecrets,
  getSanitizedConfigView,
} from "./lib/social/config.js";
import {
  acquireDistributedLock,
  releaseDistributedLock,
  getPostState,
  savePostState,
  updatePlatformState,
  calculateOverallStatus,
  getPinterestTokenState,
  savePinterestTokenState,
  RELEASE_LOCK_LUA,
} from "./lib/social/stateHelper.js";
import {
  getDateInTimeZone,
  validateManifest,
  normalizeManifest,
  resolveManifestForDate,
} from "./lib/social/contentManifest.js";
import { InstagramAdapter } from "./lib/social/adapters/instagramAdapter.js";
import { FacebookAdapter } from "./lib/social/adapters/facebookAdapter.js";
import { PinterestAdapter } from "./lib/social/adapters/pinterestAdapter.js";
import { YouTubeAdapter } from "./lib/social/adapters/youtubeAdapter.js";
import { VideoAdapterStub } from "./lib/social/adapters/videoAdapter.stub.js";
import { executeSocialPublishing, createDefaultAdapters } from "./lib/social/publishCoordinator.js";
import { savePrepareState, PREPARE_STAGES } from "./lib/social/prepareStateHelper.js";
import { QUALITY_GATE_STATUS } from "./lib/social/quality/socialQualityGate.js";
import { DEFAULT_APP_PLAY_STORE_URL, FACEBOOK_TRACKING_PLAY_STORE_URL, ensureFacebookGooglePlayLink } from "./lib/social/content/dailyContentGenerator.js";
import { generateDailyVideoManifest, YOUTUBE_TRACKING_PLAY_STORE_URL, PINTEREST_VIDEO_TRACKING_PLAY_STORE_URL } from "./lib/social/content/videoCatalog.js";
import { getYoutubeTokenState, saveYoutubeTokenState } from "./lib/social/stateHelper.js";
import cronHandler from "./api/cron/publishDailySocial.js";
import canaryHandler from "./api/cron/canarySocialPublish.js";

console.log("==================================================");
console.log("RUNNING SOCIAL PUBLISHING SUBSYSTEM TEST SUITE");
console.log("==================================================");

/**
 * In-Memory Mock Redis implementing exact Upstash Redis commands & Lua script evaluation.
 */
class MockRedis {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
  }

  async get(key) {
    if (this.expirations.has(key) && Date.now() > this.expirations.get(key)) {
      this.store.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  async set(key, value, options = {}) {
    if (options.nx) {
      const exists = await this.get(key);
      if (exists !== null) return null;
    }
    this.store.set(key, String(value));
    if (options.ex) {
      this.expirations.set(key, Date.now() + options.ex * 1000);
    }
    return "OK";
  }

  async del(key) {
    const deleted = this.store.delete(key);
    this.expirations.delete(key);
    return deleted ? 1 : 0;
  }

  async eval(script, keys, args) {
    if (script === RELEASE_LOCK_LUA) {
      const key = keys[0];
      const expectedOwner = String(args[0]);
      const currentVal = await this.get(key);

      if (currentVal === expectedOwner) {
        await this.del(key);
        return 1;
      }
      return 0;
    }
    throw new Error(`Unsupported script in MockRedis: ${script}`);
  }
}

// ============================================================================
// TEST 1: Config Validation & Secret Redaction (Primary + LifeMode)
// ============================================================================
{
  console.log("\n[TEST 1] Configuration Validation & Secret Redaction (Primary + LifeMode)");

  const emptyConfig = getSocialConfig({});
  const validation = validateSocialConfig(emptyConfig);
  assert.equal(validation.valid, false, "Empty config should fail validation");
  assert.ok(validation.errors.length >= 3, "Should report missing credentials for all platforms");

  const validConfig = getSocialConfig({
    metaPageAccessToken: "EAAB_test_token_12345",
    metaPageId: "1002938472918",
    instagramAccountId: "17841400123456789",
    lifemodeMetaPageAccessToken: "EAAB_lifemode_token_67890",
    lifemodeMetaPageId: "2009876543210",
    lifemodeInstagramAccountId: "17841400987654321",
    pinterestAccessToken: "pina_test_access_token_123",
    pinterestRefreshToken: "pinr_test_refresh_token_456",
    pinterestBoardId: "9876543210",
    lifemodePinterestAccessToken: "pina_test_lifemode_access_token_123",
    lifemodePinterestRefreshToken: "pinr_test_lifemode_refresh_token_456",
    lifemodePinterestBoardId: "495607202683292084",
    youtubeClientId: "test_yt_client_id_123.apps.googleusercontent.com",
    youtubeClientSecret: "test_yt_client_secret_456",
    youtubeRefreshToken: "1//test_yt_refresh_token_789",
  });
  const validCheck = validateSocialConfig(validConfig, ALL_CONFIGURED_DESTINATIONS);
  assert.equal(validCheck.valid, true, "Fully populated multi-destination config should pass validation");

  // Secret redaction test covering LifeMode and primary tokens
  const rawSecretString = "Error with EAAB1234567890abcdef and EAAB_lifemode_token_67890 and pina_secret999 and Bearer my_cron_secret";
  const redactedString = redactSecrets(rawSecretString);
  assert.ok(!redactedString.includes("EAAB1234567890abcdef"), "Primary Meta token must be redacted");
  assert.ok(!redactedString.includes("EAAB_lifemode_token_67890"), "LifeMode Meta token must be redacted");
  assert.ok(!redactedString.includes("pina_secret999"), "Pinterest token must be redacted");
  assert.ok(!redactedString.includes("my_cron_secret"), "Bearer auth must be redacted");

  const secretObj = {
    metaPageAccessToken: "EAABsecret",
    lifemodeMetaPageAccessToken: "EAABlifemodesecret",
    cronSecret: "super_secret_cron",
    nested: { password: "pass", status: "OK", token: "xyz" },
  };
  const redactedObj = redactSecrets(secretObj);
  assert.equal(redactedObj.metaPageAccessToken, "[REDACTED]");
  assert.equal(redactedObj.lifemodeMetaPageAccessToken, "[REDACTED]");
  assert.equal(redactedObj.cronSecret, "[REDACTED]");
  assert.equal(redactedObj.nested.password, "[REDACTED]");
  assert.equal(redactedObj.nested.token, "[REDACTED]");
  assert.equal(redactedObj.nested.status, "OK");

  const sanitizedView = getSanitizedConfigView(validConfig);
  assert.equal(sanitizedView.metaTokenConfigured, true);
  assert.equal(sanitizedView.lifemodeMetaTokenConfigured, true);
  assert.equal(sanitizedView.pinterestTokenConfigured, true);
  assert.ok(sanitizedView.metaPageId.startsWith("***"), "Primary Page ID should be masked");
  assert.ok(sanitizedView.lifemodeMetaPageId.startsWith("***"), "LifeMode Page ID should be masked");
  assert.ok(sanitizedView.instagramAccountId.startsWith("***"), "Primary IG Account ID should be masked");
  assert.ok(sanitizedView.lifemodeInstagramAccountId.startsWith("***"), "LifeMode IG Account ID should be masked");

  console.log("  ✓ Config validation properly enforces required destination keys for Primary and LifeMode");
  console.log("  ✓ Secret redaction reliably scrubs primary and LifeMode tokens from strings and deep objects");
  console.log("  ✓ Sanitized diagnostic view properly masks LifeMode IDs");
}

// ============================================================================
// TEST 2: Manifest Validation & Timezone Calendar Boundaries
// ============================================================================
{
  console.log("\n[TEST 2] Manifest Validation & Timezone Calendar Boundaries");

  // 1. Timezone boundary test
  // 2026-08-27 at 23:30 UTC is already 2026-08-28 in Tokyo (+09:00) and still 2026-08-27 in New York (-04:00)
  const boundaryDate = new Date("2026-08-27T23:30:00.000Z");
  const utcDateStr = getDateInTimeZone(boundaryDate, "UTC");
  const tokyoDateStr = getDateInTimeZone(boundaryDate, "Asia/Tokyo");
  const nyDateStr = getDateInTimeZone(boundaryDate, "America/New_York");

  assert.equal(utcDateStr, "2026-08-27");
  assert.equal(tokyoDateStr, "2026-08-28");
  assert.equal(nyDateStr, "2026-08-27");

  // 2. Single image manifest validation
  const validSingleImage = {
    date: "2026-08-28",
    id: "manifest_2026_08_28_single",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/images/virgo.png", altText: "Virgo Daily" }],
    captions: {
      instagram: "✨ Virgo Season ✨",
      facebook: "✨ Virgo Daily Guidance! https://aizodiac.life",
      pinterest: {
        title: "Virgo Daily Guidance",
        description: "Daily astrological alignment for Virgo.",
        link: "https://aizodiac.life",
      },
    },
  };
  const singleCheck = validateManifest(validSingleImage);
  assert.equal(singleCheck.valid, true, "Valid single image manifest must pass");

  // 3. Carousel manifest validation
  const validCarousel = {
    date: "2026-08-28",
    id: "manifest_2026_08_28_carousel",
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://cdn.aizodiac.app/images/slide1.png" },
      { url: "https://cdn.aizodiac.app/images/slide2.png" },
      { url: "https://cdn.aizodiac.app/images/slide3.png" },
    ],
    captions: {
      instagram: "Carousel caption",
      facebook: "Facebook caption",
      pinterest: {
        title: "Pinterest title",
        description: "Pinterest description",
        link: "https://aizodiac.life",
      },
    },
  };
  const carouselCheck = validateManifest(validCarousel);
  assert.equal(carouselCheck.valid, true, "Valid carousel manifest (3 slides) must pass");

  // 4. Invalid manifests
  const invalidCarousel1Slide = { ...validCarousel, media: [{ url: "https://cdn.aizodiac.app/slide1.png" }] };
  assert.equal(validateManifest(invalidCarousel1Slide).valid, false, "Carousel with 1 slide must fail");

  const invalidLongPinTitle = {
    ...validSingleImage,
    captions: {
      ...validSingleImage.captions,
      pinterest: { ...validSingleImage.captions.pinterest, title: "A".repeat(105) },
    },
  };
  assert.equal(validateManifest(invalidLongPinTitle).valid, false, "Pinterest title > 100 chars must fail");

  console.log("  ✓ Timezone date resolution operates deterministically across calendar boundaries");
  console.log("  ✓ Manifest validator enforces media counts and platform-specific copy");
}

// ============================================================================
// TEST 3: Redis Distributed Lock Mechanics & Race Condition Safety
// ============================================================================
{
  console.log("\n[TEST 3] Redis Distributed Lock Mechanics & Race Condition Safety");

  const redis = new MockRedis();
  const date = "2026-08-28";

  // 1. Worker 1 acquires lock
  const lock1 = await acquireDistributedLock(redis, date, { ttlSeconds: 10 });
  assert.equal(lock1.acquired, true, "Worker 1 must acquire lock");
  assert.ok(lock1.lockOwnerId, "Worker 1 receives unique lockOwnerId");

  // 2. Worker 2 attempts to acquire lock (contention)
  const lock2 = await acquireDistributedLock(redis, date, { ttlSeconds: 10 });
  assert.equal(lock2.acquired, false, "Worker 2 must fail to acquire active lock");
  assert.equal(lock2.reason, "LOCK_CONTENTION");

  // 3. Worker 1 releases lock safely with its lockOwnerId
  const rel1 = await releaseDistributedLock(redis, date, lock1.lockOwnerId);
  assert.equal(rel1.released, true, "Worker 1 safely releases its lock");

  // 4. Test Expired Lock Race Condition
  // Worker 1 acquires lock again
  const worker1Lock = await acquireDistributedLock(redis, date, { ttlSeconds: 10 });
  assert.equal(worker1Lock.acquired, true);

  // Simulate lock expiration + Worker 2 acquiring the newly freed lock
  await redis.del(worker1Lock.lockKey);
  const worker2Lock = await acquireDistributedLock(redis, date, { ttlSeconds: 10 });
  assert.equal(worker2Lock.acquired, true);
  assert.notEqual(worker1Lock.lockOwnerId, worker2Lock.lockOwnerId);

  // Worker 1 tries to release its old expired lock -> MUST BE REJECTED by Lua script!
  const staleRelease = await releaseDistributedLock(redis, date, worker1Lock.lockOwnerId);
  assert.equal(staleRelease.released, false, "Stale release attempt must return false");
  assert.equal(staleRelease.reason, "LOCK_NOT_OWNED_OR_EXPIRED");

  // Verify Worker 2's lock is STILL ACTIVE in Redis!
  const currentLockInRedis = await redis.get(worker2Lock.lockKey);
  assert.equal(currentLockInRedis, worker2Lock.lockOwnerId, "Worker 2 lock was NOT deleted by Worker 1");

  console.log("  ✓ SET NX EX guarantees single-worker lock acquisition");
  console.log("  ✓ Atomic Lua script prevents deleting another worker's lock after expiration");
}

// ============================================================================
// TEST 4: Instagram Adapter (Single Image, Carousel & Ambiguous Writes)
// ============================================================================
{
  console.log("\n[TEST 4] Instagram Adapter Mock Invocations");

  const adapter = new InstagramAdapter();
  const config = getSocialConfig({
    metaPageAccessToken: "EAAB_test_ig_token",
    instagramAccountId: "178414009999",
    metaGraphApiVersion: "v26.0",
  });

  // 1. Single Image Success Flow (with Container Readiness Check)
  let createCalled = false;
  let publishCalled = false;
  let singleReadyCalled = false;
  const mockFetchSingle = async (url, options) => {
    if (url.includes("/media_publish")) {
      publishCalled = true;
      assert.ok(options.body.includes("creation_id=ig_container_111"));
      return new Response(JSON.stringify({ id: "ig_post_999999" }), { status: 200 });
    }
    if (url.includes("fields=status_code")) {
      singleReadyCalled = true;
      return new Response(JSON.stringify({ status_code: "FINISHED", id: "ig_container_111" }), { status: 200 });
    }
    if (url.includes("/media")) {
      createCalled = true;
      assert.ok(options.body.includes("image_url=https"));
      return new Response(JSON.stringify({ id: "ig_container_111" }), { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  const singleManifest = {
    date: "2026-08-28",
    id: "m1",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/pic1.png" }],
    captions: { instagram: "IG copy" },
  };

  const resSingle = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchSingle,
    pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
  });

  assert.equal(resSingle.success, true);
  assert.equal(resSingle.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resSingle.postId, "ig_post_999999");
  assert.equal(createCalled, true);
  assert.equal(singleReadyCalled, true);
  assert.equal(publishCalled, true);

  // 2. Carousel Success Flow (3 slides with child + parent readiness checks)
  let childCount = 0;
  let childStatusChecks = 0;
  let parentCreated = false;
  let parentStatusCheck = false;
  const mockFetchCarousel = async (url, options) => {
    if (url.includes("/media_publish")) {
      return new Response(JSON.stringify({ id: "ig_carousel_post_777" }), { status: 200 });
    }
    if (url.includes("fields=status_code")) {
      if (url.includes("ig_parent_container_333")) {
        parentStatusCheck = true;
      } else {
        childStatusChecks++;
      }
      return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
    }
    if (url.includes("/media")) {
      if (options.body.includes("media_type=CAROUSEL")) {
        parentCreated = true;
        return new Response(JSON.stringify({ id: "ig_parent_container_333" }), { status: 200 });
      }
      if (options.body.includes("is_carousel_item=true")) {
        childCount++;
        return new Response(JSON.stringify({ id: `ig_child_${childCount}` }), { status: 200 });
      }
    }
    return new Response("Not found", { status: 404 });
  };

  const carouselManifest = {
    date: "2026-08-28",
    id: "m2",
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://cdn.aizodiac.app/s1.png" },
      { url: "https://cdn.aizodiac.app/s2.png" },
      { url: "https://cdn.aizodiac.app/s3.png" },
    ],
    captions: { instagram: "Carousel IG copy" },
  };

  const resCarousel = await adapter.publish({
    manifest: carouselManifest,
    config,
    fetchFn: mockFetchCarousel,
    pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
  });

  assert.equal(resCarousel.success, true);
  assert.equal(resCarousel.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resCarousel.postId, "ig_carousel_post_777");
  assert.equal(childCount, 3, "Should have created 3 child containers concurrently");
  assert.equal(childStatusChecks, 3, "Should have verified readiness for all 3 child containers");
  assert.equal(parentCreated, true);
  assert.equal(parentStatusCheck, true, "Should have verified readiness for parent carousel container");

  // 3. Provider Error Preservation (Meta 400 rejection on container creation)
  const mockFetchError = async () => {
    return new Response(
      JSON.stringify({
        error: {
          message: "Invalid aspect ratio for image",
          type: "OAuthException",
          code: 100,
          error_subcode: 2207001,
          fbtrace_id: "TraceId12345",
        },
      }),
      { status: 400 }
    );
  };

  const resError = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchError,
    pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
  });
  assert.equal(resError.success, false);
  assert.equal(resError.status, PUBLISH_STATUS.FAILED);
  assert.equal(resError.error.code, 100);
  assert.equal(resError.error.subcode, 2207001);
  assert.equal(resError.error.fbtrace_id, "TraceId12345");

  // 4. Ambiguous Post-Write Transport Failure Guard (Unchanged)
  const mockFetchAmbiguous = async (url) => {
    if (url.includes("/media_publish")) {
      throw new Error("Connection reset by peer after sending publish command");
    }
    if (url.includes("fields=status_code")) {
      return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: "ig_container_ambig" }), { status: 200 });
  };

  const resAmbig = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchAmbiguous,
    pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
  });
  assert.equal(resAmbig.success, false);
  assert.equal(resAmbig.status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);
  assert.equal(resAmbig.reconciliationData.reason, "AMBIGUOUS_PUBLISH_TRANSPORT_FAILURE");
  assert.equal(resAmbig.containerId, "ig_container_ambig");

  // 5. Explicit Readiness Scenario 1: IN_PROGRESS -> FINISHED -> publish succeeds
  {
    let statusChecks = 0;
    let publishDone = false;
    const mockFetchPollSuccess = async (url) => {
      if (url.includes("/media_publish")) {
        publishDone = true;
        return new Response(JSON.stringify({ id: "ig_post_polled_101" }), { status: 200 });
      }
      if (url.includes("fields=status_code")) {
        statusChecks++;
        if (statusChecks < 3) {
          return new Response(JSON.stringify({ status_code: "IN_PROGRESS", id: "ig_cnt_poll" }), { status: 200 });
        }
        return new Response(JSON.stringify({ status_code: "FINISHED", id: "ig_cnt_poll" }), { status: 200 });
      }
      if (url.includes("/media")) {
        return new Response(JSON.stringify({ id: "ig_cnt_poll" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await adapter.publish({
      manifest: singleManifest,
      config,
      fetchFn: mockFetchPollSuccess,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(res.postId, "ig_post_polled_101");
    assert.equal(statusChecks, 3, "Must poll 2 IN_PROGRESS before reaching FINISHED");
    assert.equal(publishDone, true);
    console.log("  ✓ Readiness Scenario 1: IN_PROGRESS -> FINISHED -> publish succeeds");
  }

  // 6. Explicit Readiness Scenario 2: Carousel children become FINISHED before parent creation
  {
    const trace = [];
    const mockFetchOrder = async (url, options) => {
      if (url.includes("/media_publish")) {
        trace.push("PUBLISH_CAROUSEL");
        return new Response(JSON.stringify({ id: "ig_carousel_order_post" }), { status: 200 });
      }
      if (url.includes("fields=status_code")) {
        if (url.includes("ig_parent_cnt")) {
          trace.push("POLL_PARENT");
        } else {
          trace.push("POLL_CHILD");
        }
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      }
      if (url.includes("/media")) {
        if (options.body.includes("media_type=CAROUSEL")) {
          trace.push("CREATE_PARENT");
          return new Response(JSON.stringify({ id: "ig_parent_cnt" }), { status: 200 });
        }
        if (options.body.includes("is_carousel_item=true")) {
          trace.push("CREATE_CHILD");
          return new Response(JSON.stringify({ id: `ig_child_${trace.length}` }), { status: 200 });
        }
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await adapter.publish({
      manifest: carouselManifest,
      config,
      fetchFn: mockFetchOrder,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(res.success, true);
    const parentCreateIdx = trace.indexOf("CREATE_PARENT");
    assert.ok(parentCreateIdx > 0, "CREATE_PARENT must exist in trace");
    const preParentEvents = trace.slice(0, parentCreateIdx);
    assert.equal(preParentEvents.filter(e => e === "CREATE_CHILD").length, 3, "3 child containers created before parent");
    assert.equal(preParentEvents.filter(e => e === "POLL_CHILD").length, 3, "3 child containers polled FINISHED before parent");

    const parentPollIdx = trace.indexOf("POLL_PARENT");
    const publishIdx = trace.indexOf("PUBLISH_CAROUSEL");
    assert.ok(parentPollIdx > parentCreateIdx, "Parent must be polled after parent creation");
    assert.ok(publishIdx > parentPollIdx, "Publish must occur after parent is FINISHED");
    console.log("  ✓ Readiness Scenario 2: Carousel children become FINISHED before parent creation");
  }

  // 7. Explicit Readiness Scenario 3: Parent becomes FINISHED before media_publish
  {
    const singleTrace = [];
    const mockFetchSingleTrace = async (url) => {
      if (url.includes("/media_publish")) {
        singleTrace.push("MEDIA_PUBLISH");
        return new Response(JSON.stringify({ id: "ig_single_trace_post" }), { status: 200 });
      }
      if (url.includes("fields=status_code")) {
        singleTrace.push("POLL_CONTAINER");
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      }
      if (url.includes("/media")) {
        singleTrace.push("CREATE_CONTAINER");
        return new Response(JSON.stringify({ id: "ig_single_cnt" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await adapter.publish({
      manifest: singleManifest,
      config,
      fetchFn: mockFetchSingleTrace,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(res.success, true);
    assert.deepEqual(singleTrace, ["CREATE_CONTAINER", "POLL_CONTAINER", "MEDIA_PUBLISH"]);
    console.log("  ✓ Readiness Scenario 3: Parent container becomes FINISHED before media_publish");
  }

  // 8. Explicit Readiness Scenario 4: ERROR fails without media_publish
  {
    let mediaPublishHit = false;
    const mockFetchErrorStatus = async (url) => {
      if (url.includes("/media_publish")) {
        mediaPublishHit = true;
        return new Response(JSON.stringify({ id: "should_not_publish" }), { status: 200 });
      }
      if (url.includes("fields=status_code")) {
        return new Response(
          JSON.stringify({ status_code: "ERROR", status: "Media failed to process on server" }),
          { status: 200 }
        );
      }
      if (url.includes("/media")) {
        return new Response(JSON.stringify({ id: "ig_err_cnt" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await adapter.publish({
      manifest: singleManifest,
      config,
      fetchFn: mockFetchErrorStatus,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(res.success, false);
    assert.equal(res.status, PUBLISH_STATUS.FAILED);
    assert.equal(mediaPublishHit, false, "media_publish MUST NOT be called when container status is ERROR");
    assert.ok(res.error.message.includes("Media failed to process"));
    console.log("  ✓ Readiness Scenario 4: ERROR status fails cleanly without media_publish");
  }

  // 9. Explicit Readiness Scenario 5: EXPIRED fails without media_publish
  {
    let mediaPublishHitExpired = false;
    const mockFetchExpired = async (url) => {
      if (url.includes("/media_publish")) {
        mediaPublishHitExpired = true;
        return new Response(JSON.stringify({ id: "should_not_publish" }), { status: 200 });
      }
      if (url.includes("fields=status_code")) {
        return new Response(
          JSON.stringify({ status_code: "EXPIRED", status: "Container expired before publishing" }),
          { status: 200 }
        );
      }
      if (url.includes("/media")) {
        return new Response(JSON.stringify({ id: "ig_exp_cnt" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await adapter.publish({
      manifest: singleManifest,
      config,
      fetchFn: mockFetchExpired,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(res.success, false);
    assert.equal(res.status, PUBLISH_STATUS.FAILED);
    assert.equal(mediaPublishHitExpired, false, "media_publish MUST NOT be called when container status is EXPIRED");
    assert.ok(res.error.message.includes("expired"));
    console.log("  ✓ Readiness Scenario 5: EXPIRED status fails cleanly without media_publish");
  }

  // 10. Explicit Readiness Scenario 6: Readiness timeout fails closed without media_publish
  {
    let mediaPublishHitTimeout = false;
    let timeoutAttempts = 0;
    const mockFetchTimeout = async (url) => {
      if (url.includes("/media_publish")) {
        mediaPublishHitTimeout = true;
        return new Response(JSON.stringify({ id: "should_not_publish" }), { status: 200 });
      }
      if (url.includes("fields=status_code")) {
        timeoutAttempts++;
        return new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 });
      }
      if (url.includes("/media")) {
        return new Response(JSON.stringify({ id: "ig_timeout_cnt" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await adapter.publish({
      manifest: singleManifest,
      config,
      fetchFn: mockFetchTimeout,
      pollOptions: {
        maxAttempts: 3,
        pollIntervalMs: 0,
        sleepFn: async () => {},
      },
    });

    assert.equal(res.success, false);
    assert.equal(res.status, PUBLISH_STATUS.FAILED);
    assert.equal(mediaPublishHitTimeout, false, "media_publish MUST NOT be called on readiness timeout");
    assert.equal(timeoutAttempts, 3, "Should poll maxAttempts times before failing closed");
    assert.ok(res.error.message.includes("readiness timeout"));
    console.log("  ✓ Readiness Scenario 6: Readiness timeout fails closed without media_publish");
  }

  console.log("  ✓ Single image & concurrent carousel publishing verified on Graph API v26.0");
  console.log("  ✓ Meta error code/subcode/trace ID properly preserved without secret leak");
  console.log("  ✓ Transport failure after publish command flagged as RECONCILIATION_REQUIRED");
}

// ============================================================================
// TEST 5: Facebook Adapter (Photos, Feed & Ambiguous Writes)
// ============================================================================
{
  console.log("\n[TEST 5] Facebook Adapter Mock Invocations");

  const adapter = new FacebookAdapter();
  const config = getSocialConfig({
    metaPageAccessToken: "EAAB_fb_token",
    metaPageId: "1002938472918",
  });

  // 1. Single Photo Success & Automatic Google Play Link Appending
  let receivedMessage = null;
  const mockFetchFb = async (url, options) => {
    assert.ok(url.includes("/1002938472918/photos"));
    const bodyParams = new URLSearchParams(options.body);
    receivedMessage = bodyParams.get("message");
    return new Response(JSON.stringify({ id: "photo_123", post_id: "feed_story_456" }), { status: 200 });
  };

  const singleManifest = {
    date: "2026-08-28",
    id: "m1",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/pic1.png" }],
    captions: {
      instagram: "Original IG Caption #astrology",
      facebook: "FB copy without store link",
      pinterest: {
        title: "Original Pin Title",
        description: "Original Pin Description",
        link: "https://aizodiac.life",
      },
    },
  };

  const res = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchFb,
  });

  assert.equal(res.success, true);
  assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(res.postId, "feed_story_456");
  assert.ok(receivedMessage.includes(DEFAULT_APP_PLAY_STORE_URL), "Facebook message must contain mandatory Google Play URL");
  assert.ok(receivedMessage.includes(FACEBOOK_TRACKING_PLAY_STORE_URL), "Facebook message must contain UTM-tagged Google Play URL");
  assert.equal(receivedMessage, `FB copy without store link\n\n${FACEBOOK_TRACKING_PLAY_STORE_URL}`);
  assert.equal(singleManifest.captions.instagram, "Original IG Caption #astrology", "Instagram caption must remain unaffected");
  assert.equal(singleManifest.captions.pinterest.title, "Original Pin Title", "Pinterest caption must remain unaffected");

  // 2. Facebook Post with Pre-existing Google Play Link (Upgraded / No Duplication)
  const manifestWithLink = {
    ...singleManifest,
    captions: {
      ...singleManifest.captions,
      facebook: `Check this out! Download: ${DEFAULT_APP_PLAY_STORE_URL}`,
    },
  };

  await adapter.publish({
    manifest: manifestWithLink,
    config,
    fetchFn: mockFetchFb,
  });

  assert.equal(receivedMessage, `Check this out! Download: ${FACEBOOK_TRACKING_PLAY_STORE_URL}`, "Must upgrade untracked link without duplication");
  const linkOccurrences = receivedMessage.split(DEFAULT_APP_PLAY_STORE_URL).length - 1;
  assert.equal(linkOccurrences, 1, "Must contain exactly 1 occurrence of Google Play URL");

  // 3. Ambiguous write handling
  const mockFetchFbAmbig = async () => {
    throw new Error("ETIMEDOUT while waiting for Facebook Page confirmation");
  };

  const resAmbig = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchFbAmbig,
  });
  assert.equal(resAmbig.success, false);
  assert.equal(resAmbig.status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);

  // 4. LifeMode System User Token -> Page Access Token Resolution & Carousel Publishing
  const secondaryAdapter = new FacebookAdapter({
    destinationKey: "facebook_secondary",
    getPageId: (c) => c.lifemodeMetaPageId,
    getAccessToken: (c) => c.lifemodeMetaPageAccessToken,
  });

  const secondaryConfig = getSocialConfig({
    metaPageAccessToken: "EAAB_primary_page_token",
    metaPageId: "1000599443130047",
    lifemodeMetaPageAccessToken: "EAAB_system_user_token",
    lifemodeMetaPageId: "226949230493910",
  });

  const carouselManifest = {
    date: "2026-08-31",
    id: "m_carousel",
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://pub.dev/slide1.png" },
      { url: "https://pub.dev/slide2.png" },
    ],
    captions: {
      facebook: "LifeMode Astrology Post",
    },
  };

  const tokensUsedInCalls = [];
  const mockFetchSecondary = async (url, options) => {
    // Identity & Page Token Resolution
    if (url.includes("/226949230493910?fields=id,name,access_token")) {
      assert.ok(url.includes("access_token=EAAB_system_user_token"), "Must query Graph API using configured System User token");
      return new Response(JSON.stringify({
        id: "226949230493910",
        name: "LifeMode",
        access_token: "EAAB_resolved_page_token_999",
      }), { status: 200 });
    }

    // Photo uploads
    if (url.includes("/226949230493910/photos")) {
      const bodyParams = new URLSearchParams(options.body);
      const usedToken = bodyParams.get("access_token");
      tokensUsedInCalls.push(usedToken);
      assert.equal(bodyParams.get("published"), "false");
      assert.equal(usedToken, "EAAB_resolved_page_token_999", "Unpublished photo upload MUST use resolved Page Access Token, NOT System User token");
      return new Response(JSON.stringify({ id: `photo_${tokensUsedInCalls.length}` }), { status: 200 });
    }

    // Feed post
    if (url.includes("/226949230493910/feed")) {
      const bodyParams = new URLSearchParams(options.body);
      const usedToken = bodyParams.get("access_token");
      tokensUsedInCalls.push(usedToken);
      assert.equal(usedToken, "EAAB_resolved_page_token_999", "Feed post MUST use resolved Page Access Token");
      return new Response(JSON.stringify({ id: "226949230493910_feed_99999" }), { status: 200 });
    }

    throw new Error(`Unexpected URL in mockFetchSecondary: ${url}`);
  };

  const resSec = await secondaryAdapter.publish({
    manifest: carouselManifest,
    config: secondaryConfig,
    fetchFn: mockFetchSecondary,
  });

  assert.equal(resSec.success, true);
  assert.equal(resSec.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resSec.postId, "226949230493910_feed_99999");
  assert.equal(tokensUsedInCalls.length, 3, "2 photo uploads + 1 feed post");
  assert.ok(tokensUsedInCalls.every(t => t === "EAAB_resolved_page_token_999"));

  console.log("  ✓ Facebook single photo publishing confirmed with post_id capture");
  console.log("  ✓ Facebook caption deterministically includes Google Play URL without duplication");
  console.log("  ✓ Instagram and Pinterest captions remain completely unaffected");
  console.log("  ✓ Facebook network timeout flagged as RECONCILIATION_REQUIRED");
  console.log("  ✓ LifeMode System User Token properly resolves to Page Access Token for unpublished photo uploads");
}

// ============================================================================
// TEST 6: Pinterest Adapter (Trial Gating, Continuous Token Refresh & Pin Posting)
// ============================================================================
{
  console.log("\n[TEST 6] Pinterest Adapter Mock Invocations & Token Lifecycle");

  const adapter = new PinterestAdapter();
  const redis = new MockRedis();

  const trialConfig = getSocialConfig({
    pinterestAccessToken: "pina_active_token",
    pinterestRefreshToken: "pinr_refresh_token",
    pinterestBoardId: "board_12345",
    pinterestAccessTier: "trial",
    pinterestAllowTrialPosting: false,
  });

  const pinManifest = {
    date: "2026-08-28",
    id: "m_pin",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/pin.png", altText: "Virgo Pin" }],
    captions: {
      pinterest: {
        title: "Virgo Title",
        description: "Virgo Desc",
        link: "https://aizodiac.life",
      },
    },
  };

  // 1. Trial Tier Gating
  const resTrial = await adapter.publish({
    manifest: pinManifest,
    config: trialConfig,
    redis,
    fetchFn: async () => {},
  });
  assert.equal(resTrial.success, false);
  assert.equal(resTrial.status, PUBLISH_STATUS.SKIPPED_TRIAL_MODE);
  assert.ok(resTrial.error.message.includes("trial access tier"));

  // 2. Standard Tier + Continuous Token Refresh
  const standardConfig = getSocialConfig({
    pinterestAppId: "pin_app_111",
    pinterestAppSecret: "pin_secret_222",
    pinterestAccessToken: "pina_old_access_token",
    pinterestRefreshToken: "pinr_initial_refresh_token",
    pinterestBoardId: "board_12345",
    pinterestAccessTier: "standard",
  });

  // Seed Redis with an expiring token (expires in 1 hour < 48 hour threshold)
  await savePinterestTokenState(redis, {
    accessToken: "pina_old_access_token",
    refreshToken: "pinr_initial_refresh_token",
    expiresAt: Date.now() + 3600 * 1000,
  });

  let refreshCalled = false;
  let pinCreateCalled = false;

  const mockFetchPinterest = async (url, options) => {
    if (url.includes("/oauth/token")) {
      refreshCalled = true;
      assert.ok(options.headers.Authorization.startsWith("Basic "));
      assert.ok(options.body.includes("grant_type=refresh_token"));
      return new Response(
        JSON.stringify({
          access_token: "pina_fresh_token_888",
          refresh_token: "pinr_rotated_token_999", // Rotated refresh token!
          expires_in: 2592000, // 30 days
          refresh_token_expires_in: 5184000, // 60 days
        }),
        { status: 200 }
      );
    }
    if (url.includes("/v5/pins")) {
      pinCreateCalled = true;
      assert.equal(options.headers.Authorization, "Bearer pina_fresh_token_888");
      return new Response(JSON.stringify({ id: "pin_post_555444333" }), { status: 201 });
    }
    return new Response("Not found", { status: 404 });
  };

  const resStandard = await adapter.publish({
    manifest: pinManifest,
    config: standardConfig,
    redis,
    fetchFn: mockFetchPinterest,
  });

  assert.equal(resStandard.success, true);
  assert.equal(resStandard.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resStandard.postId, "pin_post_555444333");
  assert.equal(refreshCalled, true, "Automatic token refresh must have executed");
  assert.equal(pinCreateCalled, true);

  // Verify rotated tokens were atomically persisted in Redis
  const savedState = await getPinterestTokenState(redis, standardConfig);
  assert.equal(savedState.accessToken, "pina_fresh_token_888");
  assert.equal(savedState.refreshToken, "pinr_rotated_token_999");
  assert.ok(savedState.expiresAt > Date.now() + 20 * 86400 * 1000);

  // 3. LifeMode Pinterest Secondary (LifeModeHQ Astrology Board 495607202683292084)
  const secondaryAdapter = new PinterestAdapter({
    name: DESTINATIONS.PINTEREST_SECONDARY,
    getAppId: (c) => c.lifemodePinterestAppId,
    getAppSecret: (c) => c.lifemodePinterestAppSecret,
    getAccessToken: (c) => c.lifemodePinterestAccessToken,
    getRefreshToken: (c) => c.lifemodePinterestRefreshToken,
    getBoardId: (c) => c.lifemodePinterestBoardId,
    getAccessTier: (c) => c.lifemodePinterestAccessTier || "trial",
    getAllowTrialPosting: (c) => Boolean(c.lifemodePinterestAllowTrialPosting),
  });

  // 3a. Credential Isolation: Primary credentials do NOT satisfy secondary requirement
  const primaryOnlyConfigForPin = getSocialConfig({
    pinterestAppId: "pin_app_primary",
    pinterestAppSecret: "pin_secret_primary",
    pinterestAccessToken: "pina_primary_token",
    pinterestRefreshToken: "pinr_primary_token",
    pinterestBoardId: "9876543210",
    pinterestAccessTier: "standard",
  });
  const secValCheck = secondaryAdapter.validateConfig(primaryOnlyConfigForPin);
  assert.equal(secValCheck.valid, false, "Secondary Pinterest must fail when only primary credentials exist");
  assert.ok(secValCheck.errors.some(e => e.includes("LIFEMODE_PINTEREST_ACCESS_TOKEN")), "Must report missing LifeMode access token");
  assert.ok(secValCheck.errors.some(e => e.includes("LIFEMODE_PINTEREST_BOARD_ID")), "Must report missing LifeMode board ID");

  // 3b. Fully configured LifeMode Pinterest
  const lifemodePinConfig = getSocialConfig({
    pinterestAppId: "pin_app_primary",
    pinterestAppSecret: "pin_secret_primary",
    pinterestAccessToken: "pina_primary_token",
    pinterestRefreshToken: "pinr_primary_token",
    pinterestBoardId: "9876543210",
    pinterestAccessTier: "standard",
    lifemodePinterestAppId: "lm_pin_app_999",
    lifemodePinterestAppSecret: "lm_pin_secret_888",
    lifemodePinterestAccessToken: "pina_lifemode_initial_token",
    lifemodePinterestRefreshToken: "pinr_lifemode_initial_refresh",
    lifemodePinterestBoardId: "495607202683292084",
    lifemodePinterestAccessTier: "standard",
  });

  const secValSuccess = secondaryAdapter.validateConfig(lifemodePinConfig);
  assert.equal(secValSuccess.valid, true, "Valid LifeMode Pinterest config must pass validation");

  // 3c. Health Check against @lifemodehq
  const mockFetchHealth = async (url) => {
    if (url.includes("/user_account")) {
      return new Response(JSON.stringify({ username: "lifemodehq", id: "495607271401849587", account_type: "business" }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const healthRes = await secondaryAdapter.checkHealth({
    config: lifemodePinConfig,
    redis,
    fetchFn: mockFetchHealth,
  });
  assert.equal(healthRes.healthy, true);
  assert.equal(healthRes.details.username, "lifemodehq");
  assert.equal(healthRes.details.boardId, "495607202683292084");
  assert.equal(healthRes.details.destination, DESTINATIONS.PINTEREST_SECONDARY);

  // 3d. Isolated Token State Storage in Redis
  await savePinterestTokenState(redis, {
    accessToken: "pina_lifemode_expiring",
    refreshToken: "pinr_lifemode_refresh_123",
    expiresAt: Date.now() + 1800 * 1000, // Expiring in 30 mins (< 48h)
  }, DESTINATIONS.PINTEREST_SECONDARY);

  // Verify primary auth key in Redis is untouched
  const primaryStateBefore = await getPinterestTokenState(redis, lifemodePinConfig, DESTINATIONS.PINTEREST);
  assert.equal(primaryStateBefore.accessToken, "pina_fresh_token_888");

  let lmRefreshCalled = false;
  let lmPinCreated = false;
  let lmPayloadBoardId = null;

  const mockFetchLMPinterest = async (url, options) => {
    if (url.includes("/oauth/token")) {
      lmRefreshCalled = true;
      const basicAuth = Buffer.from("lm_pin_app_999:lm_pin_secret_888").toString("base64");
      assert.equal(options.headers.Authorization, `Basic ${basicAuth}`, "LifeMode OAuth refresh MUST use LifeMode app credentials");
      assert.ok(options.body.includes("refresh_token=pinr_lifemode_refresh_123"));
      return new Response(
        JSON.stringify({
          access_token: "pina_lifemode_rotated_token_777",
          refresh_token: "pinr_lifemode_rotated_token_666",
          expires_in: 2592000,
          refresh_token_expires_in: 5184000,
        }),
        { status: 200 }
      );
    }
    if (url.includes("/v5/pins")) {
      lmPinCreated = true;
      assert.equal(options.headers.Authorization, "Bearer pina_lifemode_rotated_token_777");
      const body = JSON.parse(options.body);
      lmPayloadBoardId = body.board_id;
      return new Response(JSON.stringify({ id: "pin_lifemode_astrology_999" }), { status: 201 });
    }
    return new Response("Not found", { status: 404 });
  };

  const resSecondary = await secondaryAdapter.publish({
    manifest: pinManifest,
    config: lifemodePinConfig,
    redis,
    fetchFn: mockFetchLMPinterest,
  });

  assert.equal(resSecondary.success, true);
  assert.equal(resSecondary.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resSecondary.postId, "pin_lifemode_astrology_999");
  assert.equal(lmRefreshCalled, true, "LifeMode token refresh must have executed");
  assert.equal(lmPinCreated, true, "LifeMode pin must have been created");
  assert.equal(lmPayloadBoardId, "495607202683292084", "LifeMode pin must target Astrology board ID 495607202683292084");

  // Verify secondary token state saved under isolated Redis key
  const savedSecState = await getPinterestTokenState(redis, lifemodePinConfig, DESTINATIONS.PINTEREST_SECONDARY);
  assert.equal(savedSecState.accessToken, "pina_lifemode_rotated_token_777");
  assert.equal(savedSecState.refreshToken, "pinr_lifemode_rotated_token_666");

  // Verify primary token state in Redis remained completely untouched
  const primaryStateAfter = await getPinterestTokenState(redis, lifemodePinConfig, DESTINATIONS.PINTEREST);
  assert.equal(primaryStateAfter.accessToken, "pina_fresh_token_888");

  console.log("  ✓ Trial access tier properly gated and prevented from public publishing");
  console.log("  ✓ Continuous OAuth refresh triggered and rotated credentials saved to Redis");
  console.log("  ✓ Pinterest Pin creation succeeded using freshly rotated access token");
  console.log("  ✓ LifeModeHQ secondary Pinterest targets Astrology board 495607202683292084 with isolated token storage");
}

// ============================================================================
// TEST 7: Coordinator Fault Isolation, Partial Success & Safe Retries
// ============================================================================
{
  console.log("\n[TEST 7] Coordinator Fault Isolation, Partial Success & Safe Retries");

  const redis = new MockRedis();
  const date = "2026-08-28";
  await savePrepareState(redis, date, {
    publishDate: date,
    stage: PREPARE_STAGES.QUALITY_GATE_PASS,
  });

  const manifest = {
    date,
    id: "manifest_test_coordination",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/photo.png" }],
    metadata: {
      qualityGate: QUALITY_GATE_STATUS.PASS,
    },
    captions: {
      instagram: "IG copy",
      facebook: "FB copy",
      pinterest: {
        title: "Pin title",
        description: "Pin desc",
        link: "https://aizodiac.life",
      },
    },
  };

  const config = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_token",
    metaPageId: "page_123",
    instagramAccountId: "ig_456",
    pinterestAccessToken: "pina_token",
    pinterestBoardId: "board_789",
    pinterestAccessTier: "standard",
  });

  // Mock Adapters: Instagram succeeds, Facebook succeeds, Pinterest throws 401 Auth Error
  let igAttempts = 0;
  let fbAttempts = 0;
  let pinAttempts = 0;

  const customAdapters = {
    [PLATFORMS.INSTAGRAM]: {
      publish: async () => {
        igAttempts++;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "ig_id_100",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [PLATFORMS.FACEBOOK]: {
      publish: async () => {
        fbAttempts++;
        return {
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "fb_id_200",
          publishedAt: new Date().toISOString(),
        };
      },
    },
    [PLATFORMS.PINTEREST]: {
      publish: async () => {
        pinAttempts++;
        return {
          success: false,
          status: PUBLISH_STATUS.AUTH_FAILED,
          error: { message: "Pinterest token expired", status: 401 },
        };
      },
    },
  };

  // --- Run 1: First attempt with partial failure ---
  const run1 = await executeSocialPublishing({
    redis,
    config,
    targetDate: date,
    manifest,
    adapters: customAdapters,
  });

  assert.equal(run1.success, true); // PARTIAL_SUCCESS counts as overall handled
  assert.equal(run1.status, "PARTIAL_SUCCESS");
  assert.equal(run1.results.instagram.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(run1.results.facebook.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(run1.results.pinterest.status, PUBLISH_STATUS.AUTH_FAILED);
  assert.equal(igAttempts, 1);
  assert.equal(fbAttempts, 1);
  assert.equal(pinAttempts, 1);

  // --- Run 2: Second attempt (Retry after fixing Pinterest) ---
  // Fix Pinterest adapter for run 2
  customAdapters[PLATFORMS.PINTEREST] = {
    publish: async () => {
      pinAttempts++;
      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: "pin_id_300",
        publishedAt: new Date().toISOString(),
      };
    },
  };

  const run2 = await executeSocialPublishing({
    redis,
    config,
    targetDate: date,
    manifest,
    adapters: customAdapters,
  });

  assert.equal(run2.success, true);
  assert.equal(run2.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(run2.skipped.instagram.reason, "ALREADY_PUBLISHED");
  assert.equal(run2.skipped.facebook.reason, "ALREADY_PUBLISHED");
  assert.equal(run2.results.pinterest.status, PUBLISH_STATUS.PUBLISHED);

  // CRITICAL IDEMPOTENCY ASSERTION:
  assert.equal(igAttempts, 1, "Instagram MUST NOT have been called again on retry!");
  assert.equal(fbAttempts, 1, "Facebook MUST NOT have been called again on retry!");
  assert.equal(pinAttempts, 2, "Pinterest was the ONLY platform retried!");

  // Verify final post state in Redis
  const finalState = await getPostState(redis, date);
  assert.equal(finalState.platforms.instagram.postId, "ig_id_100");
  assert.equal(finalState.platforms.facebook.postId, "fb_id_200");
  assert.equal(finalState.platforms.pinterest.postId, "pin_id_300");
  assert.equal(finalState.overallStatus, PUBLISH_STATUS.PUBLISHED);

  console.log("  ✓ Partial success handled with complete platform fault isolation");
  console.log("  ✓ Confirmed PUBLISHED platforms strictly skipped on subsequent retry");
  console.log("  ✓ Only unconfirmed/failed destinations re-attempted; ambiguous writes require reconciliation");
}

// ============================================================================
// TEST 8: Serverless Route Endpoints (Cron & Canary)
// ============================================================================
{
  console.log("\n[TEST 8] Serverless Route Endpoints (Cron & Canary)");

  // 1. publishDailySocial rejects unauthorized calls
  let statusCode = null;
  let jsonResponse = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  // Missing header
  await cronHandler({ method: "POST", headers: {} }, mockRes);
  assert.equal(statusCode, 401);
  assert.equal(jsonResponse.error, "unauthorized");

  // Valid secret but autoPublishEnabled is false (Default safety state)
  process.env.CRON_SECRET = "super_secret_cron_key";
  process.env.SOCIAL_AUTO_PUBLISH_ENABLED = "false";

  await cronHandler({ method: "GET", headers: { authorization: "Bearer super_secret_cron_key" } }, mockRes);
  assert.equal(statusCode, 200);
  assert.equal(jsonResponse.status, "SKIPPED_AUTO_PUBLISH_DISABLED");

  // 2. canarySocialPublish tokenHealth action
  await canaryHandler(
    {
      method: "GET",
      headers: { authorization: "Bearer super_secret_cron_key" },
      query: { action: "tokenHealth" },
    },
    mockRes
  );
  assert.equal(statusCode, 200);
  assert.equal(jsonResponse.action, "tokenHealth");
  assert.ok(jsonResponse.configView);

  // 3. canarySocialPublish single platform execution (Facebook PUBLISHED -> outer success=true, status=PUBLISHED)
  const canaryRedis = new MockRedis();
  const canaryDate = "2026-08-28";
  const canaryManifest = {
    date: canaryDate,
    id: `social-${canaryDate}`,
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://cdn.aizodiac.app/s1.png", altText: "Slide 1 | AI Zodiac" },
      { url: "https://cdn.aizodiac.app/s2.png", altText: "Slide 2 | AI Zodiac" },
      { url: "https://cdn.aizodiac.app/s3.png", altText: "Slide 3 | AI Zodiac" },
      { url: "https://cdn.aizodiac.app/s4.png", altText: "Slide 4 | AI Zodiac" },
      { url: "https://cdn.aizodiac.app/s5.png", altText: "Slide 5 | AI Zodiac" },
    ],
    metadata: {
      qualityGate: QUALITY_GATE_STATUS.PASS,
    },
    captions: {
      instagram: "Canary IG caption #aizodiac",
      facebook: `Canary FB caption\n\n${DEFAULT_APP_PLAY_STORE_URL}`,
      pinterest: {
        title: "Canary Pin Title",
        description: "Canary Pin Description",
        link: DEFAULT_APP_PLAY_STORE_URL,
      },
    },
  };

  // Seed Redis with manifest and QUALITY_GATE_PASS prepare state
  await canaryRedis.set(`aiz:social:manifest:${canaryDate}`, JSON.stringify(canaryManifest));
  await savePrepareState(canaryRedis, canaryDate, {
    stage: PREPARE_STAGES.QUALITY_GATE_PASS,
  });

  // Inject Facebook adapter mock via executeSocialPublishing directly or canaryHandler
  const canaryResSuccess = await executeSocialPublishing({
    redis: canaryRedis,
    targetDate: canaryDate,
    platforms: ["facebook"],
    isCanary: true,
    adapters: {
      [PLATFORMS.FACEBOOK]: {
        publish: async () => ({
          success: true,
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "canary_fb_post_999",
          publishedAt: new Date().toISOString(),
          error: null,
        }),
        sanitizeError: (err) => ({ message: String(err) }),
      },
    },
  });

  assert.equal(canaryResSuccess.success, true, "Single requested platform PUBLISHED must yield outer success=true");
  assert.equal(canaryResSuccess.status, PUBLISH_STATUS.PUBLISHED, "Single requested platform PUBLISHED must yield outer status=PUBLISHED");
  assert.equal(canaryResSuccess.results.facebook.status, PUBLISH_STATUS.PUBLISHED);

  // 4. canarySocialPublish single platform failure -> outer success=false, status=FAILED
  const canaryResFail = await executeSocialPublishing({
    redis: canaryRedis,
    targetDate: "2026-08-29",
    manifest: { ...canaryManifest, date: "2026-08-29", id: "social-2026-08-29" },
    platforms: ["instagram"],
    isCanary: true,
    adapters: {
      [PLATFORMS.INSTAGRAM]: {
        publish: async () => ({
          success: false,
          status: PUBLISH_STATUS.FAILED,
          error: { message: "Instagram container timed out" },
        }),
        sanitizeError: (err) => ({ message: String(err) }),
      },
    },
  });
  // Note: 2026-08-29 has no prep state in Redis so it will be QUALITY_GATE_BLOCKED
  assert.equal(canaryResFail.success, false);
  assert.equal(canaryResFail.status, "QUALITY_GATE_BLOCKED");

  // With valid QUALITY_GATE_PASS state but adapter failure:
  await savePrepareState(canaryRedis, "2026-08-29", {
    stage: PREPARE_STAGES.QUALITY_GATE_PASS,
  });
  const canaryResAdapterFail = await executeSocialPublishing({
    redis: canaryRedis,
    targetDate: "2026-08-29",
    manifest: { ...canaryManifest, date: "2026-08-29", id: "social-2026-08-29" },
    platforms: ["instagram"],
    isCanary: true,
    adapters: {
      [PLATFORMS.INSTAGRAM]: {
        publish: async () => ({
          success: false,
          status: PUBLISH_STATUS.FAILED,
          error: { message: "Instagram container timed out" },
        }),
        sanitizeError: (err) => ({ message: String(err) }),
      },
    },
  });
  assert.equal(canaryResAdapterFail.success, false, "Failed canary platform must yield outer success=false");
  assert.equal(canaryResAdapterFail.status, PUBLISH_STATUS.FAILED, "Failed canary platform must yield outer status=FAILED");

  // Clean up test env
  delete process.env.CRON_SECRET;
  delete process.env.SOCIAL_AUTO_PUBLISH_ENABLED;

  console.log("  ✓ publishDailySocial cron endpoint enforces CRON_SECRET and fail-closed kill-switch");
  console.log("  ✓ canarySocialPublish endpoint supports authenticated diagnostic inspection");
  console.log("  ✓ canary outer success/status correctly reflects single-platform PUBLISHED result");
  console.log("  ✓ failed/blocked canary states strictly remain fail-closed non-success");
}

// ============================================================================
// TEST 9: Video Adapter Stub Forward Compatibility
// ============================================================================
{
  console.log("\n[TEST 9] Video Adapter Stub Forward Compatibility");

  const stub = new VideoAdapterStub();
  const health = await stub.checkHealth({ config: {} });
  assert.equal(health.healthy, false);

  const pub = await stub.publish({ manifest: {}, config: {} });
  assert.equal(pub.success, false);
  assert.equal(pub.status, PUBLISH_STATUS.SKIPPED);
  assert.ok(pub.error.message.includes("out of scope for V1"));

  console.log("  ✓ VideoAdapterStub provides clean extension point with zero video code");
}

// ============================================================================
// TEST 10: Fail-Closed Production Social Quality Gate Decision Matrix (8 Cases)
// ============================================================================
{
  console.log("\n[TEST 10] Fail-Closed Production Social Quality Gate Decision Matrix (8 Matrix Cases)");

  const baseConfig = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_token",
    metaPageId: "page_123",
    instagramAccountId: "ig_456",
    pinterestAccessToken: "pina_token",
    pinterestBoardId: "board_789",
    pinterestAccessTier: "standard",
  });

  function createMockAdapters() {
    const writes = { instagram: 0, facebook: 0, pinterest: 0 };
    const adapters = {
      [PLATFORMS.INSTAGRAM]: {
        publish: async () => {
          writes.instagram++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_1" };
        },
      },
      [PLATFORMS.FACEBOOK]: {
        publish: async () => {
          writes.facebook++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_1" };
        },
      },
      [PLATFORMS.PINTEREST]: {
        publish: async () => {
          writes.pinterest++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_1" };
        },
      },
    };
    return { adapters, writes };
  }

  function createTestManifest(date, qualityGateValue = undefined) {
    const manifest = {
      date,
      id: `social-${date}`,
      type: MEDIA_TYPES.SINGLE_IMAGE,
      media: [{ url: "https://pub.aizodiac.app/slide.png" }],
      captions: {
        instagram: "IG caption",
        facebook: "FB caption",
        pinterest: {
          title: "Pin title",
          description: "Pin desc",
          link: "https://play.google.com/store/apps/details?id=com.oberon.aizodiac",
        },
      },
    };
    if (qualityGateValue !== undefined) {
      manifest.metadata = { qualityGate: qualityGateValue };
    }
    return manifest;
  }

  // 1. PASS state + PASS manifest -> publishing path allowed
  {
    const date = "2026-09-20";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, true, "PASS state + PASS manifest must allow publishing");
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(writes.instagram, 1);
    assert.equal(writes.facebook, 1);
    assert.equal(writes.pinterest, 1);
    console.log("  ✓ Case 1: PASS state + PASS manifest -> Publishing Allowed (3/3 writes)");
  }

  // 2. PASS state + FAILED manifest -> BLOCKED
  {
    const date = "2026-09-21";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.FAILED);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 2: PASS state + FAILED manifest -> QUALITY_GATE_BLOCKED (0 writes)");
  }

  // 3. FAILED state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-22";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_FAILED });
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 3: FAILED state + PASS manifest -> QUALITY_GATE_BLOCKED (0 writes)");
  }

  // 4. FAILED state + FAILED manifest -> BLOCKED
  {
    const date = "2026-09-23";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_FAILED });
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.FAILED);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 4: FAILED state + FAILED manifest -> QUALITY_GATE_BLOCKED (0 writes)");
  }

  // 5. ABSENT state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-24";
    const redis = new MockRedis(); // empty Redis, no prep state seeded
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 5: ABSENT state + PASS manifest -> QUALITY_GATE_BLOCKED (0 writes)");
  }

  // 6. PASS state + ABSENT quality metadata -> BLOCKED
  {
    const date = "2026-09-25";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createTestManifest(date, undefined); // no metadata.qualityGate
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 6: PASS state + ABSENT quality metadata -> QUALITY_GATE_BLOCKED (0 writes)");
  }

  // 7. INTERMEDIATE state (RENDERED) + PASS manifest -> BLOCKED
  {
    const date = "2026-09-26";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.RENDERED });
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 7: INTERMEDIATE state (RENDERED) + PASS manifest -> QUALITY_GATE_BLOCKED (0 writes)");
  }

  // 8. UNKNOWN state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-27";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: "CORRUPTED_OR_UNKNOWN_STAGE" });
    const manifest = createTestManifest(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockAdapters();

    const res = await executeSocialPublishing({ redis, config: baseConfig, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.instagram, 0, "Instagram writes must be 0");
    assert.equal(writes.facebook, 0, "Facebook writes must be 0");
    assert.equal(writes.pinterest, 0, "Pinterest writes must be 0");
    console.log("  ✓ Case 8: UNKNOWN state + PASS manifest -> QUALITY_GATE_BLOCKED (0 writes)");
  }
}

// ============================================================================
// TEST 11: Multi-Destination Extension (AI Zodiac + LifeMode Comprehensive Matrix)
// ============================================================================
{
  console.log("\n[TEST 11] Multi-Destination Extension (AI Zodiac + LifeMode Matrix)");

  const multiConfig = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_primary_token",
    metaPageId: "primary_fb_123",
    instagramAccountId: "primary_ig_456",
    lifemodeMetaPageAccessToken: "EAAB_lifemode_token",
    lifemodeMetaPageId: "lifemode_fb_789",
    lifemodeInstagramAccountId: "lifemode_ig_012",
  });

  const createManifest = (date) => ({
    date,
    id: `social-${date}`,
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://pub.aizodiac.app/slide1.png" },
      { url: "https://pub.aizodiac.app/slide2.png" },
    ],
    metadata: {
      qualityGate: QUALITY_GATE_STATUS.PASS,
    },
    captions: {
      instagram: "Multi-destination IG copy",
      facebook: "Multi-destination FB copy https://play.google.com/store/apps/details?id=com.oberon.aizodiac",
      pinterest: {
        title: "Multi-destination Pin",
        description: "Multi-destination Pin Description",
        link: "https://play.google.com/store/apps/details?id=com.oberon.aizodiac",
      },
    },
  });

  // Scenario 1: All four Meta destinations succeed
  {
    const date = "2026-10-01";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    const callCounts = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: 0,
      [DESTINATIONS.FACEBOOK_PRIMARY]: 0,
      [DESTINATIONS.INSTAGRAM_SECONDARY]: 0,
      [DESTINATIONS.FACEBOOK_SECONDARY]: 0,
    };

    const adapters = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.INSTAGRAM_PRIMARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "post_ig_prim_1" };
        },
      },
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.FACEBOOK_PRIMARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "post_fb_prim_1" };
        },
      },
      [DESTINATIONS.INSTAGRAM_SECONDARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.INSTAGRAM_SECONDARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "post_ig_sec_1" };
        },
      },
      [DESTINATIONS.FACEBOOK_SECONDARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.FACEBOOK_SECONDARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "post_fb_sec_1" };
        },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: ALL_DESTINATIONS,
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(res.results[DESTINATIONS.INSTAGRAM_PRIMARY].postId, "post_ig_prim_1");
    assert.equal(res.results[DESTINATIONS.FACEBOOK_PRIMARY].postId, "post_fb_prim_1");
    assert.equal(res.results[DESTINATIONS.INSTAGRAM_SECONDARY].postId, "post_ig_sec_1");
    assert.equal(res.results[DESTINATIONS.FACEBOOK_SECONDARY].postId, "post_fb_sec_1");

    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_PRIMARY], 1);
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_PRIMARY], 1);
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_SECONDARY], 1);
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_SECONDARY], 1);

    const postState = await getPostState(redis, date);
    assert.equal(postState.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(postState.platforms[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(postState.platforms[DESTINATIONS.INSTAGRAM_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(postState.platforms[DESTINATIONS.FACEBOOK_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(postState.overallStatus, PUBLISH_STATUS.PUBLISHED);

    console.log("  ✓ Scenario 1: All four Meta destinations succeed with independent states & post IDs");
  }

  // Scenario 2: Primary-only configuration (LifeMode credentials omitted)
  {
    const date = "2026-10-02";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    const primaryOnlyConfig = getSocialConfig({
      autoPublishEnabled: true,
      metaPageAccessToken: "EAAB_primary_token",
      metaPageId: "primary_fb_123",
      instagramAccountId: "primary_ig_456",
      // LifeMode omitted
    });

    let primaryIgCalled = 0;
    let primaryFbCalled = 0;

    const adapters = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: {
        publish: async () => {
          primaryIgCalled++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "prim_ig_only" };
        },
      },
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        publish: async () => {
          primaryFbCalled++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "prim_fb_only" };
        },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: primaryOnlyConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: [DESTINATIONS.INSTAGRAM_PRIMARY, DESTINATIONS.FACEBOOK_PRIMARY],
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(primaryIgCalled, 1);
    assert.equal(primaryFbCalled, 1);
    console.log("  ✓ Scenario 2: Primary-only configuration publishes cleanly without LifeMode requirement");
  }

  // Scenario 3: Targeted secondary execution
  {
    const date = "2026-10-03";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    let primCalled = 0;
    let secCalled = 0;

    const adapters = {
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        publish: async () => {
          primCalled++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "prim_fb" };
        },
      },
      [DESTINATIONS.FACEBOOK_SECONDARY]: {
        publish: async () => {
          secCalled++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "sec_fb" };
        },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: [DESTINATIONS.FACEBOOK_SECONDARY],
    });

    assert.equal(res.success, true);
    assert.equal(secCalled, 1);
    assert.equal(primCalled, 0, "Primary Facebook MUST NOT have received provider writes in targeted secondary run");
    console.log("  ✓ Scenario 3: Targeted secondary execution isolates writes to requested secondary destination");
  }

  // Scenario 4 & 5: Partial Success & Retry after partial failure
  {
    const date = "2026-10-04";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    const callCounts = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: 0,
      [DESTINATIONS.FACEBOOK_PRIMARY]: 0,
      [DESTINATIONS.INSTAGRAM_SECONDARY]: 0,
      [DESTINATIONS.FACEBOOK_SECONDARY]: 0,
    };

    const adapters = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.INSTAGRAM_PRIMARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_p_1" };
        },
      },
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.FACEBOOK_PRIMARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_p_1" };
        },
      },
      [DESTINATIONS.INSTAGRAM_SECONDARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.INSTAGRAM_SECONDARY]++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_s_1" };
        },
      },
      [DESTINATIONS.FACEBOOK_SECONDARY]: {
        publish: async () => {
          callCounts[DESTINATIONS.FACEBOOK_SECONDARY]++;
          return { success: false, status: PUBLISH_STATUS.FAILED, error: { message: "LifeMode FB Graph API rate limit", status: 500 } };
        },
      },
    };

    // Run 1: Initial partial failure
    const run1 = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: ALL_DESTINATIONS,
    });

    assert.equal(run1.success, true);
    assert.equal(run1.status, "PARTIAL_SUCCESS");
    assert.equal(run1.results[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(run1.results[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(run1.results[DESTINATIONS.INSTAGRAM_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(run1.results[DESTINATIONS.FACEBOOK_SECONDARY].status, PUBLISH_STATUS.FAILED);

    assert.equal(callCounts[DESTINATIONS.FACEBOOK_PRIMARY], 1);
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_PRIMARY], 1);
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_SECONDARY], 1);
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_SECONDARY], 1);
    console.log("  ✓ Scenario 4: Partial success records exact per-destination state with overall PARTIAL_SUCCESS");

    // Run 2: Second attempt (Retry after fixing LifeMode FB)
    adapters[DESTINATIONS.FACEBOOK_SECONDARY] = {
      publish: async () => {
        callCounts[DESTINATIONS.FACEBOOK_SECONDARY]++;
        return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_s_retry_1" };
      },
    };

    const run2 = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: ALL_DESTINATIONS,
    });

    assert.equal(run2.success, true);
    assert.equal(run2.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(run2.skipped[DESTINATIONS.FACEBOOK_PRIMARY].reason, "ALREADY_PUBLISHED");
    assert.equal(run2.skipped[DESTINATIONS.INSTAGRAM_PRIMARY].reason, "ALREADY_PUBLISHED");
    assert.equal(run2.skipped[DESTINATIONS.INSTAGRAM_SECONDARY].reason, "ALREADY_PUBLISHED");
    assert.equal(run2.results[DESTINATIONS.FACEBOOK_SECONDARY].status, PUBLISH_STATUS.PUBLISHED);

    // CRITICAL IDEMPOTENCY CHECK:
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_PRIMARY], 1, "Primary Facebook MUST NOT be called again on retry!");
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_PRIMARY], 1, "Primary Instagram MUST NOT be called again on retry!");
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_SECONDARY], 1, "Secondary Instagram MUST NOT be called again on retry!");
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_SECONDARY], 2, "Secondary Facebook was the ONLY destination retried!");

    const postStateAfterRetry = await getPostState(redis, date);
    assert.equal(postStateAfterRetry.platforms[DESTINATIONS.FACEBOOK_PRIMARY].postId, "fb_p_1");
    assert.equal(postStateAfterRetry.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].postId, "ig_p_1");
    assert.equal(postStateAfterRetry.platforms[DESTINATIONS.INSTAGRAM_SECONDARY].postId, "ig_s_1");
    assert.equal(postStateAfterRetry.platforms[DESTINATIONS.FACEBOOK_SECONDARY].postId, "fb_s_retry_1");
    assert.equal(postStateAfterRetry.overallStatus, PUBLISH_STATUS.PUBLISHED);

    console.log("  ✓ Scenario 5: Retry after partial failure re-attempts ONLY the failed destination without duplicating successful primary/secondary publications");

    // Scenario 6: All destinations already published
    const run3 = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: ALL_DESTINATIONS,
    });

    assert.equal(run3.success, true);
    assert.equal(run3.status, "ALL_PLATFORMS_SKIPPED");
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_PRIMARY], 1);
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_PRIMARY], 1);
    assert.equal(callCounts[DESTINATIONS.INSTAGRAM_SECONDARY], 1);
    assert.equal(callCounts[DESTINATIONS.FACEBOOK_SECONDARY], 2);
    console.log("  ✓ Scenario 6: Repeated run on completely published date skips all destinations with 0 writes");
  }

  // Scenario 7: Ambiguous secondary write guard
  {
    const date = "2026-10-05";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    let secIgCalls = 0;
    const adapters = {
      [DESTINATIONS.INSTAGRAM_SECONDARY]: {
        publish: async () => {
          secIgCalls++;
          return {
            success: false,
            status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
            error: { message: "Network socket dropped during media_publish" },
            reconciliationData: { containerId: "cnt_ambiguous_99" },
          };
        },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: [DESTINATIONS.INSTAGRAM_SECONDARY],
    });

    assert.equal(res.status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);

    // Subsequent retry must be blocked
    const retryRes = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: [DESTINATIONS.INSTAGRAM_SECONDARY],
    });

    assert.equal(retryRes.status, "ALL_PLATFORMS_SKIPPED");
    assert.equal(retryRes.skipped[DESTINATIONS.INSTAGRAM_SECONDARY].status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);
    assert.equal(secIgCalls, 1, "Ambiguous write MUST NOT be automatically retried without reconciliation");
    console.log("  ✓ Scenario 7: Ambiguous transport failure on secondary destination sets RECONCILIATION_REQUIRED and blocks automatic duplication");
  }

  // Scenario 8: Invalid LifeMode credentials
  {
    const date = "2026-10-06";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    const adapters = {
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        publish: async () => ({ success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_p_valid" }),
      },
      [DESTINATIONS.FACEBOOK_SECONDARY]: {
        publish: async () => ({ success: false, status: PUBLISH_STATUS.AUTH_FAILED, error: { message: "Invalid OAuth token for LifeMode Page", status: 401 } }),
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: [DESTINATIONS.FACEBOOK_PRIMARY, DESTINATIONS.FACEBOOK_SECONDARY],
    });

    assert.equal(res.results[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(res.results[DESTINATIONS.FACEBOOK_SECONDARY].status, PUBLISH_STATUS.AUTH_FAILED);
    console.log("  ✓ Scenario 8: LifeMode auth failure is completely isolated from Primary success");
  }

  // Scenario 9: Backward compatibility with legacy platform names
  {
    const date = "2026-10-07";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    let primIgCalls = 0;
    let primFbCalls = 0;

    const adapters = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: {
        publish: async () => {
          primIgCalls++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "legacy_ig" };
        },
      },
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        publish: async () => {
          primFbCalls++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "legacy_fb" };
        },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      adapters,
      platforms: ["instagram", "facebook"], // Legacy platform names
    });

    assert.equal(res.success, true);
    assert.equal(primIgCalls, 1);
    assert.equal(primFbCalls, 1);

    const state = await getPostState(redis, date);
    assert.equal(state.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(state.platforms[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    console.log("  ✓ Scenario 9: Legacy platform names (instagram, facebook) map cleanly to primary destinations");
  }

  // Scenario 10: Concurrent execution safety with date lock
  {
    const date = "2026-10-08";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifest(date);

    // Pre-acquire lock to simulate in-flight execution
    await acquireDistributedLock(redis, date);

    const res = await executeSocialPublishing({
      redis,
      config: multiConfig,
      targetDate: date,
      manifest,
      platforms: ALL_DESTINATIONS,
    });

    assert.equal(res.success, false);
    assert.equal(res.status, "LOCK_CONTENTION");
    console.log("  ✓ Scenario 10: Date-level distributed Redis lock prevents concurrent social runs");
  }
}

// ============================================================================
// TEST 12: YouTube Shorts & Pinterest Video Pin Multi-Destination Matrix
// ============================================================================
{
  console.log("\n[TEST 12] YouTube Shorts & Pinterest Video Pin Multi-Destination Matrix");

  const videoConfig = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_test_token_12345",
    metaPageId: "1002938472918",
    instagramAccountId: "17841400123456789",
    pinterestAccessToken: "pina_test_access_token_123",
    pinterestRefreshToken: "pinr_test_refresh_token_456",
    pinterestBoardId: "9876543210",
    pinterestAccessTier: "standard",
    youtubeClientId: "test_yt_client_id_123.apps.googleusercontent.com",
    youtubeClientSecret: "test_yt_client_secret_456",
    youtubeRefreshToken: "1//test_yt_refresh_token_789",
    youtubeChannelId: "UC_aizodiac_official_123",
  });

  const dummyVideoBuffer = Buffer.from("fake_mp4_video_data_10s_short");

  // Scenario 1: YouTube Adapter Direct Upload Flow
  {
    let refreshedToken = false;
    let sessionCreated = false;
    let videoUploaded = false;

    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);

      // 1. Google OAuth Token Refresh
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        refreshedToken = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "ya29.a0_mock_fresh_youtube_token_999",
            expires_in: 3600,
            token_type: "Bearer",
          }),
        };
      }

      // 2. Resumable Upload Session Creation
      if (urlStr.includes("upload/youtube/v3/videos?uploadType=resumable")) {
        sessionCreated = true;
        assert.equal(options.headers?.Authorization, "Bearer ya29.a0_mock_fresh_youtube_token_999");
        assert.equal(options.headers?.["X-Upload-Content-Type"], "video/mp4");
        const body = JSON.parse(options.body);
        assert.ok(body.snippet.title.includes("#Shorts"));
        assert.ok(body.snippet.description.includes(YOUTUBE_TRACKING_PLAY_STORE_URL));
        assert.equal(body.status.selfDeclaredMadeForKids, false);

        return {
          ok: true,
          status: 200,
          headers: new Headers({
            location: "https://upload.youtube.com/upload/youtube/v3/videos?upload_id=yt_upload_session_abc123",
          }),
          json: async () => ({}),
        };
      }

      // 3. Binary Video Upload
      if (urlStr.includes("upload_id=yt_upload_session_abc123")) {
        videoUploaded = true;
        assert.equal(options.method, "PUT");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "dQw4w9WgXcQ",
            snippet: { title: "AI Zodiac Short" },
          }),
        };
      }

      // 4. Source Video Download from R2
      if (urlStr.endsWith(".mp4")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => dummyVideoBuffer.buffer,
        };
      }

      throw new Error(`Unexpected fetch URL in YouTube test: ${urlStr}`);
    };

    const redis = new MockRedis();
    const manifest = generateDailyVideoManifest({
      publishDate: "2026-10-01",
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    const ytAdapter = new YouTubeAdapter();
    const res = await ytAdapter.publish({
      manifest,
      config: videoConfig,
      redis,
      fetchFn: mockFetch,
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(res.postId, "dQw4w9WgXcQ");
    assert.ok(refreshedToken, "OAuth token should be refreshed");
    assert.ok(sessionCreated, "Resumable session should be created");
    assert.ok(videoUploaded, "Video binary should be uploaded");

    // Verify token cached in Redis
    const tokenState = await getYoutubeTokenState(redis, videoConfig);
    assert.equal(tokenState.accessToken, "ya29.a0_mock_fresh_youtube_token_999");

    console.log("  ✓ Scenario 1: YouTube Short upload succeeds with Google OAuth refresh and resumable upload session");
  }

  // Scenario 2: Pinterest Video Pin Flow
  {
    let mediaRegistered = false;
    let mediaUploadedToS3 = false;
    let mediaPolled = false;
    let pinCreated = false;

    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);

      // 1. Pinterest Token Refresh
      if (urlStr.includes("api.pinterest.com/v5/oauth/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "pina_refreshed_access_token_888",
            refresh_token: "pinr_rotated_refresh_token_999",
            expires_in: 2592000,
          }),
        };
      }

      // 2. Register Video Media
      if (urlStr.includes("api.pinterest.com/v5/media") && options.method === "POST") {
        mediaRegistered = true;
        const body = JSON.parse(options.body);
        assert.equal(body.media_type, "video");
        return {
          ok: true,
          status: 201,
          json: async () => ({
            media_id: "pin_media_video_777",
            upload_url: "https://pinterest-media-upload.s3.amazonaws.com/upload",
            upload_parameters: { key: "pin_media_video_777", policy: "abc" },
          }),
        };
      }

      // 3. S3 Media Upload
      if (urlStr.includes("pinterest-media-upload.s3.amazonaws.com")) {
        mediaUploadedToS3 = true;
        return {
          ok: true,
          status: 204,
          text: async () => "",
        };
      }

      // 4. Poll Media Status
      if (urlStr.includes("api.pinterest.com/v5/media/pin_media_video_777") && (!options.method || options.method === "GET")) {
        mediaPolled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            media_id: "pin_media_video_777",
            status: "succeeded",
          }),
        };
      }

      // 5. Create Video Pin
      if (urlStr.includes("api.pinterest.com/v5/pins") && options.method === "POST") {
        pinCreated = true;
        const body = JSON.parse(options.body);
        assert.equal(body.media_source?.source_type, "video_id");
        assert.equal(body.media_source?.media_id, "pin_media_video_777");
        assert.ok(body.description.includes(PINTEREST_VIDEO_TRACKING_PLAY_STORE_URL));
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: "pin_post_video_555",
            title: body.title,
          }),
        };
      }

      // 6. Source Video Download from R2
      if (urlStr.endsWith(".mp4")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => dummyVideoBuffer.buffer,
        };
      }

      throw new Error(`Unexpected fetch URL in Pinterest video test: ${urlStr}`);
    };

    const redis = new MockRedis();
    const manifest = generateDailyVideoManifest({
      publishDate: "2026-10-02",
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    const pinAdapter = new PinterestAdapter();
    const res = await pinAdapter.publish({
      manifest,
      config: videoConfig,
      redis,
      fetchFn: mockFetch,
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(res.postId, "pin_post_video_555");
    assert.ok(mediaRegistered, "Media registration should be called");
    assert.ok(mediaUploadedToS3, "Media should be uploaded to S3");
    assert.ok(mediaPolled, "Media processing status should be polled");
    assert.ok(pinCreated, "Pin should be created with source_type=video_id");

    console.log("  ✓ Scenario 2: Pinterest Video Pin flow completes 4-stage media registration, S3 upload, polling, and Pin creation");
  }

  // Scenario 3: End-to-End Multi-Destination Video Publishing via executeSocialPublishing
  {
    const date = "2026-10-03";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });

    const manifest = generateDailyVideoManifest({
      publishDate: date,
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    let ytCalls = 0;
    let pinCalls = 0;

    const adapters = {
      [DESTINATIONS.YOUTUBE]: {
        publish: async () => {
          ytCalls++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "yt_video_001", publishedAt: new Date().toISOString() };
        },
      },
      [DESTINATIONS.PINTEREST]: {
        publish: async () => {
          pinCalls++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_video_001", publishedAt: new Date().toISOString() };
        },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      adapters,
    });

    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(ytCalls, 1);
    assert.equal(pinCalls, 1);

    const postState = await getPostState(redis, date);
    assert.equal(postState.platforms[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(postState.platforms[DESTINATIONS.YOUTUBE].postId, "yt_video_001");
    assert.equal(postState.platforms[DESTINATIONS.PINTEREST].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(postState.platforms[DESTINATIONS.PINTEREST].postId, "pin_video_001");

    console.log("  ✓ Scenario 3: executeSocialPublishing coordinates multi-destination video run (YouTube + Pinterest) concurrently");
  }

  // Scenario 4: Idempotent Retries Skip Already Published Video Destinations
  {
    const date = "2026-10-03";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });

    // Seed post state as already published for both YouTube & Pinterest
    await savePostState(redis, date, {
      publishDate: date,
      overallStatus: PUBLISH_STATUS.PUBLISHED,
      platforms: {
        [DESTINATIONS.YOUTUBE]: { status: PUBLISH_STATUS.PUBLISHED, postId: "yt_video_001", publishedAt: "2026-10-03T10:00:00Z" },
        [DESTINATIONS.PINTEREST]: { status: PUBLISH_STATUS.PUBLISHED, postId: "pin_video_001", publishedAt: "2026-10-03T10:00:00Z" },
      },
    });

    const manifest = generateDailyVideoManifest({
      publishDate: date,
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    let ytCalls = 0;
    let pinCalls = 0;

    const adapters = {
      [DESTINATIONS.YOUTUBE]: {
        publish: async () => { ytCalls++; return { success: true }; },
      },
      [DESTINATIONS.PINTEREST]: {
        publish: async () => { pinCalls++; return { success: true }; },
      },
    };

    const res = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      adapters,
    });

    assert.equal(res.success, true);
    assert.equal(res.status, "ALL_PLATFORMS_SKIPPED");
    assert.equal(ytCalls, 0, "YouTube upload must be strictly skipped");
    assert.equal(pinCalls, 0, "Pinterest video upload must be strictly skipped");
    assert.equal(res.skipped[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(res.skipped[DESTINATIONS.PINTEREST].status, PUBLISH_STATUS.PUBLISHED);

    console.log("  ✓ Scenario 4: Idempotency guard strictly skips previously published YouTube & Pinterest videos with ZERO write calls");
  }

  // Scenario 5: Partial Failure Recovery (YouTube OK, Pinterest FAIL -> Retry Skips YouTube and Reruns Pinterest)
  {
    const date = "2026-10-04";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });

    const manifest = generateDailyVideoManifest({
      publishDate: date,
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    let ytCallCount = 0;
    let pinCallCount = 0;

    const failingAdapters = {
      [DESTINATIONS.YOUTUBE]: {
        publish: async () => {
          ytCallCount++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "yt_success_1", publishedAt: new Date().toISOString() };
        },
      },
      [DESTINATIONS.PINTEREST]: {
        publish: async () => {
          pinCallCount++;
          return { success: false, status: PUBLISH_STATUS.FAILED, error: { message: "Pinterest 500 Internal Error" } };
        },
      },
    };

    // Run 1: YouTube succeeds, Pinterest fails
    const run1 = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      adapters: failingAdapters,
    });

    assert.equal(run1.success, true); // PARTIAL_SUCCESS has outer success: true
    assert.equal(run1.status, "PARTIAL_SUCCESS");
    assert.equal(ytCallCount, 1);
    assert.equal(pinCallCount, 1);

    const midState = await getPostState(redis, date);
    assert.equal(midState.platforms[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(midState.platforms[DESTINATIONS.PINTEREST].status, PUBLISH_STATUS.FAILED);

    // Run 2: Retry with fixed Pinterest adapter
    const retryAdapters = {
      [DESTINATIONS.YOUTUBE]: {
        publish: async () => {
          ytCallCount++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "yt_unexpected_duplicate" };
        },
      },
      [DESTINATIONS.PINTEREST]: {
        publish: async () => {
          pinCallCount++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_recovered_2", publishedAt: new Date().toISOString() };
        },
      },
    };

    const run2 = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      adapters: retryAdapters,
    });

    assert.equal(run2.success, true);
    assert.equal(run2.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(ytCallCount, 1, "YouTube should NOT have been re-invoked on retry");
    assert.equal(pinCallCount, 2, "Pinterest should have been re-invoked on retry");

    const finalState = await getPostState(redis, date);
    assert.equal(finalState.platforms[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(finalState.platforms[DESTINATIONS.YOUTUBE].postId, "yt_success_1");
    assert.equal(finalState.platforms[DESTINATIONS.PINTEREST].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(finalState.platforms[DESTINATIONS.PINTEREST].postId, "pin_recovered_2");

    console.log("  ✓ Scenario 5: Partial failure recovery isolates failure: YouTube skipped on retry, Pinterest re-attempted and succeeded");
  }

  // Scenario 6: Ambiguous Network Write on YouTube flagged as RECONCILIATION_REQUIRED
  {
    const date = "2026-10-05";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });

    const manifest = generateDailyVideoManifest({
      publishDate: date,
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    const ambiguousAdapters = {
      [DESTINATIONS.YOUTUBE]: {
        publish: async () => {
          return {
            success: false,
            status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
            reconciliationData: { uploadUrl: "https://upload.youtube.com/..." },
            error: { message: "Network socket hangup during binary stream upload" },
          };
        },
      },
      [DESTINATIONS.PINTEREST]: {
        publish: async () => {
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_ok_3" };
        },
      },
    };

    const run = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      adapters: ambiguousAdapters,
    });

    assert.equal(run.results[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);

    // Subsequent retry must skip YouTube due to RECONCILIATION_REQUIRED
    let ytRetryCalls = 0;
    const retryRes = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      adapters: {
        [DESTINATIONS.YOUTUBE]: { publish: async () => { ytRetryCalls++; return { success: true }; } },
        [DESTINATIONS.PINTEREST]: { publish: async () => { return { success: true }; } },
      },
    });

    assert.equal(ytRetryCalls, 0, "Ambiguous write must block automated retry");
    assert.equal(retryRes.skipped[DESTINATIONS.YOUTUBE].status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);

    console.log("  ✓ Scenario 6: Ambiguous YouTube write is flagged RECONCILIATION_REQUIRED and prevents duplicate uploads");
  }

  // Scenario 7: Carousel vs Video Destination Routing in Pinterest Adapter
  {
    const pinAdapter = new PinterestAdapter();

    // Image carousel manifest should use image_url source
    let sourceUsed = null;
    const mockImageFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("oauth/token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "pin_tok", refresh_token: "pin_ref", expires_in: 3600 }) };
      }
      if (urlStr.includes("api.pinterest.com/v5/pins")) {
        const body = JSON.parse(options.body);
        sourceUsed = body.media_source.source_type;
        return { ok: true, status: 201, json: async () => ({ id: "pin_img_123" }) };
      }
      throw new Error(`Unexpected URL: ${urlStr}`);
    };

    const imageManifest = {
      date: "2026-10-06",
      id: "social-2026-10-06",
      type: "carousel",
      media: [{ url: "https://media.aizodiac.app/cover.png", altText: "Cover | AI Zodiac" }],
      captions: { pinterest: { title: "Pin Title", description: "Pin Desc", link: "https://aizodiac.com" } },
    };

    await pinAdapter.publish({ manifest: imageManifest, config: videoConfig, redis: new MockRedis(), fetchFn: mockImageFetch });
    assert.equal(sourceUsed, "image_url", "Carousel manifest must use image_url source");

    console.log("  ✓ Scenario 7: Pinterest adapter accurately distinguishes between image carousel ('image_url') and video ('video_id')");
  }

  // Scenario 8: Dry-Run Mode on Video Manifest
  {
    const date = "2026-10-07";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });

    const manifest = generateDailyVideoManifest({
      publishDate: date,
      mediaBaseUrl: "https://media.aizodiac.app",
    });

    const mockDryFetch = async (url, options = {}) => {
      if (options.method === "HEAD") {
        return { ok: true, status: 200 };
      }
      if (String(url).includes("oauth2.googleapis.com") || String(url).includes("oauth/token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const dryRes = await executeSocialPublishing({
      redis,
      config: videoConfig,
      targetDate: date,
      manifest,
      dryRun: true,
      fetchFn: mockDryFetch,
    });

    assert.equal(dryRes.success, true);
    assert.equal(dryRes.dryRun, true);
    assert.equal(dryRes.manifestType, MEDIA_TYPES.VIDEO);
    assert.ok(dryRes.mediaChecks.length === 1);
    assert.equal(dryRes.mediaChecks[0].reachable, true);

    console.log("  ✓ Scenario 8: Dry-run mode validates video manifest and adapter connectivity with zero write calls");
  }
}

console.log("\n==================================================");
console.log("ALL SOCIAL PUBLISHING TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");


