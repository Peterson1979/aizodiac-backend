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
const DEFAULT_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.0-flash-lite";

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

// --- Prompt templates: STRICT FORMAT, 1-2 sentences per section ---
const PROMPTS = {
  home_daily_horoscope: `
You are an expert astrologer. Respond in {{language}}.
Generate a very short daily horoscope (maximum 2 sentences) for the zodiac sign: {{zodiacSign}}.
Output plain text only. No headings, no labels.
`,

  home_daily_quote: `
You are a cosmic writer. Respond in {{language}}.
Generate one short inspirational quote (max 15 words).
Output plain text only. No quotation marks, no labels.
`,

  ai_horoscope_general: `
You are an experienced astrologer. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Generate a concise {{period}} forecast for: {{zodiacSign}}.
Follow this exact format – include the headings and a short 1-2 sentence response after each colon:

Introduction: ...
Main Forecast: ...
Focus Areas:
Love: ...
Career: ...
Finances: ...
Lucky Elements:
Lucky Number: ...
Lucky Color: ...
Best Day: ...
Overall Energy: ... (e.g., "8/10 — Confident and optimistic")
Final Advice: ...

Use only the sections above. Do not add extra text or explanations.
`,

  ask_the_stars: `
You are "AI Zodiac", a celestial oracle. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Answer this user question: "{{question}}".
Use birth data if provided (DOB: {{dateOfBirth}}, Time: {{timeOfBirth}}, Place: {{placeOfBirth}}).
Output format:
Based on your birth data and question:
"{{question}}"
Your answer in 1-2 concise sentences.
– AI Zodiac
`,

  personal_horoscope: `
You are a professional astrologer. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Use birth data: DOB {{dateOfBirth}}, Time {{timeOfBirth}}, Place {{placeOfBirth}}.
If time is unknown, say "Ascendant is generalized".
Follow this exact format:

Sun Sign: ...
Moon Sign: ...
Ascendant: ...
Element Balance: Fire X%, Earth X%, Air X%, Water X%
Personality: ...
Current Period: ...
Love & Relationships: ...
Health & Emotional Balance: ...
Personal Growth & Spirituality: ...
Advice: ...

Use only 1 sentence per section. No extra text.
`,

  love_compatibility: `
You are a love astrologer. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Analyze romantic energy based on: DOB {{dateOfBirth}}, Time {{timeOfBirth}}, Place {{placeOfBirth}}.
Follow this exact format:

Your Love Energy: ...
Your Love Style: ...
Three Most Compatible Signs:
1. [Sign] — [Two-word trait]
2. [Sign] — [Two-word trait]
3. [Sign] — [Two-word trait]
Challenging Signs: ...
Elemental Overview: ...
Love Advice: ...

Use 1 sentence per section.
`,

  numerology: `
You are an expert numerologist. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Use: Full Name "{{fullName}}", DOB {{dateOfBirth}}.
Follow this exact format:

Numerology Insights: ...
Life Path Number: X — ...
Expression Number: X — ...
Soul Urge Number: X — ...
Personality Number: X — ...
Birthday Number: X — ...
Compatibility Insight: ...
Summary and Guidance: ...

Use 1 sentence per section.
`,

  ascendant_calc: `
You are an ascendant specialist. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Use: DOB {{dateOfBirth}}, Time {{timeOfBirth}}, Place {{placeOfBirth}}.
If time unknown, say "Exact time not provided — Ascendant generalized".
Follow this exact format:

Rising Sign: ...
Core Traits: ...
Social Impression: ...
Behavioral Tendencies: ...
Physical Appearance: ...
Compatibility Note: ...
Summary/Reflection: ...

Use 1 sentence per section.
`,

  personal_astro_calendar: `
You are an astrologer. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Use: DOB {{dateOfBirth}}, Time {{timeOfBirth}}, Place {{placeOfBirth}}.
Time Range: {{timeRange}}. Focus Area: {{focusArea}}.
Follow this exact format:

Overview: ...
Timeline:
- [Date]: ...
- [Date]: ...
- [Date]: ...
Major Transits: ...
Energy Themes: ...
Advice: ...
Lucky Days: ... (e.g., "Best day: Oct 22 — Sun conjunct Jupiter (confidence boost!)")
Summary: ...

Keep all entries short (1-2 sentences max).
`,

  chinese_horoscope: `
You are a master of Chinese astrology. Respond IN {{language}} FOR THE CONTENT, but ALWAYS USE ENGLISH SECTION HEADINGS exactly as shown below. DO NOT TRANSLATE THE HEADINGS.

Use: DOB {{dateOfBirth}}, Time {{timeOfBirth}}, Place {{placeOfBirth}}. Focus Area: {{focusArea}}.
Follow this exact format:

Chinese Sign: ...
Personality Traits: ...
Element Influence: ...
Yin/Yang Polarity: ...
Compatibility Notes: ...
Yearly Outlook: ...
Advice: ...
Closing Reflection: ...

Use 1 sentence per section.
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

    // Build input summary for token estimation
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

    // Fill prompt
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

    // Token estimation
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

    // API key check
    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) {
      console.error("Gemini API key not found in env.");
      return res.status(500).json({
        error: "server_config_error",
        message: "GEMINI API key missing.",
      });
    }

    // Generate content
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
            res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
          }
        }
        res.write("data: [DONE]\n\n");
        res.end();
      });
      return;
    }

    // Non-streaming
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
        res.write(`data: ${JSON.stringify({ error: errorCode, message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (e) {
        // silent
      }
    }
  }
};