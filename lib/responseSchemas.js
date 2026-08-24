// lib/responseSchemas.js

/**
 * Canonical JSON schemas and conservative maxOutputTokens per request type.
 * Derived strictly from existing Android model contracts and prompt definitions.
 */

export const RESPONSE_SCHEMAS = {
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
      "Introduction": { type: "string" },
      "Main Forecast": { type: "string" },
      "Love": { type: "string" },
      "Career": { type: "string" },
      "Finances": { type: "string" },
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
      "Introduction": { type: "string" },
      "Main Forecast": { type: "string" },
      "Love": { type: "string" },
      "Career": { type: "string" },
      "Finances": { type: "string" },
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
      "Month": { type: "string" },
      "Introduction": { type: "string" },
      "Main Forecast": { type: "string" },
      "Love": { type: "string" },
      "Career": { type: "string" },
      "Finances": { type: "string" },
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
      "Year": { type: "string" },
      "Introduction": { type: "string" },
      "Main Forecast": { type: "string" },
      "Love": { type: "string" },
      "Career": { type: "string" },
      "Finances": { type: "string" },
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
      "Answer": { type: "string" },
    },
    required: ["Answer"],
    additionalProperties: false,
  },

  personal_horoscope: {
    type: "object",
    properties: {
      "Sun": { type: "string" },
      "Sun_Code": { type: "string" },
      "Moon": { type: "string" },
      "Moon_Code": { type: "string" },
      "Ascendant": { type: "string" },
      "Ascendant_Code": { type: "string" },
      "Elements": { type: "string" },
      "Personality (Sun, Moon, Ascendant)": { type: "string" },
      "Current Period (Planetary Transits – Daily)": { type: "string" },
      "Current Period (Planetary Transits – Weekly)": { type: "string" },
      "Current Period (Planetary Transits – Monthly)": { type: "string" },
      "Current Period (Planetary Transits – Yearly)": { type: "string" },
      "Love & Relationships": { type: "string" },
      "Career & Finances": { type: "string" },
      "Health & Emotional Balance": { type: "string" },
      "Personal Growth & Spirituality": { type: "string" },
      "Advice": { type: "string" },
      "Summary": { type: "string" },
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
      "Overview": { type: "string" },
      "Timeline": {
        type: "array",
        items: { type: "string" },
      },
      "Major Transits": { type: "string" },
      "Energy Themes": { type: "string" },
      "Advice": { type: "string" },
      "Best Day": { type: "string" },
      "Summary": { type: "string" },
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
      "animal": { type: "string" },
      "element": { type: "string" },
      "yinYang": { type: "string" },
      "personalityTraits": { type: "string" },
      "elementInfluence": { type: "string" },
      "yinYangPolarity": { type: "string" },
      "compatibilityNotes": { type: "string" },
      "yearlyOutlook": { type: "string" },
      "advice": { type: "string" },
      "closingReflection": { type: "string" },
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

// Alias for general horoscope
RESPONSE_SCHEMAS.ai_horoscope_general = RESPONSE_SCHEMAS.ai_horoscope_daily;

/**
 * Conservative output token caps per request type.
 * Derived from schema field count, sentence length requirements, and observed token usage.
 */
export const MAX_OUTPUT_TOKENS_BY_TYPE = {
  home_daily_horoscope: 200,             // 1 field, ~29 baseline tokens (6.8x margin)
  home_daily_quote: 150,                 // 1 quote (max 15 words)
  ai_horoscope_daily: 600,               // 10 fields
  ai_horoscope_general: 600,             // 10 fields
  ai_horoscope_weekly: 650,              // 11 fields
  ai_horoscope_monthly: 650,             // 11 fields
  ai_horoscope_yearly: 650,              // 11 fields
  ask_the_stars: 300,                    // 1 field concise answer
  personal_horoscope: 1200,              // 18 fields (full natal analysis)
  personal_horoscope_period_daily: 200,  // 1 field
  personal_horoscope_period_weekly: 200, // 1 field
  personal_horoscope_period_monthly: 200,// 1 field
  love_compatibility: 500,               // 7 fields + array
  numerology: 600,                       // 8 fields
  ascendant_calc: 500,                   // 7 fields
  personal_astro_calendar: 700,          // 7 fields + 3-date array
  chinese_horoscope: 650,                // 10 fields
};

/**
 * Helper to get the canonical JSON schema for a request type.
 * @param {string} type
 * @returns {object|null}
 */
export function getResponseSchema(type) {
  return RESPONSE_SCHEMAS[type] || null;
}

/**
 * Helper to get the max output token limit for a request type.
 * @param {string} type
 * @returns {number}
 */
export function getMaxOutputTokens(type) {
  return MAX_OUTPUT_TOKENS_BY_TYPE[type] || 800;
}
