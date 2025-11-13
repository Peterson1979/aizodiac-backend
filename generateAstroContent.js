// File: /api/generateAstroContent.js
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
    "UPSTASH_REDIS_URL nincs beállítva – token limit ellenőrzés KIHAGYVA (fail-open)."
  );
  redis = null;
}

// --- Helpers: language names + section titles (kept minimal) ---
function getLanguageName(code) {
  switch (code) {
    case "hu":
      return "Hungarian";
    case "de":
      return "German";
    case "fr":
      return "French";
    case "it":
      return "Italian";
    case "ru":
      return "Russian";
    case "es":
      return "Spanish";
    case "pt":
      return "Portuguese";
    case "zh":
      return "Chinese";
    case "ja":
      return "Japanese";
    case "ko":
      return "Korean";
    case "bn":
      return "Bengali";
    case "hi":
      return "Hindi";
    case "ar":
      return "Arabic";
    default:
      return "English";
  }
}

function getSectionTitles(langCode) {
  // Only used if needed; simplified version - extendable
  switch (langCode) {
    case "hu":
      return {
        summary: "Összefoglalás",
      };
    default:
      return {
        summary: "Summary",
      };
  }
}

// --- Prompt templates for each feature/type ---
// Use placeholders like {{placeholder}} which will be replaced safely.
const PROMPTS = {
  home_daily_horoscope: `
You are an expert astrologer. Respond in the language specified by {{languageCode}}.
Generate a very short daily horoscope (maximum 2 sentences) for the given zodiac sign.
Zodiac Sign: {{zodiacSign}}
Output: 1-2 short sentences, warm tone, positive guidance. Return plain text.
`,

  home_daily_quote: `
You are a thoughtful, uplifting cosmic writer. Respond in the language specified by {{languageCode}}.
Generate one short inspirational quote (max 15 words) suitable as a daily app quote.
Output: single sentence only, plain text.
`,

  ai_horoscope_general: `
You are an experienced astrologer. Respond in the language specified by {{languageCode}}.
Generate a concise {{period}} forecast for the zodiac sign: {{zodiacSign}}.
If the user provided a specific date ({{specificDate}}) or name ({{name}}), personalize briefly.
Keep the output short — 1-2 sentences per card.

Output sections (each as 1-2 short sentences):
- Introduction
- Main Forecast
- Focus Areas: Love, Career, Finances (one short sentence each)
- Lucky Elements: Number, Lucky Color, Best Day (one short sentence total)
- Overall Energy: a short rating-like string (e.g., "8/10 — Confident and optimistic")
- Final Advice

Return as JSON-friendly plain text blocks separated with "||" or as a single short paragraph (your choice) — backend will split by sections by looking for known headings.
`,

  ask_the_stars: `
You are "AI Zodiac", a celestial oracle. Respond in the language specified by {{languageCode}}.
User question: "{{question}}"
Use the user's birth data (DOB: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}) if provided to add brief astrological context.
Output: Under the heading "Based on your birth data and question:", show the question in quotes and answer in 1-2 concise sentences. End with "– AI Zodiac".
Return plain text.
`,

  personal_horoscope: `
You are a professional astrologer preparing a concise personal birth-chart summary. Respond in the language specified by {{languageCode}}.
Use the birth data: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}. If time is "I don't know my exact time", state that the Ascendant is generalized.
Output sections (each 1 short sentence unless noted): 
- Sun Sign
- Moon Sign
- Ascendant
- Element Balance (Fire %, Earth %, Air %, Water %)
- Personality (Effects of Sun, Moon, Ascendant) — 1 sentence
- Current Period (planetary positions and short forecast) — 1 sentence
- Love & Relationships — 1 sentence
- Health & Emotional Balance — 1 sentence
- Personal Growth & Spirituality — 1 sentence
- Advice — 1 sentence
Return as plain text with short section markers.
`,

  love_compatibility: `
You are a compassionate love astrologer. Respond in the language specified by {{languageCode}}.
Use the user's birth data (DOB: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}). Do not assume a partner — analyze the user's romantic energy.
Output, each as 1 short sentence:
- Your Love Energy
- Your Love Style
- Three Most Compatible Signs (list three with a short trait each, e.g., "Gemini — Fun & spontaneous")
- Challenging Signs
- Elemental Overview
- Love Advice
Return as plain text.
`,

  numerology: `
"You are an expert numerologist. Respond in the language specified by {{languageCode}}. 
Use data: Full Name: {{fullName}}, Date of Birth: {{dateOfBirth}}. 
Output sections (each 1 short sentence, except where explanation is required): 
- Numerology Insights 
- Life Path Number (include number + short explanation) 
- Expression Number (include number + short explanation) 
- Soul Urge Number (include number + short explanation) 
- Personality Number (include number + short explanation) 
- Birthday Number (include number + short explanation) 
- Compatibility Insight (short interpretation) 
- Summary and Guidance 
Return plain text."

`,

  ascendant_calc: `
You are an astrologer specializing in ascendants. Respond in the language specified by {{languageCode}}.
Use birth data: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}.
If the exact time is not available ({{timeOfBirth}} indicates unknown), say "Exact time not provided — Ascendant generalized."
Output sections (each 1 short sentence): 
- Rising Sign
- Core Traits
- Social Impression
- Behavioral Tendencies
- Physical Appearance
- Compatibility Note
- Summary/Reflection
Return plain text.
`,

  personal_astro_calendar: `
You are an astrologer creating a short personalized astro calendar. Respond in the language specified by {{languageCode}}.
Use birth data: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}.
Time Range: {{timeRange}} (day/week/month). Focus Area: {{focusArea}} (general/love/career/emotions).
Output (short sentences, 1 per item, timeline entries may be up to 2 sentences):
- Overview
- Timeline (3 dated events with short meaning)
- Major Transits
- Energy Themes
- Advice
- Lucky Days (short astrological explanation)
- Summary
Return plain text.
`,

  chinese_horoscope: `
You are a master of Chinese astrology. Respond in the language specified by {{languageCode}}.
Use birth data: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}. Focus Area: {{focusArea}}.
Output sections (1 sentence each):
- Chinese Sign (e.g., "Dragon — Wood element, Yang")
- Personality Traits
- Element Influence
- Yin/Yang Polarity
- Compatibility Notes
- Yearly Outlook
- Advice
- Closing Reflection
Return plain text.
`,
};

// --- Token estimation helper (simple, conservative) ---
function estimateTokensFromText(text) {
  if (!text) return 0;
  // rough heuristic: 4 characters ≈ 1 token (conservative)
  return Math.ceil(text.length / 4);
}

async function canUseTokens(estimatedTokens) {
  if (!redis) {
    // fail-open: allow if no redis available
    console.warn("Redis nem elérhető – token limit ellenőrzés átugorva.");
    return true;
  }

  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_tokens:${today}`;

  try {
    const usedStr = await redis.get(key);
    const used = usedStr ? parseInt(usedStr, 10) : 0;

    if (used + estimatedTokens > DAILY_TOKEN_LIMIT) {
      return false;
    }

    // increment and set expiry for the key
    const pipeline = redis.multi();
    pipeline.incrby(key, estimatedTokens);
    pipeline.expire(key, 60 * 60 * 24);
    await pipeline.exec();

    return true;
  } catch (err) {
    console.error("Redis write error:", err?.message || err);
    // If Redis fails on write, allow (fail-open), but log
    return true;
  }
}

// --- retry helper ---
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

// --- Utility: safe placeholder replace ---
function fillTemplate(template, data = {}) {
  let out = template;
  Object.keys(data).forEach((k) => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    // replace all occurrences of {{k}}
    out = out.split(`{{${k}}}`).join(val);
  });
  // remove unreplaced placeholders gracefully
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
    // expected body:
    // { type: "personal_horoscope" | "numerology" | ..., data: {...}, languageCode: "en", stream: false }
    const {
      type,
      data = {},
      languageCode = data.language || data.languageCode || "en",
      stream = false,
    } = body;

    if (!type) {
      return res.status(400).json({
        error: "missing_type",
        message: "Request 'type' is required (e.g., 'personal_horoscope').",
      });
    }

    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) {
      return res.status(400).json({
        error: "unknown_type",
        message: `Unknown type: ${type}`,
      });
    }

    // Build prompt input summary for token estimation and for the model
    const inputSummaryParts = [];
    // Flatten typical fields into summary
    const commonFields = [
      "zodiacSign",
      "dateOfBirth",
      "timeOfBirth",
      "placeOfBirth",
      "name",
      "fullName",
      "question",
      "specificDate",
      "period",
      "timeRange",
      "focusArea",
      "focus",
    ];
    commonFields.forEach((f) => {
      if (data[f]) inputSummaryParts.push(`${f}: ${data[f]}`);
    });

    const inputSummary = inputSummaryParts.join(" | ");

    // Fill template placeholders
    const filledPrompt = fillTemplate(promptTemplate, {
      languageCode,
      zodiacSign: data.zodiacSign || "",
      specificDate: data.specificDate || data.date || "",
      name: data.name || "",
      dateOfBirth: data.dateOfBirth || data.dob || "",
      timeOfBirth: data.timeOfBirth || data.time || "Not provided",
      placeOfBirth: data.placeOfBirth || data.place || "",
      question: data.question || "",
      fullName: data.fullName || data.full_name || "",
      period: data.period || "day",
      timeRange: data.timeRange || data.range || "",
      focusArea: data.focusArea || data.focus || "",
    });

    // Estimate tokens: prompt + input + overhead
    const promptTokens = estimateTokensFromText(filledPrompt);
    const inputTokens = estimateTokensFromText(inputSummary);
    // overhead: small fixed number to cover system instruction etc.
    const overhead = 200;
    const estimatedTokens = promptTokens + inputTokens + overhead;

    const allowed = await canUseTokens(estimatedTokens);
    if (!allowed) {
      return res.status(429).json({
        error: "token_limit_exceeded",
        message: "Daily token quota exceeded.",
      });
    }

    // Ensure API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) {
      console.error("Gemini API key not found in env.");
      return res.status(500).json({
        error: "server_config_error",
        message: "Server configuration error: GEMINI API key missing.",
      });
    }

    // Initialize model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    // Optionally allow streaming responses if client requests stream=true
    if (stream) {
      // Stream via SSE
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
            res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
          }
        }

        res.write("data: [DONE]\n\n");
        res.end();
      });

      return;
    }

    // Non-streaming: single generateContent call
    const generateResult = await retryWithBackoff(async () =>
      model.generateContent(filledPrompt, { timeout: GEMINI_TIMEOUT_MS })
    );

    // The API return shape may vary; try to extract text safely
    let text = "";
    try {
      if (generateResult && generateResult.response && typeof generateResult.response.text === "function") {
        text = generateResult.response.text();
      } else if (generateResult && generateResult.text) {
        text = generateResult.text;
      } else {
        text = String(generateResult || "");
      }
    } catch (e) {
      text = String(generateResult || "");
    }

    // Return structured JSON: type, tokensEstimate, promptPreview (short), content
    return res.status(200).json({
      success: true,
      type,
      estimatedTokens,
      content: text,
    });
  } catch (error) {
    console.error("Error in generateAstroContent:", error);

    let statusCode = 500;
    let errorCode = "internal_error";
    let message = "An unexpected error occurred.";

    if (error?.code === "ETIMEDOUT" || (error.message && error.message.includes("timeout"))) {
      statusCode = 504;
      errorCode = "timeout";
      message = "The request to the model timed out. Please try again.";
    } else if (error?.status === 503) {
      statusCode = 503;
      errorCode = "model_overloaded";
      message = "The model is currently overloaded. Try again later.";
    } else if (error?.status === 429) {
      statusCode = 429;
      errorCode = "rate_limited";
      message = "Too many requests to the model. Please wait and try again.";
    } else if (error?.status === 401 || error?.status === 403) {
      statusCode = error.status;
      errorCode = "unauthorized";
      message = "Unauthorized request. Check API key and permissions.";
    }

    // If headers already sent (streaming), try to send error chunk, else standard JSON
    if (!res.headersSent) {
      return res.status(statusCode).json({ error: errorCode, message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: errorCode, message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (e) {
        // nothing else to do
      }
    }
  }
};
