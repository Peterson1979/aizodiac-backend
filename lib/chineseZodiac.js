// lib/chineseZodiac.js
import { cnyDates } from "./cnyDates.js";

const animals = [
  "Monkey", "Rooster", "Dog", "Pig", "Rat", "Ox",
  "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat"
];

const emojis = {
  Monkey: "🐒", Rooster: "🐓", Dog: "🐕", Pig: "🐖",
  Rat: "🐀", Ox: "🐂", Tiger: "🐅", Rabbit: "🐇",
  Dragon: "🐉", Snake: "🐍", Horse: "🐎", Goat: "🐐"
};

const elements = ["Wood", "Fire", "Earth", "Metal", "Water"];
const yinYang = ["Yang", "Yin"]; // even = Yang, odd = Yin

export function getChineseZodiac_FULL(dateStr) {
  // Példa: "29/06/1979" → "1979-06-29"
  const [day, month, year] = dateStr.split('/');
  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(isoDate);
  let y = date.getUTCFullYear();

  const cnyStr = cnyDates[y];
  if (!cnyStr) {
    throw new Error(`Year ${y} not in CNY table`);
  }
  const cny = new Date(cnyStr);

  // Ha a születésnap a Kínai Újév ELŐTT → előző év jegye
  if (date < cny) y--;

  const animalIndex = (y - 1900) % 12;
  const animal = animals[animalIndex];
  const emoji = emojis[animal];

  const cycleIndex = (y - 1900) % 10;
  const element = elements[Math.floor(cycleIndex / 2)];
  const yy = yinYang[cycleIndex % 2];

  return {
    symbol: emoji,
    animal,
    element,
    yinYang: yy,
    signLine: `${emoji} ${animal} — ${element} element, ${yy}`
  };
}