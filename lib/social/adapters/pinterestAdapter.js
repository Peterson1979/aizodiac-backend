// lib/social/adapters/pinterestAdapter.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { PLATFORMS, PUBLISH_STATUS } from "../types.js";
import {
  getPinterestTokenState,
  savePinterestTokenState,
} from "../stateHelper.js";

export const PINTEREST_API_BASE_URL = "https://api.pinterest.com/v5";
export const PINTEREST_TOKEN_REFRESH_THRESHOLD_MS = 48 * 3600 * 1000; // 48 hours

export class PinterestAdapter extends BaseSocialAdapter {
  constructor() {
    super(PLATFORMS.PINTEREST);
  }

  validateConfig(config) {
    const errors = [];
    if (!config?.pinterestAccessToken && !config?.pinterestRefreshToken) {
      errors.push("Missing PINTEREST_ACCESS_TOKEN or PINTEREST_REFRESH_TOKEN for Pinterest");
    }
    if (!config?.pinterestBoardId) {
      errors.push("Missing PINTEREST_BOARD_ID for Pinterest");
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
    const tokenState = await getPinterestTokenState(redis, config);
    const now = Date.now();

    const isExpiringSoon = tokenState.expiresAt
      ? (tokenState.expiresAt - now < PINTEREST_TOKEN_REFRESH_THRESHOLD_MS)
      : false;

    if (!force && tokenState.accessToken && !isExpiringSoon) {
      return { success: true, accessToken: tokenState.accessToken };
    }

    // Refresh token is required for continuous OAuth refresh
    const refreshToken = tokenState.refreshToken || config.pinterestRefreshToken;
    const appId = config.pinterestAppId;
    const appSecret = config.pinterestAppSecret;

    if (!refreshToken || !appId || !appSecret) {
      // If we don't have refresh capability but have an access token, use it if not forced
      if (tokenState.accessToken && !force) {
        return { success: true, accessToken: tokenState.accessToken };
      }
      return {
        success: false,
        error: { message: "Missing Pinterest refresh token, app ID, or app secret for token refresh", status: 401 },
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

      // Atomically persist rotated credential state in Redis
      if (redis) {
        await savePinterestTokenState(redis, {
          accessToken: data.access_token,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt,
          refreshTokenExpiresAt: newRefreshExpiresAt,
        });
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
          accessTier: config.pinterestAccessTier,
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
    const isStandardTier = config.pinterestAccessTier === "standard";
    if (!isStandardTier && !config.pinterestAllowTrialPosting) {
      return {
        success: false,
        status: PUBLISH_STATUS.SKIPPED_TRIAL_MODE,
        postId: null,
        publishedAt: null,
        error: {
          message: "Pinterest is in trial access tier - public posting suppressed until Standard access is verified",
          tier: config.pinterestAccessTier,
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

    // 4. Prepare Pin Payload
    const pinCopy = manifest.captions?.pinterest || {};
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

    const payload = {
      board_id: config.pinterestBoardId,
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

    // 5. Execute Pin Publication (with Ambiguous Write Guard)
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
          boardId: config.pinterestBoardId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
