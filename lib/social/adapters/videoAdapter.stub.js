// lib/social/adapters/videoAdapter.stub.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { PUBLISH_STATUS } from "../types.js";

/**
 * Lightweight forward-compatibility stub for future video / Reels adapters.
 * Video publishing is explicitly out of scope for V1.
 */
export class VideoAdapterStub extends BaseSocialAdapter {
  constructor(platformName = "video_stub") {
    super(platformName);
  }

  validateConfig(config) {
    return { valid: false, errors: ["Video publishing is not supported in V1"] };
  }

  async checkHealth({ config, fetchFn = fetch }) {
    return {
      healthy: false,
      error: { message: "Video adapter stub - not implemented in V1", status: 501 },
    };
  }

  async publish({ manifest, config, fetchFn = fetch }) {
    return {
      success: false,
      status: PUBLISH_STATUS.SKIPPED,
      postId: null,
      publishedAt: null,
      error: { message: "Video publishing is out of scope for V1", status: 501 },
    };
  }
}
