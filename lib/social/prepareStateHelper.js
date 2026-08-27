// lib/social/prepareStateHelper.js
import { redactSecrets } from "./config.js";
import { SOCIAL_STATE_TTL_SECONDS } from "./stateHelper.js";

export const PREPARE_STAGES = Object.freeze({
  PENDING: "PENDING",
  CONTENT_GENERATED: "CONTENT_GENERATED",
  CONTENT_VALIDATED: "CONTENT_VALIDATED",
  RENDERED: "RENDERED",
  RENDER_VALIDATED: "RENDER_VALIDATED",
  UPLOADED: "UPLOADED",
  MANIFEST_READY: "MANIFEST_READY",
  QUALITY_GATE_PASS: "QUALITY_GATE_PASS",
  QUALITY_GATE_FAILED: "QUALITY_GATE_FAILED",
  FAILED: "FAILED",
});

/**
 * Returns the canonical Redis key for daily preparation state.
 * @param {string} publishDate - Date in YYYY-MM-DD
 * @returns {string} - e.g. "aiz:social:prepare:2026-09-01"
 */
export function getPrepareStateKey(publishDate) {
  const normDate = String(publishDate || "").trim();
  return `aiz:social:prepare:${normDate}`;
}

/**
 * Returns the canonical Redis lock key for daily preparation.
 * @param {string} publishDate
 * @returns {string} - e.g. "aiz:social:lock:prepare:2026-09-01"
 */
export function getPrepareLockKey(publishDate) {
  const normDate = String(publishDate || "").trim();
  return `aiz:social:lock:prepare:${normDate}`;
}

/**
 * Creates default initial preparation state.
 * @param {string} publishDate
 * @returns {object}
 */
export function createDefaultPrepareState(publishDate) {
  const now = new Date().toISOString();
  return {
    publishDate,
    stage: PREPARE_STAGES.PENDING,
    contentId: null,
    topic: null,
    category: null,
    generatedAt: null,
    updatedAt: now,
    generatedContent: null,
    uploadedMedia: null,
    manifestId: null,
    manifest: null,
    qualityGate: null,
    failureReasons: [],
    error: null,
    attempts: 0,
  };
}

/**
 * Reads preparation state from Redis.
 * @param {object} redis
 * @param {string} publishDate
 * @returns {Promise<object|null>}
 */
export async function getPrepareState(redis, publishDate) {
  if (!redis || !publishDate) return null;

  const key = getPrepareStateKey(publishDate);
  try {
    const raw = await redis.get(key);
    if (!raw) return null;

    if (typeof raw === "string") {
      return JSON.parse(raw);
    }
    if (typeof raw === "object") {
      return raw;
    }
    return null;
  } catch (err) {
    console.warn(`⚠️ Error reading prepare state for ${publishDate}:`, err.message);
    return null;
  }
}

/**
 * Saves preparation state to Redis with 90-day retention.
 * @param {object} redis
 * @param {string} publishDate
 * @param {object} stateObj
 * @param {number} [ttlSeconds=SOCIAL_STATE_TTL_SECONDS]
 * @returns {Promise<boolean>}
 */
export async function savePrepareState(
  redis,
  publishDate,
  stateObj,
  ttlSeconds = SOCIAL_STATE_TTL_SECONDS
) {
  if (!redis || !publishDate || !stateObj) return false;

  const key = getPrepareStateKey(publishDate);
  try {
    const sanitized = redactSecrets(stateObj);
    const serialized = JSON.stringify(sanitized);
    await redis.set(key, serialized, { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.error(`❌ Error saving prepare state for ${publishDate}:`, err.message);
    return false;
  }
}

/**
 * Updates a specific stage and merges partial data into preparation state.
 * @param {object} redis
 * @param {string} publishDate
 * @param {string} stage - One of PREPARE_STAGES
 * @param {object} [partialData={}]
 * @returns {Promise<object>}
 */
export async function updatePrepareStage(redis, publishDate, stage, partialData = {}) {
  let state = await getPrepareState(redis, publishDate);
  if (!state) {
    state = createDefaultPrepareState(publishDate);
  }

  const now = new Date().toISOString();

  state.stage = stage;
  state.updatedAt = now;

  if (partialData.incrementAttempt) {
    state.attempts = (state.attempts || 0) + 1;
    delete partialData.incrementAttempt;
  }

  if (partialData.error) {
    state.error = redactSecrets(partialData.error);
    delete partialData.error;
  } else if (stage !== PREPARE_STAGES.FAILED) {
    state.error = null;
  }

  // Merge remaining fields
  Object.assign(state, partialData);

  await savePrepareState(redis, publishDate, state);
  return state;
}
