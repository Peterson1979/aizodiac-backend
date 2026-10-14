import assert from "node:assert/strict";
import { PinterestAdapter } from "./lib/social/adapters/pinterestAdapter.js";
import { getSocialConfig } from "./lib/social/config.js";
import { DESTINATIONS, MEDIA_TYPES, PUBLISH_STATUS } from "./lib/social/types.js";

const config = getSocialConfig({
  pinterestAppId: "app-id",
  pinterestAppSecret: "app-secret",
  pinterestAccessToken: "expired-access-token",
  pinterestRefreshToken: "refresh-token",
  pinterestBoardId: "ai-zodiac-board-id",
  pinterestAccessTier: "standard",
  pinterestAllowTrialPosting: true,
  httpTimeoutMs: 5000,
});

const redis = {
  async get() { return null; },
  async set() { return "OK"; },
};

const manifest = {
  id: "pinterest-video-regression",
  type: MEDIA_TYPES.VIDEO,
  topic: "AI Zodiac",
  media: [{ url: "https://media.example/video.mp4" }],
  captions: {
    pinterest: {
      title: "AI Zodiac video",
      description: "AI Zodiac video description",
      link: "https://aizodiac.life/",
    },
  },
};

let registrationCalls = 0;
let pinPayload = null;

const fetchFn = async (url, options = {}) => {
  if (url.endsWith("/oauth/token")) {
    return new Response(JSON.stringify({
      access_token: "rotated-access-token",
      refresh_token: "rotated-refresh-token",
      expires_in: 3600,
      refresh_token_expires_in: 7200,
    }), { status: 200 });
  }

  if (url.endsWith("/v5/media") && options.method === "POST") {
    registrationCalls += 1;
    if (registrationCalls === 1) return new Response(JSON.stringify({ code: 401, message: "expired" }), { status: 401 });
    return new Response(JSON.stringify({
      media_id: "media-1",
      upload_url: "https://upload.example/media-1",
      upload_parameters: { key: "media-1" },
    }), { status: 201 });
  }

  if (url === "https://media.example/video.mp4") {
    const bytes = new TextEncoder().encode("video");
    return new Response(bytes, { status: 200 });
  }

  if (url === "https://upload.example/media-1") return new Response(null, { status: 204 });

  if (url.endsWith("/v5/media/media-1")) {
    return new Response(JSON.stringify({ media_id: "media-1", status: "succeeded" }), { status: 200 });
  }

  if (url.endsWith("/v5/pins") && options.method === "POST") {
    pinPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "pin-1" }), { status: 201 });
  }

  throw new Error(`Unexpected Pinterest URL: ${url}`);
};

const result = await new PinterestAdapter({ name: DESTINATIONS.PINTEREST }).publish({
  manifest,
  config,
  redis,
  fetchFn,
  pollOptions: { maxAttempts: 1, pollIntervalMs: 0 },
});

assert.equal(result.success, true);
assert.equal(result.status, PUBLISH_STATUS.PUBLISHED);
assert.equal(result.postId, "pin-1");
assert.equal(registrationCalls, 2, "A 401 media registration must be retried after token refresh");
assert.equal(pinPayload.board_id, "ai-zodiac-board-id");
assert.equal(pinPayload.media_source.source_type, "video_id");
assert.equal(pinPayload.media_source.media_id, "media-1");
assert.equal(pinPayload.media_source.cover_image_url, "https://aizodiac.life/images/cover.png");

console.log("Pinterest regression tests passed");
