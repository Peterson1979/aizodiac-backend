// Minden válasz szigorúan érvényes JSON legyen.
// Kulcsok: angolul, fixen.
// Értékek: kizárólag {{language}} nyelven.
// Nincs extra szöveg, nincs markdown, nincs preambulum.

export const BASE_RULES = `
Respond ONLY with a raw JSON object. Follow EXACTLY:

- NEVER wrap in Markdown (no \`\`\`json or \`\`\`).
- NEVER add any text before or after the JSON.
- NEVER add explanations, greetings, or comments.
- Begin with "{" and end with "}".
- All keys in English exactly as specified.
- ALL string values MUST be in {{language}} — NEVER use English words like "sentence", "about", "future", etc.
- Output must be valid JSON readable by standard parsers.
- UNDER NO CIRCUMSTANCES may you respond in any language OTHER than {{language}} — even partially, even a single word.
`;



/* ==========================================================
   HOME – DAILY
   ========================================================== */

export const PROMPTS = {
  home_daily_horoscope: `
${BASE_RULES}
Always write ONLY for {{zodiacSign}}. Never mention any other zodiac sign.
{"Daily Horoscope": "[Max 2 short sentences about {{zodiacSign}} for {{currentDate}}]"}
`,

  home_daily_quote: `
${BASE_RULES}
{"Daily Quote": "[One short inspirational quote, max 12–15 words.]"}
`,

/* ==========================================================
   AI HOROSCOPE – EXPLICIT TIME PERIOD PROMPTS
   ========================================================== */

  ai_horoscope_daily: `
${BASE_RULES}
Always write ONLY for {{zodiacSign}}. Never mention any other zodiac sign.
You are an expert in daily astrological forecasting for {{zodiacSign}}.
{
  "Introduction": "[1 sentence about {{zodiacSign}} for today ({{currentDate}})]",
  "Main Forecast": "[1 sentence for {{zodiacSign}}]",
  "Love": "[1 sentence for {{zodiacSign}}]",
  "Career": "[1 sentence for {{zodiacSign}}]",
  "Finances": "[1 sentence for {{zodiacSign}}]",
  "Lucky Number": "[number only]",
  "Lucky Color": "[color only]",
  "Best Day": "[day of week]",
  "Overall Energy": "[1 sentence for {{zodiacSign}}]",
  "Final Advice": "[1 sentence for {{zodiacSign}}]"
}
`,


  ai_horoscope_weekly: `
${BASE_RULES}
Always write ONLY for {{zodiacSign}}. Never mention any other zodiac sign.
You are an expert in weekly astrological forecasting for {{zodiacSign}}.
{
  "Week Range": "{{weekRange}}",
  "Introduction": "[1 sentence for {{zodiacSign}}]",
  "Main Forecast": "[1 sentence for {{zodiacSign}}]",
  "Love": "[1 sentence for {{zodiacSign}}]",
  "Career": "[1 sentence for {{zodiacSign}}]",
  "Finances": "[1 sentence for {{zodiacSign}}]",
  "Lucky Number": "[number only]",
  "Lucky Color": "[color only]",
  "Best Day": "[day of week]",
  "Overall Energy": "[1 sentence for {{zodiacSign}}]",
  "Final Advice": "[1 sentence for {{zodiacSign}}]"
}
`,


  ai_horoscope_monthly: `
${BASE_RULES}
Always write ONLY for {{zodiacSign}}. Never mention any other zodiac sign.
You are an expert in monthly astrological forecasting for {{zodiacSign}}.
{
  "Month": "{{month}}",
  "Introduction": "[1 sentence for {{zodiacSign}}]",
  "Main Forecast": "[1 sentence for {{zodiacSign}}]",
  "Love": "[1 sentence for {{zodiacSign}}]",
  "Career": "[1 sentence for {{zodiacSign}}]",
  "Finances": "[1 sentence for {{zodiacSign}}]",
  "Lucky Number": "[number only]",
  "Lucky Color": "[color only]",
  "Best Day": "[day of week]",
  "Overall Energy": "[1 sentence for {{zodiacSign}}]",
  "Final Advice": "[1 sentence for {{zodiacSign}}]"
}
`,


  ai_horoscope_yearly: `
${BASE_RULES}
Always write ONLY for {{zodiacSign}}. Never mention any other zodiac sign.
You are an expert in yearly astrological forecasting for {{zodiacSign}}.
{
  "Year": "{{currentYear}}",
  "Introduction": "[1 sentence for {{zodiacSign}}]",
  "Main Forecast": "[1 sentence for {{zodiacSign}}]",
  "Love": "[1 sentence for {{zodiacSign}}]",
  "Career": "[1 sentence for {{zodiacSign}}]",
  "Finances": "[1 sentence for {{zodiacSign}}]",
  "Lucky Number": "[number only]",
  "Lucky Color": "[color only]",
  "Best Day": "[day of week]",
  "Overall Energy": "[1 sentence for {{zodiacSign}}]",
  "Final Advice": "[1 sentence for {{zodiacSign}}]"
}
`,


/* ==========================================================
   ASK THE STARS
   ========================================================== */

  ask_the_stars: `
${BASE_RULES}
{"Answer": "Answer ONLY the question: '{{question}}'. Do not mention Sun, Moon, or Ascendant. Be concise and in {{language}}."}
`,


/* ==========================================================
   PERSONAL HOROSCOPE – BASE (ÚJ, SZAKMAI)
   ========================================================== */

  personal_horoscope: `
${BASE_RULES}
Generate a professional natal-chart–based horoscope.
Use clear 1–2 sentence answers. 
Keep the tone astrological (planetary influences, sign dynamics, elemental balance).
Respond in the user’s language.

{
  "Sun": "{{sunSign}}",
  "Moon": "{{moonSign}}",
  "Ascendant": "{{risingSign}}",
  "Elements": "Fire {{firePercent}}%, Earth {{earthPercent}}%, Air {{airPercent}}%, Water {{waterPercent}}%",

  "Personality (Sun, Moon, Ascendant)": "[Describe how these three placements shape personality, instincts, emotional tone, and outward behavior in 1–2 sentences]",

  "Current Period (Planetary Transits – {{periodType}})": "[Give a short forecast based on current planetary movements relevant to the chart]",

  "Love & Relationships": "[Interpret relationship energy using Venus, the Moon, and any active love-related transits]",

  "Career & Finances": "[Analyze work, ambition, and financial themes through Saturn, the Midheaven, and key transits]",

  "Health & Emotional Balance": "[Reflect on vitality (Sun), emotional climate (Moon), and stress or balance influenced by current transits]",

  "Personal Growth & Spirituality": "[Provide guidance based on Jupiter themes, Saturn lessons, and longer-term chart directions]",

  "Advice": "[1 short actionable sentence summarizing the main guidance]",

  "Summary": "[1 short closing sentence capturing the main astrological theme]"
}
`,


/* ==========================================================
   PERSONAL HOROSCOPE – EXPLICIT PERIOD PROMPTS
   ========================================================== */

  personal_horoscope_period_daily: `
${BASE_RULES}
{"Current Period": "[1 sentence specific to {{currentDate}}]"}
`,

  personal_horoscope_period_weekly: `
${BASE_RULES}
{"Current Period": "[1 sentence specific to week {{weekRange}}]"}
`,

  personal_horoscope_period_monthly: `
${BASE_RULES}
{"Current Period": "[1 sentence specific to {{month}}]"}
`,


/* ==========================================================
   LOVE COMPATIBILITY
   ========================================================== */

  love_compatibility: `
${BASE_RULES}
You are a professional astrologer. You interpret romantic compatibility based on zodiac energies.
{
  "Your Love Energy": "[1 sentence]",
  "Your Love Style": "[1 sentence]",
  "Three Most Compatible Signs": [
    "[Sign] — [Two-word trait]",
    "[Sign] — [Two-word trait]",
    "[Sign] — [Two-word trait]"
  ],
  "Challenging Signs": "[1 sentence]",
  "Elemental Overview": "[1 sentence]",
  "Love Advice": "[1 sentence]"
}
`,


/* ==========================================================
   NUMEROLOGY
   ========================================================== */

numerology: `
${BASE_RULES}
You are a professional numerologist. Use ONLY these exact numbers – NEVER recalculate them:
- Life Path Number: {{lifePathNumber}}
- Expression Number: {{expressionNumber}}
- Soul Urge Number: {{soulUrgeNumber}}
- Personality Number: {{personalityNumber}}
- Birthday Number: {{birthdayNumber}}

Now generate a personalized interpretation in {{language}}:
{
  "Numerology Insights": "[1–2 sentences about the overall numerological profile]",
  "Life Path Number": "{{lifePathNumber}} — [1 sentence about Life Path]",
  "Expression Number": "{{expressionNumber}} — [1 sentence about Expression]",
  "Soul Urge Number": "{{soulUrgeNumber}} — [1 sentence about Soul Urge]",
  "Personality Number": "{{personalityNumber}} — [1 sentence about Personality]",
  "Birthday Number": "{{birthdayNumber}} — [1 sentence about Birthday Number]",
  "Compatibility Insight": "[1 sentence about compatibility]",
  "Summary and Guidance": "[1–2 sentences of summary]"
}
`,


/* ==========================================================
   ASCENDANT CALCULATOR
   ========================================================== */

  ascendant_calc: `
${BASE_RULES}
You explain Rising Sign traits precisely.
{
  "Rising Sign": "{{risingSign}}",
  "Core Traits": "[1 sentence]",
  "Social Impression": "[1 sentence]",
  "Behavioral Tendencies": "[1 sentence]",
  "Physical Appearance": "[1 sentence]",
  "Compatibility Note": "[1 sentence]",
  "Summary/Reflection": "[1 sentence]"
}
`,


/* ==========================================================
   PERSONAL ASTRO CALENDAR
   ========================================================== */

  personal_astro_calendar: `
${BASE_RULES}
You are a professional astrologer. You describe ONLY future planetary influences (never past dates).
{
  "Overview": "[1 sentence]",
  "Timeline": [
    "{{timelineDate1}}: [1 sentence]",
    "{{timelineDate2}}: [1 sentence]",
    "{{timelineDate3}}: [1 sentence]"
  ],
  "Major Transits": "[1 sentence]",
  "Energy Themes": "[1 sentence]",
  "Advice": "[1 sentence]",
  "Best Day": "[day of week] — [1 sentence]",
  "Summary": "[1 sentence]"
}
`,


/* ==========================================================
   CHINESE HOROSCOPE – BASE
   ========================================================== */

  chinese_horoscope: `
${BASE_RULES}
You are a professional astrologer. Interpret the user's Chinese Zodiac data.
Return a JSON object with the following keys in English, but ALL VALUES in {{language}}:

{
  "animal": "[Chinese zodiac animal name in {{language}}]",
  "element": "[Element name in {{language}}]",
  "yinYang": "[Yin or Yang in {{language}}]",
  "personalityTraits": "[1 sentence]",
  "elementInfluence": "[1 sentence]",
  "yinYangPolarity": "[1 sentence]",
  "compatibilityNotes": "[1 sentence]",
  "yearlyOutlook": "[1 sentence]",
  "advice": "[1 sentence]",
  "closingReflection": "[1 sentence]"
}
`
};
