// lib/social/adapters/facebookAdapter.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { PLATFORMS, MEDIA_TYPES, PUBLISH_STATUS } from "../types.js";
import { ensureFacebookGooglePlayLink } from "../content/dailyContentGenerator.js";

export class FacebookAdapter extends BaseSocialAdapter {
  constructor() {
    super(PLATFORMS.FACEBOOK);
  }

  getBaseUrl(config) {
    const version = config?.metaGraphApiVersion || "v26.0";
    return `https://graph.facebook.com/${version}`;
  }

  validateConfig(config) {
    const errors = [];
    if (!config?.metaPageAccessToken) errors.push("Missing META_PAGE_ACCESS_TOKEN for Facebook");
    if (!config?.metaPageId) errors.push("Missing META_PAGE_ID for Facebook");
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
    const url = `${baseUrl}/${encodeURIComponent(config.metaPageId)}?fields=id,name&access_token=${encodeURIComponent(config.metaPageAccessToken)}`;

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
        },
      };
    } catch (err) {
      return {
        healthy: false,
        error: this.sanitizeError(err, null),
      };
    }
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
    const token = config.metaPageAccessToken;
    const pageId = config.metaPageId;
    const rawCaption = manifest.captions?.facebook || "";
    const caption = ensureFacebookGooglePlayLink(rawCaption);

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
