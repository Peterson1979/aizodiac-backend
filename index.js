const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware a JSON adatokhoz
app.use(express.json());

// Segédfüggvény fetch-hez
async function fetchData(url, options) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, options);
  return response;
}

// Alap útvonal
app.get('/', (req, res) => {
  res.send('AIzodiac backend él – használd a /horoscope végpontot!');
});

// ✅ Javított /horoscope végpont – most már JSON-t ad vissza
app.get('/horoscope', async (req, res) => {
  const sign = req.query.sign;
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

  const geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  const prompt = `Create a daily horoscope for the user with the ${sign} zodiac sign for ${date}.\n\nThe response should be cheerful and positive, and contain exactly the following 10 sections, in this order:\n\nLove: [maximum 2 sentences, simple, easy-to-understand language for relationships and single life]\nWork: [maximum 2 sentences about career and work tasks]\nHealth: [maximum 2 sentences about physical and mental health]\nMoney: [maximum 2 sentences about finances and investments]\nDaily lucky number: [a number between 1 and 99 that can bring luck]\nLucky color: [a specific color that conveys positive energies]\nDaily mantra: [an inspiring sentence, like a quote, that gives strength for the day]\nMood summary: [one word or short phrase that reflects the mood of the day (e.g. "Lucky", "Creative", "Calm")]\nStars position: [maximum 2 sentences - mention the position of the Moon or Venus, if relevant, and how it affects the zodiac sign]\nDaily tip: [a practical, positive advice in maximum 1 sentence to help the user experience the day successfully]\n\n🟡 Important formatting rules:\n- Each section must be on a separate line (separated by a newline character)\n- Do not write introductory or closing text\n- Do not repeat the zodiac sign or date\n- Do not use HTML, Markdown, or JSON`;

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

    for (let line of lines) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length > 0) {
        const normalizedKey = key.trim().toLowerCase()
          .replace(/ /g, '')
          .replace('moodsummary', 'mood')
          .replace('starsposition', 'starsPosition')
          .replace('dailyluckynumber', 'dailyLuckyNumber')
          .replace('luckycolor', 'luckyColor')
          .replace('dailymantra', 'dailyMantra')
          .replace('dailytip', 'dailyTip');

        result[normalizedKey] = rest.join(':').trim();
      }
    }

    res.json(result);

  } catch (error) {
    console.error('Hiba:', error);
    res.status(500).json({ error: 'Hiba történt a kérés feldolgozásakor!' });
  }
});

// Indítás
app.listen(port, () => {
  console.log(`Backend fut a http://localhost:${port} címen`);
});
