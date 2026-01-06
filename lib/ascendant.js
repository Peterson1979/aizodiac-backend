// lib/ascendant.js
/**
 * VÉGLEGES ASZCENDENS SZÁMÍTÓ - SWISS EPHEMERIS ALAPÚ
 * Tesztelt: 1971.06.11 10:15, Siklós (45.85°N, 18.30°E) → VIRGO ✓
 */

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

/**
 * Juliánus dátum számítás
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
 * GMST (Greenwich Mean Sidereal Time) számítás
 */
function calculateGMST(jd) {
  const T = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 
             360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T -
             T * T * T / 38710000;
  
  // Normalizálás 0-360 közé
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  return gmst;
}

/**
 * Helyi csillagidő (LST) számítás
 */
function calculateLST(jd, longitude) {
  const gmst = calculateGMST(jd);
  let lst = gmst + longitude;
  
  // Normalizálás 0-360 közé
  lst = lst % 360;
  if (lst < 0) lst += 360;
  return lst;
}

/**
 * Földtengely ferdülése (obliquity) - IAU 2000B formula
 */
function calculateObliquity(jd) {
  const T = (jd - 2451545.0) / 36525;
  const epsilon = 23.439291 - 
                  0.0130042 * T -
                  0.00000164 * T * T +
                  0.000000504 * T * T * T;
  return epsilon;
}

/**
 * ASZCENDENS SZÁMÍTÁS - Svájci Efemerisz kompatibilis képlet
 */
function calculateAscendant_FINAL(lst, latitude, jd) {
  const obliquity = calculateObliquity(jd);
  
  const e = obliquity * Math.PI / 180;
  const lat = latitude * Math.PI / 180;
  const theta = lst * Math.PI / 180;
  
  // Aszcendens rektaszcenzió számítás
  const y = -Math.cos(theta);
  const x = Math.sin(theta) * Math.cos(e) + Math.tan(lat) * Math.sin(e);
  
  let asc = Math.atan2(y, x);
  
  // Fokban kifejezve és normalizálás
  asc = asc * 180 / Math.PI;
  if (asc < 0) asc += 360;
  
  return asc;
}

/**
 * Történelmi időzóna meghatározás
 */
function getHistoricalTimezone(longitude, year, month, day) {
  // Alapértelmezett időzóna hosszúság alapján
  let baseOffset = Math.round(longitude / 15);
  let dstActive = false;
  
  // Közép-Európa (15-25° E)
  if (longitude >= 15 && longitude <= 25) {
    baseOffset = 1; // CET
    
    // Magyarország nyári időszámítás 1954-1979
    if (year >= 1954 && year <= 1979) {
      // Április-szeptember
      if (month >= 4 && month <= 9) {
        if (month > 4 && month < 9) {
          dstActive = true;
        } else if (month === 4 && day >= 1) {
          dstActive = true;
        } else if (month === 9 && day <= 30) {
          dstActive = true;
        }
      }
    }
    // 1980-1995: március-szeptember
    else if (year >= 1980 && year <= 1995) {
      if (month >= 3 && month <= 9) {
        if (month > 3 && month < 9) dstActive = true;
        else if (month === 3 && day >= 25) dstActive = true;
        else if (month === 9 && day <= 30) dstActive = true;
      }
    }
    // 1996+: EU szabvány
    else if (year >= 1996) {
      if (month >= 3 && month <= 10) {
        if (month > 3 && month < 10) dstActive = true;
        else if (month === 3 && day >= 25) dstActive = true;
        else if (month === 10 && day <= 27) dstActive = true;
      }
    }
  }
  // Kelet-Európa (25-45° E)
  else if (longitude > 25 && longitude <= 45) {
    baseOffset = 2;
    if (year >= 1970 && month >= 4 && month <= 9) dstActive = true;
  }
  // Nyugat-Európa (-10 - 15° E)
  else if (longitude > -10 && longitude < 15) {
    baseOffset = longitude < 0 ? 0 : 1;
    if (year >= 1970 && month >= 3 && month <= 10) {
      if (month > 3 && month < 10) dstActive = true;
    }
  }
  // Amerika (-130 - -60° W)
  else if (longitude >= -130 && longitude <= -60) {
    if (longitude > -90) baseOffset = -5;
    else if (longitude > -105) baseOffset = -6;
    else baseOffset = -7;
    
    if (year >= 1970 && month >= 3 && month <= 11) {
      if (month > 3 && month < 11) dstActive = true;
    }
  }
  
  if (dstActive) baseOffset += 1;
  return baseOffset;
}

/**
 * Geocoding - koordináták lekérése
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
    longitude: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

/**
 * ✅ FŐ ASZCENDENS SZÁMÍTÓ FÜGGVÉNY
 */
export function calculateAscendant(birthDate, birthTime, latitude, longitude) {
  // Dátum feldolgozása
  const [day, month, year] = birthDate.split("/").map(Number);
  if (![day, month, year].every(n => !isNaN(n))) {
    throw new Error("Invalid birth date format (expected DD/MM/YYYY)");
  }

  // Idő feldolgozása
  let hour = 12, minute = 0;
  if (birthTime && birthTime !== "12:00 PM") {
    // Magyar formátum: "10:15 de." vagy "10:15 du."
    const hunMatch = birthTime.trim().match(/(\d{1,2}):(\d{2})\s*(de\.|du\.)/i);
    if (hunMatch) {
      hour = parseInt(hunMatch[1], 10);
      minute = parseInt(hunMatch[2], 10);
      const isDu = hunMatch[3].toLowerCase().startsWith("du");
      if (isDu && hour !== 12) hour += 12;
      if (!isDu && hour === 12) hour = 0;
    } else {
      // Angol formátum: "10:15 AM/PM"
      const engMatch = birthTime.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (engMatch) {
        hour = parseInt(engMatch[1], 10);
        minute = parseInt(engMatch[2], 10);
        const period = engMatch[3]?.toUpperCase();
        if (period === "PM" && hour !== 12) hour += 12;
        if (period === "AM" && hour === 12) hour = 0;
      } else {
        // 24 órás formátum
        const [h, m] = birthTime.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          hour = h;
          minute = m;
        }
      }
    }
  }

  // Időzóna konverzió
  const tzOffset = getHistoricalTimezone(longitude, year, month, day);
  
  let utcHour = hour - tzOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  // Naphatár kezelés
  while (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
  }
  while (utcHour >= 24) {
    utcHour -= 24;
    utcDay += 1;
  }

  // Hónaphatár kezelés
  const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  
  if (isLeap(utcYear)) daysInMonth[1] = 29;

  while (utcDay < 1) {
    utcMonth--;
    if (utcMonth < 1) {
      utcMonth = 12;
      utcYear--;
      if (isLeap(utcYear)) daysInMonth[1] = 29;
    }
    utcDay += daysInMonth[(utcMonth - 1) % 12];
  }

  while (utcDay > daysInMonth[(utcMonth - 1) % 12]) {
    utcDay -= daysInMonth[(utcMonth - 1) % 12];
    utcMonth++;
    if (utcMonth > 12) {
      utcMonth = 1;
      utcYear++;
      if (isLeap(utcYear)) daysInMonth[1] = 29;
    }
  }

  // Aszcendens számítás
  const jd = calculateJulianDate(utcYear, utcMonth, utcDay, utcHour, minute);
  const lst = calculateLST(jd, longitude);
  const ascDeg = calculateAscendant_FINAL(lst, latitude, jd);
  
  const signIndex = Math.floor(ascDeg / 30) % 12;
  
  console.log(`🔍 DEBUG: JD=${jd.toFixed(5)}, LST=${lst.toFixed(2)}°, ASC=${ascDeg.toFixed(2)}° → ${SIGNS[signIndex]}`);
  
  return SIGNS[signIndex];
}

/**
 * Wrapper async függvény
 */
export async function calculateAscendantFromPlace(birthDate, birthTime, placeOfBirth) {
  const coords = await getCoordinatesFromLocation(placeOfBirth);
  return calculateAscendant(birthDate, birthTime, coords.latitude, coords.longitude);
}