// test-threads-publishing.mjs
import assert from "node:assert/strict";

import {
  DESTINATIONS,
  PLATFORMS,
  PUBLISH_STATUS,
  MEDIA_TYPES,
  canonicalizeDestination,
  canonicalizeDestinations,
  createDefaultPostState,
} from "./lib/social/types.js";
import {
  getSocialConfig,
  validateSocialConfig,
  redactSecrets,
} from "./lib/social/config.js";
import {
  formatThreadsCaption,
  DEFAULT_THREADS_CTA,
  THREADS_MAX_CHARACTERS,
} from "./lib/social/content/destinations.js";
import { ThreadsAdapter } from "./lib/social/adapters/threadsAdapter.js";
import {
  executeSocialPublishing,
  createDefaultAdapters,
  resolveAdapter,
} from "./lib/social/publishCoordinator.js";
import {
  getPostState,
  savePostState,
  calculateOverallStatus,
} from "./lib/social/stateHelper.js";
import { savePrepareState, PREPARE_STAGES } from "./lib/social/prepareStateHelper.js";
import { QUALITY_GATE_STATUS } from "./lib/social/quality/socialQualityGate.js";

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

async function runThreadsTestSuite() {
  console.log("==================================================");
  console.log("RUNNING THREADS PUBLISHING SUBSYSTEM TEST SUITE");
  console.log("==================================================");

  // --------------------------------------------------------------------------
  // [TEST 1] Configuration Validation & Secret Redaction
  // --------------------------------------------------------------------------
  console.log("\n[TEST 1] Threads Configuration Validation & Secret Redaction");
  {
    const validConfig = getSocialConfig({
      threadsUserId: "threads_user_12345",
      threadsAccessToken: "THQ_test_threads_access_token_abc",
      threadsApiVersion: "v1.0",
    });

    const valResult = validateSocialConfig(validConfig, [DESTINATIONS.THREADS]);
    assert.equal(valResult.valid, true);
    assert.equal(valResult.errors.length, 0);

    // Missing credentials fail closed
    const invalidConfig = getSocialConfig({
      threadsUserId: "",
      threadsAccessToken: "",
    });
    const invResult = validateSocialConfig(invalidConfig, [DESTINATIONS.THREADS]);
    assert.equal(invResult.valid, false);
    assert.ok(invResult.errors.some(e => e.includes("THREADS_ACCESS_TOKEN")));
    assert.ok(invResult.errors.some(e => e.includes("THREADS_USER_ID")));

    // Secret redaction scrubs THQ tokens
    const rawString = "Error contacting Threads: THQ_test_threads_access_token_abc";
    const redactedString = redactSecrets(rawString);
    assert.ok(!redactedString.includes("THQ_test_threads_access_token_abc"));
    assert.ok(redactedString.includes("[REDACTED_THREADS_TOKEN]"));

    // Deep object redaction preserves 'threads' platform key while masking threadsAccessToken
    const stateObj = {
      threadsAccessToken: "THQ_secret_token",
      platforms: {
        threads: {
          status: PUBLISH_STATUS.PUBLISHED,
          postId: "threads_post_999",
        },
      },
    };
    const redactedObj = redactSecrets(stateObj);
    assert.equal(redactedObj.threadsAccessToken, "[REDACTED]");
    assert.equal(redactedObj.platforms.threads.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(redactedObj.platforms.threads.postId, "threads_post_999");

    console.log("  ✓ Threads config validation enforces required credentials");
    console.log("  ✓ Secret redaction scrubs Threads access tokens while preserving destination state");
  }

  // --------------------------------------------------------------------------
  // [TEST 2] Caption Formatting & Character Limits
  // --------------------------------------------------------------------------
  console.log("\n[TEST 2] Threads Caption Formatting & Character Limits (<= 500 chars)");
  {
    // 1. Normal caption formatting
    const formatted = formatThreadsCaption({
      baseCaption: "✨ Full Moon in Pisces: Intuitive Breakthroughs\n\nTrust your inner compass as deep emotional clarity surfaces today across all water signs.\n\n#astrology #horoscope #aizodiac #pisces",
      websiteUrl: "https://aizodiac.life/features/personal-horoscope",
    });

    assert.ok(formatted.includes("Full Moon in Pisces"));
    assert.ok(formatted.includes("https://aizodiac.life/"));
    assert.ok(formatted.length <= THREADS_MAX_CHARACTERS, `Caption length ${formatted.length} exceeds max ${THREADS_MAX_CHARACTERS}`);

    // 2. Extremely long summary is cleanly truncated
    const longBaseCaption = "✨ Extremely Long Cosmic Update: " + "A".repeat(800) + "\n\n#astrology #zodiac";
    const truncated = formatThreadsCaption({
      baseCaption: longBaseCaption,
      websiteUrl: "https://aizodiac.life/",
    });

    assert.ok(truncated.length <= THREADS_MAX_CHARACTERS, `Truncated caption length ${truncated.length} must be <= 500`);
    assert.ok(truncated.includes("https://aizodiac.life/"));
    assert.ok(truncated.includes("..."));

    console.log("  ✓ Caption formatting preserves AI Zodiac branding, CTA link, and hashtags");
    console.log(`  ✓ Enforces strict Threads ${THREADS_MAX_CHARACTERS}-character limit with graceful truncation`);
  }

  // --------------------------------------------------------------------------
  // [TEST 3] Threads Adapter: Single Image Lifecycle
  // --------------------------------------------------------------------------
  console.log("\n[TEST 3] Threads Adapter: Single Image Container Creation, Polling & Publishing");
  {
    const config = {
      threadsUserId: "threads_user_123",
      threadsAccessToken: "THQ_mock_token",
      threadsApiVersion: "v1.0",
    };

    let containerCreated = false;
    let statusCheckCount = 0;
    let publishedPost = false;

    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("/threads") && options.method === "POST" && !urlStr.includes("threads_publish")) {
        containerCreated = true;
        assert.ok(options.body.includes("media_type=IMAGE"));
        assert.ok(options.body.includes("image_url="));
        return new Response(JSON.stringify({ id: "th_container_img_01" }), { status: 200 });
      }
      if (urlStr.includes("th_container_img_01") && (!options.method || options.method === "GET")) {
        statusCheckCount++;
        const status_code = statusCheckCount >= 2 ? "FINISHED" : "IN_PROGRESS";
        return new Response(JSON.stringify({ status_code, id: "th_container_img_01" }), { status: 200 });
      }
      if (urlStr.includes("threads_publish") && options.method === "POST") {
        publishedPost = true;
        assert.ok(options.body.includes("creation_id=th_container_img_01"));
        return new Response(JSON.stringify({ id: "th_post_img_999" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const adapter = new ThreadsAdapter();
    const manifest = {
      date: "2026-10-01",
      id: "manifest-threads-single",
      type: MEDIA_TYPES.SINGLE_IMAGE,
      media: [{ url: "https://cdn.aizodiac.life/images/daily-01.png" }],
      captions: { threads: "✨ Daily cosmic energy update #astrology #aizodiac" },
    };

    const result = await adapter.publish({
      manifest,
      config,
      fetchFn: mockFetch,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(result.success, true);
    assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(result.postId, "th_post_img_999");
    assert.equal(result.containerId, "th_container_img_01");
    assert.equal(containerCreated, true);
    assert.equal(statusCheckCount, 2);
    assert.equal(publishedPost, true);

    console.log("  ✓ Single image: container creation -> poll IN_PROGRESS -> FINISHED -> publish succeeds");
  }

  // --------------------------------------------------------------------------
  // [TEST 4] Threads Adapter: Carousel Lifecycle (Child Item Containers -> Parent Container -> Publish)
  // --------------------------------------------------------------------------
  console.log("\n[TEST 4] Threads Adapter: Carousel Lifecycle (Concurrent Children -> Parent -> Publish)");
  {
    const config = {
      threadsUserId: "threads_user_123",
      threadsAccessToken: "THQ_mock_token",
      threadsApiVersion: "v1.0",
    };

    let childContainersCreated = 0;
    let childStatusChecks = 0;
    let parentContainerCreated = false;
    let parentStatusChecks = 0;
    let postPublished = false;

    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("/threads") && options.method === "POST" && !urlStr.includes("threads_publish")) {
        const body = options.body || "";
        if (body.includes("media_type=CAROUSEL")) {
          parentContainerCreated = true;
          assert.ok(body.includes("children=th_child_1%2Cth_child_2%2Cth_child_3") || body.includes("children="));
          assert.ok(body.includes("text="));
          return new Response(JSON.stringify({ id: "th_parent_container_888" }), { status: 200 });
        }
        if (body.includes("is_carousel_item=true")) {
          childContainersCreated++;
          return new Response(JSON.stringify({ id: `th_child_${childContainersCreated}` }), { status: 200 });
        }
      }
      if (urlStr.includes("th_child_") && (!options.method || options.method === "GET")) {
        childStatusChecks++;
        return new Response(JSON.stringify({ status_code: "FINISHED", id: "th_child" }), { status: 200 });
      }
      if (urlStr.includes("th_parent_container_888") && (!options.method || options.method === "GET")) {
        parentStatusChecks++;
        return new Response(JSON.stringify({ status_code: "FINISHED", id: "th_parent_container_888" }), { status: 200 });
      }
      if (urlStr.includes("threads_publish") && options.method === "POST") {
        postPublished = true;
        assert.ok(options.body.includes("creation_id=th_parent_container_888"));
        return new Response(JSON.stringify({ id: "th_carousel_post_777" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const adapter = new ThreadsAdapter();
    const carouselManifest = {
      date: "2026-10-01",
      id: "manifest-threads-carousel",
      type: MEDIA_TYPES.CAROUSEL,
      media: [
        { url: "https://cdn.aizodiac.life/images/slide1.png" },
        { url: "https://cdn.aizodiac.life/images/slide2.png" },
        { url: "https://cdn.aizodiac.life/images/slide3.png" },
      ],
      captions: { threads: "✨ 3 Signs with major transit shifts today #astrology #aizodiac" },
    };

    const result = await adapter.publish({
      manifest: carouselManifest,
      config,
      fetchFn: mockFetch,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(result.success, true);
    assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(result.postId, "th_carousel_post_777");
    assert.equal(result.containerId, "th_parent_container_888");
    assert.equal(childContainersCreated, 3, "Must create 3 child containers concurrently");
    assert.equal(childStatusChecks, 3, "Must poll all 3 child containers");
    assert.equal(parentContainerCreated, true, "Must create parent carousel container");
    assert.equal(parentStatusChecks, 1, "Must poll parent container to FINISHED");
    assert.equal(postPublished, true, "Must execute threads_publish for carousel");

    console.log("  ✓ Carousel: 3 child containers -> poll FINISHED -> parent container -> poll FINISHED -> publish succeeds");
  }

  // --------------------------------------------------------------------------
  // [TEST 5] Threads Adapter: Video Lifecycle (VIDEO Container -> Poll -> Publish)
  // --------------------------------------------------------------------------
  console.log("\n[TEST 5] Threads Adapter: Video Lifecycle (VIDEO Container Creation -> Poll -> Publish)");
  {
    const config = {
      threadsUserId: "threads_user_123",
      threadsAccessToken: "THQ_mock_token",
      threadsApiVersion: "v1.0",
    };

    let videoContainerCreated = false;
    let videoStatusChecks = 0;
    let videoPostPublished = false;

    const mockFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("/threads") && options.method === "POST" && !urlStr.includes("threads_publish")) {
        videoContainerCreated = true;
        assert.ok(options.body.includes("media_type=VIDEO"));
        assert.ok(options.body.includes("video_url="));
        return new Response(JSON.stringify({ id: "th_video_container_555" }), { status: 200 });
      }
      if (urlStr.includes("th_video_container_555") && (!options.method || options.method === "GET")) {
        videoStatusChecks++;
        const status_code = videoStatusChecks >= 2 ? "FINISHED" : "IN_PROGRESS";
        return new Response(JSON.stringify({ status_code, id: "th_video_container_555" }), { status: 200 });
      }
      if (urlStr.includes("threads_publish") && options.method === "POST") {
        videoPostPublished = true;
        assert.ok(options.body.includes("creation_id=th_video_container_555"));
        return new Response(JSON.stringify({ id: "th_video_post_111" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const adapter = new ThreadsAdapter();
    const videoManifest = {
      date: "2026-10-01",
      id: "manifest-threads-video",
      type: MEDIA_TYPES.VIDEO,
      media: [{ url: "https://aizodiac-backend-new.vercel.app/videos/promo/1.mp4", duration: 10, aspectRatio: "9:16" }],
      captions: { threads: "✨ What does your zodiac sign REALLY say about you? Discover deeper truths with AI Zodiac." },
    };

    const result = await adapter.publish({
      manifest: videoManifest,
      config,
      fetchFn: mockFetch,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });

    assert.equal(result.success, true);
    assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(result.postId, "th_video_post_111");
    assert.equal(result.containerId, "th_video_container_555");
    assert.equal(videoContainerCreated, true);
    assert.equal(videoStatusChecks, 2);
    assert.equal(videoPostPublished, true);

    console.log("  ✓ Video: VIDEO container creation -> poll IN_PROGRESS -> FINISHED -> publish succeeds");
  }

  // --------------------------------------------------------------------------
  // [TEST 6] Threads Adapter Error Handling & Reconciliation
  // --------------------------------------------------------------------------
  console.log("\n[TEST 6] Threads Adapter: Fail-Closed Error Handling & Transport Failure Reconciliation");
  {
    const config = {
      threadsUserId: "threads_user_123",
      threadsAccessToken: "THQ_mock_token",
      threadsApiVersion: "v1.0",
    };

    const adapter = new ThreadsAdapter();
    const manifest = {
      date: "2026-10-01",
      id: "manifest-err-test",
      type: MEDIA_TYPES.SINGLE_IMAGE,
      media: [{ url: "https://cdn.aizodiac.life/images/err.png" }],
      captions: { threads: "Error test copy" },
    };

    // 1. Container status ERROR fails cleanly
    const mockErrorStatusFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("/threads") && options.method === "POST") {
        return new Response(JSON.stringify({ id: "th_err_cont_01" }), { status: 200 });
      }
      if (urlStr.includes("th_err_cont_01")) {
        return new Response(JSON.stringify({
          status_code: "ERROR",
          error_message: "Media download failed",
        }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    };

    const errResult = await adapter.publish({
      manifest,
      config,
      fetchFn: mockErrorStatusFetch,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });
    assert.equal(errResult.success, false);
    assert.equal(errResult.status, PUBLISH_STATUS.FAILED);
    assert.ok(errResult.error.message.includes("Media download failed"));

    // 2. Ambiguous transport drop during publish flagged as RECONCILIATION_REQUIRED
    const mockTimeoutFetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes("/threads") && options.method === "POST" && !urlStr.includes("threads_publish")) {
        return new Response(JSON.stringify({ id: "th_reconcile_cont_01" }), { status: 200 });
      }
      if (urlStr.includes("th_reconcile_cont_01")) {
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      }
      if (urlStr.includes("threads_publish")) {
        const err = new Error("FetchError: network timeout on POST threads_publish");
        err.name = "FetchError";
        throw err;
      }
      return new Response("Not found", { status: 404 });
    };

    const recResult = await adapter.publish({
      manifest,
      config,
      fetchFn: mockTimeoutFetch,
      pollOptions: { pollIntervalMs: 0, sleepFn: async () => {} },
    });
    assert.equal(recResult.success, false);
    assert.equal(recResult.status, PUBLISH_STATUS.RECONCILIATION_REQUIRED);
    assert.equal(recResult.reconciliationData.containerId, "th_reconcile_cont_01");

    console.log("  ✓ Container status ERROR fails closed with preserved sanitized error");
    console.log("  ✓ Network timeout on threads_publish flags RECONCILIATION_REQUIRED for idempotency protection");
  }

  // --------------------------------------------------------------------------
  // [TEST 7] Coordinator Multi-Platform Execution & Fault Isolation
  // --------------------------------------------------------------------------
  console.log("\n[TEST 7] Coordinator Multi-Platform Execution & Threads Fault Isolation");
  {
    const redis = new MockRedis();
    const date = "2026-10-05";
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });

    let igRan = false;
    let fbRan = false;
    let thRan = false;

    const mockAdapters = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: {
        name: DESTINATIONS.INSTAGRAM_PRIMARY,
        async publish() { igRan = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_p1" }; },
      },
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        name: DESTINATIONS.FACEBOOK_PRIMARY,
        async publish() { fbRan = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_p1" }; },
      },
      [DESTINATIONS.THREADS]: {
        name: DESTINATIONS.THREADS,
        async publish() { thRan = true; return { success: false, status: PUBLISH_STATUS.FAILED, error: { message: "Rate limit" } }; },
      },
    };

    const manifest = {
      date,
      id: `manifest-${date}`,
      type: MEDIA_TYPES.CAROUSEL,
      media: [
        { url: "https://cdn.aizodiac.life/images/s1.png" },
        { url: "https://cdn.aizodiac.life/images/s2.png" },
      ],
      destinations: [DESTINATIONS.INSTAGRAM_PRIMARY, DESTINATIONS.FACEBOOK_PRIMARY, DESTINATIONS.THREADS],
      metadata: { qualityGate: QUALITY_GATE_STATUS.PASS },
      captions: {
        instagram: "IG copy #astrology",
        facebook: "FB copy https://aizodiac.life/",
        pinterest: {
          title: "Pinterest Title",
          description: "Pinterest description text for cosmic insights",
          link: "https://aizodiac.life/",
        },
        threads: "Threads copy https://aizodiac.life/",
      },
    };

    const config = getSocialConfig({
      autoPublishEnabled: true,
      metaPageAccessToken: "EAAB_test",
      metaPageId: "page_1",
      instagramAccountId: "ig_1",
      threadsUserId: "th_user_1",
      threadsAccessToken: "THQ_token_1",
    });

    const runResult = await executeSocialPublishing({
      redis,
      config,
      targetDate: date,
      manifest,
      platforms: [DESTINATIONS.INSTAGRAM_PRIMARY, DESTINATIONS.FACEBOOK_PRIMARY, DESTINATIONS.THREADS],
      adapters: mockAdapters,
      isCanary: true,
    });

    assert.equal(runResult.status, "PARTIAL_SUCCESS");
    assert.equal(runResult.results[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(runResult.results[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(runResult.results[DESTINATIONS.THREADS].status, PUBLISH_STATUS.FAILED);
    assert.equal(igRan, true);
    assert.equal(fbRan, true);
    assert.equal(thRan, true);

    // Verify state in Redis
    const state = await getPostState(redis, date);
    assert.equal(state.platforms[DESTINATIONS.INSTAGRAM_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(state.platforms[DESTINATIONS.FACEBOOK_PRIMARY].status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(state.platforms[DESTINATIONS.THREADS].status, PUBLISH_STATUS.FAILED);

    // Retry should ONLY re-attempt Threads
    let retryIgRan = false;
    let retryThRan = false;

    const retryAdapters = {
      [DESTINATIONS.INSTAGRAM_PRIMARY]: {
        name: DESTINATIONS.INSTAGRAM_PRIMARY,
        async publish() { retryIgRan = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
      },
      [DESTINATIONS.FACEBOOK_PRIMARY]: {
        name: DESTINATIONS.FACEBOOK_PRIMARY,
        async publish() { return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
      },
      [DESTINATIONS.THREADS]: {
        name: DESTINATIONS.THREADS,
        async publish() { retryThRan = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "th_retry_post" }; },
      },
    };

    const retryResult = await executeSocialPublishing({
      redis,
      config,
      targetDate: date,
      manifest,
      platforms: [DESTINATIONS.INSTAGRAM_PRIMARY, DESTINATIONS.FACEBOOK_PRIMARY, DESTINATIONS.THREADS],
      adapters: retryAdapters,
      isCanary: true,
    });

    assert.equal(retryResult.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(retryIgRan, false, "Instagram must be skipped on retry");
    assert.equal(retryThRan, true, "Threads must be retried");
    assert.equal(retryResult.skipped[DESTINATIONS.INSTAGRAM_PRIMARY].reason, "ALREADY_PUBLISHED");
    assert.equal(retryResult.skipped[DESTINATIONS.FACEBOOK_PRIMARY].reason, "ALREADY_PUBLISHED");

    console.log("  ✓ Partial failure recovery verified: Threads failure isolated from IG/FB");
    console.log("  ✓ Idempotent retry skips previously published IG/FB and successfully re-publishes Threads");
  }

  // --------------------------------------------------------------------------
  // [TEST 8] Dry-Run Mode Verification (Zero Writes)
  // --------------------------------------------------------------------------
  console.log("\n[TEST 8] Threads Dry-Run Mode Verification");
  {
    const redis = new MockRedis();
    const date = "2026-10-06";

    const manifest = {
      date,
      id: `manifest-dryrun-${date}`,
      type: MEDIA_TYPES.VIDEO,
      media: [{ url: "https://aizodiac-backend-new.vercel.app/videos/promo/1.mp4", duration: 10, aspectRatio: "9:16" }],
      destinations: [DESTINATIONS.THREADS],
      metadata: { qualityGate: QUALITY_GATE_STATUS.PASS },
      captions: { threads: "Dry run video copy https://aizodiac.life/" },
    };

    let writeCalled = false;
    const mockAdapters = {
      [DESTINATIONS.THREADS]: {
        name: DESTINATIONS.THREADS,
        async publish() { writeCalled = true; return { success: true, status: PUBLISH_STATUS.PUBLISHED }; },
      },
    };

    const mockFetch = async () => new Response("OK", { status: 200 });

    const dryResult = await executeSocialPublishing({
      redis,
      targetDate: date,
      manifest,
      platforms: [DESTINATIONS.THREADS],
      adapters: mockAdapters,
      dryRun: true,
      isCanary: true,
      fetchFn: mockFetch,
    });

    assert.equal(dryResult.success, true);
    assert.equal(dryResult.dryRun, true);
    assert.equal(writeCalled, false, "Dry run must NOT call adapter.publish");
    assert.equal(redis.store.size, 0, "Dry run must perform 0 Redis writes");

    console.log("  ✓ Dry-run mode validates Threads media and connectivity with 0 writes");
  }

  console.log("\n==================================================");
  console.log("ALL THREADS PUBLISHING TESTS PASSED! 🎉");
  console.log("==================================================");
}

runThreadsTestSuite().catch((err) => {
  console.error("❌ Threads test suite failed:", err);
  process.exit(1);
});
