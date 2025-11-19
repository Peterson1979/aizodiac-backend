// File: /lib/generateAstroContent.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Redis = require("ioredis");

// --- Configuration ---
const DEFAULT_DAILY_TOKEN_LIMIT = 1_000_000;
const DAILY_TOKEN_LIMIT = process.env.DAILY_TOKEN_LIMIT
  ? parseInt(process.env.DAILY_TOKEN_LIMIT, 10)
  : DEFAULT_DAILY_TOKEN_LIMIT;
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;
const DEFAULT_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";

// --- Redis (Upstash) singleton ---
let redis = global.redisClient || null;

if (!redis && process.env.UPSTASH_REDIS_URL) {
  redis = new Redis(process.env.UPSTASH_REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    tls: {},
  });

  redis.on("error", (err) => {
    console.error("Redis error:", err?.message || err);
  });

  global.redisClient = redis;
} else if (!process.env.UPSTASH_REDIS_URL) {
  console.warn(
    "UPSTASH_REDIS_URL is not set – token limit check skipped (fail-open)."
  );
  redis = null;
}

// --- Supported languages (25+) ---
function getLanguageName(code) {
  const langMap = {
    en: "English",
    hu: "Hungarian",
    de: "German",
    fr: "French",
    it: "Italian",
    ru: "Russian",
    es: "Spanish",
    pt: "Portuguese",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    sw: "Swahili",
    fa: "Persian",
    ta: "Tamil",
    bn: "Bengali",
    hi: "Hindi",
    id: "Indonesian",
    th: "Thai",
    vi: "Vietnamese",
    ur: "Urdu",
    te: "Telugu",
    pl: "Polish",
    tr: "Turkish",
    uk: "Ukrainian",
    ro: "Romanian",
    nl: "Dutch",
    ms: "Malay",
    ar: "Arabic"
  };
  return langMap[code] || "English";
}

// --- Prompt templates ---
const PROMPTS = {
  home_daily_horoscope: `
You are a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. Respond IN {{language}}.
Generate a very short DAILY horoscope (maximum 2 sentences) for the zodiac sign: {{zodiacSign}}.
Focus ONLY on TODAY.
Output plain text only. No headings, no labels, no markdown.
`,

  home_daily_quote: `
You are a cosmic writer. Respond IN {{language}}.
Generate one short inspirational quote (max 15 words) suitable as a daily app quote.
Output plain text only. No quotation marks, no labels, no markdown.
`,

  ai_horoscope_general: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH SECTION HEADINGS — DO NOT TRANSLATE THEM, DO NOT ADD MARKDOWN, DO NOT ADD EXTRA LINES.

The user has requested a forecast for: {{period}}
{{#if specificDate}}For the specific date: {{specificDate}}{{/if}}
{{#if currentYear}}The current year is {{currentYear}}.{{/if}}

Generate a forecast STRICTLY for this time period:
- If "daily", focus ONLY on today
- If "weekly", cover the next 7 days
- If "monthly", cover the entire current month
- If "yearly", cover the entire year {{#if currentYear}}{{currentYear}}{{else}}this year{{/if}}
- If "specificDate" is provided, focus EXCLUSIVELY on that single date — DO NOT mention weekly, monthly, or yearly trends

Follow this EXACT format — each section on its own line, with a colon after the heading:

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
Overall Energy: [e.g., "8/10 — Confident and optimistic"]
Final Advice: [1 sentence in {{language}}]

Rules:
- NEVER translate the headings (e.g., always "Introduction:", never "Bevezetés:")
- NEVER use placeholders like "(example)" or "1 sentence in English"
- NEVER use **, *, #, or any formatting
- NEVER add empty lines between sections
- Write only the content after the colon in {{language}}
- For the same input, ALWAYS return the EXACT SAME output
`,

  ask_the_stars: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH HEADINGS WITHOUT ANY MARKDOWN:

Based on your birth data and question:
"{{question}}"
Your answer in 1-2 concise sentences.
– AI Zodiac

Rules:
- No asterisks, no bold, no extra lines
- Only the answer content may be in {{language}}
- NEVER use placeholders
- For the same input, ALWAYS return the EXACT SAME output
`,

  personal_horoscope: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. If a birth time is missing, clearly state that the Ascendant and Moon Sign are estimated or generalized.

Follow these rules **exactly**:

1. **Calculate signs accurately** from the given birth date (and time, if provided):
   - Sun Sign: based on date of birth only.
   - Moon Sign: estimate based on date (±1 day uncertainty is acceptable if time unknown).
   - Ascendant: if birth time is unknown, output "Generalized".

2. **Element Balance**: Assign approximate percentages based on the **exact elemental composition of the user's Sun, Moon, and Ascendant signs**:
   - Each sign belongs to one element:
     - Fire: Aries, Leo, Sagittarius
     - Earth: Taurus, Virgo, Capricorn
     - Air: Gemini, Libra, Aquarius
     - Water: Cancer, Scorpio, Pisces
   - Count how many of the three (Sun, Moon, Ascendant) fall into each element.
   - Convert to percentages (e.g., 2 Fire, 1 Water → Fire 66%, Water 33%, Earth 0%, Air 0%).
   - Round to nearest 5% and ensure total is **exactly 100%**.
   - Format: "Fire: X% • Earth: X% • Air: X% • Water: X%"

3. **Content rules**:
   - Write **only factual, coherent, insightful** interpretations.
   - Do **not repeat** phrases across sections.
   - Tailor each section to the user’s actual signs and element balance.
   - If period is specified (e.g., "daily", "weekly", "monthly"), focus Current Period **only** on that timeframe.
   - For "Current Period", mention planetary transits **only if relevant** to the user's chart.

4. **Format rules**:
   - One line per section.
   - NO empty lines.
   - NO markdown, bold, asterisks, or extra punctuation.
   - Headings **MUST** be in English **exactly as listed below**.
   - Only content **after the colon** may be in {{language}}.

Respond in this exact structure:

Sun Sign: [exact sign name]
Moon Sign: [exact sign name or "Estimated"]
Ascendant: [exact sign name or "Generalized"]
Element Balance: Fire: X% • Earth: X% • Air: X% • Water: X%
Personality: [1 insightful sentence in {{language}}]
Current Period: [1 sentence in {{language}}, aligned with period={{period}} if provided]
Love & Relationships: [1 sentence in {{language}}]
Career & Finances: [1 sentence in {{language}}]
Health & Emotional Balance: [1 sentence in {{language}}]
Personal Growth & Spirituality: [1 sentence in {{language}}]
Advice: [1 actionable sentence in {{language}}]
Summary: [1 concluding sentence in {{language}}]

User input:
- Date of Birth: {{dateOfBirth}}
- Time of Birth: {{timeOfBirth}}
- Place of Birth: {{placeOfBirth}}
- Gender: {{gender}}
- Requested Period: {{period}}

Rules:
- NEVER use placeholders
- For the same input, ALWAYS return the EXACT SAME output
`,

  love_compatibility: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate.You are a love astrologer. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH HEADINGS:

Your Love Energy: [1 sentence in {{language}}]
Your Love Style: [1 sentence in {{language}}]
Three Most Compatible Signs:
1. [Sign] — [Two-word trait]
2. [Sign] — [Two-word trait]
3. [Sign] — [Two-word trait]
Challenging Signs: [1 sentence in {{language}}]
Elemental Overview: [1 sentence in {{language}}]
Love Advice: [1 sentence in {{language}}]

Rules:
- No formatting, no extra lines
- Headings in English
- NEVER use placeholders
- For the same input, ALWAYS return the EXACT SAME output
`,

  numerology: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are an expert numerologist and a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH HEADINGS:

Numerology Insights: [1 sentence in {{language}}]
Life Path Number: X — [explanation in {{language}}]
Expression Number: X — [explanation in {{language}}]
Soul Urge Number: X — [explanation in {{language}}]
Personality Number: X — [explanation in {{language}}]
Birthday Number: X — [explanation in {{language}}]
Compatibility Insight: [1 sentence in {{language}}]
Summary and Guidance: [1 sentence in {{language}}]

Rules:
- One line per section
- No markdown
- Headings in English
- NEVER use placeholders
- For the same input, ALWAYS return the EXACT SAME output
`,

  ascendant_calc: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are an ascendant specialist and a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH HEADINGS:

Rising Sign: [sign name]
Core Traits: [1 sentence in {{language}}]
Social Impression: [1 sentence in {{language}}]
Behavioral Tendencies: [1 sentence in {{language}}]
Physical Appearance: [1 sentence in {{language}}]
Compatibility Note: [1 sentence in {{language}}]
Summary/Reflection: [1 sentence in {{language}}]

Rules:
- No formatting
- One line per section
- Headings in English
- NEVER use placeholders like "(example)" or "1 sentence in English"
- For the same input, ALWAYS return the EXACT SAME output
`,

  personal_astro_calendar: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are a highly experienced, precise, and data-driven astrologer. You **MUST** base your entire reading **strictly** on the user's provided birth data. Do **NOT** guess, invent, or deviate. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH HEADINGS:

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

Rules:
- No markdown
- No empty lines
- Headings in English
- NEVER use placeholders
- For the same input, ALWAYS return the EXACT SAME output
`,

  chinese_horoscope: `
If {{dateOfBirth}} is missing, invalid, or not in DD/MM/YYYY format, respond ONLY with: "Please provide a valid birth date." in {{language}}.

You are a master of Chinese astrology. You MUST calculate the user's Chinese zodiac sign STRICTLY from the birth year in {{dateOfBirth}}. Do NOT invent or guess.

Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE EXACTLY THESE ENGLISH HEADINGS:

Chinese Sign: [e.g., "Dragon — Wood element, Yang"]
Personality Traits: [1 sentence in {{language}}]
Element Influence: [1 sentence in {{language}}]
Yin/Yang Polarity: [1 sentence in {{language}}]
Compatibility Notes: [1 sentence in {{language}}]
Yearly Outlook: [1 sentence in {{language}}]
Advice: [1 sentence in {{language}}]
Closing Reflection: [1 sentence in {{language}}]

Rules:
- NEVER use placeholders like "(example)" or "1 sentence in English"
- ALWAYS calculate the Chinese sign from the birth year (e.g., 1995 = Pig)
- For the same input, ALWAYS return the EXACT SAME output
- Do NOT add extra lines, markdown, or formatting
- Headings MUST be in English, exactly as shown
`,
};

// --- Token estimation (conservative) ---
function estimateTokensFromText(text) {
  return text ? Math.ceil(text.length / 4) : 0;
}

async function canUseTokens(estimatedTokens) {
  if (!redis) {
    console.warn("Redis not available – skipping token check (fail-open).");
    return true;
  }

  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_tokens:${today}`;

  try {
    const usedStr = await redis.get(key);
    const used = usedStr ? parseInt(usedStr, 10) : 0;
    if (used + estimatedTokens > DAILY_TOKEN_LIMIT) return false;

    const pipeline = redis.multi();
    pipeline.incrby(key, estimatedTokens);
    pipeline.expire(key, 60 * 60 * 24);
    await pipeline.exec();
    return true;
  } catch (err) {
    console.error("Redis write error:", err?.message || err);
    return true; // fail-open
  }
}

// --- Retry with backoff ---
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      const delay = Math.pow(2, attempt) * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// --- Safe placeholder replacement ---
function fillTemplate(template, data = {}) {
  let out = template;
  Object.keys(data).forEach((k) => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    out = out.split(`{{${k}}}`).join(val);
  });
  out = out.replace(/{{\w+}}/g, "");
  return out;
}

// --- Main handler ---
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "method_not_allowed",
      message: "Only POST requests are allowed.",
    });
  }

  try {
    const body = req.body || {};
    const {
      type,
      data = {},
      languageCode = data.language || data.languageCode || "en",
      stream = false,
    } = body;

    if (!type) {
      return res.status(400).json({
        error: "missing_type",
        message: "Request 'type' is required.",
      });
    }

    const languageName = getLanguageName(languageCode);
    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) {
      return res.status(400).json({
        error: "unknown_type",
        message: `Unknown type: ${type}`,
      });
    }

    const inputSummaryParts = [];
    const commonFields = [
      "zodiacSign", "dateOfBirth", "timeOfBirth", "placeOfBirth",
      "name", "fullName", "question", "specificDate", "period",
      "timeRange", "focusArea"
    ];
    commonFields.forEach((f) => {
      if (data[f]) inputSummaryParts.push(`${f}: ${data[f]}`);
    });
    const inputSummary = inputSummaryParts.join(" | ");

    const filledPrompt = fillTemplate(promptTemplate, {
      language: languageName,
      zodiacSign: data.zodiacSign || "",
      specificDate: data.specificDate || data.date || "",
      name: data.name || "",
      dateOfBirth: data.dateOfBirth || data.dob || "",
      timeOfBirth: data.timeOfBirth || data.time || "Not provided",
      placeOfBirth: data.placeOfBirth || data.place || "",
      question: data.question || "",
      fullName: data.fullName || data.full_name || "",
      period: data.period || "daily",
      timeRange: data.timeRange || "day",
      focusArea: data.focusArea || "general",
    });

    const promptTokens = estimateTokensFromText(filledPrompt);
    const inputTokens = estimateTokensFromText(inputSummary);
    const estimatedTokens = promptTokens + inputTokens + 200;

    const allowed = await canUseTokens(estimatedTokens);
    if (!allowed) {
      return res.status(429).json({
        error: "token_limit_exceeded",
        message: "Daily token quota exceeded.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) {
      console.error("Gemini API key not found in env.");
      return res.status(500).json({
        error: "server_config_error",
        message: "GEMINI API key missing.",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      await retryWithBackoff(async () => {
        const streamResponse = await model.generateContentStream(filledPrompt, {
          timeout: GEMINI_TIMEOUT_MS,
        });

        for await (const chunk of streamResponse.stream) {
          const text = chunk.text?.() || "";
          if (text) {
            res.write(` ${JSON.stringify({ delta: text })}\n\n`);
          }
        }
        res.write(" [DONE]\n\n");
        res.end();
      });
      return;
    }

    const generateResult = await retryWithBackoff(async () =>
      model.generateContent(filledPrompt, { timeout: GEMINI_TIMEOUT_MS })
    );

    let text = "";
    try {
      if (generateResult?.response?.text) {
        text = generateResult.response.text();
      } else if (generateResult?.text) {
        text = generateResult.text;
      } else {
        text = String(generateResult || "");
      }
    } catch (e) {
      text = String(generateResult || "");
    }

    return res.status(200).json({
      success: true,
      type,
      estimatedTokens,
      content: text.trim(),
    });
  } catch (error) {
    console.error("Error in generateAstroContent:", error);

    let statusCode = 500;
    let errorCode = "internal_error";
    let message = "An unexpected error occurred.";

    if (error?.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
      statusCode = 504;
      errorCode = "timeout";
      message = "The request to the model timed out.";
    } else if (error?.status === 503) {
      statusCode = 503;
      errorCode = "model_overloaded";
      message = "The model is currently overloaded.";
    } else if (error?.status === 429) {
      statusCode = 429;
      errorCode = "rate_limited";
      message = "Too many requests to the model.";
    } else if ([401, 403].includes(error?.status)) {
      statusCode = error.status;
      errorCode = "unauthorized";
      message = "Unauthorized request. Check API key.";
    }

    if (!res.headersSent) {
      return res.status(statusCode).json({ error: errorCode, message });
    } else {
      try {
        res.write(` ${JSON.stringify({ error: errorCode, message })}\n\n`);
        res.write(" [DONE]\n\n");
        res.end();
      } catch (e) {
        // silent
      }
    }
  }
};