// test-cache.mjs
import assert from "node:assert";
import {
  CACHE_VERSION,
  TTL_SECONDS,
  isSharedCacheEligible,
  getSharedCacheKey,
  SHARED_CACHE_TYPES
} from "./lib/cacheHelper.js";

console.log("==================================================");
console.log("RUNNING DETERMINISTIC CACHE HELPER & LOGIC TESTS");
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

// Test I, J, K: Cache HIT path, Cache MISS path, Empty/Failed response, Redis Fail-Open
{
  const mockStore = new Map();
  let redisFail = false;

  const mockRedis = {
    async get(key) {
      if (redisFail) throw new Error("Redis connection timed out");
      return mockStore.get(key) || null;
    },
    async set(key, val, opts) {
      if (redisFail) throw new Error("Redis write failed");
      mockStore.set(key, val);
      return "OK";
    }
  };

  let modelCallCount = 0;
  let simulatedModelOutput = `{"result": "astrology insight"}`;
  let tokenAccountingCount = 0;

  async function mockHandlerPipeline(type, templateData) {
    let header = "BYPASS";
    const cacheKey = getSharedCacheKey(type, templateData, "gemini-2.5-flash-lite");

    if (cacheKey && mockRedis) {
      try {
        const cached = await mockRedis.get(cacheKey);
        if (cached !== null && cached !== undefined) {
          const cachedText = typeof cached === "string" ? cached.trim() : JSON.stringify(cached);
          if (cachedText.length > 0) {
            header = "HIT";
            return { header, content: cachedText, tokensAccounted: false };
          }
        }
      } catch (err) {
        // Fail open
      }
    } else {
      header = "BYPASS";
    }

    // Token accounting & Model call
    tokenAccountingCount++;
    modelCallCount++;

    const text = simulatedModelOutput || "";
    const trimmedText = text.trim();

    if (cacheKey && mockRedis && trimmedText.length > 0) {
      try {
        await mockRedis.set(cacheKey, trimmedText, { ex: 3600 });
      } catch {
        // Fail open
      }
      header = "MISS";
    }

    return { header, content: trimmedText, tokensAccounted: true };
  }

  // 1. Initial Request -> MISS, calls model once, accounts tokens once, caches response
  const res1 = await mockHandlerPipeline("home_daily_horoscope", { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(res1.header, "MISS");
  assert.strictEqual(modelCallCount, 1);
  assert.strictEqual(tokenAccountingCount, 1);
  assert.strictEqual(res1.content, `{"result": "astrology insight"}`);

  // 2. Second Request -> HIT, 0 model calls, 0 token accounting!
  const res2 = await mockHandlerPipeline("home_daily_horoscope", { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(res2.header, "HIT");
  assert.strictEqual(modelCallCount, 1, "Model call count must remain 1 on HIT");
  assert.strictEqual(tokenAccountingCount, 1, "Token accounting must not increment on HIT");
  assert.strictEqual(res2.content, res1.content);

  // 3. Failed/Empty generation -> not cached
  simulatedModelOutput = "";
  const resEmpty = await mockHandlerPipeline("home_daily_horoscope", { zodiacSign: "Gemini", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(modelCallCount, 2);
  // Re-requesting Gemini must still be a MISS (since empty was not cached)
  simulatedModelOutput = `{"result": "gemini forecast"}`;
  const resGemini = await mockHandlerPipeline("home_daily_horoscope", { zodiacSign: "Gemini", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(resGemini.header, "MISS");
  assert.strictEqual(modelCallCount, 3);

  // 4. Redis Failure -> Fail-Open (proceeds to model generation normally)
  redisFail = true;
  const resRedisFail = await mockHandlerPipeline("home_daily_horoscope", { zodiacSign: "Leo", currentDate: "2026-08-24", language: "en" });
  assert.strictEqual(modelCallCount, 4);
  assert.strictEqual(resRedisFail.content, `{"result": "gemini forecast"}`);
  redisFail = false;

  // 5. Personal type -> BYPASS
  const resPersonal = await mockHandlerPipeline("personal_horoscope", { zodiacSign: "Leo", language: "en" });
  assert.strictEqual(resPersonal.header, "BYPASS");

  console.log("✅ Test I, J, K passed: Mock HIT bypasses model & token accounting; MISS caches valid results; empty results not cached; Redis failure is fail-open");
}

console.log("==================================================");
console.log("ALL DETERMINISTIC TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
