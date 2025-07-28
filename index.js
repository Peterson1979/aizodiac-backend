const express = require('express');
const dotenv = require('dotenv');
dotenv.config(); // Betölti a .env fájl tartalmát (ha van)

const app = express();
const port = process.env.PORT || 3000;

// Middleware a JSON adatok kezeléséhez
app.use(express.json());

// Segédfüggvény a fetch hívásokhoz (dynamic import miatt)
async function fetchData(url, options) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, options);
  return response;
}

app.get('/horoscope', async (req, res) => {
  const sign = req.query.sign;
  const date = req.query.date; // Példa: "2024-10-27"

  if (!sign || !date) {
    return res.status(400).json({ error: 'Csillagjegy és dátum megadása kötelező!' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nincs beállítva!' });
  }

  // Gemini API hívás
  const geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey; //Cseréld le a saját API endpoint-oddal, ha szükséges!
  const prompt = `Készíts egy napi horoszkópot a ${sign} csillagjegyben született felhasználó számára a ${date} napra. A horoszkóp legyen vidám, és tartalmazzon szerelemre, munkára, egészségre és pénzre vonatkozó előrejelzéseket.`;

  try {
    const response = await fetchData(geminiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Itt formázhatod a Gemini API válaszát, ha szükséges
      const horoscope = data.candidates[0].content.parts[0].text;
      res.json({ horoscope });
    } else {
      console.error('Gemini API hiba:', data);
      res.status(500).json({ error: 'Hiba a Gemini API hívásakor!' });
    }
  } catch (error) {
    console.error('Hiba:', error);
    res.status(500).json({ error: 'Hiba történt a kérés feldolgozásakor!' });
  }
});

app.listen(port, () => {
  console.log(`Backend fut a http://localhost:${port} címen`);
});