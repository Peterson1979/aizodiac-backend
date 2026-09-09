// lib/social/adapters/facebookAdapter.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { PLATFORMS, MEDIA_TYPES, PUBLISH_STATUS } from "../types.js";
import { ensureFacebookGooglePlayLink } from "../content/dailyContentGenerator.js";

export class FacebookAdapter extends BaseSocialAdapter {
  constructor(options = {}) {
    const name = typeof options === "string" ? options : (options.name || options.destinationKey || PLATFORMS.FACEBOOK);
    super(name);
    this.getPageId = typeof options.getPageId === "function"
      ? options.getPageId
      : (config) => (options.pageId || config?.metaPageId);
    this.getAccessToken = typeof options.getAccessToken === "function"
      ? options.getAccessToken
      : (config) => (options.accessToken || config?.metaPageAccessToken);
    this.getApiVersion = typeof options.getApiVersion === "function"
      ? options.getApiVersion
      : (config) => (options.apiVersion || config?.metaGraphApiVersion || "v26.0");
  }

  getBaseUrl(config) {
    const version = this.getApiVersion(config) || "v26.0";
    return `https://graph.facebook.com/${version}`;
  }

  validateConfig(config) {
    const errors = [];
    const token = this.getAccessToken(config);
    const pageId = this.getPageId(config);
    if (!token) errors.push(`Missing Page Access Token for Facebook (${this.name})`);
    if (!pageId) errors.push(`Missing Page ID for Facebook (${this.name})`);
    return { valid: errors.length === 0, errors };
  }

  async checkHealth({ config, fetchFn = fetch }) {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return {
        healthy: false,
        error: { message: validation.errors.join("; "), status: 400 },
      };
    }

    const baseUrl = this.getBaseUrl(config);
    const pageId = this.getPageId(config);
    const token = this.getAccessToken(config);
    const url = `${baseUrl}/${encodeURIComponent(pageId)}?fields=id,name,access_token&access_token=${encodeURIComponent(token)}`;

    try {
      const res = await this.fetchWithTimeout(fetchFn, url, { method: "GET" }, config.httpTimeoutMs);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const isAuth = res.status === 401 || data.error?.code === 190;
        return {
          healthy: false,
          error: this.sanitizeError(data.error || new Error(`Meta API error ${res.status}`), res.status),
          isAuthError: isAuth,
        };
      }

      return {
        healthy: true,
        details: {
          id: data.id,
          name: data.name || "(Page connected)",
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

  /**
   * Resolves the active Page Access Token for publishing.
   * If the configured token is a System User token with Page permissions,
   * querying GET /{pageId}?fields=access_token retrieves the required Page Access Token.
   */
  async resolveActivePageToken({ baseUrl, pageId, configuredToken, config, fetchFn = fetch }) {
    if (!configuredToken || !pageId) return configuredToken;
    const url = `${baseUrl}/${encodeURIComponent(pageId)}?fields=id,name,access_token&access_token=${encodeURIComponent(configuredToken)}`;
    try {
      const res = await this.fetchWithTimeout(fetchFn, url, { method: "GET" }, config?.httpTimeoutMs);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && typeof data.access_token === "string" && data.access_token.trim().length > 0) {
        return data.access_token.trim();
      }
    } catch {
      // Fall back to configuredToken on timeout or network error
    }
    return configuredToken;
  }

  async publish({ manifest, config, fetchFn = fetch }) {
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

    const baseUrl = this.getBaseUrl(config);
    const configuredToken = this.getAccessToken(config);
    const pageId = this.getPageId(config);
    const rawCaption = manifest.captions?.facebook || "";
    const caption = ensureFacebookGooglePlayLink(rawCaption);

    // Resolve Page Access Token (especially required when configured token is System User token)
    const token = await this.resolveActivePageToken({
      baseUrl,
      pageId,
      configuredToken,
      config,
      fetchFn,
    });

    if (manifest.type === MEDIA_TYPES.SINGLE_IMAGE) {
      return await this.publishSinglePhoto({
        baseUrl,
        pageId,
        token,
        imageUrl: manifest.media[0].url,
        caption,
        timeoutMs: config.httpTimeoutMs,
        fetchFn,
      });
    }

    if (manifest.type === MEDIA_TYPES.CAROUSEL) {
      return await this.publishMultiPhotoPost({
        baseUrl,
        pageId,
        token,
        mediaItems: manifest.media,
        caption,
        timeoutMs: config.httpTimeoutMs,
        fetchFn,
      });
    }

    return {
      success: false,
      status: PUBLISH_STATUS.FAILED,
      postId: null,
      publishedAt: null,
      error: { message: `Unsupported media type for Facebook: ${manifest.type}` },
    };
  }

  async publishSinglePhoto({ baseUrl, pageId, token, imageUrl, caption, timeoutMs, fetchFn }) {
    const url = `${baseUrl}/${encodeURIComponent(pageId)}/photos`;

    try {
      const res = await this.fetchWithTimeout(
        fetchFn,
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            url: imageUrl,
            message: caption,
            access_token: token,
          }).toString(),
        },
        timeoutMs
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error || (!data.id && !data.post_id)) {
        const isAuth = res.status === 401 || data.error?.code === 190;
        return {
          success: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(data.error || new Error("Failed to publish photo to Facebook Page"), res.status),
        };
      }

      const confirmedPostId = String(data.post_id || data.id);
      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: confirmedPostId,
        publishedAt: new Date().toISOString(),
        error: null,
      };
    } catch (transportErr) {
      // Ambiguous write guard: request was sent, but connection dropped
      return {
        success: false,
        status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
        postId: null,
        publishedAt: null,
        error: this.sanitizeError(transportErr, null),
        reconciliationData: {
          reason: "AMBIGUOUS_FACEBOOK_PHOTO_TRANSPORT_FAILURE",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async publishMultiPhotoPost({ baseUrl, pageId, token, mediaItems, caption, timeoutMs, fetchFn }) {
    // 1. Concurrently Upload Unpublished Photos
    let photoIds = [];
    try {
      const uploadPromises = mediaItems.map(async (item, idx) => {
        const photoUrl = `${baseUrl}/${encodeURIComponent(pageId)}/photos`;
        const res = await this.fetchWithTimeout(
          fetchFn,
          photoUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              url: item.url,
              published: "false",
              access_token: token,
            }).toString(),
          },
          timeoutMs
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || !data.id) {
          const err = data.error || new Error(`Failed to upload unpublished Facebook photo at index ${idx}`);
          err.status = res.status;
          throw err;
        }
        return data.id;
      });

      photoIds = await Promise.all(uploadPromises);
    } catch (uploadErr) {
      const isAuth = uploadErr.status === 401 || uploadErr.code === 190;
      return {
        success: false,
        status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
        postId: null,
        publishedAt: null,
        error: this.sanitizeError(uploadErr, uploadErr.status || null),
      };
    }

    // 2. Publish Feed Post attaching the uploaded photo IDs
    const feedUrl = `${baseUrl}/${encodeURIComponent(pageId)}/feed`;
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));

    try {
      const feedRes = await this.fetchWithTimeout(
        fetchFn,
        feedUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            message: caption,
            attached_media: JSON.stringify(attachedMedia),
            access_token: token,
          }).toString(),
        },
        timeoutMs
      );

      const feedData = await feedRes.json().catch(() => ({}));
      if (!feedRes.ok || feedData.error || !feedData.id) {
        const isAuth = feedRes.status === 401 || feedData.error?.code === 190;
        return {
          success: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          publishedAt: null,
          error: this.sanitizeError(feedData.error || new Error("Failed to publish multi-photo feed post to Facebook"), feedRes.status),
        };
      }

      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: String(feedData.id),
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
          reason: "AMBIGUOUS_FACEBOOK_FEED_POST_TRANSPORT_FAILURE",
          photoIds,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
