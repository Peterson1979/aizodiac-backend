// lib/social/content/contentHistory.js

export const TOPIC_HISTORY_KEY = "aiz:social:history:topics";
export const DEFAULT_TOPIC_RETENTION_DAYS = 120;
export const TOPIC_HISTORY_TTL_SECONDS = 180 * 86400; // 180 days Redis TTL

/**
 * Normalizes a topic string for deterministic similarity and duplicate detection.
 * Removes punctuation, normalizes spacing, strips stop words and lowercases.
 * @param {string} topic
 * @returns {string}
 */
export function normalizeTopic(topic) {
  if (!topic || typeof topic !== "string") return "";

  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts normalized word tokens from a topic for overlap comparison.
 * @param {string} topic
 * @returns {Set<string>}
 */
export function extractTopicTokens(topic) {
  const stopWords = new Set([
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "and", "or",
    "by", "that", "this", "these", "those", "how", "what", "why", "which", "are",
    "is", "most", "top", "3", "your", "each", "all"
  ]);

  const norm = normalizeTopic(topic);
  const words = norm.split(" ").filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard word token similarity between two topic strings (0.0 to 1.0).
 * @param {string} topicA
 * @param {string} topicB
 * @returns {number}
 */
export function computeTopicSimilarity(topicA, topicB) {
  const tokensA = extractTopicTokens(topicA);
  const tokensB = extractTopicTokens(topicB);

  if (tokensA.size === 0 || tokensB.size === 0) {
    return normalizeTopic(topicA) === normalizeTopic(topicB) ? 1.0 : 0.0;
  }

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0.0 : intersectionCount / unionCount;
}

/**
 * Calculates day difference between two YYYY-MM-DD date strings.
 * @param {string} date1Str
 * @param {string} date2Str
 * @returns {number} - Absolute days difference
 */
export function getDaysDifference(date1Str, date2Str) {
  const d1 = new Date(`${date1Str}T00:00:00Z`).getTime();
  const d2 = new Date(`${date2Str}T00:00:00Z`).getTime();
  const diffMs = Math.abs(d1 - d2);
  return Math.round(diffMs / 86400000);
}

/**
 * Records topic usage into Redis history.
 * @param {object} redis - Redis client instance
 * @param {object} params
 * @param {string} params.topic - Plaintext topic title
 * @param {string} params.category - Topic category
 * @param {string} params.publishDate - Target publish date (YYYY-MM-DD)
 * @param {string} [params.contentId] - Associated content ID
 * @returns {Promise<boolean>}
 */
export async function recordTopicUsage(redis, { topic, category, publishDate, contentId = null }) {
  if (!redis || !topic || !publishDate) return false;

  const normKey = normalizeTopic(topic);
  const record = {
    topic: topic.trim(),
    normalizedTopic: normKey,
    category,
    publishDate,
    contentId: contentId || `social-${publishDate}`,
    recordedAt: new Date().toISOString(),
  };

  try {
    // Save to Redis Hash where field is normalized topic
    await redis.hset(TOPIC_HISTORY_KEY, { [normKey]: JSON.stringify(record) });
    await redis.expire(TOPIC_HISTORY_KEY, TOPIC_HISTORY_TTL_SECONDS);
    return true;
  } catch (err) {
    console.warn(`⚠️ Error recording topic history for "${topic}":`, err.message);
    return false;
  }
}

/**
 * Retrieves all topics recorded in the history within the given threshold days.
 * @param {object} redis
 * @param {object} [options={}]
 * @param {string} [options.referenceDate] - Reference date (YYYY-MM-DD), default current UTC date
 * @param {number} [options.thresholdDays=120] - Window in days
 * @returns {Promise<Array<object>>}
 */
export async function getRecentTopics(redis, { referenceDate = null, thresholdDays = DEFAULT_TOPIC_RETENTION_DAYS } = {}) {
  if (!redis) return [];

  const refDate = referenceDate || new Date().toISOString().slice(0, 10);

  try {
    const rawMap = await redis.hgetall(TOPIC_HISTORY_KEY);
    if (!rawMap || typeof rawMap !== "object") return [];

    const recentTopics = [];
    for (const [normKey, rawValue] of Object.entries(rawMap)) {
      if (!rawValue) continue;
      try {
        const item = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
        if (item && item.publishDate) {
          const daysAgo = getDaysDifference(refDate, item.publishDate);
          if (daysAgo <= thresholdDays) {
            recentTopics.push({
              ...item,
              daysAgo,
            });
          }
        }
      } catch {
        // Ignore unparseable entries
      }
    }

    // Sort by most recent first
    return recentTopics.sort((a, b) => (a.daysAgo || 0) - (b.daysAgo || 0));
  } catch (err) {
    console.warn("⚠️ Error fetching recent topics from Redis:", err.message);
    return [];
  }
}

/**
 * Checks if a candidate topic was used within the last thresholdDays (or is substantially similar).
 * @param {object} redis
 * @param {string} candidateTopic - The topic to test
 * @param {object} [options={}]
 * @param {string} [options.publishDate] - Reference date
 * @param {number} [options.thresholdDays=120]
 * @param {number} [options.similarityThreshold=0.75] - Word token overlap threshold
 * @param {Array<object>} [options.recentTopicsCache=null] - Pre-fetched recent topics
 * @returns {Promise<{ isDuplicate: boolean, reason?: string, matchedTopic?: object }>}
 */
export async function isTopicDuplicate(
  redis,
  candidateTopic,
  {
    publishDate = null,
    thresholdDays = DEFAULT_TOPIC_RETENTION_DAYS,
    similarityThreshold = 0.75,
    recentTopicsCache = null,
  } = {}
) {
  if (!candidateTopic || typeof candidateTopic !== "string") {
    return { isDuplicate: true, reason: "INVALID_TOPIC" };
  }

  const normCandidate = normalizeTopic(candidateTopic);
  const refDate = publishDate || new Date().toISOString().slice(0, 10);

  // 1. Direct exact hash lookup in Redis if available
  if (redis && !recentTopicsCache) {
    try {
      const rawMatch = await redis.hget(TOPIC_HISTORY_KEY, normCandidate);
      if (rawMatch) {
        const match = typeof rawMatch === "string" ? JSON.parse(rawMatch) : rawMatch;
        if (match && match.publishDate) {
          const daysAgo = getDaysDifference(refDate, match.publishDate);
          if (daysAgo <= thresholdDays) {
            return {
              isDuplicate: true,
              reason: `EXACT_MATCH_WITHIN_${thresholdDays}_DAYS (${daysAgo} days ago on ${match.publishDate})`,
              matchedTopic: match,
            };
          }
        }
      }
    } catch (err) {
      console.warn("⚠️ Error performing direct topic hash lookup:", err.message);
    }
  }

  // 2. Scan recent topics for high semantic / token similarity
  const recentList = recentTopicsCache || (await getRecentTopics(redis, { referenceDate: refDate, thresholdDays }));

  for (const item of recentList) {
    if (normalizeTopic(item.topic) === normCandidate) {
      return {
        isDuplicate: true,
        reason: `EXACT_MATCH_WITHIN_${thresholdDays}_DAYS (${item.daysAgo} days ago on ${item.publishDate})`,
        matchedTopic: item,
      };
    }

    const similarity = computeTopicSimilarity(candidateTopic, item.topic);
    if (similarity >= similarityThreshold) {
      return {
        isDuplicate: true,
        reason: `SUBSTANTIAL_SIMILARITY_${Math.round(similarity * 100)}%_WITHIN_${thresholdDays}_DAYS (vs "${item.topic}" on ${item.publishDate})`,
        matchedTopic: item,
      };
    }
  }

  return { isDuplicate: false };
}
