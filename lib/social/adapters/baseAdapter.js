// lib/social/adapters/baseAdapter.js
import { PUBLISH_STATUS } from "../types.js";
import { redactSecrets } from "../config.js";

/**
 * Standard base class for all social publishing platform adapters.
 */
export class BaseSocialAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Validates if the given config contains the necessary credentials for this adapter.
   * @param {object} config
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateConfig(config) {
    throw new Error(`validateConfig() not implemented in adapter ${this.name}`);
  }

  /**
   * Verifies health / validity of the platform credentials in read-only mode.
   * @param {object} params
   * @param {object} params.config
   * @param {Function} [params.fetchFn=fetch]
   * @returns {Promise<{ healthy: boolean, details?: object, error?: object }>}
   */
  async checkHealth({ config, fetchFn = fetch }) {
    throw new Error(`checkHealth() not implemented in adapter ${this.name}`);
  }

  /**
   * Publishes the content item to the target social platform.
   * @param {object} params
   * @param {object} params.manifest - The verified manifest item
   * @param {object} params.config - Social subsystem configuration
   * @param {object} [params.redis] - Optional Redis instance for state/tokens
   * @param {Function} [params.fetchFn=fetch] - HTTP fetch abstraction
   * @returns {Promise<{
   *   success: boolean,
   *   status: string,
   *   postId: string|null,
   *   containerId?: string|null,
   *   publishedAt: string|null,
   *   error: object|null,
   *   reconciliationData?: object|null
   * }>}
   */
  async publish({ manifest, config, redis, fetchFn = fetch }) {
    throw new Error(`publish() not implemented in adapter ${this.name}`);
  }

  /**
   * Helper to perform HTTP request with bounded timeout.
   * @param {Function} fetchFn
   * @param {string} url
   * @param {object} [options={}]
   * @param {number} [timeoutMs=8000]
   * @returns {Promise<Response>}
   */
  async fetchWithTimeout(fetchFn, url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchFn(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sanitizes error structures to prevent any secret leak while preserving diagnostic fields.
   * @param {Error|object} err
   * @param {number} [httpStatus]
   * @returns {object}
   */
  sanitizeError(err, httpStatus = null) {
    if (!err) return null;

    const baseObj = typeof err === "object" ? err : { message: String(err) };
    const sanitized = redactSecrets(baseObj);

    return {
      message: sanitized.message || "Unknown error",
      status: httpStatus || sanitized.status || null,
      code: sanitized.code || null,
      subcode: sanitized.error_subcode || sanitized.subcode || null,
      type: sanitized.type || null,
      fbtrace_id: sanitized.fbtrace_id || null,
      timestamp: new Date().toISOString(),
    };
  }
}
