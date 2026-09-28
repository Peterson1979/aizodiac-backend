import { BaseSocialAdapter } from "./baseAdapter.js";
import { MEDIA_TYPES, PLATFORMS, DESTINATIONS, canonicalizeDestination, PUBLISH_STATUS } from "../types.js";
import {
  getPinterestTokenState,
  savePinterestTokenState,
} from "../stateHelper.js";

export const PINTEREST_API_BASE_URL = "https://api.pinterest.com/v5";
export const PINTEREST_TOKEN_REFRESH_THRESHOLD_MS = 48 * 3600 * 1000; // 48 hours

export class PinterestAdapter extends BaseSocialAdapter {
  constructor(options = {}) {
    const name = typeof options === "string" ? options : (options.name || options.destinationKey || PLATFORMS.PINTEREST);
    super(name);
    const isSecondary = canonicalizeDestination(name) === DESTINATIONS.PINTEREST_SECONDARY;

    this.getAppId = typeof options.getAppId === "function"
      ? options.getAppId
      : (c) => (options.appId || (isSecondary ? c?.lifemodePinterestAppId : c?.pinterestAppId) || "");
    this.getAppSecret = typeof options.getAppSecret === "function"
      ? options.getAppSecret
      : (c) => (options.appSecret || (isSecondary ? c?.lifemodePinterestAppSecret : c?.pinterestAppSecret) || "");
    this.getAccessToken = typeof options.getAccessToken === "function"
      ? options.getAccessToken
      : (c) => (options.accessToken || (isSecondary ? c?.lifemodePinterestAccessToken : c?.pinterestAccessToken) || "");
    this.getRefreshToken = typeof options.getRefreshToken === "function"
      ? options.getRefreshToken
      : (c) => (options.refreshToken || (isSecondary ? c?.lifemodePinterestRefreshToken : c?.pinterestRefreshToken) || "");
    this.getBoardId = typeof options.getBoardId === "function"
      ? options.getBoardId
      : (c) => (options.boardId || (isSecondary ? c?.lifemodePinterestBoardId : c?.pinterestBoardId) || "");
    this.getAccessTier = typeof options.getAccessTier === "function"
      ? options.getAccessTier
      : (c) => (options.accessTier || (isSecondary ? (c?.lifemodePinterestAccessTier || "trial") : (c?.pinterestAccessTier || "trial")));
    this.getAllowTrialPosting = typeof options.getAllowTrialPosting === "function"
      ? options.getAllowTrialPosting
      : (c) => (options.allowTrialPosting ?? (isSecondary ? Boolean(c?.lifemodePinterestAllowTrialPosting) : Boolean(c?.pinterestAllowTrialPosting)));
  }

  validateConfig(config) {
    const errors = [];
    const isSecondary = canonicalizeDestination(this.name) === DESTINATIONS.PINTEREST_SECONDARY;
    const accessToken = this.getAccessToken(config);
    const refreshToken = this.getRefreshToken(config);
    const boardId = this.getBoardId(config);

    if (!accessToken && !refreshToken) {
      const tokenName = isSecondary
        ? "LIFEMODE_PINTEREST_ACCESS_TOKEN or LIFEMODE_PINTEREST_REFRESH_TOKEN"
        : "PINTEREST_ACCESS_TOKEN or PINTEREST_REFRESH_TOKEN";
      errors.push(`Missing ${tokenName} for Pinterest (${this.name})`);
    }
    if (!boardId) {
      const boardName = isSecondary ? "LIFEMODE_PINTEREST_BOARD_ID" : "PINTEREST_BOARD_ID";
      errors.push(`Missing ${boardName} for Pinterest (${this.name})`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Refreshes Pinterest OAuth credentials if nearing expiry or expired.
   * @param {object} params
   * @param {object} params.config
   * @param {object} [params.redis]
   * @param {Function} [params.fetchFn=fetch]
   * @param {boolean} [params.force=false]
   * @returns {Promise<{ success: boolean, accessToken?: string, error?: object }>}
   */
  async ensureValidAccessToken({ config, redis, fetchFn = fetch, force = false }) {
    const tokenState = await getPinterestTokenState(redis, config, this.name);
    const now = Date.now();

    const isExpiringSoon = tokenState.expiresAt
      ? (tokenState.expiresAt - now < PINTEREST_TOKEN_REFRESH_THRESHOLD_MS)
      : false;

    if (!force && tokenState.accessToken && !isExpiringSoon) {
      return { success: true, accessToken: tokenState.accessToken };
    }

    // Refresh token is required for continuous OAuth refresh
    const refreshToken = tokenState.refreshToken || this.getRefreshToken(config);
    const appId = this.getAppId(config);
    const appSecret = this.getAppSecret(config);

    if (!refreshToken || !appId || !appSecret) {
      // If we don't have refresh capability but have an access token, use it if not forced
      if (tokenState.accessToken && !force) {
        return { success: true, accessToken: tokenState.accessToken };
      }
      const isSecondary = canonicalizeDestination(this.name) === DESTINATIONS.PINTEREST_SECONDARY;
      const prefix = isSecondary ? "LifeMode Pinterest" : "Pinterest";
      return {
        success: false,
        error: { message: `Missing ${prefix} refresh token, app ID, or app secret for token refresh (${this.name})`, status: 401 },
      };
    }

    try {
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
      const res = await this.fetchWithTimeout(
        fetchFn,
        `${PINTEREST_API_BASE_URL}/oauth/token`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }).toString(),
        },
        config.httpTimeoutMs
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.access_token) {
        return {
          success: false,
          error: this.sanitizeError(data.error || data || new Error("Pinterest token refresh rejected"), res.status),
        };
      }

      // Source of truth for expiry: provider-returned expires_in
      const expiresInSec = Number(data.expires_in) || (30 * 86400);
      const refreshExpiresInSec = Number(data.refresh_token_expires_in) || (60 * 86400);

      const newExpiresAt = now + (expiresInSec * 1000);
      const newRefreshExpiresAt = now + (refreshExpiresInSec * 1000);
      const newRefreshToken = data.refresh_token || refreshToken;

      // Atomically persist rotated credential state in Redis under destination key
      if (redis) {
        await savePinterestTokenState(redis, {
          accessToken: data.access_token,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt,
          refreshTokenExpiresAt: newRefreshExpiresAt,
        }, this.name);
      }

      return {
        success: true,
        accessToken: data.access_token,
      };
    } catch (refreshErr) {
      return {
        success: false,
        error: this.sanitizeError(refreshErr, null),
      };
    }
  }

  async checkHealth({ config, redis, fetchFn = fetch }) {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return {
        healthy: false,
        error: { message: validation.errors.join("; "), status: 400 },
      };
    }

    const tokenRes = await this.ensureValidAccessToken({ config, redis, fetchFn });
    if (!tokenRes.success) {
      return {
        healthy: false,
        error: tokenRes.error,
        isAuthError: true,
      };
    }

    const url = `${PINTEREST_API_BASE_URL}/user_account`;

    try {
      const res = await this.fetchWithTimeout(
        fetchFn,
        url,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenRes.accessToken}`,
          },
        },
        config.httpTimeoutMs
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.code || data.message?.toLowerCase().includes("error")) {
        const isAuth = res.status === 401;
        return {
          healthy: false,
          error: this.sanitizeError(data, res.status),
          isAuthError: isAuth,
        };
      }

      return {
        healthy: true,
        details: {
          username: data.username || "(connected)",
          accountType: data.account_type || "business",
          accessTier: this.getAccessTier(config),
          boardId: this.getBoardId(config),
          destination: this.name,
        },
      };
    } catch (err) {
      return {
        healthy: false,
        error: this.sanitizeError(err, null),
      };
    }
  }

  async publish({ manifest, config, redis, fetchFn = fetch }) {
    // 1. Validate configuration
    const configCheck = this.validateConfig(config);
    if (!configCheck.valid) {
      return {
        success: false,
        status: PUBLISH_STATUS.AUTH_FAILED,
        postId: null,
        publishedAt: null,
        error: { message: configCheck.errors.join("; "), status: 400 },
      };
    }

    // 2. Pinterest Access Tier Safety Gate
    const accessTier = this.getAccessTier(config);
    const allowTrialPosting = this.getAllowTrialPosting(config);
    const isStandardTier = accessTier === "standard";
    if (!isStandardTier && !allowTrialPosting) {
      return {
        success: false,
        status: PUBLISH_STATUS.SKIPPED_TRIAL_MODE,
        postId: null,
        publishedAt: null,
        error: {
          message: `Pinterest is in trial access tier (${this.name}) - public posting suppressed until Standard access is verified`,
          tier: accessTier,
        },
      };
    }

    // 3. Obtain valid access token (auto-refresh if needed)
    let tokenRes = await this.ensureValidAccessToken({ config, redis, fetchFn });
    if (!tokenRes.success) {
      return {
        success: false,
        status: PUBLISH_STATUS.AUTH_FAILED,
        postId: null,
        publishedAt: null,
        error: tokenRes.error,
      };
    }

    // 4. Validate Media Item URL
    const mediaItem = manifest.media?.[0];
    if (!mediaItem || !mediaItem.url) {
      return {
        success: false,
        status: PUBLISH_STATUS.FAILED,
        postId: null,
        publishedAt: null,
        error: { message: "Missing media item URL for Pinterest Pin" },
      };
    }

    const isSecondary = canonicalizeDestination(this.name) === DESTINATIONS.PINTEREST_SECONDARY;
    const pinCopy = (isSecondary && manifest.captions?.pinterest_secondary)
      ? manifest.captions.pinterest_secondary
      : (manifest.captions?.pinterest || {});
    const isVideoManifest = manifest.type === MEDIA_TYPES.VIDEO || manifest.type === "video";
    const boardId = this.getBoardId(config);

    // =========================================================================
    // BRANCH A: Video Pin Publishing (Pinterest API v5 Media Register -> Upload -> Pin)
    // =========================================================================
    if (isVideoManifest) {
      return await this.publishVideoPin({
        manifest,
        mediaItem,
        pinCopy,
        boardId,
        config,
        tokenRes,
        redis,
        fetchFn,
      });
    }

    // =========================================================================
    // BRANCH B: Image / Carousel Pin Publishing (Existing Image Pin Path)
    // =========================================================================
    const payload = {
      board_id: boardId,
      title: pinCopy.title || "",
      description: pinCopy.description || "",
      link: pinCopy.link || "",
      media_source: {
        source_type: "image_url",
        url: mediaItem.url,
      },
      alt_text: mediaItem.altText || pinCopy.title || "",
    };

    const url = `${PINTEREST_API_BASE_URL}/pins`;

    // Execute Image Pin Publication (with Ambiguous Write Guard)
    try {
      const res = await this.fetchWithTimeout(
        fetchFn,
        url,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tokenRes.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        config.httpTimeoutMs
      );

      // Handle 401 token expiry retry (once)
      if (res.status === 401) {
        const refreshAttempt = await this.ensureValidAccessToken({ config, redis, fetchFn, force: true });
        if (refreshAttempt.success) {
          const retryRes = await this.fetchWithTimeout(
            fetchFn,
            url,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${refreshAttempt.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            },
            config.httpTimeoutMs
          );

          const retryData = await retryRes.json().catch(() => ({}));
          if (!retryRes.ok || !retryData.id) {
            return {
              success: false,
              status: retryRes.status === 401 ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
              postId: null,
              publishedAt: null,
              error: this.sanitizeError(retryData, retryRes.status),
            };
          }

          return {
            success: true,
            status: PUBLISH_STATUS.PUBLISHED,
            postId: String(retryData.id),
            publishedAt: new Date().toISOString(),
            error: null,
          };
        }
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.id) {
        const isAuth = res.status === 401;
        return {
          success: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(data, res.status),
        };
      }

      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: String(data.id),
        publishedAt: new Date().toISOString(),
        error: null,
      };
    } catch (transportErr) {
      // Ambiguous write guard
      return {
        success: false,
        status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
        postId: null,
        publishedAt: null,
        error: this.sanitizeError(transportErr, null),
        reconciliationData: {
          reason: "AMBIGUOUS_PINTEREST_PIN_TRANSPORT_FAILURE",
          boardId: boardId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Publishes a video Pin using Pinterest API v5 /media and /pins endpoints.
   */
  async publishVideoPin({
    manifest,
    mediaItem,
    pinCopy,
    boardId,
    config,
    tokenRes,
    redis,
    fetchFn,
  }) {
    let accessToken = tokenRes.accessToken;

    try {
      // 1. Register media upload with Pinterest API v5
      const mediaRegisterRes = await this.fetchWithTimeout(
        fetchFn,
        `${PINTEREST_API_BASE_URL}/media`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ media_type: "video" }),
        },
        config.httpTimeoutMs
      );

      // Handle 401 refresh
      if (mediaRegisterRes.status === 401) {
        const refreshAttempt = await this.ensureValidAccessToken({ config, redis, fetchFn, force: true });
        if (!refreshAttempt.success) {
          return {
            success: false,
            status: PUBLISH_STATUS.AUTH_FAILED,
            postId: null,
            publishedAt: null,
            error: refreshAttempt.error,
          };
        }
        accessToken = refreshAttempt.accessToken;
      }

      const mediaData = await mediaRegisterRes.json().catch(() => ({}));
      if (!mediaRegisterRes.ok || !mediaData.media_id) {
        return {
          success: false,
          status: mediaRegisterRes.status === 401 ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(mediaData.error || mediaData, mediaRegisterRes.status),
        };
      }

      const mediaId = String(mediaData.media_id);
      const uploadUrl = mediaData.upload_url;
      const uploadParams = mediaData.upload_parameters || {};

      // 2. Fetch video binary payload
      const videoRes = await fetchFn(mediaItem.url);
      if (!videoRes.ok) {
        return {
          success: false,
          status: PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: { message: `Failed to fetch video source from ${mediaItem.url}: HTTP ${videoRes.status}` },
        };
      }
      const videoBuffer = await videoRes.arrayBuffer();

      // 3. Upload video to upload_url using FormData
      if (uploadUrl) {
        const formData = new FormData();
        for (const [k, v] of Object.entries(uploadParams)) {
          formData.append(k, String(v));
        }
        const blob = new Blob([videoBuffer], { type: "video/mp4" });
        formData.append("file", blob, "video.mp4");

        const s3UploadRes = await fetchFn(uploadUrl, {
          method: "POST",
          body: formData,
        });

        if (!s3UploadRes.ok && s3UploadRes.status !== 204 && s3UploadRes.status !== 200) {
          return {
            success: false,
            status: PUBLISH_STATUS.FAILED,
            postId: null,
            publishedAt: null,
            error: { message: `Pinterest S3 media upload failed with HTTP ${s3UploadRes.status}` },
          };
        }
      }

      // 4. Poll media status until succeeded (or up to 5 attempts)
      let mediaReady = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const statusRes = await this.fetchWithTimeout(
          fetchFn,
          `${PINTEREST_API_BASE_URL}/media/${mediaId}`,
          {
            method: "GET",
            headers: { "Authorization": `Bearer ${accessToken}` },
          },
          config.httpTimeoutMs
        );

        if (statusRes.ok) {
          const statusData = await statusRes.json().catch(() => ({}));
          if (statusData.status === "succeeded") {
            mediaReady = true;
            break;
          } else if (statusData.status === "failed") {
            return {
              success: false,
              status: PUBLISH_STATUS.FAILED,
              postId: null,
              publishedAt: null,
              error: { message: "Pinterest video processing failed on provider side" },
            };
          }
        }
      }

      // 5. Create Video Pin via /pins
      const videoPinPayload = {
        board_id: boardId,
        title: (pinCopy.title || manifest.topic || "").slice(0, 100),
        description: (pinCopy.description || "").slice(0, 500),
        link: pinCopy.link || "",
        media_source: {
          source_type: "video_id",
          media_id: mediaId,
        },
      };

      const pinRes = await this.fetchWithTimeout(
        fetchFn,
        `${PINTEREST_API_BASE_URL}/pins`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(videoPinPayload),
        },
        config.httpTimeoutMs
      );

      const pinData = await pinRes.json().catch(() => ({}));
      if (!pinRes.ok || !pinData.id) {
        return {
          success: false,
          status: pinRes.status === 401 ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(pinData, pinRes.status),
        };
      }

      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: String(pinData.id),
        publishedAt: new Date().toISOString(),
        error: null,
      };

    } catch (videoPinErr) {
      return {
        success: false,
        status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
        postId: null,
        publishedAt: null,
        error: this.sanitizeError(videoPinErr, null),
        reconciliationData: {
          reason: "AMBIGUOUS_PINTEREST_VIDEO_PIN_TRANSPORT_FAILURE",
          boardId: boardId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
