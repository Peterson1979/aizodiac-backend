// lib/social/adapters/youtubeAdapter.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { PLATFORMS, DESTINATIONS, canonicalizeDestination, PUBLISH_STATUS } from "../types.js";
import {
  getYoutubeTokenState,
  saveYoutubeTokenState,
} from "../stateHelper.js";
import { formatYouTubeVideoDescription } from "../content/videoCatalog.js";

export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_CHANNELS_API_URL = "https://www.googleapis.com/youtube/v3/channels";
export const YOUTUBE_UPLOAD_API_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

export const YOUTUBE_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class YouTubeAdapter extends BaseSocialAdapter {
  constructor(options = {}) {
    const name = typeof options === "string" ? options : (options.name || options.destinationKey || PLATFORMS.YOUTUBE);
    super(name);
    const isLifeMode = canonicalizeDestination(name) === DESTINATIONS.YOUTUBE_LIFEMODE;

    this.getClientId = typeof options.getClientId === "function"
      ? options.getClientId
      : (c) => (options.clientId || (isLifeMode ? c?.lifemodeYoutubeClientId : c?.youtubeClientId) || "");
    this.getClientSecret = typeof options.getClientSecret === "function"
      ? options.getClientSecret
      : (c) => (options.clientSecret || (isLifeMode ? c?.lifemodeYoutubeClientSecret : c?.youtubeClientSecret) || "");
    this.getRefreshToken = typeof options.getRefreshToken === "function"
      ? options.getRefreshToken
      : (c) => (options.refreshToken || (isLifeMode ? c?.lifemodeYoutubeRefreshToken : c?.youtubeRefreshToken) || "");
    this.getChannelId = typeof options.getChannelId === "function"
      ? options.getChannelId
      : (c) => (options.channelId || (isLifeMode ? (c?.lifemodeYoutubeChannelId || "UC0S9aU2uKFsg5x55jkwqYlg") : c?.youtubeChannelId) || "");
    this.getPrivacyStatus = typeof options.getPrivacyStatus === "function"
      ? options.getPrivacyStatus
      : (c) => (options.privacyStatus || (isLifeMode ? (c?.lifemodeYoutubePrivacyStatus || "public") : (c?.youtubePrivacyStatus || "public")));
    this.getCategoryId = typeof options.getCategoryId === "function"
      ? options.getCategoryId
      : (c) => (options.categoryId || (isLifeMode ? (c?.lifemodeYoutubeCategoryId || "24") : (c?.youtubeCategoryId || "24")));
  }

  validateConfig(config) {
    const errors = [];
    const isLifeMode = canonicalizeDestination(this.name) === DESTINATIONS.YOUTUBE_LIFEMODE;
    const clientId = this.getClientId(config);
    const clientSecret = this.getClientSecret(config);
    const refreshToken = this.getRefreshToken(config);

    if (!clientId) {
      errors.push(`Missing ${isLifeMode ? "LIFEMODE_YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_ID" : "YOUTUBE_CLIENT_ID"} for YouTube (${this.name})`);
    }
    if (!clientSecret) {
      errors.push(`Missing ${isLifeMode ? "LIFEMODE_YOUTUBE_CLIENT_SECRET / YOUTUBE_CLIENT_SECRET" : "YOUTUBE_CLIENT_SECRET"} for YouTube (${this.name})`);
    }
    if (!refreshToken) {
      errors.push(`Missing ${isLifeMode ? "LIFEMODE_YOUTUBE_REFRESH_TOKEN" : "YOUTUBE_REFRESH_TOKEN"} for YouTube (${this.name})`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Refreshes YouTube / Google OAuth access token if expired or nearing expiry.
   * Persists rotated token in Redis.
   * @param {object} params
   * @param {object} params.config
   * @param {object} [params.redis]
   * @param {Function} [params.fetchFn=fetch]
   * @param {boolean} [params.force=false]
   * @returns {Promise<{ success: boolean, accessToken?: string, error?: object }>}
   */
  async ensureValidAccessToken({ config, redis, fetchFn = fetch, force = false }) {
    const tokenState = await getYoutubeTokenState(redis, config, this.name);
    const now = Date.now();

    const isExpiringSoon = tokenState.expiresAt
      ? (tokenState.expiresAt - now < YOUTUBE_TOKEN_REFRESH_THRESHOLD_MS)
      : false;

    if (!force && tokenState.accessToken && !isExpiringSoon) {
      return { success: true, accessToken: tokenState.accessToken };
    }

    const clientId = this.getClientId(config);
    const clientSecret = this.getClientSecret(config);
    const refreshToken = tokenState.refreshToken || this.getRefreshToken(config);

    if (!refreshToken || !clientId || !clientSecret) {
      if (tokenState.accessToken && !force) {
        return { success: true, accessToken: tokenState.accessToken };
      }
      return {
        success: false,
        error: { message: `Missing YouTube client ID, client secret, or refresh token for token refresh (${this.name})`, status: 401 },
      };
    }

    try {
      const res = await this.fetchWithTimeout(
        fetchFn,
        GOOGLE_OAUTH_TOKEN_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
          }).toString(),
        },
        config.httpTimeoutMs
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.access_token) {
        return {
          success: false,
          error: this.sanitizeError(data.error_description || data.error || data || new Error("YouTube token refresh rejected"), res.status),
        };
      }

      const expiresInSec = Number(data.expires_in) || 3600;
      const newExpiresAt = now + (expiresInSec * 1000);

      if (redis) {
        await saveYoutubeTokenState(redis, {
          accessToken: data.access_token,
          refreshToken,
          expiresAt: newExpiresAt,
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

    try {
      const res = await this.fetchWithTimeout(
        fetchFn,
        `${YOUTUBE_CHANNELS_API_URL}?part=snippet&mine=true`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenRes.accessToken}`,
            "Accept": "application/json",
          },
        },
        config.httpTimeoutMs
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const isAuth = res.status === 401;
        return {
          healthy: false,
          error: this.sanitizeError(data.error || data, res.status),
          isAuthError: isAuth,
        };
      }

      const channelItem = data.items?.[0];
      return {
        healthy: true,
        details: {
          destination: this.name,
          channelId: channelItem?.id || this.getChannelId(config) || "(authenticated)",
          channelTitle: channelItem?.snippet?.title || "(channel connected)",
          privacyStatus: this.getPrivacyStatus(config) || "public",
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

    // 2. Obtain valid access token (auto-refresh if needed)
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

    // 3. Validate video media item
    const mediaItem = manifest.media?.[0];
    if (!mediaItem || !mediaItem.url) {
      return {
        success: false,
        status: PUBLISH_STATUS.FAILED,
        postId: null,
        publishedAt: null,
        error: { message: "Missing video media item URL for YouTube Short upload" },
      };
    }

    // 4. Format YouTube Shorts snippet and status metadata
    const ytCopy = (manifest.captions && (manifest.captions[this.name] || manifest.captions.youtube)) || {};
    const rawTitle = ytCopy.title || manifest.topic || "AI Zodiac Astrological Insights";
    const title = rawTitle.slice(0, 100);

    const description = ytCopy.description || formatYouTubeVideoDescription({
      baseDescription: manifest.captions?.facebook || "",
      websiteUrl: manifest.destinationUrl,
    });

    const tags = Array.isArray(ytCopy.tags) && ytCopy.tags.length > 0
      ? ytCopy.tags
      : ["AI Zodiac", "astrology", "horoscope", "zodiac", "Shorts", "zodiac signs"];

    const metadata = {
      snippet: {
        title,
        description,
        tags,
        categoryId: this.getCategoryId(config) || "24",
        defaultLanguage: "en",
        defaultAudioLanguage: "en",
      },
      status: {
        privacyStatus: this.getPrivacyStatus(config) || "public",
        selfDeclaredMadeForKids: false,
      },
    };

    // 5. Initiate Resumable Upload Session
    let uploadUrl;
    try {
      const sessionRes = await this.fetchWithTimeout(
        fetchFn,
        `${YOUTUBE_UPLOAD_API_URL}?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tokenRes.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/mp4",
            "Accept": "application/json",
          },
          body: JSON.stringify(metadata),
        },
        config.httpTimeoutMs
      );

      // Handle 401 token expiry retry (once)
      if (sessionRes.status === 401) {
        const refreshAttempt = await this.ensureValidAccessToken({ config, redis, fetchFn, force: true });
        if (refreshAttempt.success) {
          tokenRes = refreshAttempt;
          const retrySessionRes = await this.fetchWithTimeout(
            fetchFn,
            `${YOUTUBE_UPLOAD_API_URL}?uploadType=resumable&part=snippet,status`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${tokenRes.accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
                "Accept": "application/json",
              },
              body: JSON.stringify(metadata),
            },
            config.httpTimeoutMs
          );

          if (!retrySessionRes.ok) {
            const errData = await retrySessionRes.json().catch(() => ({}));
            return {
              success: false,
              status: retrySessionRes.status === 401 ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
              postId: null,
              publishedAt: null,
              error: this.sanitizeError(errData.error || errData, retrySessionRes.status),
            };
          }

          uploadUrl = retrySessionRes.headers.get("location") || retrySessionRes.headers.get("Location");
        } else {
          return {
            success: false,
            status: PUBLISH_STATUS.AUTH_FAILED,
            postId: null,
            publishedAt: null,
            error: refreshAttempt.error,
          };
        }
      } else if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        return {
          success: false,
          status: sessionRes.status === 401 ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(errData.error || errData, sessionRes.status),
        };
      } else {
        uploadUrl = sessionRes.headers.get("location") || sessionRes.headers.get("Location");
      }

      if (!uploadUrl) {
        return {
          success: false,
          status: PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: { message: "YouTube upload session initialization returned no Location header" },
        };
      }
    } catch (sessionErr) {
      return {
        success: false,
        status: PUBLISH_STATUS.FAILED,
        postId: null,
        publishedAt: null,
        error: this.sanitizeError(sessionErr, null),
      };
    }

    // 6. Acquire Video Binary Payload
    let videoBuffer;
    try {
      const videoRes = await fetchFn(mediaItem.url);
      if (!videoRes.ok) {
        return {
          success: false,
          status: PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: { message: `Failed to fetch source video from ${mediaItem.url}: HTTP ${videoRes.status}` },
        };
      }
      videoBuffer = await videoRes.arrayBuffer();
    } catch (fetchMediaErr) {
      return {
        success: false,
        status: PUBLISH_STATUS.FAILED,
        postId: null,
        publishedAt: null,
        error: { message: `Failed to read video asset: ${fetchMediaErr.message}` },
      };
    }

    // 7. Upload Video Binary Payload via PUT with Ambiguous Write Guard
    try {
      const uploadRes = await fetchFn(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(videoBuffer.byteLength),
          "Accept": "application/json",
        },
        body: videoBuffer,
      });

      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok && uploadRes.status !== 201) {
        return {
          success: false,
          status: uploadRes.status === 401 ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(uploadData.error || uploadData, uploadRes.status),
        };
      }

      const videoId = uploadData.id;
      if (!videoId) {
        return {
          success: false,
          status: PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: { message: "YouTube upload completed but response contained no video ID" },
        };
      }

      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: String(videoId),
        publishedAt: uploadData.snippet?.publishedAt || new Date().toISOString(),
        error: null,
      };
    } catch (uploadTransportErr) {
      // Ambiguous write guard: transport failed after session created
      return {
        success: false,
        status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
        postId: null,
        publishedAt: null,
        error: this.sanitizeError(uploadTransportErr, null),
        reconciliationData: {
          reason: "AMBIGUOUS_YOUTUBE_UPLOAD_TRANSPORT_FAILURE",
          uploadUrl,
          title,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
