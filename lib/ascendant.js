// lib/ascendant.js
/**
 * Aszcendens (Rising Sign) – Swiss Ephemeris-kompatibilis számítás
 * Támogatja: magyar időformátumot ("10:15 de."), globális helyeket, UTC időzóna-konverziót
 */

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

/**
 * Julián dátum számítása (UTC alapú)
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
 * Helyi csillagidő (LST) fokban – pontosabb GMST képlettel
 */
function calculateLocalSiderealTime(jd, longitude) {
  const T = (jd - 2451545.0) / 36525;
  let GMST = 280.46061837 +
             360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T -
             (T * T * T) / 38710000;
  GMST = ((GMST % 360) + 360) % 360;
  let LST = GMST + longitude;
  return ((LST % 360) + 360) % 360;
}

/**
 * ✅ SWISS EPHEMERIS KÉPLET – PONTOS ASCENDENS
 */
function calculateAscendantDegree(lst, latitude) {
  const obliquity = 23.43929111; // IAU 2006 érték
  const e = (obliquity * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const ramc = (lst * Math.PI) / 180;

  const numerator = Math.sin(ramc) * Math.cos(e) + Math.tan(lat) * Math.sin(e);
  const denominator = Math.cos(ramc);
  const tanAsc = numerator / denominator;

  let asc = Math.atan(tanAsc);

  if (ramc < Math.PI) {
    asc += Math.PI;
  }

  asc = ((asc * 180) / Math.PI + 360) % 360;
  return asc;
}

/**
 * Nominatim geocoding – megfelelő User-Agent-gel és helyes URL-lel
 */
export async function getCoordinatesFromLocation(place) {
  if (!place || !place.trim()) {
    throw new Error("Place is empty");
  }
  // ✅ Javítva: ELTÁVOLÍTVA a felesleges szóköz a q= után
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
 * Fő függvény – támogatja a magyar "de." / "du." formátumot
 */
export function calculateAscendant(birthDate, birthTime, latitude, longitude, timezoneOffset = 0) {
  const [day, month, year] = birthDate.split("/").map(Number);
  if (![day, month, year].every(n => !isNaN(n))) {
    throw new Error("Invalid birth date format (expected DD/MM/YYYY)");
  }

  // ⭐⭐ TÁMOGATJA a magyar "10:15 de." és "3:30 du." formátumot
  let hour = 12, minute = 0;
  if (birthTime && birthTime !== "12:00 PM") {
    // Magyar formátum
    const hungarianMatch = birthTime.trim().match(/(\d{1,2}):(\d{2})\s*(de\.|du\.)/i);
    if (hungarianMatch) {
      hour = parseInt(hungarianMatch[1], 10);
      minute = parseInt(hungarianMatch[2], 10);
      const isDu = hungarianMatch[3].toLowerCase().startsWith("du");
      if (isDu && hour !== 12) hour += 12;
      if (!isDu && hour === 12) hour = 0;
    } else {
      // Angol / 24 órás formátum
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
  }

  // Manuális UTC konverzió anélkül, hogy new Date() időzónát rontana
  let utcHour = hour - timezoneOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  while (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
  }
  while (utcHour >= 24) {
    utcHour -= 24;
    utcDay += 1;
  }

  const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (isLeap(utcYear)) daysInMonth[1] = 29;

  while (utcDay < 1) {
    utcMonth--;
    if (utcMonth < 1) {
      utcMonth = 12;
      utcYear--;
    }
    const prev = (utcMonth - 1 + 12) % 12;
    utcDay += daysInMonth[prev];
    if (isLeap(utcYear)) daysInMonth[1] = 29;
  }

  let curDays = (isLeap(utcYear) && utcMonth === 2) ? 29 : daysInMonth[(utcMonth - 1) % 12];
  while (utcDay > curDays) {
    utcDay -= curDays;
    utcMonth++;
    if (utcMonth > 12) {
      utcMonth = 1;
      utcYear++;
    }
    curDays = (isLeap(utcYear) && utcMonth === 2) ? 29 : daysInMonth[(utcMonth - 1) % 12];
  }

  const jd = calculateJulianDate(utcYear, utcMonth, utcDay, utcHour, minute);
  const lst = calculateLocalSiderealTime(jd, longitude);
  const ascDegree = calculateAscendantDegree(lst, latitude);
  const signIndex = Math.floor(ascDegree / 30) % 12;
  return SIGNS[signIndex];
}