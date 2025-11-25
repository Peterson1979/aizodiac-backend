// lib/chineseZodiac.js
const { cnyDates } = require("./cnyDates.js");

// Magyar állatnevek (pontos sorrend! Ugyanaz, mint az angol animals tömb)
const ANIMALS_HU = [
  "Majom", "Tyúk", "Kutya", "Disznó", "Egér", "Bika",
  "Tigris", "Nyúl", "Sárkány", "Kígyó", "Ló", "Bárány"
];

// Angol állatnevek (1900 = Majom, Yang)
const ANIMALS_EN = [
  "Monkey", "Rooster", "Dog", "Pig", "Rat", "Ox",
  "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat"
];

// Emoji-k (ugyanabban a sorrendben)
const EMOJIS = [
  "🐒", "🐓", "🐕", "🐖", "🐀", "🐂",
  "🐅", "🐇", "🐉", "🐍", "🐎", "🐐"
];

// Elemek magyarul
const ELEMENTS_HU = {
  "Wood": "Fa",
  "Fire": "Tűz",
  "Earth": "Föld",
  "Metal": "Fém",
  "Water": "Víz"
};

function getChineseZodiac_FULL(dateStr) {
  // Dátum feldolgozás: "DD/MM/YYYY"
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error("Invalid date format. Expected DD/MM/YYYY");
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  // ISO dátum létrehozása
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const birthDate = new Date(isoDate);
  if (isNaN(birthDate.getTime())) {
    throw new Error("Invalid date");
  }

  // Kínai újév dátuma az adott évben
  let cnyDateStr = cnyDates[year];
  if (!cnyDateStr) {
    // Ha nincs a táblázatban, próbáljuk meg az előző/ következő évet
    if (cnyDates[year - 1]) {
      cnyDateStr = cnyDates[year - 1];
    } else if (cnyDates[year + 1]) {
      cnyDateStr = cnyDates[year + 1];
      year++; // mert már túl vagyunk a CNY-n
    } else {
      throw new Error(`Year ${year} not supported in CNY table`);
    }
  }

  const cnyDate = new Date(cnyDateStr);
  if (birthDate < cnyDate) {
    year--; // még az előző kínai év
  }

  // Kínai jegy kiszámolása (1900 = Majom, Yang)
  const animalIndex = (year - 1900) % 12;
  if (animalIndex < 0) animalIndex += 12;

  const animalEn = ANIMALS_EN[animalIndex];
  const animalHu = ANIMALS_HU[animalIndex];
  const symbol = EMOJIS[animalIndex];

  // Elem: 2 évenként vált (1900 = Metal, de a ciklus 1900-ban Yang Metal → 1901 Yin Metal, 1902 Yang Water, stb.)
  // A kínai elem ciklus 10 éves: 0=Yang Metal, 1=Yin Metal, 2=Yang Water, 3=Yin Water, ...
  const elementCycle = (year - 1900) % 10;
  const elementBase = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  const elementEn = elementBase[elementCycle] || "Earth";
  const elementHu = ELEMENTS_HU[elementEn] || "Föld";

  // Yin/Yang: páros ciklusindex = Yang, páratlan = Yin
  const yy = (elementCycle % 2 === 0) ? "Yang" : "Yin";

  return {
    symbol,
    animal: animalHu,        // ← MAGYARUL!
    element: elementHu,      // ← MAGYARUL, "Föld", nem "Fö ld"
    yinYang: yy
  };
}

module.exports = { getChineseZodiac_FULL };