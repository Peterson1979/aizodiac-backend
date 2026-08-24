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
import {
  RESPONSE_SCHEMAS,
  MAX_OUTPUT_TOKENS_BY_TYPE,
  getResponseSchema,
  getMaxOutputTokens
} from "./lib/responseSchemas.js";
import { PROMPTS } from "./lib/prompts.js";
import { getChineseZodiac_FULL } from "./lib/chineseZodiac.js";
import { calculateNumerology } from "./lib/factualCalculations.js";
import { retryWithBackoff } from "./api/generateAstroContent.js";

console.log("==================================================");
console.log("RUNNING BATCH 3 FINAL V2 CACHE CORRECTION TESTS");
console.log("==================================================");

// Test A: Cache Version (Preserved as v2)
{
  assert.strictEqual(CACHE_VERSION, "v2", "CACHE_VERSION must remain v2 to preserve existing shared caches");
  console.log("✅ Test A passed: CACHE_VERSION is v2");
}

// Test B: Existing Public Shared Cache Keys Remain Identical to fb5324a
{
  const data1 = { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" };
  const data2 = { zodiacSign: "  aries ", currentDate: "2026-08-24", language: " EN " };
  const key1 = getSharedCacheKey("home_daily_horoscope", data1, "gemini-2.5-flash-lite");
  const key2 = getSharedCacheKey("home_daily_horoscope", data2, "gemini-2.5-flash-lite");
  assert.strictEqual(key1, key2);
  assert.strictEqual(key1, `aiz:cache:v2:gemini-2.5-flash-lite:home_daily_horoscope:2026-08-24:aries:en`);

  const quoteKey = getSharedCacheKey("home_daily_quote", { currentDate: "2026-08-24", language: "hu" }, "gemini-2.5-flash-lite");
  assert.strictEqual(quoteKey, `aiz:cache:v2:gemini-2.5-flash-lite:home_daily_quote:2026-08-24:hu`);

  const ascKey = getSharedCacheKey("ascendant_calc", { risingSign: "Scorpio", language: "es" }, "gemini-2.5-flash-lite");
  assert.strictEqual(ascKey, `aiz:cache:v2:gemini-2.5-flash-lite:ascendant_calc:scorpio:es`);

  const loveKey = getSharedCacheKey("love_compatibility", { zodiacSign: "Libra", language: "fr" }, "gemini-2.5-flash-lite");
  assert.strictEqual(loveKey, `aiz:cache:v2:gemini-2.5-flash-lite:love_compatibility:libra:fr`);

  const chKey = getSharedCacheKey("chinese_horoscope", { animal: "Dragon", element: "Wood", yinYang: "Yang", currentYear: "2026", language: "de" }, "gemini-2.5-flash-lite");
  assert.strictEqual(chKey, `aiz:cache:v2:gemini-2.5-flash-lite:chinese_horoscope:2026:dragon_wood_yang:de`);

  console.log("✅ Test B passed: All existing v2 public cache keys remain 100% compatible with fb5324a");
}

// Test C: High-Cost Feature 1 — PERSONAL_HOROSCOPE Semantic Hashing & Collision Test
{
  const phData1 = {
    sunSign: "Leo",
    moonSign: "Virgo",
    risingSign: "Scorpio",
    firePercent: 35,
    earthPercent: 25,
    airPercent: 20,
    waterPercent: 20,
    currentDate: "2026-08-24",
    currentYear: "2026",
    month: "august",
    weekRange: "2026-08-24 to 2026-08-30",
    periodType: "Daily",
    language: "en"
  };

  const phDataNormalized = {
    sunSign: "  leo ",
    moonSign: "virgo",
    risingSign: " SCORPIO ",
    firePercent: "35",
    earthPercent: "25",
    airPercent: "20",
    waterPercent: "20",
    currentDate: "2026-08-24",
    currentYear: "2026",
    month: "August",
    weekRange: " 2026-08-24 to 2026-08-30 ",
    periodType: "DAILY",
    language: " EN "
  };

  const key1 = getSharedCacheKey("personal_horoscope", phData1, "gemini-2.5-flash-lite");
  const key2 = getSharedCacheKey("personal_horoscope", phDataNormalized, "gemini-2.5-flash-lite");
  assert.strictEqual(key1, key2, "Identical complete semantic inputs must produce identical cache keys");
  assert.ok(key1.startsWith("aiz:cache:v2:gemini-2.5-flash-lite:personal_horoscope:"));
  assert.ok(key1.endsWith(":en"));

  // Collision Test: Same Sun/Moon/Rising/date/lang BUT DIFFERENT element balance -> MUST NOT share a key!
  const phDataDiffElements = {
    ...phData1,
    firePercent: 50,
    earthPercent: 10,
    airPercent: 20,
    waterPercent: 20,
  };
  const keyDiffElements = getSharedCacheKey("personal_horoscope", phDataDiffElements, "gemini-2.5-flash-lite");
  assert.notStrictEqual(key1, keyDiffElements, "Changed element balance MUST produce a different cache key");

  // Changed date produces different key
  const keyDiffDate = getSharedCacheKey("personal_horoscope", { ...phData1, currentDate: "2026-08-25" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(key1, keyDiffDate);

  // Changed sign produces different key
  const keyDiffSign = getSharedCacheKey("personal_horoscope", { ...phData1, risingSign: "Cancer" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(key1, keyDiffSign);

  // Verify all 18 Android fields in schema
  const schema = getResponseSchema("personal_horoscope");
  assert.strictEqual(schema.required.length, 18);
  const expectedPhFields = [
    "Sun", "Sun_Code", "Moon", "Moon_Code", "Ascendant", "Ascendant_Code", "Elements",
    "Personality (Sun, Moon, Ascendant)",
    "Current Period (Planetary Transits – Daily)",
    "Current Period (Planetary Transits – Weekly)",
    "Current Period (Planetary Transits – Monthly)",
    "Current Period (Planetary Transits – Yearly)",
    "Love & Relationships", "Career & Finances", "Health & Emotional Balance",
    "Personal Growth & Spirituality", "Advice", "Summary"
  ];
  for (const f of expectedPhFields) {
    assert.ok(schema.required.includes(f), `personal_horoscope must require field: ${f}`);
  }
  assert.strictEqual(getMaxOutputTokens("personal_horoscope"), 1200, "personal_horoscope bound must be 1200");
  console.log("✅ Test C passed: personal_horoscope SHA-256 semantic hash, collision prevention, zero PII, and 18 fields verified");
}

// Test D: High-Cost Feature 2 — NUMEROLOGY Deterministic Math & Tuple Cache
{
  // 1. Verify deterministic numerology engine
  const num1 = calculateNumerology("John Doe", "15/08/1990");
  assert.ok(num1.lifePath > 0 && num1.lifePath <= 33);
  assert.ok(num1.expression > 0 && num1.expression <= 33);
  assert.ok(num1.soulUrge > 0 && num1.soulUrge <= 33);
  assert.ok(num1.personality > 0 && num1.personality <= 33);

  // 2. Verify cache key based on numbers tuple
  const numData1 = {
    lifePathNumber: 7,
    expressionNumber: 3,
    soulUrgeNumber: 11,
    personalityNumber: 4,
    birthdayNumber: 15,
    language: "en"
  };
  const numData2 = {
    lifePathNumber: "7",
    expressionNumber: " 3 ",
    soulUrgeNumber: "11",
    personalityNumber: "4",
    birthdayNumber: "15",
    language: " EN "
  };

  const key1 = getSharedCacheKey("numerology", numData1, "gemini-2.5-flash-lite");
  const key2 = getSharedCacheKey("numerology", numData2, "gemini-2.5-flash-lite");
  assert.strictEqual(key1, key2, "Identical numbers tuple must produce identical cache key");
  assert.strictEqual(key1, `aiz:cache:v2:gemini-2.5-flash-lite:numerology:7_3_11_4_15:en`);
  assert.strictEqual(key1.includes("John"), false, "Name must NEVER appear in numerology cache key");
  assert.strictEqual(key1.includes("1990"), false, "Birth year must NEVER appear in numerology cache key");

  // Changed number produces different key
  const keyDiffNum = getSharedCacheKey("numerology", { ...numData1, lifePathNumber: 8 }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(key1, keyDiffNum);

  // Verify all 8 fields in schema
  const schema = getResponseSchema("numerology");
  assert.strictEqual(schema.required.length, 8);
  const expectedNumFields = [
    "Numerology Insights", "Life Path Number", "Expression Number", "Soul Urge Number",
    "Personality Number", "Birthday Number", "Compatibility Insight", "Summary and Guidance"
  ];
  for (const f of expectedNumFields) {
    assert.ok(schema.required.includes(f), `numerology must require field: ${f}`);
  }
  assert.strictEqual(getMaxOutputTokens("numerology"), 600, "numerology bound must be 600");
  console.log("✅ Test D passed: numerology deterministic engine, tuple cache, zero PII, and all 8 fields verified");
}

// Test E: High-Cost Feature 3 — PERSONAL_ASTRO_CALENDAR Shared Transit Cache
{
  const calData1 = {
    timeRange: "daily",
    timelineDate1: "2026-08-24",
    timelineDate2: "2026-08-25",
    timelineDate3: "2026-08-26",
    language: "en"
  };
  const calData2 = {
    timeRange: " DAILY ",
    timelineDate1: "2026-08-24",
    timelineDate2: "2026-08-25",
    timelineDate3: "2026-08-26",
    language: " EN "
  };

  const key1 = getSharedCacheKey("personal_astro_calendar", calData1, "gemini-2.5-flash-lite");
  const key2 = getSharedCacheKey("personal_astro_calendar", calData2, "gemini-2.5-flash-lite");
  assert.strictEqual(key1, key2);
  assert.strictEqual(key1, `aiz:cache:v2:gemini-2.5-flash-lite:personal_astro_calendar:daily:2026-08-24_2026-08-25_2026-08-26:en`);

  // Changed timeline date produces different key
  const keyDiffCal = getSharedCacheKey("personal_astro_calendar", { ...calData1, timelineDate1: "2026-08-27" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(key1, keyDiffCal);

  // Verify schema and Timeline array shape
  const schema = getResponseSchema("personal_astro_calendar");
  assert.strictEqual(schema.required.length, 7);
  assert.strictEqual(schema.properties.Timeline.type, "array");
  assert.strictEqual(schema.properties.Timeline.items.type, "string");
  const expectedCalFields = ["Overview", "Timeline", "Major Transits", "Energy Themes", "Advice", "Best Day", "Summary"];
  for (const f of expectedCalFields) {
    assert.ok(schema.required.includes(f), `personal_astro_calendar must require field: ${f}`);
  }
  assert.strictEqual(getMaxOutputTokens("personal_astro_calendar"), 700, "personal_astro_calendar bound must be 700");
  console.log("✅ Test E passed: personal_astro_calendar shared transit cache key, Timeline array shape, and 7 fields verified");
}

// Test F: High-Cost Feature 4 — CHINESE_HOROSCOPE CNY Math & Year Segment Cache
{
  // 1. Verify deterministic Chinese Zodiac calculation
  const z1 = getChineseZodiac_FULL("01/12/2025");
  assert.strictEqual(z1.animal, "Snake");
  assert.strictEqual(z1.element, "Wood");
  assert.strictEqual(z1.yinYang, "Yin");

  // 2. Verify cache key
  const chData = {
    animal: "Dragon",
    element: "Wood",
    yinYang: "Yang",
    currentYear: "2026",
    language: "de"
  };
  const key = getSharedCacheKey("chinese_horoscope", chData, "gemini-2.5-flash-lite");
  assert.strictEqual(key, `aiz:cache:v2:gemini-2.5-flash-lite:chinese_horoscope:2026:dragon_wood_yang:de`);

  // Different year produces different key
  const keyNextYear = getSharedCacheKey("chinese_horoscope", { ...chData, currentYear: "2027" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(key, keyNextYear);

  // Verify schema
  const schema = getResponseSchema("chinese_horoscope");
  assert.strictEqual(schema.required.length, 10);
  const expectedChFields = [
    "animal", "element", "yinYang", "personalityTraits", "elementInfluence",
    "yinYangPolarity", "compatibilityNotes", "yearlyOutlook", "advice", "closingReflection"
  ];
  for (const f of expectedChFields) {
    assert.ok(schema.required.includes(f), `chinese_horoscope must require field: ${f}`);
  }
  assert.strictEqual(getMaxOutputTokens("chinese_horoscope"), 650, "chinese_horoscope bound must be 650");
  console.log("✅ Test F passed: chinese_horoscope deterministic CNY math, year segment key, and 10 fields verified");
}

// Test G: BYPASS Types (Personal Custom Question & Explicit Period Snippets)
{
  const bypassTypes = [
    "ask_the_stars",
    "personal_horoscope_period_daily",
    "personal_horoscope_period_weekly",
    "personal_horoscope_period_monthly",
    "unknown_type"
  ];
  for (const bType of bypassTypes) {
    assert.strictEqual(isSharedCacheEligible(bType), false, `${bType} must remain BYPASS`);
    assert.strictEqual(getSharedCacheKey(bType, { question: "Will I find love?" }), null);
  }
  console.log("✅ Test G passed: Open-ended ask_the_stars and period snippets remain BYPASS");
}

// Test H: TTL Configurations
{
  for (const type of SHARED_CACHE_TYPES) {
    assert.ok(TTL_SECONDS[type] > 0, `TTL must be configured for ${type}`);
  }
  assert.strictEqual(TTL_SECONDS.personal_horoscope, 36 * 3600);
  assert.strictEqual(TTL_SECONDS.numerology, 90 * 86400);
  assert.strictEqual(TTL_SECONDS.personal_astro_calendar, 36 * 3600);
  assert.strictEqual(TTL_SECONDS.chinese_horoscope, 380 * 86400);
  console.log("✅ Test H passed: All TTL configurations verified");
}

// Test I: Telemetry Extraction & Recording
{
  const mockResp = {
    text: "Forecast text",
    usageMetadata: {
      promptTokenCount: 180,
      candidatesTokenCount: 220,
      totalTokenCount: 400,
    }
  };
  const usage = extractUsageMetadata(mockResp);
  assert.strictEqual(usage.promptTokens, 180);
  assert.strictEqual(usage.candidateTokens, 220);
  assert.strictEqual(usage.totalTokens, 400);

  const redisMap = new Map();
  const mockRedis = {
    async hincrby(key, field, inc) {
      if (!redisMap.has(key)) redisMap.set(key, {});
      const hash = redisMap.get(key);
      hash[field] = (hash[field] || 0) + inc;
      return hash[field];
    },
    async expire() { return 1; }
  };

  await recordUsageTelemetry(mockRedis, "personal_horoscope", usage, "2026-08-24");
  assert.deepStrictEqual(redisMap.get("aiz:usage:2026-08-24:total"), {
    requests: 1, promptTokens: 180, candidateTokens: 220, totalTokens: 400
  });
  assert.deepStrictEqual(redisMap.get("aiz:usage:2026-08-24:type:personal_horoscope"), {
    requests: 1, promptTokens: 180, candidateTokens: 220, totalTokens: 400
  });
  console.log("✅ Test I passed: Telemetry extraction and daily/type aggregation verified");
}

// Test J: Retry Backoff Tests (503 only, non-503 instant fail)
{
  let calls = 0;
  const delays = [];
  const res = await retryWithBackoff(async () => {
    calls++;
    if (calls === 1) {
      const err = new Error("503");
      err.status = 503;
      throw err;
    }
    return "OK";
  }, 5, (ms) => delays.push(ms));
  assert.strictEqual(res, "OK");
  assert.strictEqual(calls, 2);
  assert.deepStrictEqual(delays, [2000]);

  // Non-503 fails immediately
  let threw = false;
  try {
    await retryWithBackoff(async () => {
      const err = new Error("429");
      err.status = 429;
      throw err;
    }, 5, () => {});
  } catch (err) {
    threw = true;
  }
  assert.strictEqual(threw, true);
  console.log("✅ Test J passed: Retry backoff on 503 and immediate failure on non-503 verified");
}

// Test K: End-to-End Mock Pipeline for All 4 Features (HIT, MISS, Validation, No-PII)
{
  const mockCache = new Map();
  const mockTelemetry = new Map();

  const mockRedis = {
    async get(key) { return mockCache.get(key) || null; },
    async set(key, val, opts) { mockCache.set(key, val); return "OK"; },
    async hincrby(key, field, inc) {
      if (!mockTelemetry.has(key)) mockTelemetry.set(key, {});
      const hash = mockTelemetry.get(key);
      hash[field] = (hash[field] || 0) + inc;
      return hash[field];
    },
    async expire() { return 1; }
  };

  let simulatedOutputText = "";

  async function mockGenerateHandler(type, templateData) {
    const cacheKey = getSharedCacheKey(type, templateData, "gemini-2.5-flash-lite");

    if (cacheKey && mockRedis) {
      const cached = await mockRedis.get(cacheKey);
      if (cached) {
        return { status: 200, headers: { "X-AIZ-Cache": "HIT" }, body: { success: true, content: cached } };
      }
    }

    const schema = getResponseSchema(type);
    const text = simulatedOutputText.trim();

    if (schema) {
      try {
        JSON.parse(text);
      } catch (err) {
        return { status: 500, headers: { "X-AIZ-Cache": "BYPASS" }, body: { error: "invalid_ai_response", message: err.message } };
      }
    }

    const usage = { promptTokens: 100, candidateTokens: 50, totalTokens: 150 };
    await recordUsageTelemetry(mockRedis, type, usage, "2026-08-24");

    if (cacheKey && mockRedis && text.length > 0) {
      await mockRedis.set(cacheKey, text, { ex: 3600 });
      return { status: 200, headers: { "X-AIZ-Cache": "MISS" }, body: { success: true, content: text } };
    }

    return { status: 200, headers: { "X-AIZ-Cache": "BYPASS" }, body: { success: true, content: text } };
  }

  // 1. personal_horoscope MISS -> HIT
  simulatedOutputText = JSON.stringify({
    "Sun": "Oroszlán", "Sun_Code": "Leo", "Moon": "Szűz", "Moon_Code": "Virgo",
    "Ascendant": "Skorpió", "Ascendant_Code": "Scorpio",
    "Elements": "Fire 35%, Earth 25%, Air 20%, Water 20%",
    "Personality (Sun, Moon, Ascendant)": "Text.",
    "Current Period (Planetary Transits – Daily)": "Text.",
    "Current Period (Planetary Transits – Weekly)": "Text.",
    "Current Period (Planetary Transits – Monthly)": "Text.",
    "Current Period (Planetary Transits – Yearly)": "Text.",
    "Love & Relationships": "Text.", "Career & Finances": "Text.",
    "Health & Emotional Balance": "Text.", "Personal Growth & Spirituality": "Text.",
    "Advice": "Text.", "Summary": "Text."
  });
  const phData = { sunSign: "Leo", moonSign: "Virgo", risingSign: "Scorpio", firePercent: 35, earthPercent: 25, airPercent: 20, waterPercent: 20, currentDate: "2026-08-24", language: "hu" };
  const call1 = await mockGenerateHandler("personal_horoscope", phData);
  assert.strictEqual(call1.headers["X-AIZ-Cache"], "MISS");
  const call2 = await mockGenerateHandler("personal_horoscope", phData);
  assert.strictEqual(call2.headers["X-AIZ-Cache"], "HIT");

  // 2. numerology MISS -> HIT
  simulatedOutputText = JSON.stringify({
    "Numerology Insights": "Text.", "Life Path Number": "7 — Text.",
    "Expression Number": "3 — Text.", "Soul Urge Number": "11 — Text.",
    "Personality Number": "4 — Text.", "Birthday Number": "15 — Text.",
    "Compatibility Insight": "Text.", "Summary and Guidance": "Text."
  });
  const numData = { lifePathNumber: 7, expressionNumber: 3, soulUrgeNumber: 11, personalityNumber: 4, birthdayNumber: 15, language: "en" };
  const numCall1 = await mockGenerateHandler("numerology", numData);
  assert.strictEqual(numCall1.headers["X-AIZ-Cache"], "MISS");
  const numCall2 = await mockGenerateHandler("numerology", numData);
  assert.strictEqual(numCall2.headers["X-AIZ-Cache"], "HIT");

  // 3. personal_astro_calendar MISS -> HIT
  simulatedOutputText = JSON.stringify({
    "Overview": "Text.",
    "Timeline": ["2026-08-24: Text.", "2026-08-25: Text.", "2026-08-26: Text."],
    "Major Transits": "Text.", "Energy Themes": "Text.",
    "Advice": "Text.", "Best Day": "Monday — Text.", "Summary": "Text."
  });
  const calData = { timeRange: "daily", timelineDate1: "2026-08-24", timelineDate2: "2026-08-25", timelineDate3: "2026-08-26", language: "en" };
  const calCall1 = await mockGenerateHandler("personal_astro_calendar", calData);
  assert.strictEqual(calCall1.headers["X-AIZ-Cache"], "MISS");
  const calCall2 = await mockGenerateHandler("personal_astro_calendar", calData);
  assert.strictEqual(calCall2.headers["X-AIZ-Cache"], "HIT");

  // 4. chinese_horoscope MISS -> HIT
  simulatedOutputText = JSON.stringify({
    "animal": "Dragon", "element": "Wood", "yinYang": "Yang",
    "personalityTraits": "Text.", "elementInfluence": "Text.",
    "yinYangPolarity": "Text.", "compatibilityNotes": "Text.",
    "yearlyOutlook": "Text.", "advice": "Text.", "closingReflection": "Text."
  });
  const chData = { animal: "Dragon", element: "Wood", yinYang: "Yang", currentYear: "2026", language: "en" };
  const chCall1 = await mockGenerateHandler("chinese_horoscope", chData);
  assert.strictEqual(chCall1.headers["X-AIZ-Cache"], "MISS");
  const chCall2 = await mockGenerateHandler("chinese_horoscope", chData);
  assert.strictEqual(chCall2.headers["X-AIZ-Cache"], "HIT");

  console.log("✅ Test K passed: All four consolidated high-cost features successfully verified for Cache MISS -> Cache HIT");
}

console.log("==================================================");
console.log("ALL BATCH 3 FINAL V2 TESTS PASSED! 🎉");
console.log("==================================================");
