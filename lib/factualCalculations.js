// lib/factualCalculations.js

// --- Life Path Number (determinisztikus) ---
export function calculateLifePathNumber(dateOfBirth) {
  const digits = dateOfBirth.replace(/\D/g, '').split('').map(Number);
  const sumDigits = (arr) => arr.reduce((a, b) => a + b, 0);
  let total = sumDigits(digits);
  while (total > 9) total = sumDigits(total.toString().split('').map(Number));
  return total;
}

// --- Ascendant (approximate) ---
export function approximateAscendant(sunSign, hour = 12) {
  const signs = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const sunIndex = signs.indexOf(sunSign);
  return signs[(sunIndex + Math.floor(hour/2)) % 12];
}

// --- Chinese Zodiac ---
export function getChineseZodiac(year) {
  const animals = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
  const elements = ["Wood","Fire","Earth","Metal","Water"];
  const yinYang = ["Yang","Yin"];
  const animal = animals[(year - 4) % 12];
  const element = elements[(year - 4) % 10 % 5];
  const yy = yinYang[(year - 4) % 2];
  return { animal, element, yinYang: yy, symbol: `${element} ${animal}` };
}

// --- Chinese Zodiac FULL (DD/MM/YYYY formátumhoz) ---
// factualCalculations.js
export function getChineseZodiac_FULL(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) throw new Error("Invalid date");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  // Kínai újév dátuma 1971-ben: február 15.
  if (month < 2 || (month === 2 && day < 15)) {
    // 1971. január 1 – február 14 → még 1970-es év (Kutya)
    return getChineseZodiac(1970);
  }
  return getChineseZodiac(year);
}