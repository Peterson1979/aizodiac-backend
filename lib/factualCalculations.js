// lib/factualCalculations.js

// ===== NUMEROLÓGIA =====
const LETTER_VALUES = {
  'A': 1, 'J': 1, 'S': 1,
  'B': 2, 'K': 2, 'T': 2,
  'C': 3, 'L': 3, 'U': 3,
  'D': 4, 'M': 4, 'V': 4,
  'E': 5, 'N': 5, 'W': 5,
  'F': 6, 'O': 6, 'X': 6,
  'G': 7, 'P': 7, 'Y': 7,
  'H': 8, 'Q': 8, 'Z': 8,
  'I': 9, 'R': 9
};

function reduceToSingleOrMaster(num) {
  if (num === 11 || num === 22 || num === 33) return num;
  while (num > 9) {
    num = num.toString().split('').reduce((sum, d) => sum + parseInt(d, 10), 0);
  }
  return num;
}

// Birthday Number: univerzális parzer
function extractBirthday(birthDate) {
  const numbers = birthDate.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 1;

  if (numbers.length >= 3) {
    const a = parseInt(numbers[0], 10);
    const b = parseInt(numbers[1], 10);
    const c = parseInt(numbers[2], 10);

    if (a > 31) {
      if (b <= 12 && c <= 31) return c;
      if (c <= 12 && b <= 31) return b;
    }
    if (a <= 31) return a;
    if (b <= 31) return b;
  }

  for (const numStr of numbers) {
    const num = parseInt(numStr, 10);
    if (num >= 1 && num <= 31) return num;
  }

  return 1;
}

export function calculateNumerology(fullName, birthDate) {
  const lifePath = reduceToSingleOrMaster(
    birthDate.replace(/[^0-9]/g, '').split('').reduce((sum, d) => sum + parseInt(d, 10), 0)
  );

  const expression = reduceToSingleOrMaster(
    fullName.toUpperCase().replace(/[^A-Z]/g, '')
      .split('').map(c => LETTER_VALUES[c] || 0)
      .reduce((sum, val) => sum + val, 0)
  );

  const vowels = 'AEIOU';
  const soulUrge = reduceToSingleOrMaster(
    fullName.toUpperCase().replace(/[^A-Z]/g, '')
      .split('').filter(c => vowels.includes(c))
      .map(c => LETTER_VALUES[c] || 0)
      .reduce((sum, val) => sum + val, 0)
  );

  const personality = reduceToSingleOrMaster(
    fullName.toUpperCase().replace(/[^A-Z]/g, '')
      .split('').filter(c => !vowels.includes(c))
      .map(c => LETTER_VALUES[c] || 0)
      .reduce((sum, val) => sum + val, 0)
  );

  const birthday = extractBirthday(birthDate);

  return { lifePath, expression, soulUrge, personality, birthday };
}

// ===== ÉLETÚT SZÁM (kompatibilitás miatt) =====
export function calculateLifePathNumber(dateOfBirth) {
  const digits = dateOfBirth.replace(/\D/g, '').split('').map(Number);
  const sumDigits = (arr) => arr.reduce((a, b) => a + b, 0);
  let total = sumDigits(digits);
  while (total > 9 && ![11, 22, 33].includes(total)) {
    total = sumDigits(total.toString().split('').map(Number));
  }
  return total;
}

// ===== ASCENDANT (approx) =====
export function approximateAscendant(sunSign, hour = 12) {
  const signs = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const sunIndex = signs.indexOf(sunSign);
  return signs[(sunIndex + Math.floor(hour/2)) % 12];
}