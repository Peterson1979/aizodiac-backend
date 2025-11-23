// lib/ascendant.js

// A 12 zodiákus jegy
const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

// Jegyek kezdőpozíciói a horoszkóp körön (fokokban)
const SIGN_STARTS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

// Egyszerűsített aszcendens számítás (forrás: "Rising Sign Calculator" algoritmusok alapján)
export function calculateAscendant(birthDateStr, birthTimeStr, latitude = 0) {
  // Dátum és idő parse-olása
  const [day, month, year] = birthDateStr.split("/").map(Number);
  const date = new Date(year, month - 1, day);

  let hour = 12, minute = 0;
  if (birthTimeStr && birthTimeStr !== "12:00 PM") {
    // Egyszerű idő parse (pl. "08:45 AM", "3:30 PM")
    const timeMatch = birthTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      const isPM = timeMatch[3]?.toUpperCase() === "PM";
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
    }
  }

  // Lokális oldalsó idő (LST) közelítése – egyszerűsített
  const utcHour = hour - (new Date().getTimezoneOffset() / 60);
  const localSiderealTime = (utcHour + 100 + (date.getDate() / 365.25) * 24) % 24;
  const lstDegrees = (localSiderealTime * 15) % 360; // 1 óra = 15 fok

  // Deklinációs korrekció a szélesség alapján
  const latRad = (latitude * Math.PI) / 180;
  const obliquity = 23.44; // Föld tengelyhajlása
  const obRad = (obliquity * Math.PI) / 180;

  // Egyszerűsített RAMC (Right Ascension of Midheaven)
  const ramc = lstDegrees;

  // Aszcendens közelítése
  const tanAsc = Math.tan((ramc * Math.PI) / 180) / Math.cos(latRad);
  let ascRadians = Math.atan(tanAsc);
  if (ramc > 90 && ramc <= 270) ascRadians += Math.PI;
  let ascDegrees = (ascRadians * 180) / Math.PI;
  if (ascDegrees < 0) ascDegrees += 360;

  // Korrekció a horoszkóp síkjára
  ascDegrees = (ascDegrees + 360) % 360;

  // Jegy meghatározása
  let signIndex = 0;
  for (let i = 0; i < 12; i++) {
    if (ascDegrees >= SIGN_STARTS[i] && ascDegrees < SIGN_STARTS[(i + 1) % 12]) {
      signIndex = i;
      break;
    }
  }

  return SIGNS[signIndex];
}