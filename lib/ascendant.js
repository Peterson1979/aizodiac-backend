// lib/ascendant.js

/**
 * PROFESSZIONÁLIS ASZCENDENS SZÁMÍTÁS
 * Swiss Ephemeris kompatibilis algoritmusok
 * 1900-2100 közötti időszakra
 */

const ZODIAC_SIGNS_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// Delta T számítás (NASA algoritmus)
function calculateDeltaT(year, month) {
  const y = year + (month - 0.5) / 12;
  let deltaT;
  
  if (year < 1900) {
    const t = (y - 1820) / 100;
    deltaT = -20 + 32 * t * t;
  } else if (year < 1920) {
    const t = (y - 1900) / 100;
    deltaT = -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * t * t * t * t;
  } else if (year < 1941) {
    const t = y - 1920;
    deltaT = 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t;
  } else if (year < 1961) {
    const t = y - 1950;
    deltaT = 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547;
  } else if (year < 1986) {
    const t = y - 1975;
    deltaT = 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718;
  } else if (year < 2005) {
    const t = y - 2000;
    deltaT = 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 
             0.000651814 * t * t * t * t + 0.00002373599 * t * t * t * t * t;
  } else if (year < 2050) {
    const t = y - 2000;
    deltaT = 62.92 + 0.32217 * t + 0.005589 * t * t;
  } else {
    deltaT = -20 + 32 * Math.pow((y - 1820) / 100, 2) - 0.5628 * (2150 - y);
  }
  
  return deltaT / 86400;
}

// Julian Day számítás
function calculateJulianDay(year, month, day, hour, minute) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  
  const JD = Math.floor(365.25 * (year + 4716)) +
             Math.floor(30.6001 * (month + 1)) +
             day + B - 1524.5;
  
  const dayFraction = (hour + minute / 60) / 24;
  
  return JD + dayFraction;
}

// GMST számítás
function calculateGMST(jd) {
  const T = (jd - 2451545.0) / 36525;
  
  let gmst = 280.46061837 + 
             360.98564736629 * (jd - 2451545.0) +
             0.000387933 * T * T -
             T * T * T / 38710000;
  
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  
  return gmst;
}

// Nutation számítás
function calculateNutation(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Omega = (450160.398036 - 6962890.5431 * T) * Math.PI / 648000;
  const Ls = (1287104.79305 + 129596581.0481 * T) * Math.PI / 648000;
  const L = (485868.249036 + 1717915923.2178 * T) * Math.PI / 648000;
  
  const nutLon = (-17.20 * Math.sin(Omega) - 1.32 * Math.sin(2 * Ls) - 
                  0.23 * Math.sin(2 * L) + 0.21 * Math.sin(2 * Omega)) / 3600;
  
  return nutLon;
}

// Obliquity számítás
function calculateObliquity(jd) {
  const T = (jd - 2451545.0) / 36525;
  const eps0 = 84381.448 - 46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T;
  return eps0 / 3600;
}

// LST számítás
function calculateLST(jd, longitude) {
  const gmst = calculateGMST(jd);
  const nutation = calculateNutation(jd);
  const obliquity = calculateObliquity(jd);
  const eqeq = nutation * Math.cos(obliquity * Math.PI / 180);
  
  let lst = gmst + longitude + eqeq;
  lst = lst % 360;
  if (lst < 0) lst += 360;
  
  return lst;
}

// Aszcendens számítás
function calculateAscendantDegree(lst, latitude, obliquity) {
  const lstRad = lst * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const oblRad = obliquity * Math.PI / 180;
  
  const tanLat = Math.tan(latRad);
  const sinObl = Math.sin(oblRad);
  const cosObl = Math.cos(oblRad);
  const sinLST = Math.sin(lstRad);
  const cosLST = Math.cos(lstRad);
  
  let asc = Math.atan2(cosLST, -(sinLST * cosObl + tanLat * sinObl));
  asc = asc * 180 / Math.PI;
  
  if (asc < 0) asc += 360;
  
  return asc;
}

// Fok -> Zodiákus jel konverzió
function degreeToZodiac(degree) {
  degree = degree % 360;
  if (degree < 0) degree += 360;
  
  const signIndex = Math.floor(degree / 30);
  const degInSign = degree % 30;
  const deg = Math.floor(degInSign);
  const min = Math.round((degInSign - deg) * 60);
  
  return {
    sign: ZODIAC_SIGNS_EN[signIndex],
    degree: deg,
    minute: min,
    display: `${deg}° ${min}' ${ZODIAC_SIGNS_EN[signIndex]}`
  };
}

// Időformátum parse (12:00 PM vagy 14:30)
function parseTime(timeStr) {
  if (!timeStr) return { hour: 12, minute: 0 };
  
  const isPM = timeStr.toUpperCase().includes('PM');
  const isAM = timeStr.toUpperCase().includes('AM');
  
  const cleanTime = timeStr.replace(/[APM\s]/gi, '');
  const [hourStr, minStr] = cleanTime.split(':');
  
  let hour = parseInt(hourStr, 10) || 12;
  const minute = parseInt(minStr, 10) || 0;
  
  if (isPM && hour !== 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  
  return { hour, minute };
}

// Dátum parse (DD/MM/YYYY)
function parseDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) throw new Error('Invalid date format');
  
  return {
    day: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    year: parseInt(parts[2], 10)
  };
}

// Időzóna becslés hosszúság alapján
function estimateTimezone(longitude) {
  return Math.round(longitude / 15);
}

// DST ellenőrzés (EU szabály 1996 után)
function isDST(year, month, day, hour, timezone) {
  if (year < 1996) return false;
  
  const marchLastSunday = getLastSundayOfMonth(year, 3);
  const octoberLastSunday = getLastSundayOfMonth(year, 10);
  
  const date = new Date(year, month - 1, day, hour);
  const marchDST = new Date(year, 2, marchLastSunday, 2);
  const octoberDST = new Date(year, 9, octoberLastSunday, 3);
  
  return date >= marchDST && date < octoberDST;
}

function getLastSundayOfMonth(year, month) {
  const lastDay = new Date(year, month, 0);
  const day = lastDay.getDate();
  const dayOfWeek = lastDay.getDay();
  return day - dayOfWeek;
}

/**
 * FŐ ASZCENDENS SZÁMÍTÁS FÜGGVÉNY
 * @param {string} dateOfBirth - DD/MM/YYYY formátum
 * @param {string} timeOfBirth - "HH:MM" vagy "HH:MM AM/PM" formátum
 * @param {number} latitude - Szélesség
 * @param {number} longitude - Hosszúság
 * @returns {string} - Aszcendens jel (pl. "Leo", "Virgo")
 */
export function calculateAscendant(dateOfBirth, timeOfBirth, latitude, longitude) {
  try {
    console.log('🔍 calculateAscendant input:', { dateOfBirth, timeOfBirth, latitude, longitude });
    
    // Dátum parse
    const { day, month, year } = parseDate(dateOfBirth);
    
    // Idő parse
    const { hour, minute } = parseTime(timeOfBirth);
    
    // Időzóna becslés
    const timezone = estimateTimezone(longitude);
    const dstOffset = isDST(year, month, day, hour, timezone) ? 1 : 0;
    
    // UTC konverzió
    const utcHour = hour - timezone - dstOffset;
    
    // Julian Day
    const jd = calculateJulianDay(year, month, day, utcHour, minute);
    const deltaT = calculateDeltaT(year, month);
    const jde = jd + deltaT;
    
    // Számítások
    const obliquity = calculateObliquity(jde);
    const lst = calculateLST(jd, longitude);
    const ascDegree = calculateAscendantDegree(lst, latitude, obliquity);
    
    // Eredmény
    const result = degreeToZodiac(ascDegree);
    
    console.log('✅ calculateAscendant result:', result.sign);
    
    return result.sign;
    
  } catch (error) {
    console.error('❌ calculateAscendant error:', error);
    return 'Generalized';
  }
}

/**
 * KOORDINÁTA LEKÉRÉS GEOCODING API-VAL
 */
export async function getCoordinatesFromLocation(location) {
  try {
    // OpenStreetMap Nominatim API (ingyenes)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AstroApp/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error('Geocoding API error');
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('Location not found');
    }
    
    const latitude = parseFloat(data[0].lat);
    const longitude = parseFloat(data[0].lon);
    
    console.log(`✅ Coordinates for "${location}":`, { latitude, longitude });
    
    return { latitude, longitude };
    
  } catch (error) {
    console.error('❌ getCoordinatesFromLocation error:', error);
    throw error;
  }
}