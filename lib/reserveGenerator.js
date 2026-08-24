// lib/reserveGenerator.js
import {
  ZODIAC_NAMES,
  WEEKDAYS,
  LUCKY_COLORS,
  DAILY_QUOTES,
  COMPONENT_POOLS,
  ASK_STARS_CATEGORIES
} from "./reserveContent.js";
import {
  mergeDeterministicFields,
  validateResponseObject,
  getFullResponseSchema
} from "./responseSchemas.js";

/**
 * Deterministic integer hash for semantic seed strings.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let hash = 5381;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Deterministically picks an element from an array using a seed string and optional offset.
 * @param {Array} array
 * @param {string} seed
 * @param {number} [offset]
 * @returns {*}
 */
export function pick(array, seed, offset = 0) {
  if (!Array.isArray(array) || array.length === 0) return "";
  const index = (hashString(seed) + offset) % array.length;
  return array[index];
}

/**
 * Resolves the closest supported language pool or defaults to English.
 * @param {string} lang
 * @returns {string}
 */
function resolveLang(lang) {
  let norm = String(lang || "en").trim().toLowerCase().slice(0, 2);
  if (norm === "in") norm = "id";
  if (COMPONENT_POOLS[norm]) return norm;
  return "en";
}

/**
 * Classifies an incoming question for ask_the_stars into a semantic category.
 * @param {string} question
 * @returns {string} category key
 */
export function classifyQuestionCategory(question) {
  const q = String(question || "").toLowerCase();
  if (!q.trim()) return "general";

  const categories = ["love", "career", "finances", "decision"];
  for (const cat of categories) {
    const keywords = ASK_STARS_CATEGORIES[cat]?.keywords || [];
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase())) {
        return cat;
      }
    }
  }
  return "general";
}

/**
 * Core Emergency Reserve Generator for all 17 AI Zodiac request types.
 * Produces 100% deterministic, valid, non-empty, localized JSON objects without any external AI calls.
 *
 * @param {string} type - Request type
 * @param {object} finalData - Prepared request data
 * @param {string} [languageCode] - Target language
 * @returns {{success: boolean, source: string, content: string, object: object}}
 */
export function generateReserveResponse(type, finalData = {}, languageCode = "en") {
  const lang = resolveLang(languageCode || finalData.language);
  const pools = COMPONENT_POOLS[lang] || COMPONENT_POOLS.en;
  const colors = LUCKY_COLORS[lang] || LUCKY_COLORS.en;
  const weekdays = WEEKDAYS[lang] || WEEKDAYS.en;
  const quotes = DAILY_QUOTES[lang] || DAILY_QUOTES.en;

  const sign = finalData.zodiacSign || finalData.sunSign || "Aries";
  const date = finalData.currentDate || finalData.specificDate || new Date().toISOString().slice(0, 10);
  const seed = `${type}:${sign}:${date}:${lang}`;

  let rawAiObj = {};

  switch (type) {
    case "home_daily_horoscope": {
      const intro = pick(pools.intros, seed, 1);
      const forecast = pick(pools.forecasts, seed, 2);
      rawAiObj = {
        "Daily Horoscope": `${intro} ${forecast}`
      };
      break;
    }

    case "home_daily_quote": {
      const quote = pick(quotes, seed, 3);
      rawAiObj = {
        "Daily Quote": quote
      };
      break;
    }

    case "ai_horoscope_daily":
    case "ai_horoscope_general": {
      const luckyNum = ((hashString(seed) % 99) + 1).toString();
      const luckyCol = pick(colors, seed, 4);
      const bestDay = pick(weekdays, seed, 5);

      rawAiObj = {
        Introduction: pick(pools.intros, seed, 10),
        "Main Forecast": pick(pools.forecasts, seed, 20),
        Love: pick(pools.love, seed, 30),
        Career: pick(pools.career, seed, 40),
        Finances: pick(pools.finances, seed, 50),
        "Lucky Number": luckyNum,
        "Lucky Color": luckyCol,
        "Best Day": bestDay,
        "Overall Energy": pick(pools.energies, seed, 60),
        "Final Advice": pick(pools.advices, seed, 70),
      };
      break;
    }

    case "ai_horoscope_weekly": {
      const luckyNum = ((hashString(seed) % 99) + 1).toString();
      const luckyCol = pick(colors, seed, 4);
      const bestDay = pick(weekdays, seed, 5);

      rawAiObj = {
        Introduction: pick(pools.intros, seed, 11),
        "Main Forecast": pick(pools.forecasts, seed, 21),
        Love: pick(pools.love, seed, 31),
        Career: pick(pools.career, seed, 41),
        Finances: pick(pools.finances, seed, 51),
        "Lucky Number": luckyNum,
        "Lucky Color": luckyCol,
        "Best Day": bestDay,
        "Overall Energy": pick(pools.energies, seed, 61),
        "Final Advice": pick(pools.advices, seed, 71),
      };
      break;
    }

    case "ai_horoscope_monthly": {
      const luckyNum = ((hashString(seed) % 99) + 1).toString();
      const luckyCol = pick(colors, seed, 4);
      const bestDay = pick(weekdays, seed, 5);

      rawAiObj = {
        Introduction: pick(pools.intros, seed, 12),
        "Main Forecast": pick(pools.forecasts, seed, 22),
        Love: pick(pools.love, seed, 32),
        Career: pick(pools.career, seed, 42),
        Finances: pick(pools.finances, seed, 52),
        "Lucky Number": luckyNum,
        "Lucky Color": luckyCol,
        "Best Day": bestDay,
        "Overall Energy": pick(pools.energies, seed, 62),
        "Final Advice": pick(pools.advices, seed, 72),
      };
      break;
    }

    case "ai_horoscope_yearly": {
      const luckyNum = ((hashString(seed) % 99) + 1).toString();
      const luckyCol = pick(colors, seed, 4);
      const bestDay = pick(weekdays, seed, 5);

      rawAiObj = {
        Introduction: pick(pools.intros, seed, 13),
        "Main Forecast": pick(pools.forecasts, seed, 23),
        Love: pick(pools.love, seed, 33),
        Career: pick(pools.career, seed, 43),
        Finances: pick(pools.finances, seed, 53),
        "Lucky Number": luckyNum,
        "Lucky Color": luckyCol,
        "Best Day": bestDay,
        "Overall Energy": pick(pools.energies, seed, 63),
        "Final Advice": pick(pools.advices, seed, 73),
      };
      break;
    }

    case "ask_the_stars": {
      const question = finalData.question || "";
      const category = classifyQuestionCategory(question);
      const catConfig = ASK_STARS_CATEGORIES[category] || ASK_STARS_CATEGORIES.general;
      const answer = catConfig.answers[lang] || catConfig.answers.en;

      rawAiObj = {
        Answer: answer
      };
      break;
    }

    case "personal_horoscope": {
      const sun = finalData.sunSign || "Aries";
      const moon = finalData.moonSign || "Taurus";
      const asc = finalData.risingSign || "Gemini";
      const pSeed = `personal:${sun}:${moon}:${asc}:${date}:${lang}`;

      rawAiObj = {
        "Personality (Sun, Moon, Ascendant)": `${pick(pools.intros, pSeed, 1)} ${pick(pools.forecasts, pSeed, 2)}`,
        "Current Period (Planetary Transits – Daily)": pick(pools.forecasts, pSeed, 3),
        "Current Period (Planetary Transits – Weekly)": pick(pools.forecasts, pSeed, 4),
        "Current Period (Planetary Transits – Monthly)": pick(pools.forecasts, pSeed, 5),
        "Current Period (Planetary Transits – Yearly)": pick(pools.forecasts, pSeed, 6),
        "Love & Relationships": pick(pools.love, pSeed, 7),
        "Career & Finances": pick(pools.career, pSeed, 8),
        "Health & Emotional Balance": pick(pools.energies, pSeed, 9),
        "Personal Growth & Spirituality": pick(pools.advices, pSeed, 10),
        Advice: pick(pools.advices, pSeed, 11),
        Summary: `${pick(pools.intros, pSeed, 12)} ${pick(pools.advices, pSeed, 13)}`,
      };
      break;
    }

    case "personal_horoscope_period_daily":
    case "personal_horoscope_period_weekly":
    case "personal_horoscope_period_monthly": {
      const periodPhrase = `${pick(pools.intros, seed, 100)} ${pick(pools.forecasts, seed, 200)}`;
      rawAiObj = {
        "Current Period": periodPhrase
      };
      break;
    }

    case "love_compatibility": {
      const signNames = ZODIAC_NAMES[lang] || ZODIAC_NAMES.en;
      const allSigns = ["Aries", "Leo", "Sagittarius", "Taurus", "Virgo", "Capricorn", "Gemini", "Libra", "Aquarius", "Cancer", "Scorpio", "Pisces"];
      const sIndex = allSigns.indexOf(sign);
      const c1 = signNames[allSigns[(sIndex + 4) % 12]] || "Leo";
      const c2 = signNames[allSigns[(sIndex + 8) % 12]] || "Sagittarius";
      const c3 = signNames[allSigns[(sIndex + 2) % 12]] || "Gemini";
      const chall = signNames[allSigns[(sIndex + 6) % 12]] || "Cancer";

      rawAiObj = {
        "Your Love Energy": pick(pools.love, seed, 1),
        "Your Love Style": pick(pools.love, seed, 2),
        "Three Most Compatible Signs": [
          `${c1} — ${pick(pools.energies, seed, 10)}`,
          `${c2} — ${pick(pools.energies, seed, 20)}`,
          `${c3} — ${pick(pools.energies, seed, 30)}`
        ],
        "Challenging Signs": `${chall} — ${pick(pools.advices, seed, 40)}`,
        "Elemental Overview": pick(pools.energies, seed, 5),
        "Love Advice": pick(pools.advices, seed, 6),
      };
      break;
    }

    case "numerology": {
      rawAiObj = {
        "Numerology Insights": `${pick(pools.intros, seed, 1)} ${pick(pools.forecasts, seed, 2)}`,
        "Compatibility Insight": pick(pools.love, seed, 3),
        "Summary and Guidance": pick(pools.advices, seed, 4),
      };
      break;
    }

    case "ascendant_calc": {
      rawAiObj = {
        "Core Traits": pick(pools.intros, seed, 1),
        "Social Impression": pick(pools.forecasts, seed, 2),
        "Behavioral Tendencies": pick(pools.energies, seed, 3),
        "Physical Appearance": pick(pools.energies, seed, 4),
        "Compatibility Note": pick(pools.love, seed, 5),
        "Summary/Reflection": pick(pools.advices, seed, 6),
      };
      break;
    }

    case "personal_astro_calendar": {
      const d1 = finalData.timelineDate1 || date;
      const d2 = finalData.timelineDate2 || date;
      const d3 = finalData.timelineDate3 || date;
      const bestDay = pick(weekdays, seed, 8);

      rawAiObj = {
        Overview: pick(pools.intros, seed, 1),
        Timeline: [
          `${d1}: ${pick(pools.forecasts, seed, 10)}`,
          `${d2}: ${pick(pools.love, seed, 20)}`,
          `${d3}: ${pick(pools.career, seed, 30)}`
        ],
        "Major Transits": pick(pools.forecasts, seed, 2),
        "Energy Themes": pick(pools.energies, seed, 3),
        Advice: pick(pools.advices, seed, 4),
        "Best Day": `${bestDay} — ${pick(pools.forecasts, seed, 5)}`,
        Summary: pick(pools.advices, seed, 6),
      };
      break;
    }

    case "chinese_horoscope": {
      rawAiObj = {
        personalityTraits: pick(pools.intros, seed, 1),
        elementInfluence: pick(pools.forecasts, seed, 2),
        yinYangPolarity: pick(pools.energies, seed, 3),
        compatibilityNotes: pick(pools.love, seed, 4),
        yearlyOutlook: pick(pools.career, seed, 5),
        advice: pick(pools.advices, seed, 6),
        closingReflection: pick(pools.intros, seed, 7),
      };
      break;
    }

    default:
      throw new Error(`Unsupported reserve request type: ${type}`);
  }

  // Merge deterministic calculations and parameters into the raw object
  const finalObj = mergeDeterministicFields(type, rawAiObj, finalData, lang);

  // Validate the final merged object against the canonical full schema
  if (!validateResponseObject(type, finalObj)) {
    console.error(`❌ Final reserve schema validation failed for ${type}`, finalObj);
    throw new Error(`Reserve object validation failed for ${type}`);
  }

  const finalJsonString = JSON.stringify(finalObj);

  return {
    success: true,
    source: "reserve",
    content: finalJsonString,
    object: finalObj,
  };
}
