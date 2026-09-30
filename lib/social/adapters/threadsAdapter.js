// lib/social/adapters/threadsAdapter.js
import { BaseSocialAdapter } from "./baseAdapter.js";
import { DESTINATIONS, MEDIA_TYPES, PUBLISH_STATUS } from "../types.js";
import { redactSecrets } from "../config.js";
import { formatThreadsCaption } from "../content/destinations.js";

export class ThreadsAdapter extends BaseSocialAdapter {
  constructor(options = {}) {
    const name = typeof options === "string" ? options : (options.name || options.destinationKey || DESTINATIONS.THREADS);
    super(name);
    this.getUserId = typeof options.getUserId === "function"
      ? options.getUserId
      : (config) => (options.userId || config?.threadsUserId);
    this.getAccessToken = typeof options.getAccessToken === "function"
      ? options.getAccessToken
      : (config) => (options.accessToken || config?.threadsAccessToken);
    this.getApiVersion = typeof options.getApiVersion === "function"
      ? options.getApiVersion
      : (config) => (options.apiVersion || config?.threadsApiVersion || "v1.0");
  }

  getBaseUrl(config) {
    const version = this.getApiVersion(config) || "v1.0";
    return `https://graph.threads.net/${version}`;
  }

  validateConfig(config) {
    const errors = [];
    const token = this.getAccessToken(config);
    const userId = this.getUserId(config);
    if (!token) errors.push(`Missing Access Token for Threads (${this.name})`);
    if (!userId) errors.push(`Missing User ID for Threads (${this.name})`);
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
    const userId = this.getUserId(config);
    const token = this.getAccessToken(config);
    const url = `${baseUrl}/${encodeURIComponent(userId)}?fields=id,username&access_token=${encodeURIComponent(token)}`;

    try {
      const res = await this.fetchWithTimeout(fetchFn, url, { method: "GET" }, config?.httpTimeoutMs || 8000);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const isAuth = res.status === 401 || data.error?.code === 190;
        return {
          healthy: false,
          error: this.sanitizeError(data.error || new Error(`Threads API error ${res.status}`), res.status),
          isAuthError: isAuth,
        };
      }

      return {
        healthy: true,
        details: {
          id: data.id,
          username: data.username || "(connected)",
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
   * Resolves and formats the caption for Threads, ensuring it stays strictly within the 500-character limit.
   * @param {object} manifest
   * @returns {string}
   */
  resolveCaption(manifest) {
    let rawCaption = "";
    if (typeof manifest?.captions?.threads === "string") {
      rawCaption = manifest.captions.threads;
    } else if (manifest?.captions?.threads && typeof manifest.captions.threads === "object") {
      rawCaption = manifest.captions.threads.text || manifest.captions.threads.caption || manifest.captions.threads.description || "";
    } else if (manifest?.type === MEDIA_TYPES.VIDEO || manifest?.type === "video") {
      rawCaption = manifest?.captions?.instagram || manifest?.captions?.facebook || manifest?.captions?.youtube?.description || manifest?.captions?.pinterest?.description || "";
    } else {
      rawCaption = manifest?.captions?.instagram || manifest?.captions?.facebook || "";
    }

    return formatThreadsCaption({ baseCaption: rawCaption });
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
    const token = this.getAccessToken(config);
    const userId = this.getUserId(config);
    const caption = this.resolveCaption(manifest);
    const timeoutMs = config?.httpTimeoutMs || 8000;

    if (manifest.type === MEDIA_TYPES.SINGLE_IMAGE) {
      return await this.publishSingleImage({
        baseUrl,
        userId,
        token,
        imageUrl: manifest.media[0].url,
        caption,
        timeoutMs,
        fetchFn,
        pollOptions,
      });
    }

    if (manifest.type === MEDIA_TYPES.CAROUSEL) {
      return await this.publishCarousel({
        baseUrl,
        userId,
        token,
        mediaItems: manifest.media,
        caption,
        timeoutMs,
        fetchFn,
        pollOptions,
      });
    }

    if (manifest.type === MEDIA_TYPES.VIDEO || manifest.type === "video") {
      return await this.publishSingleVideo({
        baseUrl,
        userId,
        token,
        videoUrl: manifest.media[0].url,
        caption,
        timeoutMs,
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
      error: { message: `Unsupported media type for Threads: ${manifest.type}` },
    };
  }

  /**
   * Polls a Threads media container until status becomes FINISHED or fails.
   * @param {object} params
   * @param {string} params.baseUrl
   * @param {string} params.token
   * @param {string} params.containerId
   * @param {number} [params.timeoutMs=8000] - Timeout per HTTP request
   * @param {number} [params.maxWaitMs=60000] - Total maximum time to wait for FINISHED
   * @param {number} [params.pollIntervalMs=2000] - Delay between status checks
   * @param {number} [params.maxAttempts] - Explicit max polling attempts
   * @param {function} [params.fetchFn=fetch]
   * @param {function} [params.sleepFn] - Custom sleep function
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
    const statusUrl = `${baseUrl}/${encodeURIComponent(containerId)}?fields=id,status,error_message&access_token=${encodeURIComponent(token)}`;
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
            data.error || new Error(`Failed to check status for Threads container ${containerId}`),
            res.status
          ),
        };
      }

      const status = data.status || data.status_code;

      if (status === "FINISHED") {
        return {
          ready: true,
          data,
        };
      }

      if (status === "ERROR") {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            new Error(data.error_message || data.status ? `Threads container ${containerId} processing error: ${data.error_message || data.status}` : `Threads container ${containerId} failed with ERROR status`),
            400
          ),
          data,
        };
      }

      if (status === "EXPIRED") {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            new Error(`Threads container ${containerId} expired`),
            400
          ),
          data,
        };
      }

      const elapsed = Date.now() - startTime;
      if (attempts >= effectiveMaxAttempts || elapsed >= maxWaitMs) {
        return {
          ready: false,
          status: PUBLISH_STATUS.FAILED,
          error: this.sanitizeError(
            new Error(`Threads container ${containerId} readiness timeout after ${attempts} attempts (last status: ${status || "UNKNOWN"})`),
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

  async publishSingleImage({ baseUrl, userId, token, imageUrl, caption, timeoutMs, fetchFn, pollOptions = {} }) {
    const createUrl = `${baseUrl}/${encodeURIComponent(userId)}/threads`;
    let containerId = null;

    try {
      const createRes = await this.fetchWithTimeout(
        fetchFn,
        createUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            media_type: "IMAGE",
            image_url: imageUrl,
            text: caption,
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
          error: this.sanitizeError(createData.error || new Error("Failed to create Threads image container"), createRes.status),
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

    return await this.executePublishContainer({
      baseUrl,
      userId,
      token,
      containerId,
      timeoutMs,
      fetchFn,
    });
  }

  async publishSingleVideo({ baseUrl, userId, token, videoUrl, caption, timeoutMs, fetchFn, pollOptions = {} }) {
    const createUrl = `${baseUrl}/${encodeURIComponent(userId)}/threads`;
    let containerId = null;

    try {
      const createRes = await this.fetchWithTimeout(
        fetchFn,
        createUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            media_type: "VIDEO",
            video_url: videoUrl,
            text: caption,
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
          error: this.sanitizeError(createData.error || new Error("Failed to create Threads video container"), createRes.status),
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

    return await this.executePublishContainer({
      baseUrl,
      userId,
      token,
      containerId,
      timeoutMs,
      fetchFn,
    });
  }

  async publishCarousel({ baseUrl, userId, token, mediaItems, caption, timeoutMs, fetchFn, pollOptions = {} }) {
    // 1. Concurrently Create Child Item Containers
    let childContainerIds = [];
    try {
      const childPromises = mediaItems.map(async (item, idx) => {
        const childUrl = `${baseUrl}/${encodeURIComponent(userId)}/threads`;
        const res = await this.fetchWithTimeout(
          fetchFn,
          childUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              media_type: "IMAGE",
              image_url: item.url,
              is_carousel_item: "true",
              access_token: token,
            }).toString(),
          },
          timeoutMs
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || !data.id) {
          const err = data.error || new Error(`Failed to create Threads carousel item container at index ${idx}`);
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
      const parentUrl = `${baseUrl}/${encodeURIComponent(userId)}/threads`;
      const parentRes = await this.fetchWithTimeout(
        fetchFn,
        parentUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            media_type: "CAROUSEL",
            children: childContainerIds.join(","),
            text: caption,
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
          error: this.sanitizeError(parentData.error || new Error("Failed to create parent Threads carousel container"), parentRes.status),
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
      userId,
      token,
      containerId: carouselContainerId,
      timeoutMs,
      fetchFn,
    });
  }

  async executePublishContainer({ baseUrl, userId, token, containerId, timeoutMs, fetchFn }) {
    const publishUrl = `${baseUrl}/${encodeURIComponent(userId)}/threads_publish`;

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
          error: this.sanitizeError(pubData.error || new Error("Failed to publish Threads container"), pubRes.status),
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
      // Ambiguous write transport error guard
      return {
        success: false,
        status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
        postId: null,
        containerId,
        publishedAt: null,
        error: this.sanitizeError(transportErr, null),
        reconciliationData: {
          reason: "AMBIGUOUS_THREADS_TRANSPORT_FAILURE",
          containerId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
