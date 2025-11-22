import type { NextApiRequest, NextApiResponse } from "next";
import {
  Redis,
  PROMPTS,
  fillTemplate,
  estimateTokensFromText,
  canUseTokens,
  isAllowedRequest,
  retryWithBackoff,
} from "../../lib/generateAstroContent";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", message: "Only POST allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!(await isAllowedRequest(String(ip)))) {
    return res.status(429).json({ error: "rate_limited", message: "Too many requests per minute" });
  }

  const { type, data = {}, languageCode = "en" } = req.body;

  if (!type) return res.status(400).json({ error: "missing_type", message: "'type' required" });
  const promptTemplate = PROMPTS[type];
  if (!promptTemplate) return res.status(400).json({ error: "unknown_type", message: `Unknown type: ${type}` });

  const filledPrompt = fillTemplate(promptTemplate, { ...data, language: languageCode });
  const estimatedTokens = estimateTokensFromText(filledPrompt) + 200;

  if (!(await canUseTokens(estimatedTokens))) {
    return res.status(429).json({ error: "token_limit_exceeded", message: "Daily token quota exceeded" });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "server_config_error", message: "GEMINI API key missing." });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  try {
    const result = await retryWithBackoff(() => model.generateContent(filledPrompt, { timeout: 25_000 }));
    const text = result?.response?.text?.() || result?.text || String(result || "");
    return res.status(200).json({ success: true, estimatedTokens, content: text.trim() });
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({ error: "model_error", message: "Failed to generate content" });
  }
}
