// lib/timezoneMap.js
// Forrás: CLDR / IANA időzóna adatbázis (egyszerűsített, leggyakoribb UTC offset alapján)
// ⚠️ Figyelem: téli/nyári időszámítás (DST) **nem kezelt**, de a legtöbb asztrológiai rendszer
// a születés időpontjának **normál (standard) időzónáját** használja – ez így is elfogadott gyakorlat.

export const COUNTRY_TO_UTC_OFFSET = {
  // Európa
  "Hungary": 1,
  "Germany": 1,
  "France": 1,
  "Italy": 1,
  "Spain": 1,
  "United Kingdom": 0,
  "Portugal": 0,
  "Netherlands": 1,
  "Belgium": 1,
  "Austria": 1,
  "Switzerland": 1,
  "Sweden": 1,
  "Norway": 1,
  "Denmark": 1,
  "Finland": 2,
  "Poland": 1,
  "Czech Republic": 1,
  "Slovakia": 1,
  "Romania": 2,
  "Bulgaria": 2,
  "Greece": 2,
  "Russia": 3, // egyszerűsített: Moszkva idő
  "Ukraine": 2,
  "Croatia": 1,
  "Serbia": 1,
  "Slovenia": 1,

  // Észak-Amerika
  "United States": -5, // keleti (Eastern Standard Time)
  "Canada": -5,
  "Mexico": -6,
  "Brazil": -3,

  // Ázsia
  "China": 8,
  "Japan": 9,
  "South Korea": 9,
  "India": 5.5,
  "Indonesia": 7,
  "Thailand": 7,
  "Vietnam": 7,
  "Philippines": 8,
  "Malaysia": 8,
  "Singapore": 8,

  // Ausztrália és Óceánia
  "Australia": 10, // keleti (Sydney)
  "New Zealand": 12,

  // Afrika
  "South Africa": 2,
  "Egypt": 2,
  "Nigeria": 1,
  "Kenya": 3,
  "Morocco": 1,

  // Egyéb gyakori
  "Turkey": 3,
  "Israel": 2,
  "Saudi Arabia": 3,
  "United Arab Emirates": 4,
  "Argentina": -3,
  "Chile": -4,
  "Colombia": -5,
  "Peru": -5
};

// Alternatív nevek (pl. magyar → angol)
const ALTERNATE_NAMES = {
  "Magyarország": "Hungary",
  "Németország": "Germany",
  "Franciaország": "France",
  "Olaszország": "Italy",
  "Spanyolország": "Spain",
  "Egyesült Királyság": "United Kingdom",
  "Egyesült Államok": "United States",
  "Kanada": "Canada",
  "Brazília": "Brazil",
  "Kína": "China",
  "Japán": "Japan",
  "India": "India",
  "Ausztrália": "Australia",
  "Oroszország": "Russia",
  "Románia": "Romania",
  "Bulgária": "Bulgaria",
  "Görögország": "Greece",
  "Törökország": "Turkey",
  "Izrael": "Israel",
  "Egyiptom": "Egypt",
  "Dél-Afrika": "South Africa"
};

export function getUtcOffsetByCountry(countryName) {
  if (!countryName || typeof countryName !== "string") return 0;

  // 1. Próbáljuk meg közvetlenül
  let offset = COUNTRY_TO_UTC_OFFSET[countryName.trim()];
  if (offset !== undefined) return offset;

  // 2. Próbáljuk meg alternatív névvel (pl. magyar → angol)
  const normalized = ALTERNATE_NAMES[countryName.trim()];
  if (normalized) {
    offset = COUNTRY_TO_UTC_OFFSET[normalized];
    if (offset !== undefined) return offset;
  }

  // 3. Utolsó esély: kisbetűs keresés
  const lowerName = countryName.toLowerCase();
  for (const [key, value] of Object.entries(COUNTRY_TO_UTC_OFFSET)) {
    if (key.toLowerCase() === lowerName) return value;
  }

  // 4. Alapértelmezett: UTC+0
  return 0;
}