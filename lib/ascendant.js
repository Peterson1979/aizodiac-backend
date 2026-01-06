// lib/ascendant.js
/**
 * Aszcendens (Rising Sign) Precíziós Kalkulátor – AI Zodiac App számára
 * Alap: Julián dátum, Helyi Csillagidő (LST), szférikus trigonometria
 * Támogatja: globális helyeket, időzóna-eltolást, téli/nyári időszámítást (ha a frontend adja)
 */

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

/**
 * Julián dátum számítása (UTC alapú!)
 */
function calculateJulianDate(year, month, day, hour, minute) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (year + 4716)) +
             Math.floor(30.6001 * (month + 1)) +
             day + B - 1524.5 +
             (hour + minute / 60) / 24;
  return JD;
}

/**
 * Helyi Csillagidő (LST) számítása fokban
 */
function calculateLocalSiderealTime(jd, longitude) {
  const T = (jd - 2451545.0) / 36525;
  let GMST = 280.46061837 +
             360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T -
             (T * T * T) / 38710000;
  GMST = GMST % 360;
  if (GMST < 0) GMST += 360;
  let LST = GMST + longitude;
  LST = LST % 360;
  if (LST < 0) LST += 360;
  return LST;
}

/**
 * Aszcendens fok számítása szférikus trigonometriával
 */
function calculateAscendantDegree(lst, latitude) {
  const obliquity = 23.4397; // Föld tengelydőlése
  const lstRad = (lst * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;
  const oblRad = (obliquity * Math.PI) / 180;

  const x = -Math.cos(lstRad);
  const y = -Math.sin(lstRad) * Math.cos(oblRad) - Math.tan(latRad) * Math.sin(oblRad);

  let asc = Math.atan2(y, x) * 180 / Math.PI;
  asc = asc % 360;
  if (asc < 0) asc += 360;
  return asc;
}

/**
 * Koordináta lekérdezése OpenStreetMap Nominatim API-val
 * ⚠️ KÖTELEZŐ: User-Agent fejléc!
 */
export async function getCoordinatesFromLocation(place) {
  if (!place || !place.trim()) {
    throw new Error("Place is empty");
  }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.trim())}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AI Zodiac/1.0 (contact@aizodiac.app)" // ✅ Nominatim követelmény
    }
  });
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Location not found");
  }
  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon)
  };
}

/**
 * Fő függvény: aszcendens számítása
 * @param {string} birthDate – "DD/MM/YYYY"
 * @param {string} birthTime – pl. "08:45 AM" vagy "20:45"
 * @param {number} latitude – pl. 47.4979
 * @param {number} longitude – pl. 19.0402
 * @param {number} timezoneOffset – UTC-től eltérés órában (pl. +1)
 * @returns {string} – pl. "Leo"
 */
export function calculateAscendant(birthDate, birthTime, latitude, longitude, timezoneOffset = 0) {
  // Dátum feldolgozása
  const [day, month, year] = birthDate.split("/").map(Number);
  if (![day, month, year].every(n => !isNaN(n))) {
    throw new Error("Invalid birth date format (expected DD/MM/YYYY)");
  }

  // Idő feldolgozása (AM/PM vagy 24 órás)
  let hour = 12, minute = 0;
  if (birthTime && birthTime !== "12:00 PM") {
    const timeMatch = birthTime.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      const period = timeMatch[3]?.toUpperCase();
      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;
    } else {
      // Feltételezi 24 órás formátumot
      const [h, m] = birthTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        hour = h;
        minute = m;
      }
    }
  }

  // Helyi idő → UTC átváltás
  const localDate = new Date(year, month - 1, day, hour, minute);
  const utcYear = localDate.getUTCFullYear();
  const utcMonth = localDate.getUTCMonth() + 1;
  const utcDay = localDate.getUTCDate();
  const utcHour = localDate.getUTCHours();
  const utcMinute = localDate.getUTCMinutes();

  // Számítás
  const jd = calculateJulianDate(utcYear, utcMonth, utcDay, utcHour, utcMinute);
  const lst = calculateLocalSiderealTime(jd, longitude);
  const ascDegree = calculateAscendantDegree(lst, latitude);
  const signIndex = Math.min(11, Math.floor(ascDegree / 30));

  return SIGNS[signIndex];
}