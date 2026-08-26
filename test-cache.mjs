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
console.log("RUNNING BATCH 5 CONSOLIDATED TESTS (ALL 17 TYPES)");
console.log("==================================================");

// Test 1: Global Cache Version & Type Revisions
{
  assert.strictEqual(CACHE_VERSION, "v2", "CACHE_VERSION must remain v2");
  assert.strictEqual(CACHE_TYPE_REVISION.home_daily_horoscope, "b6");
  assert.strictEqual(CACHE_TYPE_REVISION.ai_horoscope_daily, "b6");
  assert.strictEqual(CACHE_TYPE_REVISION.ai_horoscope_weekly, "b6");
  assert.strictEqual(CACHE_TYPE_REVISION.ai_horoscope_monthly, "b6");
  assert.strictEqual(CACHE_TYPE_REVISION.ai_horoscope_yearly, "b6");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.numerology, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_astro_calendar, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.chinese_horoscope, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.ascendant_calc, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.love_compatibility, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope_period_daily, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope_period_weekly, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope_period_monthly, "b5");
  console.log("✅ Test 1 passed: CACHE_VERSION = v2 and type revisions configured properly");
}

// Test 2: Updated Horoscope Caches (b6 revision) & Unchanged Quote Cache
{
  const k1 = getSharedCacheKey("home_daily_horoscope", { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(k1, "aiz:cache:v2:gemini-2.5-flash-lite:home_daily_horoscope:b6:2026-08-24:aries:en");

  const k2 = getSharedCacheKey("home_daily_quote", { currentDate: "2026-08-24", language: "hu" }, "gemini-2.5-flash-lite");
  assert.strictEqual(k2, "aiz:cache:v2:gemini-2.5-flash-lite:home_daily_quote:2026-08-24:hu");

  const k3 = getSharedCacheKey("ai_horoscope_daily", { zodiacSign: "Virgo", currentDate: "2026-08-24", language: "es" }, "gemini-2.5-flash-lite");
  assert.strictEqual(k3, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_daily:b6:2026-08-24:virgo:es");

  const k4 = getSharedCacheKey("ai_horoscope_general", { zodiacSign: "Virgo", currentDate: "2026-08-24", language: "es" }, "gemini-2.5-flash-lite");
  assert.strictEqual(k4, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_daily:b6:2026-08-24:virgo:es");

  console.log("✅ Test 2 passed: Updated horoscope caches use b6 revision; home_daily_quote remains unchanged baseline");
}

// Test 3: Batch 5 Offloaded Request Types (weekly, monthly, yearly on b6; ascendant, love on b5)
{
  // ai_horoscope_weekly (Week Range offloaded)
  const aiWeekly = getInternalAiSchema("ai_horoscope_weekly");
  const fullWeekly = getFullResponseSchema("ai_horoscope_weekly");
  assert.strictEqual(aiWeekly.required.length, 10);
  assert.strictEqual("Week Range" in aiWeekly.properties, false);
  assert.strictEqual(fullWeekly.required.length, 11);
  const mergedWeekly = mergeDeterministicFields("ai_horoscope_weekly", { Introduction: "Intro" }, { weekRange: "2026-08-24 to 2026-08-30" });
  assert.strictEqual(mergedWeekly["Week Range"], "2026-08-24 to 2026-08-30");

  const keyWeekly = getSharedCacheKey("ai_horoscope_weekly", { zodiacSign: "Leo", weekRange: "2026-w35", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(keyWeekly, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_weekly:b6:2026-w35:leo:en");

  // ai_horoscope_monthly (Month offloaded)
  const aiMonthly = getInternalAiSchema("ai_horoscope_monthly");
  const fullMonthly = getFullResponseSchema("ai_horoscope_monthly");
  assert.strictEqual(aiMonthly.required.length, 10);
  assert.strictEqual("Month" in aiMonthly.properties, false);
  assert.strictEqual(fullMonthly.required.length, 11);
  const mergedMonthly = mergeDeterministicFields("ai_horoscope_monthly", { Introduction: "Intro" }, { month: "August" });
  assert.strictEqual(mergedMonthly["Month"], "August");

  const keyMonthly = getSharedCacheKey("ai_horoscope_monthly", { zodiacSign: "Leo", month: "august", currentYear: "2026", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(keyMonthly, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_monthly:b6:2026_august:leo:en");

  // ai_horoscope_yearly (Year offloaded)
  const aiYearly = getInternalAiSchema("ai_horoscope_yearly");
  const fullYearly = getFullResponseSchema("ai_horoscope_yearly");
  assert.strictEqual(aiYearly.required.length, 10);
  assert.strictEqual("Year" in aiYearly.properties, false);
  assert.strictEqual(fullYearly.required.length, 11);
  const mergedYearly = mergeDeterministicFields("ai_horoscope_yearly", { Introduction: "Intro" }, { currentYear: "2026" });
  assert.strictEqual(mergedYearly["Year"], "2026");

  const keyYearly = getSharedCacheKey("ai_horoscope_yearly", { zodiacSign: "Leo", currentYear: "2026", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(keyYearly, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_yearly:b6:2026:leo:en");

  // ascendant_calc (Rising Sign offloaded & localized)
  const aiAsc = getInternalAiSchema("ascendant_calc");
  const fullAsc = getFullResponseSchema("ascendant_calc");
  assert.strictEqual(aiAsc.required.length, 6);
  assert.strictEqual("Rising Sign" in aiAsc.properties, false);
  assert.strictEqual(fullAsc.required.length, 7);
  const mergedAsc = mergeDeterministicFields("ascendant_calc", { "Core Traits": "Leader" }, { risingSign: "Scorpio" }, "hu");
  assert.strictEqual(mergedAsc["Rising Sign"], "Skorpió");

  const keyAsc = getSharedCacheKey("ascendant_calc", { risingSign: "Scorpio", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(keyAsc, "aiz:cache:v2:gemini-2.5-flash-lite:ascendant_calc:b5:scorpio:en");

  // love_compatibility (Your Sign offloaded & localized)
  const aiLove = getInternalAiSchema("love_compatibility");
  const fullLove = getFullResponseSchema("love_compatibility");
  assert.strictEqual(aiLove.required.length, 6);
  assert.strictEqual("Your Sign" in aiLove.properties, false);
  assert.strictEqual(fullLove.required.length, 7);
  const mergedLove = mergeDeterministicFields("love_compatibility", { "Love Advice": "Be open" }, { zodiacSign: "Aries" }, "de");
  assert.strictEqual(mergedLove["Your Sign"], "Widder");

  const keyLove = getSharedCacheKey("love_compatibility", { zodiacSign: "Aries", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(keyLove, "aiz:cache:v2:gemini-2.5-flash-lite:love_compatibility:b5:aries:en");

  console.log("✅ Test 3 passed: Horoscope types on b6; ascendant and love compatibility preserved on b5");
}

// Test 4: Ask the Stars (Custom user question -> BYPASS shared cache)
{
  assert.strictEqual(isSharedCacheEligible("ask_the_stars"), false);
  assert.strictEqual(getSharedCacheKey("ask_the_stars", { question: "What is my destiny?" }), null);
  const schema = getResponseSchema("ask_the_stars");
  assert.strictEqual(schema.required.length, 1);
  assert.strictEqual(schema.required[0], "Answer");
  console.log("✅ Test 4 passed: ask_the_stars safely retains BYPASS (no user question caching)");
}

// Test 5: Personal Period Requests (daily, weekly, monthly now safely cached with non-PII keys)
{
  assert.strictEqual(isSharedCacheEligible("personal_horoscope_period_daily"), true);
  assert.strictEqual(isSharedCacheEligible("personal_horoscope_period_weekly"), true);
  assert.strictEqual(isSharedCacheEligible("personal_horoscope_period_monthly"), true);

  const kDaily = getSharedCacheKey("personal_horoscope_period_daily", { currentDate: "2026-08-24", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(kDaily, "aiz:cache:v2:gemini-2.5-flash-lite:personal_horoscope_period_daily:b5:2026-08-24:en");

  const kWeekly = getSharedCacheKey("personal_horoscope_period_weekly", { weekRange: "2026-w35", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(kWeekly, "aiz:cache:v2:gemini-2.5-flash-lite:personal_horoscope_period_weekly:b5:2026-w35:en");

  const kMonthly = getSharedCacheKey("personal_horoscope_period_monthly", { month: "august", currentYear: "2026", language: "en" }, "gemini-2.5-flash-lite");
  assert.strictEqual(kMonthly, "aiz:cache:v2:gemini-2.5-flash-lite:personal_horoscope_period_monthly:b5:2026_august:en");

  console.log("✅ Test 5 passed: personal horoscope period requests safely cached with b5 keys and non-PII parameters");
}

// Test 6: All 17 Canonical Full Schemas Exist & Have Valid Structure
{
  const types = Object.keys(FULL_RESPONSE_SCHEMAS);
  assert.strictEqual(types.length >= 17, true);
  for (const t of types) {
    const s = getResponseSchema(t);
    assert.ok(s, `Schema missing for ${t}`);
    assert.strictEqual(s.type, "object");
    assert.ok(Array.isArray(s.required) && s.required.length > 0);
  }
  console.log(`✅ Test 6 passed: All ${types.length} response schemas are complete and valid`);
}

// Test 7: Batch 4 Preserved Features (personal_horoscope, numerology, chinese, astro_calendar)
{
  assert.strictEqual(getInternalAiSchema("personal_horoscope").required.length, 11);
  assert.strictEqual(getFullResponseSchema("personal_horoscope").required.length, 18);

  assert.strictEqual(getInternalAiSchema("numerology").required.length, 3);
  assert.strictEqual(getFullResponseSchema("numerology").required.length, 8);

  assert.strictEqual(getInternalAiSchema("chinese_horoscope").required.length, 7);
  assert.strictEqual(getFullResponseSchema("chinese_horoscope").required.length, 10);

  assert.strictEqual(getInternalAiSchema("personal_astro_calendar").required.length, 7);
  assert.strictEqual(getFullResponseSchema("personal_astro_calendar").required.length, 7);

  console.log("✅ Test 7 passed: Batch 4 optimized features strictly preserved and valid");
}

// Test 8: End-to-End Mock Generation Pipeline with Telemetry and Redis HIT/MISS
{
  const mockCache = new Map();
  const mockRedis = {
    async get(key) { return mockCache.get(key) || null; },
    async set(key, val) { mockCache.set(key, val); return "OK"; },
    async hincrby() { return 1; },
    async expire() { return 1; }
  };

  async function mockPipeline(type, data, lang = "en") {
    const cacheKey = getSharedCacheKey(type, { ...data, language: lang }, "gemini-2.5-flash-lite");
    if (cacheKey) {
      const cached = await mockRedis.get(cacheKey);
      if (cached) return { status: 200, header: "HIT", body: JSON.parse(cached) };
    }

    // Mock AI output with only internal fields
    let aiObj = {};
    if (type === "ascendant_calc") {
      aiObj = {
        "Core Traits": "Dynamic leader",
        "Social Impression": "Charismatic",
        "Behavioral Tendencies": "Decisive",
        "Physical Appearance": "Athletic",
        "Compatibility Note": "Harmonious with Aries",
        "Summary/Reflection": "Step forward boldly."
      };
    } else if (type === "love_compatibility") {
      aiObj = {
        "Your Love Energy": "Passionate and magnetic",
        "Your Love Style": "Spontaneous and genuine",
        "Three Most Compatible Signs": ["Leo — Warm bond", "Sagittarius — Adventurous pair", "Gemini — Lively connection"],
        "Challenging Signs": "Cancer requires extra patience",
        "Elemental Overview": "Fire energy seeks dynamic expression",
        "Love Advice": "Communicate openly."
      };
    }

    const merged = mergeDeterministicFields(type, aiObj, data, lang);
    assert.strictEqual(validateResponseObject(type, merged), true);
    const jsonStr = JSON.stringify(merged);
    if (cacheKey) {
      await mockRedis.set(cacheKey, jsonStr);
    }
    return { status: 200, header: "MISS", body: merged };
  }

  // ascendant_calc MISS -> HIT
  const ascData = { risingSign: "Scorpio" };
  const r1 = await mockPipeline("ascendant_calc", ascData, "hu");
  assert.strictEqual(r1.header, "MISS");
  assert.strictEqual(r1.body["Rising Sign"], "Skorpió");
  assert.strictEqual(Object.keys(r1.body).length, 7);

  const r2 = await mockPipeline("ascendant_calc", ascData, "hu");
  assert.strictEqual(r2.header, "HIT");
  assert.strictEqual(r2.body["Rising Sign"], "Skorpió");

  // love_compatibility MISS -> HIT
  const loveData = { zodiacSign: "Aries" };
  const l1 = await mockPipeline("love_compatibility", loveData, "en");
  assert.strictEqual(l1.header, "MISS");
  assert.strictEqual(l1.body["Your Sign"], "Aries");
  assert.strictEqual(Object.keys(l1.body).length, 7);

  const l2 = await mockPipeline("love_compatibility", loveData, "en");
  assert.strictEqual(l2.header, "HIT");
  assert.strictEqual(l2.body["Your Sign"], "Aries");

  console.log("✅ Test 8 passed: End-to-end mock generation pipeline verified with deterministic merging and cache transitions");
}

// Test 9: Targeted Zodiac Sign Isolation and Revision Partitioning
{
  // Prove Gemini and Cancer have different keys across all horoscope types
  const geminiDaily = getSharedCacheKey("ai_horoscope_daily", { zodiacSign: "Gemini", currentDate: "2026-08-24", language: "en" }, "gemini-2.5-flash-lite");
  const cancerDaily = getSharedCacheKey("ai_horoscope_daily", { zodiacSign: "Cancer", currentDate: "2026-08-24", language: "en" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(geminiDaily, cancerDaily, "Gemini and Cancer daily keys must be strictly different");
  assert.ok(geminiDaily.includes(":gemini:"), "Gemini daily key must contain 'gemini'");
  assert.ok(cancerDaily.includes(":cancer:"), "Cancer daily key must contain 'cancer'");

  // Prove Leo and Gemini have different keys for yearly
  const leoYearly = getSharedCacheKey("ai_horoscope_yearly", { zodiacSign: "Leo", currentYear: "2026", language: "en" }, "gemini-2.5-flash-lite");
  const geminiYearly = getSharedCacheKey("ai_horoscope_yearly", { zodiacSign: "Gemini", currentYear: "2026", language: "en" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(leoYearly, geminiYearly, "Leo and Gemini yearly keys must be strictly different");
  assert.ok(leoYearly.includes(":leo:"), "Leo yearly key must contain 'leo'");
  assert.ok(geminiYearly.includes(":gemini:"), "Gemini yearly key must contain 'gemini'");

  // Prove old and new horoscope cache revisions differ
  const oldGeminiDailyKey = "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_daily:2026-08-24:gemini:hu";
  const newGeminiDailyKey = getSharedCacheKey("ai_horoscope_daily", { zodiacSign: "Gemini", currentDate: "2026-08-24", language: "hu" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(newGeminiDailyKey, oldGeminiDailyKey, "New daily key must differ from old unversioned key");
  assert.strictEqual(newGeminiDailyKey, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_daily:b6:2026-08-24:gemini:hu");

  const oldLeoYearlyKey = "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_yearly:b5:2026:leo:hu";
  const newLeoYearlyKey = getSharedCacheKey("ai_horoscope_yearly", { zodiacSign: "Leo", currentYear: "2026", language: "hu" }, "gemini-2.5-flash-lite");
  assert.notStrictEqual(newLeoYearlyKey, oldLeoYearlyKey, "New yearly key must differ from old b5 key");
  assert.strictEqual(newLeoYearlyKey, "aiz:cache:v2:gemini-2.5-flash-lite:ai_horoscope_yearly:b6:2026:leo:hu");

  // Prove unrelated cache revisions remain completely unchanged
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.numerology, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_astro_calendar, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.chinese_horoscope, "b4");
  assert.strictEqual(CACHE_TYPE_REVISION.ascendant_calc, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.love_compatibility, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope_period_daily, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope_period_weekly, "b5");
  assert.strictEqual(CACHE_TYPE_REVISION.personal_horoscope_period_monthly, "b5");

  console.log("✅ Test 9 passed: Targeted zodiac sign isolation and cache revision differentiation verified");
}

console.log("==================================================");
console.log("ALL CACHE TESTS PASSED! 🎉");
console.log("==================================================");
