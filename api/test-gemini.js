import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const result = await model.generateContent("Say hello in a friendly way");
    const output = result.response.text();

    res.status(200).json({ success: true, output });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}