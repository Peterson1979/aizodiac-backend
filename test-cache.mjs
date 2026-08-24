// test-cache.mjs
import assert from "node:assert";
import {
  CACHE_VERSION,
  CACHE_TYPE_REVISION,
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
  FULL_RESPONSE_SCHEMAS,
  INTERNAL_AI_SCHEMAS,
  MAX_OUTPUT_TOKENS_BY_TYPE,
  getResponseSchema,
  getFullResponseSchema,
  getInternalAiSchema,
  getMaxOutputTokens,
  mergeDeterministicFields,
  validateResponseObject,
  getLocalizedZodiacSign
} from "./lib/responseSchemas.js";
import { PROMPTS } from "./lib/prompts.js";
import { getChineseZodiac_FULL } from "./lib/chineseZodiac.js";
import { calculateNumerology } from "./lib/factualCalculations.js";
import { retryWithBackoff } from "./api/generateAstroContent.js";

console.log("==================================================");
console.log("RUNNING BATCH 4 DETERMINISTIC OFFLOADING & CACHE TESTS");
console.log("==================================================");

// Test A: Cache Version (Preserved as v2) and Type-Specific Revisions
{
  assert.strictEqual(CACHE_VERSION, "v2", "CACHE_VERSION must remain v2");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.numerology, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_astro_calendar, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.chinese_horoscope, "b4");
  console.log("✅ Test A passed: CACHE_VERSION is v2 and CACHE_TYPE_REVISION is configured");
}

// Test B: Unrelated v2 Public Shared Cache Keys Remain Unchanged
{
  const data1 = { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" };
  const key1 = getSharedCacheKey("home_daily_horoscope", data1, "gemini-2.5-flash-lite");
  assert.strictEqual(key1, `aiz:cache:v2:gemini-2.5-flash-lite:home_daily_horoscope:2026-08-24:aries:en`);

  const quoteKey = getSharedCacheKey("home_daily_quote", { currentDate: "2026-08-24", language: "hu" }, "gemini-2.5-flash-lite");
  assert.strictEqual(quoteKey, `aiz:cache:v2:gemini-2.5-flash-lite:home_daily_quote:2026-08-24:hu`);

  const ascKey = getSharedCacheKey("ascendant_calc", { risingSign: "Scorpio", language: "es" }, "gemini-2.5-flash-lite");
  assert.strictEqual(ascKey, `aiz:cache:v2:gemini-2.5-flash-lite:ascendant_calc:scorpio:es`);

  const loveKey = getSharedCacheKey("love_compatibility", { zodiacSign: "Libra", language: "fr" }, "gemini-2.5-flash-lite");
  assert.strictEqual(loveKey, `aiz:cache:v2:gemini-2.5-flash-lite:love_compatibility:libra:fr`);

  console.log("✅ Test B passed: All unrelated v2 public cache keys remain byte-for-byte identical to baseline");
}

// Test C: Batch 4 Affected Keys Contain Type-Specific Revision and Partition Safely
{
  const phKey = getSharedCacheKey("personal_horoscope", {
    sunSign: "Leo", moonSign: "Virgo", risingSign: "Scorpio",
    firePercent: 35, earthPercent: 25, airPercent: 20, waterPercent: 20,
    currentDate: "2026-08-24", language: "en"
  }, "gemini-2.5-flash-lite");
  assert.ok(phKey.includes(":personal_horoscope:b4:"), "personal_horoscope key must include b4 revision");

  const numKey = getSharedCacheKey("numerology", {
    lifePathNumber: 7, expressionNumber: 3, soulUrgeNumber: 11, personalityNumber: 4, birthdayNumber: 15, language: "en"
  }, "gemini-2.5-flash-lite");
  assert.strictEqual(numKey, "aiz:cache:v2:gemini-2.5-flash-lite:numerology:b4:7_3_11_4_15:en");

  const calKey = getSharedCacheKey("personal_astro_calendar", {
    timeRange: "daily", timelineDate1: "2026-08-24", timelineDate2: "2026-08-25", timelineDate3: "2026-08-26", language: "en"
  }, "gemini-2.5-flash-lite");
  assert.strictEqual(calKey, "aiz:cache:v2:gemini-2.5-flash-lite:personal_astro_calendar:b4:daily:2026-08-24_2026-08-25_2026-08-26:en");

  const chKey = getSharedCacheKey("chinese_horoscope", {
    animal: "Dragon", element: "Wood", yinYang: "Yang", currentYear: "2026", language: "de"
  }, "gemini-2.5-flash-lite");
  assert.strictEqual(chKey, "aiz:cache:v2:gemini-2.5-flash-lite:chinese_horoscope:b4:2026:dragon_wood_yang:de");

  console.log("✅ Test C passed: Affected 4 request types safely incorporate b4 revision");
}

// Test D: PERSONAL_HOROSCOPE Internal AI Schema & Deterministic Merging
{
  const aiSchema = getInternalAiSchema("personal_horoscope");
  const fullSchema = getFullResponseSchema("personal_horoscope");

  // AI schema must only have 11 fields
  assert.strictEqual(aiSchema.required.length, 11);
  assert.strictEqual("Sun" in aiSchema.properties, false);
  assert.strictEqual("Sun_Code" in aiSchema.properties, false);
  assert.strictEqual("Moon" in aiSchema.properties, false);
  assert.strictEqual("Moon_Code" in aiSchema.properties, false);
  assert.strictEqual("Ascendant" in aiSchema.properties, false);
  assert.strictEqual("Ascendant_Code" in aiSchema.properties, false);
  assert.strictEqual("Elements" in aiSchema.properties, false);

  // Full schema must have all 18 fields
  assert.strictEqual(fullSchema.required.length, 18);

  // Mock Gemini output with only 11 interpretive fields
  const mockAiOutput = {
    "Personality (Sun, Moon, Ascendant)": "Dynamic and inspiring nature.",
    "Current Period (Planetary Transits – Daily)": "Favorable clarity today.",
    "Current Period (Planetary Transits – Weekly)": "Growth in career pursuits.",
    "Current Period (Planetary Transits – Monthly)": "Financial balance improves.",
    "Current Period (Planetary Transits – Yearly)": "Transformative year ahead.",
    "Love & Relationships": "Harmonious connections blossom.",
    "Career & Finances": "Strategic investments succeed.",
    "Health & Emotional Balance": "Maintain physical stamina.",
    "Personal Growth & Spirituality": "Deep intuition guides decisions.",
    "Advice": "Trust your inner wisdom.",
    "Summary": "A powerful day for personal achievements."
  };

  const finalData = {
    sunSign: "Leo",
    moonSign: "Virgo",
    risingSign: "Scorpio",
    firePercent: 35,
    earthPercent: 25,
    airPercent: 20,
    waterPercent: 20
  };

  const merged = mergeDeterministicFields("personal_horoscope", mockAiOutput, finalData, "hu");
  assert.strictEqual(Object.keys(merged).length, 18);
  assert.strictEqual(merged["Sun"], "Oroszlán");
  assert.strictEqual(merged["Sun_Code"], "Leo");
  assert.strictEqual(merged["Moon"], "Szűz");
  assert.strictEqual(merged["Moon_Code"], "Virgo");
  assert.strictEqual(merged["Ascendant"], "Skorpió");
  assert.strictEqual(merged["Ascendant_Code"], "Scorpio");
  assert.strictEqual(merged["Elements"], "Fire 35%, Earth 25%, Air 20%, Water 20%");
  assert.strictEqual(validateResponseObject("personal_horoscope", merged), true);

  console.log("✅ Test D passed: personal_horoscope AI schema has 11 fields, merges to all 18 fields, localized and validated");
}

// Test E: NUMEROLOGY Internal AI Schema & Deterministic Merging
{
  const aiSchema = getInternalAiSchema("numerology");
  const fullSchema = getFullResponseSchema("numerology");

  // AI schema must only have 3 interpretive fields
  assert.strictEqual(aiSchema.required.length, 3);
  assert.deepStrictEqual(aiSchema.required, [
    "Numerology Insights", "Compatibility Insight", "Summary and Guidance"
  ]);

  // Full schema must have all 8 fields
  assert.strictEqual(fullSchema.required.length, 8);

  const mockAiOutput = {
    "Numerology Insights": "You possess deep wisdom and visionary potential.",
    "Compatibility Insight": "Harmonious synergy with 3 and 7 vibrations.",
    "Summary and Guidance": "Focus on spiritual growth and deliberate action."
  };

  const finalData = {
    lifePathNumber: 7,
    expressionNumber: 3,
    soulUrgeNumber: 11,
    personalityNumber: 4,
    birthdayNumber: 15
  };

  const merged = mergeDeterministicFields("numerology", mockAiOutput, finalData, "en");
  assert.strictEqual(Object.keys(merged).length, 8);
  assert.strictEqual(merged["Life Path Number"], "7");
  assert.strictEqual(merged["Expression Number"], "3");
  assert.strictEqual(merged["Soul Urge Number"], "11");
  assert.strictEqual(merged["Personality Number"], "4");
  assert.strictEqual(merged["Birthday Number"], "15");
  assert.strictEqual(validateResponseObject("numerology", merged), true);

  console.log("✅ Test E passed: numerology AI schema has 3 fields, merges 5 deterministic numbers, all 8 fields validated");
}

// Test F: CHINESE_HOROSCOPE Internal AI Schema & Deterministic Merging
{
  const aiSchema = getInternalAiSchema("chinese_horoscope");
  const fullSchema = getFullResponseSchema("chinese_horoscope");

  // AI schema must have 7 fields (animal, element, yinYang excluded)
  assert.strictEqual(aiSchema.required.length, 7);
  assert.strictEqual("animal" in aiSchema.properties, false);
  assert.strictEqual("element" in aiSchema.properties, false);
  assert.strictEqual("yinYang" in aiSchema.properties, false);

  // Full schema must have all 10 fields
  assert.strictEqual(fullSchema.required.length, 10);

  const mockAiOutput = {
    personalityTraits: "Confident and energetic leader.",
    elementInfluence: "Wood brings expansive vitality and creative ambition.",
    yinYangPolarity: "Yang provides bold initiative and forward drive.",
    compatibilityNotes: "High affinity with Rat and Monkey signs.",
    yearlyOutlook: "Promising prospects for personal growth.",
    advice: "Balance ambition with measured patience.",
    closingReflection: "The Dragon thrives through wise courage."
  };

  const finalData = {
    ANIMAL: "Dragon",
    ELEMENT: "Wood",
    YIN_YANG: "Yang"
  };

  const merged = mergeDeterministicFields("chinese_horoscope", mockAiOutput, finalData, "en");
  assert.strictEqual(Object.keys(merged).length, 10);
  assert.strictEqual(merged["animal"], "Dragon");
  assert.strictEqual(merged["element"], "Wood");
  assert.strictEqual(merged["yinYang"], "Yang");
  assert.strictEqual(validateResponseObject("chinese_horoscope", merged), true);

  console.log("✅ Test F passed: chinese_horoscope AI schema has 7 fields, merges animal/element/yinYang, all 10 fields validated");
}

// Test G: PERSONAL_ASTRO_CALENDAR Timeline Array & Schema
{
  const aiSchema = getInternalAiSchema("personal_astro_calendar");
  const fullSchema = getFullResponseSchema("personal_astro_calendar");
  assert.strictEqual(aiSchema.required.length, 7);
  assert.strictEqual(fullSchema.required.length, 7);

  const mockAiOutput = {
    Overview: "A period of celestial momentum.",
    Timeline: [
      "Clarity and strategic focus.",
      "2026-08-25: Productive collaboration.",
      "Reflective contemplation."
    ],
    "Major Transits": "Sun trine Mars empowers decisive action.",
    "Energy Themes": "Clarity, purpose, vitality.",
    Advice: "Channel inspiration into concrete plans.",
    "Best Day": "Tuesday — Favorable for major initiatives.",
    Summary: "Harness this transit window for meaningful progress."
  };

  const finalData = {
    timelineDate1: "2026-08-24",
    timelineDate2: "2026-08-25",
    timelineDate3: "2026-08-26"
  };

  const merged = mergeDeterministicFields("personal_astro_calendar", mockAiOutput, finalData, "en");
  assert.strictEqual(merged.Timeline[0].startsWith("2026-08-24:"), true);
  assert.strictEqual(merged.Timeline[1].startsWith("2026-08-25:"), true);
  assert.strictEqual(merged.Timeline[2].startsWith("2026-08-26:"), true);
  assert.strictEqual(validateResponseObject("personal_astro_calendar", merged), true);

  console.log("✅ Test G passed: personal_astro_calendar Timeline array and all 7 fields verified");
}

// Test H: Telemetry & Retry Backoff Invariant Tests
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

  const mockUsage = { promptTokenCount: 150, candidatesTokenCount: 120, totalTokenCount: 270 };
  const extracted = extractUsageMetadata({ usageMetadata: mockUsage });
  assert.strictEqual(extracted.promptTokens, 150);
  assert.strictEqual(extracted.candidateTokens, 120);
  assert.strictEqual(extracted.totalTokens, 270);

  console.log("✅ Test H passed: Retries (503 backoff) and telemetry metadata extraction verified");
}

// Test I: End-to-End Mock Pipeline with Deterministic Merging & Cache MISS -> HIT
{
  const mockCache = new Map();
  const mockRedis = {
    async get(key) { return mockCache.get(key) || null; },
    async set(key, val) { mockCache.set(key, val); return "OK"; },
    async hincrby() { return 1; },
    async expire() { return 1; }
  };

  async function mockGenerate(type, finalData) {
    const cacheKey = getSharedCacheKey(type, finalData, "gemini-2.5-flash-lite");
    if (cacheKey && mockRedis) {
      const cached = await mockRedis.get(cacheKey);
      if (cached) {
        return { status: 200, headers: { "X-AIZ-Cache": "HIT" }, body: { success: true, content: cached } };
      }
    }

    // Simulate AI output (internal schema only)
    let rawAiObj;
    if (type === "numerology") {
      rawAiObj = {
        "Numerology Insights": "Deep spiritual intuition.",
        "Compatibility Insight": "Synergy with 3.",
        "Summary and Guidance": "Trust your path."
      };
    } else if (type === "personal_horoscope") {
      rawAiObj = {
        "Personality (Sun, Moon, Ascendant)": "Inspiring spirit.",
        "Current Period (Planetary Transits – Daily)": "Clarity.",
        "Current Period (Planetary Transits – Weekly)": "Growth.",
        "Current Period (Planetary Transits – Monthly)": "Balance.",
        "Current Period (Planetary Transits – Yearly)": "Transformation.",
        "Love & Relationships": "Harmony.",
        "Career & Finances": "Success.",
        "Health & Emotional Balance": "Vitality.",
        "Personal Growth & Spirituality": "Intuition.",
        Advice: "Focus.",
        Summary: "Great day."
      };
    }

    const merged = mergeDeterministicFields(type, rawAiObj, finalData, "en");
    assert.strictEqual(validateResponseObject(type, merged), true);
    const jsonStr = JSON.stringify(merged);

    if (cacheKey && mockRedis) {
      await mockRedis.set(cacheKey, jsonStr);
    }
    return { status: 200, headers: { "X-AIZ-Cache": "MISS" }, body: { success: true, content: jsonStr } };
  }

  // numerology MISS -> HIT
  const numData = { lifePathNumber: 7, expressionNumber: 3, soulUrgeNumber: 11, personalityNumber: 4, birthdayNumber: 15, language: "en" };
  const num1 = await mockGenerate("numerology", numData);
  assert.strictEqual(num1.headers["X-AIZ-Cache"], "MISS");
  const num1Parsed = JSON.parse(num1.body.content);
  assert.strictEqual(Object.keys(num1Parsed).length, 8);

  const num2 = await mockGenerate("numerology", numData);
  assert.strictEqual(num2.headers["X-AIZ-Cache"], "HIT");
  assert.strictEqual(num2.body.content, num1.body.content);

  // personal_horoscope MISS -> HIT
  const phData = { sunSign: "Leo", moonSign: "Virgo", risingSign: "Scorpio", firePercent: 35, earthPercent: 25, airPercent: 20, waterPercent: 20, currentDate: "2026-08-24", language: "en" };
  const ph1 = await mockGenerate("personal_horoscope", phData);
  assert.strictEqual(ph1.headers["X-AIZ-Cache"], "MISS");
  const ph1Parsed = JSON.parse(ph1.body.content);
  assert.strictEqual(Object.keys(ph1Parsed).length, 18);

  const ph2 = await mockGenerate("personal_horoscope", phData);
  assert.strictEqual(ph2.headers["X-AIZ-Cache"], "HIT");
  assert.strictEqual(ph2.body.content, ph1.body.content);

  console.log("✅ Test I passed: Mock end-to-end generation merges deterministic fields and caches full objects");
}

console.log("==================================================");
console.log("ALL BATCH 4 DETERMINISTIC OFFLOADING TESTS PASSED! 🎉");
console.log("==================================================");
