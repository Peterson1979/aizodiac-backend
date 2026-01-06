// lib/ascendant.js
/**
 * Aszcendens (Rising Sign) – Globális verzió
 * Minden országra működik automatikus időzóna felismeréssel
 */

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

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

function calculateAscendantDegree(lst, latitude) {
  const obliquity = 23.43929111;
  const e = obliquity * Math.PI / 180;
  const lat = latitude * Math.PI / 180;
  const ramc = lst * Math.PI / 180;

  const sinAsc = Math.sin(ramc) * Math.cos(e) + Math.tan(lat) * Math.sin(e);
  const cosAsc = Math.cos(ramc);

  let asc = Math.atan2(sinAsc, cosAsc);
  if (asc < 0) asc += 2 * Math.PI;
  return (asc * 180) / Math.PI;
}

/**
 * Időzóna meghatározás koordináták alapján
 * Közelítő algoritmus hosszúsági fok alapján + történelmi korrekció
 */
function getTimezoneFromCoordinates(longitude, year, month, day) {
  // Alapértelmezett időzóna hosszúság alapján (15° = 1 óra)
  let baseOffset = Math.round(longitude / 15);
  
  // Óceán közepén? Használjuk az alapértelmezett számítást
  // De finomhangolás szükséges kontinensek esetén
  
  // Történelmi nyári időszámítás közelítés (északi félteke, 1970 után)
  let dstActive = false;
  if (year >= 1970 && month >= 3 && month <= 10) {
    // Északi félteke: március-október között általában nyári idő
    if (longitude > -130 && longitude < 50) { // Európa, Amerika
      if (month > 3 && month < 10) dstActive = true;
      if (month === 3 && day >= 25) dstActive = true;
      if (month === 10 && day < 25) dstActive = true;
    }
  }
  
  // Finomhangolás régiók szerint
  if (longitude >= 15 && longitude <= 25) {
    // Közép-Európa (Németország, Lengyelország, Magyarország, stb.)
    baseOffset = 1;
  } else if (longitude > 25 && longitude <= 45) {
    // Kelet-Európa (Románia, Ukrajna, Finnország)
    baseOffset = 2;
  } else if (longitude > -10 && longitude < 15) {
    // Nyugat-Európa (UK, Franciaország, Spanyolország)
    baseOffset = longitude < 0 ? 0 : 1;
  } else if (longitude >= -130 && longitude <= -60) {
    // Amerika (USA, Kanada)
    if (longitude > -90) baseOffset = -5; // Keleti part
    else if (longitude > -105) baseOffset = -6; // Központ
    else baseOffset = -7; // Nyugati rész
  }
  
  // Nyári időszámítás hozzáadása
  if (dstActive) baseOffset += 1;
  
  return baseOffset;
}

/**
 * Geocoding API - koordináták és időzóna lekérése
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
  
  const latitude = parseFloat(data[0].lat);
  const longitude = parseFloat(data[0].lon);
  
  return {
    latitude,
    longitude,
    displayName: data[0].display_name
  };
}

/**
 * Időzóna lekérése TimeZoneDB API-val (opcionális, pontosabb)
 * Ha nem elérhető, visszatér koordináta-alapú becsléssel
 */
async function getTimezoneFromAPI(latitude, longitude, timestamp) {
  try {
    // TimeZoneDB ingyenes API (ha van API key)
    // Alternatíva: használj koordináta alapú becslést
    const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("Timezone API failed");
    
    const data = await response.json();
    return data.currentUtcOffset?.hours || 0;
  } catch (error) {
    // Fallback: koordináta alapú becslés
    console.warn("Timezone API unavailable, using coordinate approximation");
    return null;
  }
}

export async function calculateAscendant(birthDate, birthTime, latitude, longitude, year, month, day) {
  // Dátum feldolgozása
  const [dayNum, monthNum, yearNum] = birthDate.split("/").map(Number);
  if (![dayNum, monthNum, yearNum].every(n => !isNaN(n))) {
    throw new Error("Invalid birth date format (expected DD/MM/YYYY)");
  }

  // Idő feldolgozása
  let hour = 12, minute = 0;
  if (birthTime && birthTime !== "12:00 PM") {
    // Magyar formátum: "10:15 de." vagy "10:15 du."
    const hungarianMatch = birthTime.trim().match(/(\d{1,2}):(\d{2})\s*(de\.|du\.)/i);
    if (hungarianMatch) {
      hour = parseInt(hungarianMatch[1], 10);
      minute = parseInt(hungarianMatch[2], 10);
      const isDu = hungarianMatch[3].toLowerCase().startsWith("du");
      if (isDu && hour !== 12) hour += 12;
      if (!isDu && hour === 12) hour = 0;
    } else {
      // Angol formátum: "10:15 AM" vagy "10:15 PM"
      const timeMatch = birthTime.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
        const period = timeMatch[3]?.toUpperCase();
        if (period === "PM" && hour !== 12) hour += 12;
        if (period === "AM" && hour === 12) hour = 0;
      } else {
        // 24 órás formátum: "10:15"
        const [h, m] = birthTime.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          hour = h;
          minute = m;
        }
      }
    }
  }

  // Időzóna meghatározás
  const timezoneOffset = getTimezoneFromCoordinates(longitude, yearNum, monthNum, dayNum);
  
  // UTC időre konvertálás
  let utcHour = hour - timezoneOffset;
  let utcDay = dayNum;
  let utcMonth = monthNum;
  let utcYear = yearNum;

  // Nap alatti átlépés kezelése
  while (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
  }
  while (utcHour >= 24) {
    utcHour -= 24;
    utcDay += 1;
  }

  // Hónap/év átlépés kezelése
  const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (isLeap(utcYear)) daysInMonth[1] = 29;

  while (utcDay < 1) {
    utcMonth--;
    if (utcMonth < 1) {
      utcMonth = 12;
      utcYear--;
      if (isLeap(utcYear)) daysInMonth[1] = 29;
    }
    const prevMonthDays = daysInMonth[(utcMonth - 1) % 12];
    utcDay += prevMonthDays;
  }

  let curDays = daysInMonth[(utcMonth - 1) % 12];
  if (isLeap(utcYear) && utcMonth === 2) curDays = 29;
  
  while (utcDay > curDays) {
    utcDay -= curDays;
    utcMonth++;
    if (utcMonth > 12) {
      utcMonth = 1;
      utcYear++;
      if (isLeap(utcYear)) daysInMonth[1] = 29;
    }
    curDays = daysInMonth[(utcMonth - 1) % 12];
    if (isLeap(utcYear) && utcMonth === 2) curDays = 29;
  }

  // Aszcendens számítás
  const jd = calculateJulianDate(utcYear, utcMonth, utcDay, utcHour, minute);
  const lst = calculateLocalSiderealTime(jd, longitude);
  const ascDegree = calculateAscendantDegree(lst, latitude);
  const signIndex = Math.floor(ascDegree / 30) % 12;
  
  return SIGNS[signIndex];
}