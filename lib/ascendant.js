// lib/ascendant.js
/**
 * Aszcendens (Rising Sign) Precíziós Kalkulátor – AI Zodiac App számára
 * Alap: Swiss Ephemeris-kompatibilis képlet (swe-asc)
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
  let GMST = 18.697374558 + 24.06570982441908 * (jd - 2451545.0);
  GMST = GMST % 24;
  if (GMST < 0) GMST += 24;
  const LST = GMST + longitude / 15; // longitude fokban → órában
  return (LST * 15) % 360; // vissza fokba
}

/**
 * ✅ JAVÍTOTT ASCENDENS FOK SZÁMÍTÁS – Swiss Ephemeris stílusban
 */
function calculateAscendantDegree(lst, latitude) {
  const obliquity = 23.43929111; // pontosabb érték
  const e = (obliquity * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const ramc = (lst * Math.PI) / 180;

  // tan(asc) = - (cos RAMC + sin RAMC * cos e * tan lat) / sin e
  const tanAsc = -(Math.cos(ramc) + Math.sin(ramc) * Math.cos(e) * Math.tan(lat)) / Math.sin(e);
  let asc = Math.atan(tanAsc);

  // Korrekció a kvadránsra
  if (ramc < Math.PI) {
    asc += Math.PI;
  }
  if (asc < 0) asc += 2 * Math.PI;
  return (asc * 180) / Math.PI;
}

/**
 * Koordináta lekérdezése OpenStreetMap Nominatim API-val
 */
export async function getCoordinatesFromLocation(place) {
  if (!place || !place.trim()) {
    throw new Error("Place is empty");
  }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.trim())}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AI Zodiac/1.0 (contact@aizodiac.app)"
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
 */
export function calculateAscendant(birthDate, birthTime, latitude, longitude, timezoneOffset = 0) {
  const [day, month, year] = birthDate.split("/").map(Number);
  if (![day, month, year].every(n => !isNaN(n))) {
    throw new Error("Invalid birth date format (expected DD/MM/YYYY)");
  }

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
      const [h, m] = birthTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        hour = h;
        minute = m;
      }
    }
  }

  // 🟢 JAVÍTÁS: UTC konverzió NÉLKÜL JavaScript Date használatával
  let utcHour = hour - timezoneOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  // Óra normalizálás
  while (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
  }
  while (utcHour >= 24) {
    utcHour -= 24;
    utcDay += 1;
  }

  // Nap/hó/év korrekció (egyszerűsített)
  const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  function isLeap(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
  if (isLeap(utcYear)) daysInMonth[1] = 29;

  while (utcDay < 1) {
    utcMonth--;
    if (utcMonth < 1) {
      utcMonth = 12;
      utcYear--;
    }
    const prevMonth = (utcMonth - 1 + 12) % 12;
    utcDay += daysInMonth[prevMonth];
    daysInMonth[1] = isLeap(utcYear) ? 29 : 28;
  }

  daysInMonth[1] = isLeap(utcYear) ? 29 : 28;
  let curMonthDays = daysInMonth[(utcMonth - 1) % 12];
  while (utcDay > curMonthDays) {
    utcDay -= curMonthDays;
    utcMonth++;
    if (utcMonth > 12) {
      utcMonth = 1;
      utcYear++;
    }
    daysInMonth[1] = isLeap(utcYear) ? 29 : 28;
    curMonthDays = daysInMonth[(utcMonth - 1) % 12];
  }

  // ✅ Most már tisztán UTC komponensek
  const jd = calculateJulianDate(utcYear, utcMonth, utcDay, utcHour, minute);
  const lst = calculateLocalSiderealTime(jd, longitude);
  const ascDegree = calculateAscendantDegree(lst, latitude);
  const signIndex = Math.floor(ascDegree / 30) % 12;
  return SIGNS[signIndex];
}
