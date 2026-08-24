// lib/responseSchemas.js

/**
 * Canonical full JSON response schemas expected by the Android client for all 17 request types.
 * Used to validate the FINAL merged response before caching and sending to the client.
 */
export const FULL_RESPONSE_SCHEMAS = {
  home_daily_horoscope: {
    type: "object",
    properties: {
      "Daily Horoscope": { type: "string" },
    },
    required: ["Daily Horoscope"],
    additionalProperties: false,
  },

  home_daily_quote: {
    type: "object",
    properties: {
      "Daily Quote": { type: "string" },
    },
    required: ["Daily Quote"],
    additionalProperties: false,
  },

  ai_horoscope_daily: {
    type: "object",
    properties: {
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  ai_horoscope_weekly: {
    type: "object",
    properties: {
      "Week Range": { type: "string" },
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Week Range",
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  ai_horoscope_monthly: {
    type: "object",
    properties: {
      Month: { type: "string" },
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Month",
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  ai_horoscope_yearly: {
    type: "object",
    properties: {
      Year: { type: "string" },
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Year",
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  ask_the_stars: {
    type: "object",
    properties: {
      Answer: { type: "string" },
    },
    required: ["Answer"],
    additionalProperties: false,
  },

  personal_horoscope: {
    type: "object",
    properties: {
      Sun: { type: "string" },
      Sun_Code: { type: "string" },
      Moon: { type: "string" },
      Moon_Code: { type: "string" },
      Ascendant: { type: "string" },
      Ascendant_Code: { type: "string" },
      Elements: { type: "string" },
      "Personality (Sun, Moon, Ascendant)": { type: "string" },
      "Current Period (Planetary Transits – Daily)": { type: "string" },
      "Current Period (Planetary Transits – Weekly)": { type: "string" },
      "Current Period (Planetary Transits – Monthly)": { type: "string" },
      "Current Period (Planetary Transits – Yearly)": { type: "string" },
      "Love & Relationships": { type: "string" },
      "Career & Finances": { type: "string" },
      "Health & Emotional Balance": { type: "string" },
      "Personal Growth & Spirituality": { type: "string" },
      Advice: { type: "string" },
      Summary: { type: "string" },
    },
    required: [
      "Sun",
      "Sun_Code",
      "Moon",
      "Moon_Code",
      "Ascendant",
      "Ascendant_Code",
      "Elements",
      "Personality (Sun, Moon, Ascendant)",
      "Current Period (Planetary Transits – Daily)",
      "Current Period (Planetary Transits – Weekly)",
      "Current Period (Planetary Transits – Monthly)",
      "Current Period (Planetary Transits – Yearly)",
      "Love & Relationships",
      "Career & Finances",
      "Health & Emotional Balance",
      "Personal Growth & Spirituality",
      "Advice",
      "Summary",
    ],
    additionalProperties: false,
  },

  personal_horoscope_period_daily: {
    type: "object",
    properties: {
      "Current Period": { type: "string" },
    },
    required: ["Current Period"],
    additionalProperties: false,
  },

  personal_horoscope_period_weekly: {
    type: "object",
    properties: {
      "Current Period": { type: "string" },
    },
    required: ["Current Period"],
    additionalProperties: false,
  },

  personal_horoscope_period_monthly: {
    type: "object",
    properties: {
      "Current Period": { type: "string" },
    },
    required: ["Current Period"],
    additionalProperties: false,
  },

  love_compatibility: {
    type: "object",
    properties: {
      "Your Sign": { type: "string" },
      "Your Love Energy": { type: "string" },
      "Your Love Style": { type: "string" },
      "Three Most Compatible Signs": {
        type: "array",
        items: { type: "string" },
      },
      "Challenging Signs": { type: "string" },
      "Elemental Overview": { type: "string" },
      "Love Advice": { type: "string" },
    },
    required: [
      "Your Sign",
      "Your Love Energy",
      "Your Love Style",
      "Three Most Compatible Signs",
      "Challenging Signs",
      "Elemental Overview",
      "Love Advice",
    ],
    additionalProperties: false,
  },

  numerology: {
    type: "object",
    properties: {
      "Numerology Insights": { type: "string" },
      "Life Path Number": { type: "string" },
      "Expression Number": { type: "string" },
      "Soul Urge Number": { type: "string" },
      "Personality Number": { type: "string" },
      "Birthday Number": { type: "string" },
      "Compatibility Insight": { type: "string" },
      "Summary and Guidance": { type: "string" },
    },
    required: [
      "Numerology Insights",
      "Life Path Number",
      "Expression Number",
      "Soul Urge Number",
      "Personality Number",
      "Birthday Number",
      "Compatibility Insight",
      "Summary and Guidance",
    ],
    additionalProperties: false,
  },

  ascendant_calc: {
    type: "object",
    properties: {
      "Rising Sign": { type: "string" },
      "Core Traits": { type: "string" },
      "Social Impression": { type: "string" },
      "Behavioral Tendencies": { type: "string" },
      "Physical Appearance": { type: "string" },
      "Compatibility Note": { type: "string" },
      "Summary/Reflection": { type: "string" },
    },
    required: [
      "Rising Sign",
      "Core Traits",
      "Social Impression",
      "Behavioral Tendencies",
      "Physical Appearance",
      "Compatibility Note",
      "Summary/Reflection",
    ],
    additionalProperties: false,
  },

  personal_astro_calendar: {
    type: "object",
    properties: {
      Overview: { type: "string" },
      Timeline: {
        type: "array",
        items: { type: "string" },
      },
      "Major Transits": { type: "string" },
      "Energy Themes": { type: "string" },
      Advice: { type: "string" },
      "Best Day": { type: "string" },
      Summary: { type: "string" },
    },
    required: [
      "Overview",
      "Timeline",
      "Major Transits",
      "Energy Themes",
      "Advice",
      "Best Day",
      "Summary",
    ],
    additionalProperties: false,
  },

  chinese_horoscope: {
    type: "object",
    properties: {
      animal: { type: "string" },
      element: { type: "string" },
      yinYang: { type: "string" },
      personalityTraits: { type: "string" },
      elementInfluence: { type: "string" },
      yinYangPolarity: { type: "string" },
      compatibilityNotes: { type: "string" },
      yearlyOutlook: { type: "string" },
      advice: { type: "string" },
      closingReflection: { type: "string" },
    },
    required: [
      "animal",
      "element",
      "yinYang",
      "personalityTraits",
      "elementInfluence",
      "yinYangPolarity",
      "compatibilityNotes",
      "yearlyOutlook",
      "advice",
      "closingReflection",
    ],
    additionalProperties: false,
  },
};

FULL_RESPONSE_SCHEMAS.ai_horoscope_general = FULL_RESPONSE_SCHEMAS.ai_horoscope_daily;
export const RESPONSE_SCHEMAS = FULL_RESPONSE_SCHEMAS;

/**
 * INTERNAL AI SCHEMAS passed to Gemini.
 * Deterministic fields are excluded so Gemini does not waste candidate tokens generating them.
 */
export const INTERNAL_AI_SCHEMAS = {
  ...FULL_RESPONSE_SCHEMAS,

  // ai_horoscope_weekly: 10 fields (Week Range offloaded)
  ai_horoscope_weekly: {
    type: "object",
    properties: {
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  // ai_horoscope_monthly: 10 fields (Month offloaded)
  ai_horoscope_monthly: {
    type: "object",
    properties: {
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  // ai_horoscope_yearly: 10 fields (Year offloaded)
  ai_horoscope_yearly: {
    type: "object",
    properties: {
      Introduction: { type: "string" },
      "Main Forecast": { type: "string" },
      Love: { type: "string" },
      Career: { type: "string" },
      Finances: { type: "string" },
      "Lucky Number": { type: "string" },
      "Lucky Color": { type: "string" },
      "Best Day": { type: "string" },
      "Overall Energy": { type: "string" },
      "Final Advice": { type: "string" },
    },
    required: [
      "Introduction",
      "Main Forecast",
      "Love",
      "Career",
      "Finances",
      "Lucky Number",
      "Lucky Color",
      "Best Day",
      "Overall Energy",
      "Final Advice",
    ],
    additionalProperties: false,
  },

  // ascendant_calc: 6 fields (Rising Sign offloaded)
  ascendant_calc: {
    type: "object",
    properties: {
      "Core Traits": { type: "string" },
      "Social Impression": { type: "string" },
      "Behavioral Tendencies": { type: "string" },
      "Physical Appearance": { type: "string" },
      "Compatibility Note": { type: "string" },
      "Summary/Reflection": { type: "string" },
    },
    required: [
      "Core Traits",
      "Social Impression",
      "Behavioral Tendencies",
      "Physical Appearance",
      "Compatibility Note",
      "Summary/Reflection",
    ],
    additionalProperties: false,
  },

  // love_compatibility: 6 fields (Your Sign offloaded)
  love_compatibility: {
    type: "object",
    properties: {
      "Your Love Energy": { type: "string" },
      "Your Love Style": { type: "string" },
      "Three Most Compatible Signs": {
        type: "array",
        items: { type: "string" },
      },
      "Challenging Signs": { type: "string" },
      "Elemental Overview": { type: "string" },
      "Love Advice": { type: "string" },
    },
    required: [
      "Your Love Energy",
      "Your Love Style",
      "Three Most Compatible Signs",
      "Challenging Signs",
      "Elemental Overview",
      "Love Advice",
    ],
    additionalProperties: false,
  },

  // personal_horoscope: 11 interpretive fields (Sun, Sun_Code, Moon, Moon_Code, Ascendant, Ascendant_Code, Elements offloaded)
  personal_horoscope: {
    type: "object",
    properties: {
      "Personality (Sun, Moon, Ascendant)": { type: "string" },
      "Current Period (Planetary Transits – Daily)": { type: "string" },
      "Current Period (Planetary Transits – Weekly)": { type: "string" },
      "Current Period (Planetary Transits – Monthly)": { type: "string" },
      "Current Period (Planetary Transits – Yearly)": { type: "string" },
      "Love & Relationships": { type: "string" },
      "Career & Finances": { type: "string" },
      "Health & Emotional Balance": { type: "string" },
      "Personal Growth & Spirituality": { type: "string" },
      Advice: { type: "string" },
      Summary: { type: "string" },
    },
    required: [
      "Personality (Sun, Moon, Ascendant)",
      "Current Period (Planetary Transits – Daily)",
      "Current Period (Planetary Transits – Weekly)",
      "Current Period (Planetary Transits – Monthly)",
      "Current Period (Planetary Transits – Yearly)",
      "Love & Relationships",
      "Career & Finances",
      "Health & Emotional Balance",
      "Personal Growth & Spirituality",
      "Advice",
      "Summary",
    ],
    additionalProperties: false,
  },

  // numerology: 3 interpretive fields (5 numeric fields offloaded)
  numerology: {
    type: "object",
    properties: {
      "Numerology Insights": { type: "string" },
      "Compatibility Insight": { type: "string" },
      "Summary and Guidance": { type: "string" },
    },
    required: [
      "Numerology Insights",
      "Compatibility Insight",
      "Summary and Guidance",
    ],
    additionalProperties: false,
  },

  // chinese_horoscope: 7 interpretive fields (animal, element, yinYang offloaded)
  chinese_horoscope: {
    type: "object",
    properties: {
      personalityTraits: { type: "string" },
      elementInfluence: { type: "string" },
      yinYangPolarity: { type: "string" },
      compatibilityNotes: { type: "string" },
      yearlyOutlook: { type: "string" },
      advice: { type: "string" },
      closingReflection: { type: "string" },
    },
    required: [
      "personalityTraits",
      "elementInfluence",
      "yinYangPolarity",
      "compatibilityNotes",
      "yearlyOutlook",
      "advice",
      "closingReflection",
    ],
    additionalProperties: false,
  },

  // personal_astro_calendar: 7 fields
  personal_astro_calendar: {
    type: "object",
    properties: {
      Overview: { type: "string" },
      Timeline: {
        type: "array",
        items: { type: "string" },
      },
      "Major Transits": { type: "string" },
      "Energy Themes": { type: "string" },
      Advice: { type: "string" },
      "Best Day": { type: "string" },
      Summary: { type: "string" },
    },
    required: [
      "Overview",
      "Timeline",
      "Major Transits",
      "Energy Themes",
      "Advice",
      "Best Day",
      "Summary",
    ],
    additionalProperties: false,
  },
};

INTERNAL_AI_SCHEMAS.ai_horoscope_general = INTERNAL_AI_SCHEMAS.ai_horoscope_daily;

/**
 * Zodiac sign translations for standard multilingual localization.
 */
export const ZODIAC_TRANSLATIONS = {
  en: {
    Aries: "Aries", Taurus: "Taurus", Gemini: "Gemini", Cancer: "Cancer",
    Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Scorpio",
    Sagittarius: "Sagittarius", Capricorn: "Capricorn", Aquarius: "Aquarius", Pisces: "Pisces",
    Estimated: "Estimated", Generalized: "Generalized", Unknown: "Unknown"
  },
  hu: {
    Aries: "Kos", Taurus: "Bika", Gemini: "Ikrek", Cancer: "Rák",
    Leo: "Oroszlán", Virgo: "Szűz", Libra: "Mérleg", Scorpio: "Skorpió",
    Sagittarius: "Nyilas", Capricorn: "Bak", Aquarius: "Vízöntő", Pisces: "Halak",
    Estimated: "Becsült", Generalized: "Általánosított", Unknown: "Ismeretlen"
  },
  de: {
    Aries: "Widder", Taurus: "Stier", Gemini: "Zwillinge", Cancer: "Krebs",
    Leo: "Löwe", Virgo: "Jungfrau", Libra: "Waage", Scorpio: "Skorpion",
    Sagittarius: "Schütze", Capricorn: "Steinbock", Aquarius: "Wassermann", Pisces: "Fische",
    Estimated: "Geschätzt", Generalized: "Generalisiert", Unknown: "Unbekannt"
  },
  es: {
    Aries: "Aries", Taurus: "Tauro", Gemini: "Géminis", Cancer: "Cáncer",
    Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Escorpio",
    Sagittarius: "Sagitario", Capricorn: "Capricornio", Aquarius: "Acuario", Pisces: "Piscis",
    Estimated: "Estimado", Generalized: "Generalizado", Unknown: "Desconocido"
  },
  fr: {
    Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer",
    Leo: "Lion", Virgo: "Vierge", Libra: "Balance", Scorpio: "Scorpion",
    Sagittarius: "Sagittaire", Capricorn: "Capricorne", Aquarius: "Verseau", Pisces: "Poissons",
    Estimated: "Estimé", Generalized: "Généralisé", Unknown: "Inconnu"
  },
  it: {
    Aries: "Ariete", Taurus: "Toro", Gemini: "Gemelli", Cancer: "Cancro",
    Leo: "Leone", Virgo: "Vergine", Libra: "Bilancia", Scorpio: "Scorpione",
    Sagittarius: "Sagittario", Capricorn: "Capricorno", Aquarius: "Acquario", Pisces: "Pesci",
    Estimated: "Stimato", Generalized: "Generalizzato", Unknown: "Sconosciuto"
  },
  pt: {
    Aries: "Áries", Taurus: "Touro", Gemini: "Gêmeos", Cancer: "Câncer",
    Leo: "Leão", Virgo: "Virgem", Libra: "Libra", Scorpio: "Escorpião",
    Sagittarius: "Sagitário", Capricorn: "Capricórnio", Aquarius: "Aquário", Pisces: "Peixes",
    Estimated: "Estimado", Generalized: "Generalizado", Unknown: "Desconhecido"
  },
  tr: {
    Aries: "Koç", Taurus: "Boğa", Gemini: "İkizler", Cancer: "Yengeç",
    Leo: "Aslan", Virgo: "Başak", Libra: "Terazi", Scorpio: "Akrep",
    Sagittarius: "Yay", Capricorn: "Oğlak", Aquarius: "Kova", Pisces: "Balık",
    Estimated: "Tahmini", Generalized: "Genelleştirilmiş", Unknown: "Bilinmeyen"
  },
  pl: {
    Aries: "Baran", Taurus: "Byk", Gemini: "Bliźnięta", Cancer: "Rak",
    Leo: "Lew", Virgo: "Panna", Libra: "Waga", Scorpio: "Skorpion",
    Sagittarius: "Strzelec", Capricorn: "Koziorożec", Aquarius: "Wodnik", Pisces: "Ryby",
    Estimated: "Szacowany", Generalized: "Uogólniony", Unknown: "Nieznany"
  },
  ru: {
    Aries: "Овен", Taurus: "Телец", Gemini: "Близнецы", Cancer: "Рак",
    Leo: "Лев", Virgo: "Дева", Libra: "Весы", Scorpio: "Скорпион",
    Sagittarius: "Стрелец", Capricorn: "Козерог", Aquarius: "Водолей", Pisces: "Рыбы",
    Estimated: "Примерный", Generalized: "Обобщенный", Unknown: "Неизвестный"
  }
};

export function getLocalizedZodiacSign(sign, lang = "en") {
  const normLang = String(lang || "en").trim().toLowerCase().slice(0, 2);
  const langDict = ZODIAC_TRANSLATIONS[normLang] || ZODIAC_TRANSLATIONS.en;
  return langDict[sign] || ZODIAC_TRANSLATIONS.en[sign] || sign;
}

/**
 * Merges server-side deterministic fields into the AI-generated object.
 * Returns a complete object matching the canonical full response schema.
 */
export function mergeDeterministicFields(type, aiObj, finalData = {}, language = "en") {
  if (!aiObj || typeof aiObj !== "object") return aiObj;
  const merged = { ...aiObj };

  switch (type) {
    case "ai_horoscope_weekly": {
      merged["Week Range"] = String(finalData.weekRange || "");
      return merged;
    }

    case "ai_horoscope_monthly": {
      merged["Month"] = String(finalData.month || finalData.currentMonth || "");
      return merged;
    }

    case "ai_horoscope_yearly": {
      merged["Year"] = String(finalData.currentYear || finalData.year || "");
      return merged;
    }

    case "ascendant_calc": {
      const risingSign = finalData.risingSign || "Generalized";
      merged["Rising Sign"] = getLocalizedZodiacSign(risingSign, language);
      return merged;
    }

    case "love_compatibility": {
      const zodiacSign = finalData.zodiacSign || "Unknown";
      merged["Your Sign"] = getLocalizedZodiacSign(zodiacSign, language);
      return merged;
    }

    case "personal_horoscope": {
      const sunSign = finalData.sunSign || "Unknown";
      const moonSign = finalData.moonSign || "Estimated";
      const risingSign = finalData.risingSign || "Generalized";
      merged["Sun"] = getLocalizedZodiacSign(sunSign, language);
      merged["Sun_Code"] = sunSign;
      merged["Moon"] = getLocalizedZodiacSign(moonSign, language);
      merged["Moon_Code"] = moonSign;
      merged["Ascendant"] = getLocalizedZodiacSign(risingSign, language);
      merged["Ascendant_Code"] = risingSign;
      const fire = finalData.firePercent ?? 0;
      const earth = finalData.earthPercent ?? 0;
      const air = finalData.airPercent ?? 0;
      const water = finalData.waterPercent ?? 0;
      merged["Elements"] = `Fire ${fire}%, Earth ${earth}%, Air ${air}%, Water ${water}%`;
      return merged;
    }

    case "numerology": {
      merged["Life Path Number"] = String(finalData.lifePathNumber ?? "");
      merged["Expression Number"] = String(finalData.expressionNumber ?? "");
      merged["Soul Urge Number"] = String(finalData.soulUrgeNumber ?? "");
      merged["Personality Number"] = String(finalData.personalityNumber ?? "");
      merged["Birthday Number"] = String(finalData.birthdayNumber ?? "");
      return merged;
    }

    case "chinese_horoscope": {
      merged["animal"] = String(finalData.ANIMAL || finalData.animal || "");
      merged["element"] = String(finalData.ELEMENT || finalData.element || "");
      merged["yinYang"] = String(finalData.YIN_YANG || finalData.yinYang || "");
      return merged;
    }

    case "personal_astro_calendar": {
      if (Array.isArray(merged["Timeline"])) {
        const dates = [
          finalData.timelineDate1 || "",
          finalData.timelineDate2 || "",
          finalData.timelineDate3 || "",
        ];
        merged["Timeline"] = merged["Timeline"].map((item, idx) => {
          const text = String(item || "").trim();
          const expectedDate = dates[idx];
          if (expectedDate && !text.startsWith(expectedDate)) {
            return `${expectedDate}: ${text.replace(/^[^:]+:\s*/, "")}`;
          }
          return text;
        });
      }
      return merged;
    }

    default:
      return merged;
  }
}

/**
 * Validates that a merged response object contains all required fields for its canonical schema.
 * @param {string} type
 * @param {object} obj
 * @returns {boolean}
 */
export function validateResponseObject(type, obj) {
  const schema = getResponseSchema(type);
  if (!schema) return true;
  if (!obj || typeof obj !== "object") return false;
  const missing = (schema.required || []).filter(f => !(f in obj));
  return missing.length === 0;
}

/**
 * Conservative output token caps per request type.
 */
export const MAX_OUTPUT_TOKENS_BY_TYPE = {
  home_daily_horoscope: 200,             // 1 field, ~29 baseline tokens (6.8x margin)
  home_daily_quote: 150,                 // 1 quote (max 15 words)
  ai_horoscope_daily: 600,               // 10 fields
  ai_horoscope_general: 600,             // 10 fields
  ai_horoscope_weekly: 650,              // 10 AI fields + 1 server field
  ai_horoscope_monthly: 650,             // 10 AI fields + 1 server field
  ai_horoscope_yearly: 650,              // 10 AI fields + 1 server field
  ask_the_stars: 300,                    // 1 field concise answer
  personal_horoscope: 1200,              // 11 AI fields + 7 server fields (safe headroom)
  personal_horoscope_period_daily: 200,  // 1 field
  personal_horoscope_period_weekly: 200, // 1 field
  personal_horoscope_period_monthly: 200,// 1 field
  love_compatibility: 500,               // 6 AI fields + 1 server field
  numerology: 600,                       // 3 AI fields + 5 server fields (safe headroom)
  ascendant_calc: 500,                   // 6 AI fields + 1 server field
  personal_astro_calendar: 700,          // 7 fields + 3-date array
  chinese_horoscope: 650,                // 7 AI fields + 3 server fields (safe headroom)
};

/**
 * Helper to get the canonical full JSON schema for validating final merged objects.
 * @param {string} type
 * @returns {object|null}
 */
export function getResponseSchema(type) {
  return FULL_RESPONSE_SCHEMAS[type] || null;
}

export function getFullResponseSchema(type) {
  return FULL_RESPONSE_SCHEMAS[type] || null;
}

/**
 * Helper to get the internal AI schema for Gemini generation.
 * @param {string} type
 * @returns {object|null}
 */
export function getInternalAiSchema(type) {
  return INTERNAL_AI_SCHEMAS[type] || null;
}

/**
 * Helper to get the max output token limit for a request type.
 * @param {string} type
 * @returns {number}
 */
export function getMaxOutputTokens(type) {
  return MAX_OUTPUT_TOKENS_BY_TYPE[type] || 800;
}
