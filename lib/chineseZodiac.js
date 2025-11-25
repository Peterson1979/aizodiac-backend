// lib/chineseZodiac.js

import { cnyDates } from "./cnyDates.js";

// Magyar állatnevek
const ANIMALS_HU = [
  "Majom", "Tyúk", "Kutya", "Disznó", "Egér", "Bika",
  "Tigris", "Nyúl", "Sárkány", "Kígyó", "Ló", "Bárány"
];

// Emoji-k (1900 = Majom)
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

export function getChineseZodiac_FULL(dateStr) {
  // Dátum feldolgozás
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error("Invalid date format. Expected DD/MM/YYYY");
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const birthDate = new Date(isoDate);
  if (isNaN(birthDate.getTime())) {
    throw new Error("Invalid date");
  }

  // Kínai újév
  let cnyDateStr = cnyDates[year];
  if (!cnyDateStr) {
    if (cnyDates[year - 1]) cnyDateStr = cnyDates[year - 1];
    else if (cnyDates[year + 1]) {
      cnyDateStr = cnyDates[year + 1];
      year++;
    } else throw new Error(`Year ${year} not supported`);
  }

  const cnyDate = new Date(cnyDateStr);
  if (birthDate < cnyDate) year--;

  const animalIndex = (year - 1900) % 12;
  if (animalIndex < 0) animalIndex += 12;

  const animalHu = ANIMALS_HU[animalIndex];
  const symbol = EMOJIS[animalIndex];

  const elementCycle = (year - 1900) % 10;
  const elementBase = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  const elementEn = elementBase[elementCycle] || "Earth";
  const elementHu = ELEMENTS_HU[elementEn] || "Föld";

  const yinYang = (elementCycle % 2 === 0) ? "Yang" : "Yin";

  return {
    symbol,
    animal: animalHu,
    element: elementHu,
    yinYang
  };
}