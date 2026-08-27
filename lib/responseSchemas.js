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
  ar: {
    Aries: "الحمل", Taurus: "الثور", Gemini: "الجوزاء", Cancer: "السرطان",
    Leo: "الأسد", Virgo: "العذراء", Libra: "الميزان", Scorpio: "العقرب",
    Sagittarius: "القوس", Capricorn: "الجدي", Aquarius: "الدلو", Pisces: "الحوت",
    Estimated: "تقديري", Generalized: "عام", Unknown: "غير معروف"
  },
  zh: {
    Aries: "白羊座", Taurus: "金牛座", Gemini: "双子座", Cancer: "巨蟹座",
    Leo: "狮子座", Virgo: "处女座", Libra: "天秤座", Scorpio: "天蝎座",
    Sagittarius: "射手座", Capricorn: "摩羯座", Aquarius: "水瓶座", Pisces: "双鱼座",
    Estimated: "推算", Generalized: "通用", Unknown: "未知"
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
  },
  ja: {
    Aries: "牡羊座", Taurus: "牡牛座", Gemini: "双子座", Cancer: "蟹座",
    Leo: "獅子座", Virgo: "乙女座", Libra: "天秤座", Scorpio: "蠍座",
    Sagittarius: "射手座", Capricorn: "山羊座", Aquarius: "水瓶座", Pisces: "魚座",
    Estimated: "推定", Generalized: "一般的", Unknown: "不明"
  },
  ko: {
    Aries: "양자리", Taurus: "황소자리", Gemini: "쌍둥이자리", Cancer: "게자리",
    Leo: "사자자리", Virgo: "처녀자리", Libra: "천칭자리", Scorpio: "전갈자리",
    Sagittarius: "사수자리", Capricorn: "염소자리", Aquarius: "물병자리", Pisces: "물고기자리",
    Estimated: "추정", Generalized: "일반화", Unknown: "알 수 없음"
  },
  hi: {
    Aries: "मेष", Taurus: "वृषभ", Gemini: "मिथुन", Cancer: "कर्क",
    Leo: "सिंह", Virgo: "कन्या", Libra: "तुला", Scorpio: "वृश्चिक",
    Sagittarius: "धनु", Capricorn: "मकर", Aquarius: "कुंभ", Pisces: "मीन",
    Estimated: "अनुमानित", Generalized: "सामान्य", Unknown: "अज्ञात"
  },
  nl: {
    Aries: "Ram", Taurus: "Stier", Gemini: "Tweelingen", Cancer: "Kreeft",
    Leo: "Leeuw", Virgo: "Maagd", Libra: "Weegschaal", Scorpio: "Schorpioen",
    Sagittarius: "Boogschutter", Capricorn: "Steenbok", Aquarius: "Waterman", Pisces: "Vissen",
    Estimated: "Geschat", Generalized: "Gegeneraliseerd", Unknown: "Onbekend"
  },
  uk: {
    Aries: "Овен", Taurus: "Телець", Gemini: "Близнюки", Cancer: "Рак",
    Leo: "Лев", Virgo: "Діва", Libra: "Терези", Scorpio: "Скорпіон",
    Sagittarius: "Стрілець", Capricorn: "Козоріг", Aquarius: "Водолій", Pisces: "Риби",
    Estimated: "Орієнтовний", Generalized: "Узагальнений", Unknown: "Невідомий"
  },
  ro: {
    Aries: "Berbec", Taurus: "Taur", Gemini: "Gemeni", Cancer: "Rac",
    Leo: "Leu", Virgo: "Fecioară", Libra: "Balanță", Scorpio: "Scorpion",
    Sagittarius: "Săgetător", Capricorn: "Capricorn", Aquarius: "Vărsător", Pisces: "Pești",
    Estimated: "Estimat", Generalized: "Generalizat", Unknown: "Necunoscut"
  },
  vi: {
    Aries: "Bạch Dương", Taurus: "Kim Ngưu", Gemini: "Song Tử", Cancer: "Cự Giải",
    Leo: "Sư Tử", Virgo: "Xử Nữ", Libra: "Thiên Bình", Scorpio: "Bọ Cạp",
    Sagittarius: "Nhân Mã", Capricorn: "Ma Kết", Aquarius: "Bảo Bình", Pisces: "Song Ngư",
    Estimated: "Ước tính", Generalized: "Tổng quát", Unknown: "Chưa rõ"
  },
  th: {
    Aries: "ราศีเมษ", Taurus: "ราศีพฤษภ", Gemini: "ราศีเมถุน", Cancer: "ราศีกรกฎ",
    Leo: "ราศีสิงห์", Virgo: "ราศีกันย์", Libra: "ราศีตุลย์", Scorpio: "ราศีพิจิก",
    Sagittarius: "ราศีธนู", Capricorn: "ราศีมังกร", Aquarius: "ราศีกุมภ์", Pisces: "ราศีมีน",
    Estimated: "โดยประมาณ", Generalized: "ทั่วไป", Unknown: "ไม่ระบุ"
  },
  id: {
    Aries: "Aries", Taurus: "Taurus", Gemini: "Gemini", Cancer: "Cancer",
    Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Scorpio",
    Sagittarius: "Sagitarius", Capricorn: "Capricorn", Aquarius: "Aquarius", Pisces: "Pisces",
    Estimated: "Perkiraan", Generalized: "Umum", Unknown: "Tidak diketahui"
  },
  ms: {
    Aries: "Aries", Taurus: "Taurus", Gemini: "Gemini", Cancer: "Cancer",
    Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Scorpio",
    Sagittarius: "Sagittarius", Capricorn: "Capricorn", Aquarius: "Aquarius", Pisces: "Pisces",
    Estimated: "Anggaran", Generalized: "Umum", Unknown: "Tidak diketahui"
  },
  bn: {
    Aries: "মেষ", Taurus: "বৃষ", Gemini: "মিথুন", Cancer: "কর্কট",
    Leo: "সিংহ", Virgo: "কন্যা", Libra: "তুলা", Scorpio: "বৃশ্চিক",
    Sagittarius: "ধনু", Capricorn: "মকর", Aquarius: "কুম্ভ", Pisces: "মীন",
    Estimated: "আনুমানিক", Generalized: "সাধারণ", Unknown: "অজানা"
  },
  fa: {
    Aries: "حمل", Taurus: "ثور", Gemini: "جوزا", Cancer: "سرطان",
    Leo: "اسد", Virgo: "سنبله", Libra: "میزان", Scorpio: "عقرب",
    Sagittarius: "قوس", Capricorn: "جدی", Aquarius: "دلو", Pisces: "حوت",
    Estimated: "تخمینی", Generalized: "عمومی", Unknown: "نامشخص"
  },
  ur: {
    Aries: "حمل", Taurus: "ثور", Gemini: "جوزا", Cancer: "سرطان",
    Leo: "اسد", Virgo: "سنبلہ", Libra: "میزان", Scorpio: "عقرب",
    Sagittarius: "قوس", Capricorn: "جدی", Aquarius: "دلو", Pisces: "حوت",
    Estimated: "تخمینی", Generalized: "عمومی", Unknown: "نامعلوم"
  },
  ta: {
    Aries: "மேஷம்", Taurus: "ரிஷபம்", Gemini: "மிதுனம்", Cancer: "கடகம்",
    Leo: "சிம்மம்", Virgo: "கன்னி", Libra: "துலாம்", Scorpio: "விருச்சிகம்",
    Sagittarius: "தனுசு", Capricorn: "மகரம்", Aquarius: "கும்பம்", Pisces: "மீனம்",
    Estimated: "மதிப்பிடப்பட்டது", Generalized: "பொதுவானது", Unknown: "தெரியவில்லை"
  },
  te: {
    Aries: "మేషం", Taurus: "వృషభం", Gemini: "మిథునం", Cancer: "కర్కాటకం",
    Leo: "సింహం", Virgo: "కన్య", Libra: "తుల", Scorpio: "వృశ్చికం",
    Sagittarius: "ధనుస్సు", Capricorn: "మకరం", Aquarius: "కుంభం", Pisces: "మీనం",
    Estimated: "అంచనా", Generalized: "సాధారణ", Unknown: "తెలియదు"
  },
  sw: {
    Aries: "Punda", Taurus: "Ng'ombe", Gemini: "Mapacha", Cancer: "Kaa",
    Leo: "Simba", Virgo: "Bikira", Libra: "Mizani", Scorpio: "Nge",
    Sagittarius: "Mshale", Capricorn: "Mbuzi", Aquarius: "Ndoo", Pisces: "Samaki",
    Estimated: "Kadirio", Generalized: "Jumla", Unknown: "Haijulikani"
  }
};
ZODIAC_TRANSLATIONS.in = ZODIAC_TRANSLATIONS.id;

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
 * Hard correctness guard: Validates that for Western horoscope requests,
 * the response does not substitute another Western zodiac sign or a Chinese
 * zodiac animal/concept as the horoscope subject.
 *
 * @param {string} type - Request type
 * @param {object} obj - Response object
 * @param {string} requestedSign - Requested canonical Western zodiac sign (e.g., 'Gemini', 'Leo')
 * @param {string} [languageCode='en'] - Language code
 * @returns {{valid: boolean, reason?: string}}
 */
export function validateHoroscopeSubject(type, obj, requestedSign, languageCode = "en") {
  const HOROSCOPE_SUBJECT_GUARD_TYPES = new Set([
    "home_daily_horoscope",
    "ai_horoscope_daily",
    "ai_horoscope_general",
    "ai_horoscope_weekly",
    "ai_horoscope_monthly",
    "ai_horoscope_yearly"
  ]);

  if (!HOROSCOPE_SUBJECT_GUARD_TYPES.has(type)) {
    return { valid: true };
  }

  if (!requestedSign || typeof requestedSign !== "string") {
    return { valid: true };
  }

  const rawReq = requestedSign.trim();
  const canonicalReq = rawReq.length > 0
    ? (rawReq.charAt(0).toUpperCase() + rawReq.slice(1).toLowerCase())
    : "Aries";

  // Extract all text fields from the response object
  function extractAllText(data) {
    if (!data || typeof data !== "object") return "";
    const parts = [];
    for (const val of Object.values(data)) {
      if (typeof val === "string") {
        parts.push(val);
      } else if (Array.isArray(val)) {
        parts.push(val.map(v => typeof v === "string" ? v : JSON.stringify(v)).join(" "));
      } else if (val && typeof val === "object") {
        parts.push(extractAllText(val));
      }
    }
    return parts.join(" ");
  }

  const allText = extractAllText(obj);
  if (!allText.trim()) {
    return { valid: true };
  }

  // 1. Check for prohibited Chinese Zodiac concepts in Western horoscopes
  const CHINESE_YEAR_REGEX = /\b(?:year\s+of\s+the|année\s+du|año\s+del|anno\s+del|jahr\s+des|год)\s+(?:horse|rat|ox|tiger|rabbit|dragon|snake|goat|sheep|monkey|rooster|dog|pig|boar|cheval|bœuf|boeuf|tigre|lapin|serpent|chèvre|singe|coq|chien|cochon|caballo|rata|buey|conejo|dragón|dragon|serpiente|cabra|mono|gallo|perro|cerdo|cavallo|topo|bufalo|drago|cane|maiale|pferdes|pferd|ratte|ochsen|hasen|drachen|schlange|ziege|affen|hahns|hundes|schweins|лошади|крысы|быка|тигра|кролика|дракона|змеи|козы|обезьяны|петуха|собаки|свиньи)\b/i;
  if (CHINESE_YEAR_REGEX.test(allText)) {
    return { valid: false, reason: "Prohibited Chinese zodiac year reference in Western horoscope" };
  }

  const HU_CHINESE_YEAR_REGEX = /\b(?:ló|patkány|bivaly|tigris|nyúl|sárkány|kígyó|kecske|majom|kakas|kutya|disznó|koca)\s+éve(?:ben)?\b/i;
  if (HU_CHINESE_YEAR_REGEX.test(allText)) {
    return { valid: false, reason: "Prohibited Hungarian Chinese zodiac year reference in Western horoscope" };
  }

  const CHINESE_GENERAL_REGEX = /\b(?:chinese\s+(?:zodiac|horoscope|sign|astrology)|kínai\s+(?:horoszkóp|csillagjegy|jegy|asztrológia|állatöv|jegyed)|zodiac\s+chinois|signe\s+chinois|zodiaco\s+chino|signo\s+chino|zodiaco\s+cinese|segno\s+cinese|chinesische[s|n]?\s+(?:sternzeichen|horoskop|tierkreis)|китайский\s+(?:гороскоп|знак))\b/i;
  if (CHINESE_GENERAL_REGEX.test(allText)) {
    return { valid: false, reason: "Prohibited Chinese zodiac terminology in Western horoscope" };
  }

  const CHINESE_ANIMAL_SUBJECT_REGEX = /\b(?:as a|as an|you,?\s+|dear|mint|kedves|als|en tant que|cher|chère|como|querido|querida|come|caro|cara)\s+(?:horse|rat|ox|tiger|rabbit|dragon|snake|goat|sheep|monkey|rooster|dog|pig|boar|ló|patkány|bivaly|tigris|nyúl|sárkány|kígyó|kecske|majom|kakas|kutya|disznó)\b/i;
  if (CHINESE_ANIMAL_SUBJECT_REGEX.test(allText)) {
    return { valid: false, reason: "Prohibited Chinese animal subject vocative in Western horoscope" };
  }

  // 2. Check for Foreign Western Zodiac sign subject substitution
  const ALL_WESTERN_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];

  const foreignSigns = ALL_WESTERN_SIGNS.filter(s => s.toLowerCase() !== canonicalReq.toLowerCase());
  const normLang = String(languageCode || "en").trim().toLowerCase().slice(0, 2);

  for (const sign of foreignSigns) {
    // Gather names for this foreign sign across English, Hungarian, and current target language
    const namesToTest = new Set([
      sign,
      getLocalizedZodiacSign(sign, "en"),
      getLocalizedZodiacSign(sign, "hu"),
      getLocalizedZodiacSign(sign, normLang),
    ]);

    for (const foreignName of namesToTest) {
      if (!foreignName || foreignName.length < 2) continue;
      const escaped = foreignName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // English & general subject patterns
      const enVocativeRegex = new RegExp(`\\b(?:dear|as a|as an|you,?\\s+)\\s*${escaped}\\b`, "i");
      const enSubjectRegex = new RegExp(`\\b${escaped}\\s+(?:will|should|must|can|needs? to|is entering|experiences?|faces?)\\b`, "i");
      const enPossessiveRegex = new RegExp(`\\b${escaped}'s\\s+(?:daily|weekly|monthly|yearly|forecast|horoscope|energy|path|journey|season|year|day|month|week)\\b`, "i");
      const enForSignRegex = new RegExp(`\\bfor\\s+${escaped}\\s+(?:today|this week|this month|this year|in \\d{4})\\b`, "i");
      const enThisPeriodForRegex = new RegExp(`\\bthis\\s+(?:day|week|month|year|\\d{4})\\s+for\\s+${escaped}\\b`, "i");
      const enNativesRegex = new RegExp(`\\b${escaped}\\s+natives?\\b`, "i");

      // Hungarian subject patterns
      const huVocativeRegex = new RegExp(`\\b(?:kedves|mint)\\s+${escaped}\\b`, "i");
      const huKentRegex = new RegExp(`\\b${escaped}(?:ként)\\b`, "i");
      const huSignSubjectRegex = new RegExp(`\\ba\\s+${escaped}\\s+(?:jegy|szülöttei|szülötteként|szülötteinek|számára|mai napja|hete|hónapja|éve|20\\d\\d-es éve)\\b`, "i");
      const huPluralSubjectRegex = new RegExp(`\\ba\\s+${escaped}(?:ok|ek|ök|ak)\\s+(?:számára|élete|napja|hete|hónapja|éve)\\b`, "i");
      const huJegyuekRegex = new RegExp(`\\b${escaped}\\s+jegyűek(?:nek)?\\b`, "i");
      const huSzamaraRegex = new RegExp(`\\b${escaped}\\s+számára\\b`, "i");

      // German / French / Spanish / Italian / Russian patterns
      const deSubjectRegex = new RegExp(`\\b(?:lieber|liebe|als|für)\\s+${escaped}\\b|\\b${escaped}-Geborene\\b`, "i");
      const frSubjectRegex = new RegExp(`\\b(?:cher|chère|en tant que|pour les?)\\s+${escaped}\\b`, "i");
      const esSubjectRegex = new RegExp(`\\b(?:querido|querida|como|para los?)\\s+${escaped}\\b`, "i");
      const itSubjectRegex = new RegExp(`\\b(?:caro|cara|come|per i|per il)\\s+${escaped}\\b`, "i");
      const ruSubjectRegex = new RegExp(`\\b(?:дорогой|дорогая|как|для)\\s+${escaped}\\b`, "i");

      if (
        enVocativeRegex.test(allText) ||
        enSubjectRegex.test(allText) ||
        enPossessiveRegex.test(allText) ||
        enForSignRegex.test(allText) ||
        enThisPeriodForRegex.test(allText) ||
        enNativesRegex.test(allText) ||
        huVocativeRegex.test(allText) ||
        huKentRegex.test(allText) ||
        huSignSubjectRegex.test(allText) ||
        huPluralSubjectRegex.test(allText) ||
        huJegyuekRegex.test(allText) ||
        huSzamaraRegex.test(allText) ||
        deSubjectRegex.test(allText) ||
        frSubjectRegex.test(allText) ||
        esSubjectRegex.test(allText) ||
        itSubjectRegex.test(allText) ||
        ruSubjectRegex.test(allText)
      ) {
        return {
          valid: false,
          reason: `Foreign Western zodiac sign subject '${foreignName}' detected when '${canonicalReq}' was requested`
        };
      }
    }
  }

  return { valid: true };
}

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
