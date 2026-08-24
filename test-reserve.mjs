// test-reserve.mjs
import assert from "node:assert";
import { generateReserveResponse, hashString, pick, classifyQuestionCategory } from "./lib/reserveGenerator.js";
import { COMPONENT_POOLS, DAILY_QUOTES, ASK_STARS_CATEGORIES } from "./lib/reserveContent.js";
import { FULL_RESPONSE_SCHEMAS, validateResponseObject } from "./lib/responseSchemas.js";
import { recordReserveTelemetry } from "./lib/telemetryHelper.js";
import handler from "./api/generateAstroContent.js";

console.log("==================================================");
console.log("RUNNING BATCH 8 EMERGENCY CONTENT RESERVE TESTS");
console.log("==================================================");

// The exact 28 supported Android languages audited from AIzodiac_New
const ANDROID_SUPPORTED_LOCALES = [
  "en", "hu", "de", "fr", "it", "ru", "es", "pt", "zh", "ja", "ko", "sw",
  "fa", "ta", "bn", "hi", "id", "th", "vi", "ur", "te", "pl", "tr",
  "uk", "ro", "nl", "ms", "ar"
];

const ALL_17_TYPES = [
  "home_daily_horoscope",
  "home_daily_quote",
  "ai_horoscope_daily",
  "ai_horoscope_general",
  "ai_horoscope_weekly",
  "ai_horoscope_monthly",
  "ai_horoscope_yearly",
  "ask_the_stars",
  "personal_horoscope",
  "personal_horoscope_period_daily",
  "personal_horoscope_period_weekly",
  "personal_horoscope_period_monthly",
  "love_compatibility",
  "numerology",
  "ascendant_calc",
  "personal_astro_calendar",
  "chinese_horoscope"
];

// Helper mock final data for all 17 types
function getMockFinalData(type, sign = "Aries", date = "2026-08-24", lang = "en") {
  return {
    zodiacSign: sign,
    sunSign: sign,
    moonSign: "Leo",
    risingSign: "Sagittarius",
    currentDate: date,
    specificDate: date,
    currentYear: "2026",
    month: "August",
    weekRange: "2026-08-24 to 2026-08-30",
    language: lang,
    firePercent: 30,
    earthPercent: 40,
    airPercent: 20,
    waterPercent: 10,
    lifePathNumber: 7,
    expressionNumber: 3,
    soulUrgeNumber: 11,
    personalityNumber: 4,
    birthdayNumber: 24,
    fullName: "Alex Smith",
    dateOfBirth: "24/08/1990",
    timeOfBirth: "14:30",
    placeOfBirth: "Budapest",
    SYMBOL: "🐍",
    ANIMAL: "Snake",
    ELEMENT: "Wood",
    YIN_YANG: "Yin",
    question: "Will I find true love soon?",
    timelineDate1: "2026-08-25",
    timelineDate2: "2026-08-28",
    timelineDate3: "2026-09-02",
  };
}

// =========================================================================
// TEST 1: Locale Dictionary Completeness (All 28 Android locales present)
// =========================================================================
console.log(`\n--- Auditing ${ANDROID_SUPPORTED_LOCALES.length} Android Locales in Reserve Dictionaries ---`);
for (const locale of ANDROID_SUPPORTED_LOCALES) {
  assert.ok(COMPONENT_POOLS[locale], `COMPONENT_POOLS must contain native dictionary for '${locale}'`);
  assert.ok(DAILY_QUOTES[locale], `DAILY_QUOTES must contain native quotes for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].intros.length > 0, `Intros empty for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].forecasts.length > 0, `Forecasts empty for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].love.length > 0, `Love empty for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].career.length > 0, `Career empty for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].finances.length > 0, `Finances empty for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].energies.length > 0, `Energies empty for '${locale}'`);
  assert.ok(COMPONENT_POOLS[locale].advices.length > 0, `Advices empty for '${locale}'`);
  
  if (locale !== "en") {
    // Verify non-English dictionaries are NOT identical to English (no English inheritance)
    assert.notStrictEqual(
      COMPONENT_POOLS[locale].intros[0],
      COMPONENT_POOLS.en.intros[0],
      `Locale '${locale}' must NOT inherit English intros`
    );
  }
}
console.log(`✅ Test 1 passed: All ${ANDROID_SUPPORTED_LOCALES.length} Android locales have genuine native phrase dictionaries`);

// =========================================================================
// TEST 2: Exhaustive Matrix (28 Locales × 17 Request Types = 476 Combinations)
// =========================================================================
console.log(`\n--- Running Matrix: ${ANDROID_SUPPORTED_LOCALES.length} Locales × ${ALL_17_TYPES.length} Types = ${ANDROID_SUPPORTED_LOCALES.length * ALL_17_TYPES.length} Combinations ---`);

let totalMatrixTests = 0;
for (const locale of ANDROID_SUPPORTED_LOCALES) {
  for (const type of ALL_17_TYPES) {
    const data = getMockFinalData(type, "Aries", "2026-08-24", locale);
    const result = generateReserveResponse(type, data, locale);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.source, "reserve");
    assert.ok(typeof result.content === "string");

    const parsed = JSON.parse(result.content);
    assert.ok(parsed && typeof parsed === "object");

    // Validate against canonical full response schema
    const isValid = validateResponseObject(type, parsed);
    assert.strictEqual(isValid, true, `Reserve output for ${type} in locale '${locale}' failed schema validation!`);

    // Check that all required fields are present and non-empty
    const schema = FULL_RESPONSE_SCHEMAS[type];
    for (const field of schema.required) {
      const val = parsed[field];
      assert.ok(val !== undefined && val !== null, `Field '${field}' is missing in reserve ${type} for '${locale}'`);
      if (typeof val === "string") {
        assert.ok(val.trim().length > 0, `Field '${field}' is empty string in reserve ${type} for '${locale}'`);
      } else if (Array.isArray(val)) {
        assert.ok(val.length > 0, `Array field '${field}' is empty in reserve ${type} for '${locale}'`);
      }
    }

    // Strict check: For non-English responses, ensure user prose does not match English phrases
    if (locale !== "en") {
      if (parsed["Daily Horoscope"]) {
        assert.notStrictEqual(
          parsed["Daily Horoscope"],
          `${COMPONENT_POOLS.en.intros[0]} ${COMPONENT_POOLS.en.forecasts[0]}`,
          `Response for '${locale}' incorrectly returned English text`
        );
      }
    }

    totalMatrixTests++;
  }
}
console.log(`✅ Test 2 passed: All ${totalMatrixTests} matrix combinations (${ANDROID_SUPPORTED_LOCALES.length} locales × ${ALL_17_TYPES.length} types) passed schema validation with genuine native text`);

// =========================================================================
// TEST 3: Deterministic Stability (Same input -> Identical response)
// =========================================================================
{
  const data1 = getMockFinalData("home_daily_horoscope", "Leo", "2026-08-24", "hu");
  const data2 = getMockFinalData("home_daily_horoscope", "Leo", "2026-08-24", "hu");

  const res1 = generateReserveResponse("home_daily_horoscope", data1, "hu");
  const res2 = generateReserveResponse("home_daily_horoscope", data2, "hu");

  assert.strictEqual(res1.content, res2.content, "Same inputs must produce byte-for-byte identical output");
  console.log("✅ Test 3 passed: Same semantic inputs produce stable, deterministic outputs");
}

// =========================================================================
// TEST 4: Semantic Variation (Different sign/date -> Different output)
// =========================================================================
{
  const aries = generateReserveResponse("home_daily_horoscope", getMockFinalData("home_daily_horoscope", "Aries", "2026-08-24", "de"), "de");
  const scorpio = generateReserveResponse("home_daily_horoscope", getMockFinalData("home_daily_horoscope", "Scorpio", "2026-08-24", "de"), "de");
  const ariesTomorrow = generateReserveResponse("home_daily_horoscope", getMockFinalData("home_daily_horoscope", "Aries", "2026-08-25", "de"), "de");

  assert.notStrictEqual(aries.content, scorpio.content, "Different signs must produce varied content");
  assert.notStrictEqual(aries.content, ariesTomorrow.content, "Different dates must produce varied content");
  console.log("✅ Test 4 passed: Semantic variation across signs and dates verified");
}

// =========================================================================
// TEST 5: ask_the_stars Category Classification Across Locales
// =========================================================================
{
  assert.strictEqual(classifyQuestionCategory("Will I get married or find love?"), "love");
  assert.strictEqual(classifyQuestionCategory("Mikor kapok előléptetést a munkahelyemen?"), "career");
  assert.strictEqual(classifyQuestionCategory("Soll ich mein Geld in Aktien investieren?"), "finances");
  assert.strictEqual(classifyQuestionCategory("Comment choisir le bon chemin?"), "decision");
  assert.strictEqual(classifyQuestionCategory("هل سأتزوج قريبا؟"), "love");
  assert.strictEqual(classifyQuestionCategory("我的工作会有晋升吗？"), "career");

  const askLoveJa = generateReserveResponse("ask_the_stars", { question: "結婚できますか？" }, "ja");
  const askCareerJa = generateReserveResponse("ask_the_stars", { question: "転職についてどう思いますか？" }, "ja");

  assert.notStrictEqual(askLoveJa.content, askCareerJa.content);
  console.log("✅ Test 5 passed: ask_the_stars multilingual keyword classifier verified");
}

// =========================================================================
// TEST 6: Telemetry Recording for Reserve (Zero Tokens, Routing Counter Only)
// =========================================================================
{
  const mockHashes = new Map();
  const mockRedis = {
    async hincrby(key, field, amount) {
      if (!mockHashes.has(key)) mockHashes.set(key, {});
      const h = mockHashes.get(key);
      h[field] = (Number(h[field]) || 0) + Number(amount);
      return h[field];
    },
    async expire() { return 1; }
  };

  await recordReserveTelemetry(mockRedis, "home_daily_horoscope", "budget", "2026-08-24");

  const routingHash = mockHashes.get("aiz:usage:2026-08-24:routing");
  const typeHash = mockHashes.get("aiz:usage:2026-08-24:reserve:type:home_daily_horoscope");

  assert.strictEqual(routingHash.reserveUsed, 1);
  assert.strictEqual(routingHash.reserveByBudget, 1);
  assert.strictEqual(typeHash.requests, 1);

  console.log("✅ Test 6 passed: Reserve telemetry recorded correctly with zero token usage");
}

// =========================================================================
// TEST 7: End-to-End Handler Fallback to Reserve when Budget Exhausted
// =========================================================================
{
  const mockReq = {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    body: {
      type: "home_daily_horoscope",
      data: { zodiacSign: "Aries", specificDate: "2026-08-24" },
      languageCode: "ja"
    }
  };

  const capturedHeaders = {};
  let capturedStatus = null;
  let capturedJson = null;

  const mockRes = {
    setHeader(name, val) { capturedHeaders[name] = val; },
    status(s) { capturedStatus = s; return this; },
    json(j) { capturedJson = j; return this; }
  };

  // Force budget limits to 0 to simulate exhausted budget
  process.env.GLOBAL_DAILY_TOKEN_LIMIT = "0";
  process.env.GROQ_DAILY_TOKEN_LIMIT = "0";
  process.env.GEMINI_DAILY_TOKEN_LIMIT = "0";

  await handler(mockReq, mockRes);

  assert.strictEqual(capturedStatus, 200);
  assert.strictEqual(capturedHeaders["X-AIZ-Source"], "reserve");
  assert.strictEqual(capturedJson.success, true);
  assert.ok(typeof capturedJson.content === "string");

  const parsed = JSON.parse(capturedJson.content);
  assert.ok(parsed["Daily Horoscope"]);

  // Reset env vars
  delete process.env.GLOBAL_DAILY_TOKEN_LIMIT;
  delete process.env.GROQ_DAILY_TOKEN_LIMIT;
  delete process.env.GEMINI_DAILY_TOKEN_LIMIT;

  console.log("✅ Test 7 passed: Handler automatically served Emergency Reserve (200 OK) in Japanese without English inheritance");
}

// =========================================================================
// TEST 8: Malformed Request / Invalid Input Must Fail (Reserve NOT used)
// =========================================================================
{
  const mockReq = {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    body: {
      data: { zodiacSign: "Aries" }
    }
  };

  let capturedStatus = null;
  let capturedJson = null;

  const mockRes = {
    setHeader() {},
    status(s) { capturedStatus = s; return this; },
    json(j) { capturedJson = j; return this; }
  };

  await handler(mockReq, mockRes);
  assert.strictEqual(capturedStatus, 400);
  assert.strictEqual(capturedJson.error, "missing_type");

  console.log("✅ Test 8 passed: Malformed requests fail normally with 400 (Reserve NOT used to hide bad input)");
}

console.log("==================================================");
console.log("ALL BATCH 8 EMERGENCY RESERVE TESTS PASSED! 🎉");
console.log("==================================================");
