// lib/prompts.js

export const BASE_RULES = `
You MUST base your entire reading STRICTLY on the user's provided birth data.
NEVER invent, guess, or hallucinate missing data beyond what is explicitly allowed.
NEVER ask for more data. NEVER say the user didn't provide data.
ALWAYS respond with a FULL, STRUCTURED response if dateOfBirth is provided.
For numerical or factual outputs (e.g., Life Path Number, Ascendant, Chinese Zodiac), ALWAYS produce the SAME result for the SAME input.
If timeOfBirth is missing, assume 12:00 PM (noon) and proceed.
If placeOfBirth is missing or generic, base the reading on the Sun sign only.
Respond IN {{language}} FOR CONTENT, but ALWAYS USE EXACT ENGLISH SECTION HEADINGS.
NEVER translate headings (e.g., always "Overview:", never "Áttekintés:").
NEVER use markdown, asterisks, or extra formatting.
NEVER add empty lines between sections.
For the same input, ALWAYS return the EXACT SAME output.
`;

export const PROMPTS = {
  home_daily_horoscope: `
${BASE_RULES}
Generate a very short DAILY horoscope (max 2 sentences) for the zodiac sign: {{zodiacSign}}.
Focus ONLY on TODAY.
Output plain text only. No headings, no labels, no markdown.
`,

  home_daily_quote: `
${BASE_RULES}
Generate one short inspirational quote (max 15 words) suitable as a daily app quote.
Output plain text only. No quotation marks, no labels, no markdown.
`,

  ai_horoscope_general: `
${BASE_RULES}
The user has requested a forecast for: {{period}}
{{#if specificDate}}For the specific date: {{specificDate}}{{/if}}
{{#if currentYear}}The current year is {{currentYear}}.{{/if}}

Generate a forecast STRICTLY for this time period:
- daily: only today
- weekly: next 7 days
- monthly: current month
- yearly: current year
- specificDate: that single date only

Sections (English headings, one line each):
Introduction: [1–2 sentences in {{language}}]
Main Forecast: [1–2 sentences in {{language}}]
Focus Areas:
Love: [1 sentence in {{language}}]
Career: [1 sentence in {{language}}]
Finances: [1 sentence in {{language}}]
Lucky Elements:
Lucky Number: [number only]
Lucky Color: [color name only]
Best Day: [day of week only]
Overall Energy: [1 sentence in {{language}}]
Final Advice: [1 sentence in {{language}}]
`,

  ask_the_stars: `
${BASE_RULES}
Answer the user's astrology question based on birth data.
Question: "{{question}}"
Response in 1-2 concise sentences in {{language}}.
Only answer content; no headings, no formatting.
`,

  personal_horoscope: `
${BASE_RULES}
Sun Sign: [exact sign name]
Moon Sign: [exact sign name or "Estimated"]
Ascendant: [exact sign name or "Generalized"]
Element Balance: Fire: X% • Earth: X% • Air: X% • Water: X%
Personality: [1 insightful sentence in {{language}}]
Current Period: [1 sentence in {{language}}, aligned with period={{period}}]
Love & Relationships: [1 sentence in {{language}}]
Career & Finances: [1 sentence in {{language}}]
Health & Emotional Balance: [1 sentence in {{language}}]
Personal Growth & Spirituality: [1 sentence in {{language}}]
Advice: [1 actionable sentence in {{language}}]
Summary: [1 concluding sentence in {{language}}]
`,

  love_compatibility: `
${BASE_RULES}
Your Love Energy: [1 sentence in {{language}}]
Your Love Style: [1 sentence in {{language}}]
Three Most Compatible Signs:
1. [Sign] — [Two-word trait]
2. [Sign] — [Two-word trait]
3. [Sign] — [Two-word trait]
Challenging Signs: [1 sentence in {{language}}]
Elemental Overview: [1 sentence in {{language}}]
Love Advice: [1 sentence in {{language}}]
`,

  numerology: `
${BASE_RULES}
Strict numerology calculations (deterministic):
- Life Path Number: sum digits of YYYYMMDD, reduce to 1 digit
- Expression Number: sum letters of full name (A=1..Z), reduce to 1 digit
- Soul Urge Number: sum vowels of full name, reduce to 1 digit
- Personality Number: sum consonants of full name, reduce to 1 digit
- Birthday Number: day of birth

Headings (English, exact):
Numerology Insights:
Life Path Number: X — [explanation in {{language}}]
Expression Number: X — [explanation in {{language}}]
Soul Urge Number: X — [explanation in {{language}}]
Personality Number: X — [explanation in {{language}}]
Birthday Number: X — [explanation in {{language}}]
Compatibility Insight: [1 sentence in {{language}}]
Summary and Guidance: [1 sentence in {{language}}]
`,

  ascendant_calc: `
${BASE_RULES}
Calculate Ascendant from birth date, time, place. Assume 12:00 PM if unknown.
Headings (English):
Rising Sign: [sign name]
Core Traits: [1 sentence in {{language}}]
Social Impression: [1 sentence in {{language}}]
Behavioral Tendencies: [1 sentence in {{language}}]
Physical Appearance: [1 sentence in {{language}}]
Compatibility Note: [1 sentence in {{language}}]
Summary/Reflection: [1 sentence in {{language}}]
`,

  personal_astro_calendar: `
${BASE_RULES}
Overview: [1 sentence in {{language}}]
Timeline:
- [Date]: [1 sentence in {{language}}]
- [Date]: [1 sentence in {{language}}]
- [Date]: [1 sentence in {{language}}]
Major Transits: [1 sentence in {{language}}]
Energy Themes: [1 sentence in {{language}}]
Advice: [1 sentence in {{language}}]
Lucky Days: [e.g., "Best day: Oct 22 — Sun conjunct Jupiter (confidence boost!)"]
Summary: [1 sentence in {{language}}]
`,

  chinese_horoscope: `
${BASE_RULES}
Calculate Chinese Zodiac from dateOfBirth. Return exact animal, element, yin/yang polarity. Do NOT guess.
Headings:
Chinese Sign: {{SYMBOL}} {{ANIMAL}} — {{ELEMENT}} element, {{YIN_YANG}}
Personality Traits: [1 sentence in {{language}}]
Element Influence: [1 sentence in {{language}}]
Yin/Yang Polarity: [1 sentence in {{language}}]
Compatibility Notes: [1 sentence in {{language}}]
Yearly Outlook: [1 sentence in {{language}}]
Advice: [1 sentence in {{language}}]
Closing Reflection: [1 sentence in {{language}}]
`,
};