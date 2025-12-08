// lib/chineseZodiac.js
import { cnyDates } from "./cnyDates.js";

const ANIMALS_EN = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const EMOJIS = ["🐀", "🐂", "🐅", "🐇", "🐉", "🐍", "🐎", "🐐", "🐒", "🐓", "🐕", "🐖"];
const ELEMENTS_EN = { "Wood": "Wood", "Fire": "Fire", "Earth": "Earth", "Metal": "Metal", "Water": "Water" };

export function getChineseZodiac_FULL(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) throw new Error("Invalid date format. Expected DD/MM/YYYY");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const birthDate = new Date(isoDate);
  if (isNaN(birthDate.getTime())) throw new Error("Invalid date");

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

  // Use Rat-based cycle with offset
  const animalIndex = (year - 4) % 12;
  if (animalIndex < 0) animalIndex += 12;

  const animalEn = ANIMALS_EN[animalIndex];
  const symbol = EMOJIS[animalIndex];

  const elementCycle = (year - 1900) % 10;
  const elementBase = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  const elementEn = elementBase[elementCycle] || "Earth";

  const yinYang = (elementCycle % 2 === 0) ? "Yang" : "Yin";

  return { symbol, animal: animalEn, element: elementEn, yinYang };
}