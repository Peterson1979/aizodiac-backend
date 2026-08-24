// lib/prompts.js

export const BASE_RULES = `Write all string values exclusively in {{language}}. Keep astrological interpretations clear and concise.`;

export const PROMPTS = {
  home_daily_horoscope: `
${BASE_RULES}
Write a daily horoscope for {{zodiacSign}} for {{currentDate}} in 2 short sentences. Never mention any other zodiac sign.
`,

  home_daily_quote: `
${BASE_RULES}
Write an inspiring daily quote (max 12–15 words).
`,

  ai_horoscope_daily: `
${BASE_RULES}
Daily astrological forecast for {{zodiacSign}} for today ({{currentDate}}). Never mention any other zodiac sign.
Provide 2 short sentences for Introduction, Main Forecast, Love, Career, Finances, Overall Energy, and Final Advice.
Provide single values for Lucky Number, Lucky Color, and Best Day.
`,

  ai_horoscope_weekly: `
${BASE_RULES}
Weekly astrological forecast for {{zodiacSign}} for {{weekRange}}. Never mention any other zodiac sign.
Set "Week Range" to "{{weekRange}}".
Provide 2 short sentences for Introduction, Main Forecast, Love, Career, Finances, Overall Energy, and Final Advice.
Provide single values for Lucky Number, Lucky Color, and Best Day.
`,

  ai_horoscope_monthly: `
${BASE_RULES}
Monthly astrological forecast for {{zodiacSign}} for {{month}}. Never mention any other zodiac sign.
Set "Month" to "{{month}}".
Provide 2 short sentences for Introduction, Main Forecast, Love, Career, Finances, Overall Energy, and Final Advice.
Provide single values for Lucky Number, Lucky Color, and Best Day.
`,

  ai_horoscope_yearly: `
${BASE_RULES}
Yearly astrological forecast for {{zodiacSign}} for {{currentYear}}. Never mention any other zodiac sign.
Set "Year" to "{{currentYear}}".
Provide 2 short sentences for Introduction, Main Forecast, Love, Career, Finances, Overall Energy, and Final Advice.
Provide single values for Lucky Number, Lucky Color, and Best Day.
`,

  ask_the_stars: `
${BASE_RULES}
Answer only this question concisely: '{{question}}'. Do not mention Sun, Moon, or Ascendant.
`,

  personal_horoscope: `
${BASE_RULES}
Natal chart forecast for Sun in {{sunSign}}, Moon in {{moonSign}}, Ascendant in {{risingSign}}.
Element balance: Fire {{firePercent}}%, Earth {{earthPercent}}%, Air {{airPercent}}%, Water {{waterPercent}}%.
Provide 1-2 concise sentences for each interpretive field:
- Personality (Sun, Moon, Ascendant)
- Current Period (Planetary Transits – Daily)
- Current Period (Planetary Transits – Weekly)
- Current Period (Planetary Transits – Monthly)
- Current Period (Planetary Transits – Yearly)
- Love & Relationships
- Career & Finances
- Health & Emotional Balance
- Personal Growth & Spirituality
- Advice
- Summary
`,

  personal_horoscope_period_daily: `
${BASE_RULES}
Personal horoscope period forecast for {{currentDate}} in 2 short sentences.
`,

  personal_horoscope_period_weekly: `
${BASE_RULES}
Personal horoscope period forecast for week {{weekRange}} in 2 short sentences.
`,

  personal_horoscope_period_monthly: `
${BASE_RULES}
Personal horoscope period forecast for {{month}} in 2 short sentences.
`,

  love_compatibility: `
${BASE_RULES}
Romantic compatibility analysis for {{zodiacSign}}.
Set "Your Sign" to "{{zodiacSign}}".
Provide 2 short sentences for Your Love Energy, Your Love Style, Challenging Signs, Elemental Overview, and Love Advice.
List Three Most Compatible Signs formatted as "[Sign] — [Two-word trait]".
`,

  numerology: `
${BASE_RULES}
Numerological interpretation for numbers: Life Path {{lifePathNumber}}, Expression {{expressionNumber}}, Soul Urge {{soulUrgeNumber}}, Personality {{personalityNumber}}, Birthday {{birthdayNumber}}.
Provide concise interpretations:
- Numerology Insights (max 2 sentences)
- Compatibility Insight (1 sentence)
- Summary and Guidance (max 2 sentences)
`,

  ascendant_calc: `
${BASE_RULES}
Rising Sign traits and interpretation for {{risingSign}}.
Set "Rising Sign" to "{{risingSign}}".
Provide 2 short sentences for Core Traits, Social Impression, Behavioral Tendencies, Physical Appearance, Compatibility Note, and Summary/Reflection.
`,

  personal_astro_calendar: `
${BASE_RULES}
Astrological transit forecast for dates: {{timelineDate1}}, {{timelineDate2}}, {{timelineDate3}}.
Provide 1 concise sentence per field:
- Overview (distinct transit summary)
- Timeline (array of 3 items, 1 sentence each for {{timelineDate1}}, {{timelineDate2}}, and {{timelineDate3}})
- Major Transits
- Energy Themes
- Advice
- Best Day ("[Day] — [1 sentence]")
- Summary
`,

  chinese_horoscope: `
${BASE_RULES}
Chinese Zodiac analysis for {{animal}}, {{element}}, {{yinYang}} in {{currentYear}}.
Provide 1 concise sentence for each interpretive field:
- personalityTraits
- elementInfluence
- yinYangPolarity
- compatibilityNotes
- yearlyOutlook
- advice
- closingReflection
`
};

PROMPTS.ai_horoscope_general = PROMPTS.ai_horoscope_daily;