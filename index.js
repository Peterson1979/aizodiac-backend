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

app.get('/', (req, res) => {
  res.send('AIzodiac backend él – használd a /horoscope végpontot!');
});

app.get('/horoscope', async (req, res) => {
  const sign = req.query.sign;
  const langCode = req.query.lang?.toLowerCase() || 'en';
  const date = req.query.date;

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
Create a daily horoscope for the user with the ${sign} zodiac sign for ${date}.

The response should be cheerful and positive and contain ONLY the following 10 sections, in this order, WITHOUT including any section titles or labels:

Love: [max 2 sentences, simple, easy-to-understand language for relationships and single life]
Work: [max 2 sentences about career and work tasks]
Health: [max 2 sentences about physical and mental health]
Money: [max 2 sentences about finances and investments]
Daily lucky number: [a number between 1 and 99 that can bring luck]
Lucky color: [a specific color that conveys positive energies]
Daily mantra: [an inspiring sentence, like a quote, that gives strength for the day]
Mood summary: [one word or short phrase that reflects the mood of the day]
Stars position: [max 2 sentences about Moon/Venus and how it affects the zodiac sign]
Daily tip: [a practical, positive advice in 1 sentence to help the user succeed today]

IMPORTANT:
- The entire response must be written in English.
- Each section must be on a separate line
- No intro or outro text
- No JSON, HTML, or Markdown formatting
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'Nem várt Gemini API válasz.' });
    }

    const lines = text.split('\n').filter(Boolean);
    const result = {};

    let keyNames = ["love", "work", "health", "money", "dailyluckynumber", "luckycolor", "dailymantra", "moodsummary", "starsposition", "dailytip"];
    for (let i = 0; i < lines.length; i++) {
      result[keyNames[i]] = lines[i];
    }
    res.json(result);
  } catch (error) {
    console.error('Hiba:', error);
    res.status(500).json({ error: 'Hiba történt a kérés feldolgozásakor!' });
  }
});

app.listen(port, () => {
  console.log(`Backend fut a http://localhost:${port} címen`);
});