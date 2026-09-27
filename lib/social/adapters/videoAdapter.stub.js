// lib/social/adapters/videoAdapter.stub.js
import { PUBLISH_STATUS } from "../types.js";
import { YouTubeAdapter } from "./youtubeAdapter.js";

/**
 * Backward compatibility stub for legacy tests/code.
 */
export class VideoAdapterStub {
  constructor(platformName = "video") {
    this.platformName = platformName;
  }

  async checkHealth({ config = {} } = {}) {
    return {
      healthy: false,
      details: null,
      error: "Video publishing stub: out of scope for V1",
    };
  }

  async publish({ manifest = {}, config = {} } = {}) {
    return {
      success: false,
      status: PUBLISH_STATUS.SKIPPED,
      error: { message: "Video publishing is out of scope for V1 (videoAdapter is a stub)" },
    };
  }
}

export { YouTubeAdapter };

