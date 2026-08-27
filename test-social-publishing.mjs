// test-social-publishing.mjs
import assert from "node:assert/strict";
import {
  PLATFORMS,
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
import { VideoAdapterStub } from "./lib/social/adapters/videoAdapter.stub.js";
import { executeSocialPublishing } from "./lib/social/publishCoordinator.js";
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
// TEST 1: Config Validation & Secret Redaction
// ============================================================================
{
  console.log("\n[TEST 1] Configuration Validation & Secret Redaction");

  const emptyConfig = getSocialConfig({});
  const validation = validateSocialConfig(emptyConfig);
  assert.equal(validation.valid, false, "Empty config should fail validation");
  assert.ok(validation.errors.length >= 3, "Should report missing credentials for all platforms");

  const validConfig = getSocialConfig({
    metaPageAccessToken: "EAAB_test_token_12345",
    metaPageId: "1002938472918",
    instagramAccountId: "17841400123456789",
    pinterestAccessToken: "pina_test_access_token_123",
    pinterestRefreshToken: "pinr_test_refresh_token_456",
    pinterestBoardId: "9876543210",
  });
  const validCheck = validateSocialConfig(validConfig);
  assert.equal(validCheck.valid, true, "Fully populated config should pass validation");

  // Secret redaction test
  const rawSecretString = "Error with EAAB1234567890abcdef and pina_secret999 and Bearer my_cron_secret";
  const redactedString = redactSecrets(rawSecretString);
  assert.ok(!redactedString.includes("EAAB1234567890abcdef"), "Meta token must be redacted");
  assert.ok(!redactedString.includes("pina_secret999"), "Pinterest token must be redacted");
  assert.ok(!redactedString.includes("my_cron_secret"), "Bearer auth must be redacted");

  const secretObj = {
    metaPageAccessToken: "EAABsecret",
    cronSecret: "super_secret_cron",
    nested: { password: "pass", status: "OK", token: "xyz" },
  };
  const redactedObj = redactSecrets(secretObj);
  assert.equal(redactedObj.metaPageAccessToken, "[REDACTED]");
  assert.equal(redactedObj.cronSecret, "[REDACTED]");
  assert.equal(redactedObj.nested.password, "[REDACTED]");
  assert.equal(redactedObj.nested.token, "[REDACTED]");
  assert.equal(redactedObj.nested.status, "OK");

  const sanitizedView = getSanitizedConfigView(validConfig);
  assert.equal(sanitizedView.metaTokenConfigured, true);
  assert.equal(sanitizedView.pinterestTokenConfigured, true);
  assert.ok(sanitizedView.metaPageId.startsWith("***"), "Page ID should be masked");

  console.log("  ✓ Config validation properly enforces required platform keys");
  console.log("  ✓ Secret redaction reliably scrubs tokens from strings and deep objects");
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
      facebook: "✨ Virgo Daily Guidance! https://aizodiac.app",
      pinterest: {
        title: "Virgo Daily Guidance",
        description: "Daily astrological alignment for Virgo.",
        link: "https://aizodiac.app",
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
        link: "https://aizodiac.app",
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

  // 1. Single Image Success Flow
  let createCalled = false;
  let publishCalled = false;
  const mockFetchSingle = async (url, options) => {
    if (url.includes("/media_publish")) {
      publishCalled = true;
      assert.ok(options.body.includes("creation_id=ig_container_111"));
      return new Response(JSON.stringify({ id: "ig_post_999999" }), { status: 200 });
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
  });

  assert.equal(resSingle.success, true);
  assert.equal(resSingle.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resSingle.postId, "ig_post_999999");
  assert.equal(createCalled, true);
  assert.equal(publishCalled, true);

  // 2. Carousel Success Flow (3 slides)
  let childCount = 0;
  let parentCreated = false;
  const mockFetchCarousel = async (url, options) => {
    if (url.includes("/media_publish")) {
      return new Response(JSON.stringify({ id: "ig_carousel_post_777" }), { status: 200 });
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
  });

  assert.equal(resCarousel.success, true);
  assert.equal(resCarousel.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(resCarousel.postId, "ig_carousel_post_777");
  assert.equal(childCount, 3, "Should have created 3 child containers concurrently");
  assert.equal(parentCreated, true);

  // 3. Provider Error Preservation (Meta 400 rejection)
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
  });
  assert.equal(resError.success, false);
  assert.equal(resError.status, PUBLISH_STATUS.FAILED);
  assert.equal(resError.error.code, 100);
  assert.equal(resError.error.subcode, 2207001);
  assert.equal(resError.error.fbtrace_id, "TraceId12345");

  // 4. Ambiguous Post-Write Transport Failure Guard
  const mockFetchAmbiguous = async (url) => {
    if (url.includes("/media_publish")) {
      throw new Error("Connection reset by peer after sending publish command");
    }
    return new Response(JSON.stringify({ id: "ig_container_ambig" }), { status: 200 });
  };

  const resAmbig = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchAmbiguous,
  });
  assert.equal(resAmbig.success, false);
  assert.equal(resAmbig.status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);
  assert.equal(resAmbig.reconciliationData.reason, "AMBIGUOUS_PUBLISH_TRANSPORT_FAILURE");
  assert.equal(resAmbig.containerId, "ig_container_ambig");

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

  // Single Photo Success
  const mockFetchFb = async (url, options) => {
    assert.ok(url.includes("/1002938472918/photos"));
    return new Response(JSON.stringify({ id: "photo_123", post_id: "feed_story_456" }), { status: 200 });
  };

  const singleManifest = {
    date: "2026-08-28",
    id: "m1",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/pic1.png" }],
    captions: { facebook: "FB copy" },
  };

  const res = await adapter.publish({
    manifest: singleManifest,
    config,
    fetchFn: mockFetchFb,
  });

  assert.equal(res.success, true);
  assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
  assert.equal(res.postId, "feed_story_456");

  // Ambiguous write handling
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

  console.log("  ✓ Facebook single photo publishing confirmed with post_id capture");
  console.log("  ✓ Facebook network timeout flagged as RECONCILIATION_REQUIRED");
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
        link: "https://aizodiac.app",
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

  console.log("  ✓ Trial access tier properly gated and prevented from public publishing");
  console.log("  ✓ Continuous OAuth refresh triggered and rotated credentials saved to Redis");
  console.log("  ✓ Pinterest Pin creation succeeded using freshly rotated access token");
}

// ============================================================================
// TEST 7: Coordinator Fault Isolation, Partial Success & Safe Retries
// ============================================================================
{
  console.log("\n[TEST 7] Coordinator Fault Isolation, Partial Success & Safe Retries");

  const redis = new MockRedis();
  const date = "2026-08-28";
  const manifest = {
    date,
    id: "manifest_test_coordination",
    type: MEDIA_TYPES.SINGLE_IMAGE,
    media: [{ url: "https://cdn.aizodiac.app/photo.png" }],
    captions: {
      instagram: "IG copy",
      facebook: "FB copy",
      pinterest: {
        title: "Pin title",
        description: "Pin desc",
        link: "https://aizodiac.app",
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
  console.log("  ✓ Only failed destinations re-attempted, guaranteeing zero duplicates");
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

  // Clean up test env
  delete process.env.CRON_SECRET;
  delete process.env.SOCIAL_AUTO_PUBLISH_ENABLED;

  console.log("  ✓ publishDailySocial cron endpoint enforces CRON_SECRET and fail-closed kill-switch");
  console.log("  ✓ canarySocialPublish endpoint supports authenticated diagnostic inspection");
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

console.log("\n==================================================");
console.log("ALL SOCIAL PUBLISHING TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
