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
Professional natal-chart forecast based on:
Sun: {{sunSign}}, Moon: {{moonSign}}, Ascendant: {{risingSign}}
Elements: Fire {{firePercent}}%, Earth {{earthPercent}}%, Air {{airPercent}}%, Water {{waterPercent}}%

Translate sign names to {{language}} for Sun, Moon, and Ascendant.
Set "Sun_Code" to "{{sunSign}}", "Moon_Code" to "{{moonSign}}", "Ascendant_Code" to "{{risingSign}}".
Set "Elements" to "Fire {{firePercent}}%, Earth {{earthPercent}}%, Air {{airPercent}}%, Water {{waterPercent}}%".
Provide 2 short sentences for Personality (Sun, Moon, Ascendant), Current Period (Planetary Transits – Daily, Weekly, Monthly, Yearly), Love & Relationships, Career & Finances, Health & Emotional Balance, Personal Growth & Spirituality, Advice, and Summary.
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
Numerological interpretation for the following exact numbers (do not recalculate):
- Life Path Number: {{lifePathNumber}}
- Expression Number: {{expressionNumber}}
- Soul Urge Number: {{soulUrgeNumber}}
- Personality Number: {{personalityNumber}}
- Birthday Number: {{birthdayNumber}}

Format Life Path Number as "{{lifePathNumber}} — [2 short sentences]".
Format Expression Number as "{{expressionNumber}} — [2 short sentences]".
Format Soul Urge Number as "{{soulUrgeNumber}} — [2 short sentences]".
Format Personality Number as "{{personalityNumber}} — [2 short sentences]".
Format Birthday Number as "{{birthdayNumber}} — [2 short sentences]".
Provide 2 short sentences for Numerology Insights, Compatibility Insight, and Summary and Guidance.
`,

  ascendant_calc: `
${BASE_RULES}
Rising Sign traits and interpretation for {{risingSign}}.
Set "Rising Sign" to "{{risingSign}}".
Provide 2 short sentences for Core Traits, Social Impression, Behavioral Tendencies, Physical Appearance, Compatibility Note, and Summary/Reflection.
`,

  personal_astro_calendar: `
${BASE_RULES}
Future planetary transit forecast for dates: {{timelineDate1}}, {{timelineDate2}}, {{timelineDate3}}.
Format Timeline array items as:
"{{timelineDate1}}: [2 short sentences]",
"{{timelineDate2}}: [2 short sentences]",
"{{timelineDate3}}: [2 short sentences]".
Provide 2 short sentences for Overview, Major Transits, Energy Themes, Advice, Best Day ("[Day] — [2 short sentences]"), and Summary.
`,

  chinese_horoscope: `
${BASE_RULES}
Chinese Zodiac interpretation for:
Animal: {{animal}}, Element: {{element}}, Yin/Yang: {{yinYang}}.
Set "animal" to "{{animal}}", "element" to "{{element}}", "yinYang" to "{{yinYang}}".
Provide 2 short sentences for personalityTraits, elementInfluence, yinYangPolarity, compatibilityNotes, yearlyOutlook, advice, and closingReflection.
`
};

PROMPTS.ai_horoscope_general = PROMPTS.ai_horoscope_daily;