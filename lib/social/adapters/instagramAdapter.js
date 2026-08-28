// lib/social/adapters/instagramAdapter.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { PLATFORMS, MEDIA_TYPES, PUBLISH_STATUS } from "../types.js";
import { redactSecrets } from "../config.js";

export class InstagramAdapter extends BaseSocialAdapter {
  constructor() {
    super(PLATFORMS.INSTAGRAM);
  }

  getBaseUrl(config) {
    const version = config?.metaGraphApiVersion || "v26.0";
    return `https://graph.facebook.com/${version}`;
  }

  validateConfig(config) {
    const errors = [];
    if (!config?.metaPageAccessToken) errors.push("Missing META_PAGE_ACCESS_TOKEN for Instagram");
    if (!config?.instagramAccountId) errors.push("Missing INSTAGRAM_BUSINESS_ACCOUNT_ID for Instagram");
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
    const url = `${baseUrl}/${encodeURIComponent(config.instagramAccountId)}?fields=id,username&access_token=${encodeURIComponent(config.metaPageAccessToken)}`;

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
          username: data.username || "(connected)",
        },
      };
    } catch (err) {
      return {
        healthy: false,
        error: this.sanitizeError(err, null),
      };
    }
  }

  async publish({ manifest, config, fetchFn = fetch, pollOptions = {} }) {
    const configCheck = this.validateConfig(config);
    if (!configCheck.valid) {
      return {
        success: false,
        status: PUBLISH_STATUS.AUTH_FAILED,
        postId: null,
        containerId: null,
        publishedAt: null,
        error: { message: configCheck.errors.join("; "), status: 400 },
      };
    }

    const baseUrl = this.getBaseUrl(config);
    const token = config.metaPageAccessToken;
    const accountId = config.instagramAccountId;
    const caption = manifest.captions?.instagram || "";

    if (manifest.type === MEDIA_TYPES.SINGLE_IMAGE) {
      return await this.publishSingleImage({
        baseUrl,
        accountId,
        token,
        imageUrl: manifest.media[0].url,
        caption,
        timeoutMs: config.httpTimeoutMs,
        fetchFn,
        pollOptions,
      });
    }

    if (manifest.type === MEDIA_TYPES.CAROUSEL) {
      return await this.publishCarousel({
        baseUrl,
        accountId,
        token,
        mediaItems: manifest.media,
        caption,
        timeoutMs: config.httpTimeoutMs,
        fetchFn,
        pollOptions,
      });
    }

    return {
      success: false,
      status: PUBLISH_STATUS.FAILED,
      postId: null,
      containerId: null,
      publishedAt: null,
      error: { message: `Unsupported media type for Instagram: ${manifest.type}` },
    };
  }

  /**
   * Polls an Instagram media container until status_code becomes FINISHED or fails.
   * @param {object} params
   * @param {string} params.baseUrl
   * @param {string} params.token
   * @param {string} params.containerId
   * @param {number} [params.timeoutMs=8000] - Timeout per HTTP request
   * @param {number} [params.maxWaitMs=60000] - Total maximum time to wait for FINISHED
   * @param {number} [params.pollIntervalMs=2000] - Delay between status checks
   * @param {number} [params.maxAttempts] - Explicit max polling attempts
   * @param {function} [params.fetchFn=fetch]
   * @param {function} [params.sleepFn] - Custom sleep function (e.g. for deterministic tests)
   * @returns {Promise<{ ready: boolean, status?: string, error?: object, data?: object }>}
   */
  async waitForContainerReady({
    baseUrl,
    token,
    containerId,
    timeoutMs = 8000,
    maxWaitMs = 60000,
    pollIntervalMs = 2000,
    maxAttempts,
    fetchFn = fetch,
    sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }) {
    const statusUrl = `${baseUrl}/${encodeURIComponent(containerId)}?fields=status_code,status&access_token=${encodeURIComponent(token)}`;
    const effectiveMaxAttempts = Number.isInteger(maxAttempts) && maxAttempts > 0
      ? maxAttempts
      : Math.max(1, Math.ceil(maxWaitMs / Math.max(1, pollIntervalMs)));
    const startTime = Date.now();
    let attempts = 0;

    while (true) {
      attempts++;
      let res;
      let data;

      try {
        res = await this.fetchWithTimeout(fetchFn, statusUrl, { method: "GET" }, timeoutMs);
        data = await res.json().catch(() => ({}));
      } catch (fetchErr) {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(fetchErr, null),
        };
      }

      if (!res.ok || data.error) {
        const isAuth = res.status === 401 || data.error?.code === 190;
        return {
          ready: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            data.error || new Error(`Failed to check status for Instagram container ${containerId}`),
            res.status
          ),
        };
      }

      const statusCode = data.status_code;

      if (statusCode === "FINISHED") {
        return {
          ready: true,
          data,
        };
      }

      if (statusCode === "ERROR") {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            new Error(data.status ? `Instagram container ${containerId} processing error: ${data.status}` : `Instagram container ${containerId} failed with ERROR status`),
            400
          ),
          data,
        };
      }

      if (statusCode === "EXPIRED") {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            new Error(data.status ? `Instagram container ${containerId} expired: ${data.status}` : `Instagram container ${containerId} expired`),
            400
          ),
          data,
        };
      }

      // Check timeout boundary before sleeping
      const elapsed = Date.now() - startTime;
      if (attempts >= effectiveMaxAttempts || elapsed >= maxWaitMs) {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            new Error(`Instagram container ${containerId} readiness timeout after ${attempts} attempts (last status: ${statusCode || "UNKNOWN"})`),
            408
          ),
          data,
        };
      }

      if (pollIntervalMs > 0 || sleepFn) {
        await sleepFn(pollIntervalMs);
      }
    }
  }

  async publishSingleImage({ baseUrl, accountId, token, imageUrl, caption, timeoutMs, fetchFn, pollOptions = {} }) {
    // 1. Create Single Image Container
    const createUrl = `${baseUrl}/${encodeURIComponent(accountId)}/media`;
    let containerId = null;

    try {
      const createRes = await this.fetchWithTimeout(
        fetchFn,
        createUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            image_url: imageUrl,
            caption: caption,
            access_token: token,
          }).toString(),
        },
        timeoutMs
      );

      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok || createData.error || !createData.id) {
        const isAuth = createRes.status === 401 || createData.error?.code === 190;
        return {
          success: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          containerId: null,
          publishedAt: null,
          error: this.sanitizeError(createData.error || new Error("Failed to create Instagram container"), createRes.status),
        };
      }

      containerId = createData.id;
    } catch (createErr) {
      return {
        success: false,
        status: PUBLISH_STATUS.FAILED,
        postId: null,
        containerId: null,
        publishedAt: null,
        error: this.sanitizeError(createErr, null),
      };
    }

    // 2. Wait for Single Image Container Readiness
    const readiness = await this.waitForContainerReady({
      baseUrl,
      token,
      containerId,
      timeoutMs,
      fetchFn,
      ...pollOptions,
    });

    if (!readiness.ready) {
      return {
        success: false,
        status: readiness.status || PUBLISH_STATUS.FAILED,
        postId: null,
        containerId,
        publishedAt: null,
        error: readiness.error,
      };
    }

    // 3. Publish Container (with Ambiguous Transport Failure Guard)
    return await this.executePublishContainer({
      baseUrl,
      accountId,
      token,
      containerId,
      timeoutMs,
      fetchFn,
    });
  }

  async publishCarousel({ baseUrl, accountId, token, mediaItems, caption, timeoutMs, fetchFn, pollOptions = {} }) {
    // 1. Concurrently Create Child Item Containers
    let childContainerIds = [];
    try {
      const childPromises = mediaItems.map(async (item, idx) => {
        const childUrl = `${baseUrl}/${encodeURIComponent(accountId)}/media`;
        const res = await this.fetchWithTimeout(
          fetchFn,
          childUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              image_url: item.url,
              is_carousel_item: "true",
              access_token: token,
            }).toString(),
          },
          timeoutMs
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || !data.id) {
          const err = data.error || new Error(`Failed to create carousel item container at index ${idx}`);
          err.status = res.status;
          throw err;
        }
        return data.id;
      });

      childContainerIds = await Promise.all(childPromises);
    } catch (childErr) {
      const isAuth = childErr.status === 401 || childErr.code === 190;
      return {
        success: false,
        status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
        postId: null,
        containerId: null,
        publishedAt: null,
        error: this.sanitizeError(childErr, childErr.status || null),
      };
    }

    // 2. Wait for All Child Containers to be FINISHED
    const childReadinessResults = await Promise.all(
      childContainerIds.map((cid) =>
        this.waitForContainerReady({
          baseUrl,
          token,
          containerId: cid,
          timeoutMs,
          fetchFn,
          ...pollOptions,
        })
      )
    );

    const failedChild = childReadinessResults.find((r) => !r.ready);
    if (failedChild) {
      return {
        success: false,
        status: failedChild.status || PUBLISH_STATUS.FAILED,
        postId: null,
        containerId: null,
        publishedAt: null,
        error: failedChild.error,
      };
    }

    // 3. Create Parent Carousel Container
    let carouselContainerId = null;
    try {
      const parentUrl = `${baseUrl}/${encodeURIComponent(accountId)}/media`;
      const parentRes = await this.fetchWithTimeout(
        fetchFn,
        parentUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            media_type: "CAROUSEL",
            children: childContainerIds.join(","),
            caption: caption,
            access_token: token,
          }).toString(),
        },
        timeoutMs
      );

      const parentData = await parentRes.json().catch(() => ({}));
      if (!parentRes.ok || parentData.error || !parentData.id) {
        const isAuth = parentRes.status === 401 || parentData.error?.code === 190;
        return {
          success: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          containerId: null,
          publishedAt: null,
          error: this.sanitizeError(parentData.error || new Error("Failed to create parent carousel container"), parentRes.status),
        };
      }

      carouselContainerId = parentData.id;
    } catch (parentErr) {
      return {
        success: false,
        status: PUBLISH_STATUS.FAILED,
        postId: null,
        containerId: null,
        publishedAt: null,
        error: this.sanitizeError(parentErr, null),
      };
    }

    // 4. Wait for Parent Carousel Container to be FINISHED
    const parentReadiness = await this.waitForContainerReady({
      baseUrl,
      token,
      containerId: carouselContainerId,
      timeoutMs,
      fetchFn,
      ...pollOptions,
    });

    if (!parentReadiness.ready) {
      return {
        success: false,
        status: parentReadiness.status || PUBLISH_STATUS.FAILED,
        postId: null,
        containerId: carouselContainerId,
        publishedAt: null,
        error: parentReadiness.error,
      };
    }

    // 5. Publish Carousel Container (with Ambiguous Transport Failure Guard)
    return await this.executePublishContainer({
      baseUrl,
      accountId,
      token,
      containerId: carouselContainerId,
      timeoutMs,
      fetchFn,
    });
  }

  async executePublishContainer({ baseUrl, accountId, token, containerId, timeoutMs, fetchFn }) {
    const publishUrl = `${baseUrl}/${encodeURIComponent(accountId)}/media_publish`;

    try {
      const pubRes = await this.fetchWithTimeout(
        fetchFn,
        publishUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: containerId,
            access_token: token,
          }).toString(),
        },
        timeoutMs
      );

      const pubData = await pubRes.json().catch(() => ({}));

      if (!pubRes.ok || pubData.error || !pubData.id) {
        const isAuth = pubRes.status === 401 || pubData.error?.code === 190;
        return {
          success: false,
          status: isAuth ? PUBLISH_STATUS.AUTH_FAILED : PUBLISH_STATUS.FAILED,
          postId: null,
          containerId,
          publishedAt: null,
          error: this.sanitizeError(pubData.error || new Error("Failed to publish Instagram container"), pubRes.status),
        };
      }

      return {
        success: true,
        status: PUBLISH_STATUS.PUBLISHED,
        postId: String(pubData.id),
        containerId,
        publishedAt: new Date().toISOString(),
        error: null,
      };
    } catch (transportErr) {
      // CRITICAL IDEMPOTENCY GUARD:
      // The media_publish POST was sent, but connection failed or timed out before receiving confirmation.
      // Do NOT retry automatically. Flag as RECONCILIATION_REQUIRED.
      return {
        success: false,
        status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
        postId: null,
        containerId,
        publishedAt: null,
        error: this.sanitizeError(transportErr, null),
        reconciliationData: {
          reason: "AMBIGUOUS_PUBLISH_TRANSPORT_FAILURE",
          containerId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
