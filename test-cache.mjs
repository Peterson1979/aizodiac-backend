// test-cache.mjs
import assert from "node:assert";
import {
  CACHE_VERSION,
  TTL_SECONDS,
  isSharedCacheEligible,
  getSharedCacheKey,
  SHARED_CACHE_TYPES
} from "./lib/cacheHelper.js";
import {
  extractUsageMetadata,
  recordUsageTelemetry,
  TELEMETRY_RETENTION_SECONDS
} from "./lib/telemetryHelper.js";
import { retryWithBackoff } from "./api/generateAstroContent.js";

console.log("==================================================");
console.log("RUNNING DETERMINISTIC CACHE, TELEMETRY & RETRY TESTS");
console.log("==================================================");

// Test A: Same semantic request produces identical cache key
{
  const data1 = { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" };
  const data2 = { zodiacSign: "  aries ", currentDate: "2026-08-24", language: " EN " };
  const key1 = getSharedCacheKey("home_daily_horoscope", data1, "gemini-2.5-flash-lite");
  const key2 = getSharedCacheKey("home_daily_horoscope", data2, "gemini-2.5-flash-lite");
  assert.strictEqual(key1, key2, "Normalized inputs must produce identical cache keys");
  assert.strictEqual(key1, `aiz:cache:${CACHE_VERSION}:gemini-2.5-flash-lite:home_daily_horoscope:2026-08-24:aries:en`);
  console.log("✅ Test A passed: Same semantic request produces identical cache key");
}

// Test B: Different zodiac sign produces different key
{
  const keyAries = getSharedCacheKey("home_daily_horoscope", { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" });
  const keyTaurus = getSharedCacheKey("home_daily_horoscope", { zodiacSign: "Taurus", currentDate: "2026-08-24", language: "en" });
  assert.notStrictEqual(keyAries, keyTaurus, "Different zodiac signs must have distinct keys");
  console.log("✅ Test B passed: Different zodiac sign produces different key");
}

// Test C: Different language produces different key
{
  const keyEn = getSharedCacheKey("home_daily_horoscope", { zodiacSign: "Leo", currentDate: "2026-08-24", language: "en" });
  const keyHu = getSharedCacheKey("home_daily_horoscope", { zodiacSign: "Leo", currentDate: "2026-08-24", language: "hu" });
  const keyDe = getSharedCacheKey("home_daily_horoscope", { zodiacSign: "Leo", currentDate: "2026-08-24", language: "de" });
  assert.notStrictEqual(keyEn, keyHu);
  assert.notStrictEqual(keyEn, keyDe);
  console.log("✅ Test C passed: Different language produces different key");
}

// Test D: Different date/week/month/year produces different key
{
  // Daily
  const keyD1 = getSharedCacheKey("ai_horoscope_daily", { zodiacSign: "Cancer", currentDate: "2026-08-24", language: "en" });
  const keyD2 = getSharedCacheKey("ai_horoscope_daily", { zodiacSign: "Cancer", currentDate: "2026-08-25", language: "en" });
  assert.notStrictEqual(keyD1, keyD2);

  // Weekly
  const keyW1 = getSharedCacheKey("ai_horoscope_weekly", { zodiacSign: "Cancer", weekRange: "2026-08-17 to 2026-08-23", language: "en" });
  const keyW2 = getSharedCacheKey("ai_horoscope_weekly", { zodiacSign: "Cancer", weekRange: "2026-08-24 to 2026-08-30", language: "en" });
  assert.notStrictEqual(keyW1, keyW2);

  // Monthly
  const keyM1 = getSharedCacheKey("ai_horoscope_monthly", { zodiacSign: "Cancer", currentYear: "2026", month: "august", language: "en" });
  const keyM2 = getSharedCacheKey("ai_horoscope_monthly", { zodiacSign: "Cancer", currentYear: "2026", month: "september", language: "en" });
  assert.notStrictEqual(keyM1, keyM2);

  // Yearly
  const keyY1 = getSharedCacheKey("ai_horoscope_yearly", { zodiacSign: "Cancer", currentYear: "2026", language: "en" });
  const keyY2 = getSharedCacheKey("ai_horoscope_yearly", { zodiacSign: "Cancer", currentYear: "2027", language: "en" });
  assert.notStrictEqual(keyY1, keyY2);

  console.log("✅ Test D passed: Different period boundaries produce different keys");
}

// Test E: Different model identifier produces different key
{
  const keyModel1 = getSharedCacheKey("home_daily_quote", { currentDate: "2026-08-24", language: "en" }, "gemini-2.5-flash-lite");
  const keyModel2 = getSharedCacheKey("home_daily_quote", { currentDate: "2026-08-24", language: "en" }, "gemini-2.0-flash-lite");
  assert.notStrictEqual(keyModel1, keyModel2, "Model change must partition the cache");
  console.log("✅ Test E passed: Different model identifier produces different key");
}

// Test F: Personal request types are ALWAYS BYPASS (returns null)
{
  const personalTypes = [
    "numerology",
    "personal_horoscope",
    "personal_astro_calendar",
    "ask_the_stars",
    "personal_horoscope_period_daily",
    "personal_horoscope_period_weekly",
    "personal_horoscope_period_monthly",
    "unknown_type"
  ];

  for (const pType of personalTypes) {
    assert.strictEqual(isSharedCacheEligible(pType), false, `${pType} must not be eligible for shared cache`);
    assert.strictEqual(getSharedCacheKey(pType, { zodiacSign: "Aries", language: "en" }), null, `${pType} must return null cache key`);
  }
  console.log("✅ Test F passed: All personal types return null (BYPASS)");
}

// Test G: Ascendant, Love Compatibility, Chinese Horoscope, Quotes keys format & PII safety
{
  // Ascendant
  const ascKey = getSharedCacheKey("ascendant_calc", { risingSign: "Scorpio", language: "es" }, "gemini-2.5-flash-lite");
  assert.strictEqual(ascKey, `aiz:cache:${CACHE_VERSION}:gemini-2.5-flash-lite:ascendant_calc:scorpio:es`);

  // Love Compatibility
  const loveKey = getSharedCacheKey("love_compatibility", { zodiacSign: "Libra", language: "fr" }, "gemini-2.5-flash-lite");
  assert.strictEqual(loveKey, `aiz:cache:${CACHE_VERSION}:gemini-2.5-flash-lite:love_compatibility:libra:fr`);

  // Chinese Horoscope
  const chKey = getSharedCacheKey("chinese_horoscope", { animal: "Dragon", element: "Wood", yinYang: "Yang", currentYear: "2026", language: "de" }, "gemini-2.5-flash-lite");
  assert.strictEqual(chKey, `aiz:cache:${CACHE_VERSION}:gemini-2.5-flash-lite:chinese_horoscope:2026:dragon_wood_yang:de`);

  // Daily quote
  const quoteKey = getSharedCacheKey("home_daily_quote", { currentDate: "2026-08-24", language: "hu" }, "gemini-2.5-flash-lite");
  assert.strictEqual(quoteKey, `aiz:cache:${CACHE_VERSION}:gemini-2.5-flash-lite:home_daily_quote:2026-08-24:hu`);

  console.log("✅ Test G passed: Ascendant, Love, Chinese, and Quote keys verified with zero PII");
}

// Test H: TTL Configurations
{
  for (const type of SHARED_CACHE_TYPES) {
    assert.ok(TTL_SECONDS[type] > 0, `TTL must be configured for ${type}`);
  }
  assert.strictEqual(TTL_SECONDS.home_daily_horoscope, 36 * 3600);
  assert.strictEqual(TTL_SECONDS.ai_horoscope_daily, 36 * 3600);
  assert.strictEqual(TTL_SECONDS.ai_horoscope_weekly, 10 * 86400);
  assert.strictEqual(TTL_SECONDS.ai_horoscope_monthly, 45 * 86400);
  assert.strictEqual(TTL_SECONDS.ai_horoscope_yearly, 380 * 86400);
  assert.strictEqual(TTL_SECONDS.ascendant_calc, 180 * 86400);
  assert.strictEqual(TTL_SECONDS.love_compatibility, 180 * 86400);
  assert.strictEqual(TTL_SECONDS.chinese_horoscope, 380 * 86400);
  console.log("✅ Test H passed: All TTL configurations verified");
}

// Test I: Telemetry Extraction Logic
{
  // Full metadata
  const mockResp = {
    text: "Forecast text",
    usageMetadata: {
      promptTokenCount: 200,
      candidatesTokenCount: 300,
      totalTokenCount: 500,
      thoughtsTokenCount: 50,
      cachedContentTokenCount: 100,
    }
  };
  const usage = extractUsageMetadata(mockResp);
  assert.strictEqual(usage.promptTokens, 200);
  assert.strictEqual(usage.candidateTokens, 300);
  assert.strictEqual(usage.totalTokens, 500);
  assert.strictEqual(usage.thoughtsTokens, 50);
  assert.strictEqual(usage.cachedTokens, 100);

  // Missing metadata normalization
  const emptyUsage = extractUsageMetadata({});
  assert.strictEqual(emptyUsage.promptTokens, 0);
  assert.strictEqual(emptyUsage.candidateTokens, 0);
  assert.strictEqual(emptyUsage.totalTokens, 0);
  assert.strictEqual(emptyUsage.thoughtsTokens, 0);
  assert.strictEqual(emptyUsage.cachedTokens, 0);

  console.log("✅ Test I passed: Usage metadata extracted and normalized safely");
}

// Test J: Telemetry Recording & Aggregate Increment Test
{
  const redisMap = new Map();
  const expirations = new Map();

  const mockRedis = {
    async hincrby(key, field, inc) {
      if (!redisMap.has(key)) redisMap.set(key, {});
      const hash = redisMap.get(key);
      hash[field] = (hash[field] || 0) + inc;
      return hash[field];
    },
    async expire(key, seconds) {
      expirations.set(key, seconds);
      return 1;
    }
  };

  const usage = {
    promptTokens: 200,
    candidateTokens: 300,
    totalTokens: 500,
    thoughtsTokens: 0,
    cachedTokens: 0
  };

  await recordUsageTelemetry(mockRedis, "home_daily_horoscope", usage, "2026-08-24");

  const totalHash = redisMap.get("aiz:usage:2026-08-24:total");
  const typeHash = redisMap.get("aiz:usage:2026-08-24:type:home_daily_horoscope");

  assert.deepStrictEqual(totalHash, {
    requests: 1,
    promptTokens: 200,
    candidateTokens: 300,
    totalTokens: 500
  });

  assert.deepStrictEqual(typeHash, {
    requests: 1,
    promptTokens: 200,
    candidateTokens: 300,
    totalTokens: 500
  });

  assert.strictEqual(expirations.get("aiz:usage:2026-08-24:total"), TELEMETRY_RETENTION_SECONDS);
  assert.strictEqual(expirations.get("aiz:usage:2026-08-24:type:home_daily_horoscope"), TELEMETRY_RETENTION_SECONDS);

  console.log("✅ Test J passed: Exact aggregate token telemetry recorded for daily total and type");
}

// Test K: Deterministic Retry Logic Tests (Batch 2A Correction Cases A - G)
{
  // A. Immediate success
  {
    let calls = 0;
    const delays = [];
    const res = await retryWithBackoff(async () => {
      calls++;
      return "SUCCESS_A";
    }, 5, (ms) => delays.push(ms));
    assert.strictEqual(res, "SUCCESS_A");
    assert.strictEqual(calls, 1, "Immediate success must make exactly 1 call");
    assert.strictEqual(delays.length, 0);
  }

  // B. 503, then success
  {
    let calls = 0;
    const delays = [];
    const res = await retryWithBackoff(async () => {
      calls++;
      if (calls === 1) {
        const err = new Error("Service Unavailable");
        err.status = 503;
        throw err;
      }
      return "SUCCESS_B";
    }, 5, (ms) => delays.push(ms));
    assert.strictEqual(res, "SUCCESS_B");
    assert.strictEqual(calls, 2, "One 503 then success must make exactly 2 calls");
    assert.deepStrictEqual(delays, [2000], "Delay after attempt 1 must be 2000ms");
  }

  // C. Four 503 failures, then success
  {
    let calls = 0;
    const delays = [];
    const res = await retryWithBackoff(async () => {
      calls++;
      if (calls < 5) {
        const err = new Error("Service Unavailable");
        err.status = 503;
        throw err;
      }
      return "SUCCESS_C";
    }, 5, (ms) => delays.push(ms));
    assert.strictEqual(res, "SUCCESS_C");
    assert.strictEqual(calls, 5, "Four 503s then success must make exactly 5 calls");
    assert.deepStrictEqual(delays, [2000, 4000, 8000, 16000], "Delays must be 2s, 4s, 8s, 16s");
  }

  // D. Five consecutive 503 failures
  {
    let calls = 0;
    const delays = [];
    let threw = false;
    try {
      await retryWithBackoff(async () => {
        calls++;
        const err = new Error("Service Unavailable");
        err.status = 503;
        throw err;
      }, 5, (ms) => delays.push(ms));
    } catch (err) {
      threw = true;
      assert.strictEqual(err.status, 503);
    }
    assert.strictEqual(threw, true, "Must throw after 5 consecutive 503 failures");
    assert.strictEqual(calls, 5, "Must make exactly 5 attempts before terminal error");
    assert.deepStrictEqual(delays, [2000, 4000, 8000, 16000]);
  }

  // E. HTTP 429 -> Fail immediately (1 call)
  {
    let calls = 0;
    const delays = [];
    let threw = false;
    try {
      await retryWithBackoff(async () => {
        calls++;
        const err = new Error("Too Many Requests");
        err.status = 429;
        throw err;
      }, 5, (ms) => delays.push(ms));
    } catch (err) {
      threw = true;
      assert.strictEqual(err.status, 429);
    }
    assert.strictEqual(threw, true);
    assert.strictEqual(calls, 1, "HTTP 429 must fail immediately with 1 call");
    assert.strictEqual(delays.length, 0);
  }

  // F. HTTP 500 -> Fail immediately (1 call)
  {
    let calls = 0;
    const delays = [];
    let threw = false;
    try {
      await retryWithBackoff(async () => {
        calls++;
        const err = new Error("Internal Server Error");
        err.status = 500;
        throw err;
      }, 5, (ms) => delays.push(ms));
    } catch (err) {
      threw = true;
      assert.strictEqual(err.status, 500);
    }
    assert.strictEqual(threw, true);
    assert.strictEqual(calls, 1, "HTTP 500 must fail immediately with 1 call");
    assert.strictEqual(delays.length, 0);
  }

  // G. Generic/Network error without status 503 -> Fail immediately (1 call)
  {
    let calls = 0;
    const delays = [];
    let threw = false;
    try {
      await retryWithBackoff(async () => {
        calls++;
        throw new Error("ECONNRESET");
      }, 5, (ms) => delays.push(ms));
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, "ECONNRESET");
    }
    assert.strictEqual(threw, true);
    assert.strictEqual(calls, 1, "Generic error must fail immediately with 1 call");
    assert.strictEqual(delays.length, 0);
  }

  console.log("✅ Test K passed: Retry cases A-G verified (503 backoff 2s/4s/8s/16s, non-503 instant fail)");
}

// Test L: End-to-End Mock Pipeline with Retry, Telemetry, Cache HIT/MISS/BYPASS (Case H)
{
  const mockCache = new Map();
  const mockTelemetry = new Map();
  let redisFail = false;

  const mockRedis = {
    async get(key) {
      if (redisFail) throw new Error("Redis get failed");
      return mockCache.get(key) || null;
    },
    async set(key, val, opts) {
      if (redisFail) throw new Error("Redis set failed");
      mockCache.set(key, val);
      return "OK";
    },
    async hincrby(key, field, inc) {
      if (redisFail) throw new Error("Redis hincrby failed");
      if (!mockTelemetry.has(key)) mockTelemetry.set(key, {});
      const hash = mockTelemetry.get(key);
      hash[field] = (hash[field] || 0) + inc;
      return hash[field];
    },
    async expire(key, seconds) {
      return 1;
    }
  };

  let modelExecutionCount = 0;
  let simulatedFailures = 0;

  async function mockGenerateAstroContentPipeline(type, templateData) {
    let cacheStatus = "BYPASS";
    const cacheKey = getSharedCacheKey(type, templateData, "gemini-2.5-flash-lite");

    if (cacheKey && mockRedis) {
      try {
        const cached = await mockRedis.get(cacheKey);
        if (cached) {
          return {
            status: 200,
            headers: { "X-AIZ-Cache": "HIT" },
            body: { success: true, content: cached },
            modelCalled: false
          };
        }
      } catch (err) {
        // Fail open
      }
    }

    // Call Model with Retry
    const sdkResult = await retryWithBackoff(async () => {
      modelExecutionCount++;
      if (simulatedFailures > 0) {
        simulatedFailures--;
        const err = new Error("Simulated 503");
        err.status = 503;
        throw err;
      }
      return {
        text: `{"forecast": "sunny stars"}`,
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 250,
          totalTokenCount: 400
        }
      };
    }, 5, () => {});

    const trimmedText = (sdkResult?.text || "").trim();

    // Telemetry - only on successful completion
    const usage = extractUsageMetadata(sdkResult);
    await recordUsageTelemetry(mockRedis, type, usage, "2026-08-24");

    // Cache Store
    if (cacheKey && mockRedis && trimmedText.length > 0) {
      try {
        await mockRedis.set(cacheKey, trimmedText, { ex: 3600 });
      } catch {
        // Fail open
      }
      cacheStatus = "MISS";
    }

    return {
      status: 200,
      headers: { "X-AIZ-Cache": cacheStatus },
      body: { success: true, content: trimmedText },
      modelCalled: true,
      usage
    };
  }

  // 1. Initial Request with 2 transient 503 retries -> succeeds on attempt 3
  simulatedFailures = 2;
  const call1 = await mockGenerateAstroContentPipeline("home_daily_horoscope", { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(call1.headers["X-AIZ-Cache"], "MISS");
  assert.strictEqual(call1.modelCalled, true);
  assert.strictEqual(modelExecutionCount, 3, "Must make 3 attempts (2 retries + 1 success)");
  // Case H: Telemetry requests count must be incremented by EXACTLY 1!
  assert.deepStrictEqual(mockTelemetry.get("aiz:usage:2026-08-24:total"), {
    requests: 1,
    promptTokens: 150,
    candidateTokens: 250,
    totalTokens: 400
  });

  // 2. Second Request -> HIT -> 0 model calls, 0 telemetry increment
  const call2 = await mockGenerateAstroContentPipeline("home_daily_horoscope", { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(call2.headers["X-AIZ-Cache"], "HIT");
  assert.strictEqual(call2.modelCalled, false);
  assert.strictEqual(modelExecutionCount, 3, "Model execution count must remain unchanged on HIT");
  assert.strictEqual(mockTelemetry.get("aiz:usage:2026-08-24:total").requests, 1, "Telemetry requests must not increment on HIT");

  // 3. Terminal Failure test -> 5 consecutive 503s throws and records ZERO telemetry
  simulatedFailures = 5;
  let terminalFailed = false;
  try {
    await mockGenerateAstroContentPipeline("home_daily_horoscope", { zodiacSign: "Libra", currentDate: "2026-08-24", language: "en" });
  } catch (err) {
    terminalFailed = true;
  }
  assert.strictEqual(terminalFailed, true, "Terminal failure must throw");
  // Telemetry for Libra must NOT exist
  assert.strictEqual(mockTelemetry.get("aiz:usage:2026-08-24:type:home_daily_horoscope").requests, 1, "Terminal failure must not record telemetry");

  console.log("✅ Test L passed: Full mock pipeline verified for Retry + Telemetry (Case H), Cache HIT/MISS, and Terminal Failure handling");
}

console.log("==================================================");
console.log("ALL DETERMINISTIC TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
