const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

async function fetchData(url, options) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, options);
  return response;
}

// 🔁 Nyelvi kód ➝ nyelv neve
function getLanguageName(code) {
  switch (code) {
    case 'hu': return 'Hungarian';
    case 'de': return 'German';
    case 'fr': return 'French';
    case 'es': return 'Spanish';
    case 'it': return 'Italian';
    case 'ru': return 'Russian';
    case 'zh': return 'Chinese (Simplified)';
    case 'ja': return 'Japanese';
    case 'ko': return 'Korean';
    case 'ar': return 'Arabic';
    case 'fa': return 'Persian';
    case 'bn': return 'Bengali';
    case 'hi': return 'Hindi';
    case 'id': return 'Indonesian';
    case 'th': return 'Thai';
    case 'vi': return 'Vietnamese';
    case 'ur': return 'Urdu';
    case 'pl': return 'Polish';
    case 'tr': return 'Turkish';
    case 'uk': return 'Ukrainian';
    case 'ro': return 'Romanian';
    case 'nl': return 'Dutch';
    case 'ms': return 'Malay';
    case 'sw': return 'Swahili';
    case 'ta': return 'Tamil';
    case 'te': return 'Telugu';
    case 'pt': return 'Portuguese';
    default: return 'English';
  }
}

app.get('/', (req, res) => {
  res.send('AIzodiac backend él – használd a /horoscope végpontot!');
});

app.get('/horoscope', async (req, res) => {
  const sign = req.query.sign;
  const langCode = req.query.lang?.toLowerCase() || 'en';
  const languageName = getLanguageName(langCode);

  let date = req.query.date;
  if (!sign) {
    return res.status(400).json({ error: 'Csillagjegy megadása kötelező!' });
  }
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nincs beállítva!' });
  }

  const prompt = `
You are an astrologer AI. Provide a daily horoscope for the zodiac sign "${sign}" for ${date}.
Respond ONLY in valid JSON with the following exact English keys:

{
  "love": "...",
  "work": "...",
  "health": "...",
  "money": "...",
  "dailyLuckyNumber": "...",
  "luckyColor": "...",
  "dailyMantra": "...",
  "moodSummary": "...",
  "starsPosition": "...",
  "dailyTip": "..."
}

Important:
- Keep the keys exactly as written above.
- The values must be written in ${languageName}.
- No extra text or formatting outside of JSON.
`;

  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetchData(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log("Gemini API response:", text);

    if (!text) {
      return res.status(500).json({ error: 'Nem várt Gemini API válasz.' });
    }

    // Tisztítás (ha a Gemini extra karaktereket adna vissza)
    text = text.replace(/```json|```/g, '').trim();

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({ error: 'Nem lehet feldolgozni a Gemini válaszát.', raw: text });
    }

    // Biztosítjuk, hogy minden kulcs létezzen
    const expectedKeys = ["love", "work", "health", "money", "dailyLuckyNumber", "luckyColor", "dailyMantra", "moodSummary", "starsPosition", "dailyTip"];
    for (const key of expectedKeys) {
      if (!jsonResponse[key]) jsonResponse[key] = null;
    }

    res.json(jsonResponse);
  } catch (error) {
    console.error('Hiba:', error);
    res.status(500).json({ error: 'Hiba történt a kérés feldolgozásakor!' });
  }
});

app.listen(port, () => {
  console.log(`Backend fut a http://localhost:${port} címen`);
});
