const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const response = await model.generateText({
      prompt: "Say hello in a friendly way",
      maxOutputTokens: 50,
    });

    res.status(200).json({ success: true, response: response.candidates[0].output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}
