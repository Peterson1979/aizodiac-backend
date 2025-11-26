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

// ✅ EGYSZERŰ Birthday Number: csak az első számot használjuk, ha 1-31 között van
function extractBirthday(birthDate) {
  // Csak a számokat kérjük le
  const numbers = birthDate.match(/\d+/g);
  if (!numbers) return 1;

  // Az első számot használjuk
  const firstNumber = parseInt(numbers[0], 10);
  if (firstNumber >= 1 && firstNumber <= 31) {
    return firstNumber;
  }

  return 1;
}

export function calculateNumerology(fullName, birthDate) {
  // Life Path Number
  const lifePath = reduceToSingleOrMaster(
    birthDate.replace(/[^0-9]/g, '').split('').reduce((sum, d) => sum + parseInt(d, 10), 0)
  );

  // Expression Number
  const expression = reduceToSingleOrMaster(
    fullName.toUpperCase().replace(/[^A-Z]/g, '')
      .split('').map(c => LETTER_VALUES[c] || 0)
      .reduce((sum, val) => sum + val, 0)
  );

  // Soul Urge (magánhangzók: A, E, I, O, U)
  const vowels = 'AEIOU';
  const soulUrge = reduceToSingleOrMaster(
    fullName.toUpperCase().replace(/[^A-Z]/g, '')
      .split('').filter(c => vowels.includes(c))
      .map(c => LETTER_VALUES[c] || 0)
      .reduce((sum, val) => sum + val, 0)
  );

  // Personality Number (mássalhangzók)
  const personality = reduceToSingleOrMaster(
    fullName.toUpperCase().replace(/[^A-Z]/g, '')
      .split('').filter(c => !vowels.includes(c))
      .map(c => LETTER_VALUES[c] || 0)
      .reduce((sum, val) => sum + val, 0)
  );

  // Birthday Number
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