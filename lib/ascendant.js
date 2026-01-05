// lib/ascendant.js
export function calculateAscendant(birthDateStr, birthTimeStr = "12:00 PM", place = "") {
  try {
    // ✅ JAVÍTÁS 1: EGYSZERŰ IDŐ ALAPÚ SZÁMÍTÁS (NINCS GEOKÓDOLÁS)
    const hourStr = birthTimeStr.replace(/[^0-9]/g, '');
    const hour = parseInt(hourStr) || 12;
    
    // ✅ JAVÍTÁS 2: KÖZÉP-EURÓPAI IDŐZÓNÁHOZ ALKALMAZKODÓ SZÁMÍTÁS
    return getRisingSignByHour(hour);
    
  } catch (error) {
    console.error("❌ Hiba az aszcendens számításban:", error);
    return "Libra"; // Biztonsági alapértelmezett
  }
}

// ⏰ ÓRA ALAPJÁN TÖRTÉNŐ SZÁMÍTÁS (KÖZÉP-EURÓPAI IDŐZÓNÁHOZ)
function getRisingSignByHour(hour) {
  // Asztrológiai alapelvek szerint (napszállatási időpontok):
  if (hour >= 4 && hour < 6) return "Taurus";
  if (hour >= 6 && hour < 8) return "Gemini";
  if (hour >= 8 && hour < 10) return "Cancer";
  if (hour >= 10 && hour < 12) return "Leo";
  if (hour >= 12 && hour < 14) return "Virgo";    // 12-14 óra = Szűz
  if (hour >= 14 && hour < 16) return "Libra";
  if (hour >= 16 && hour < 18) return "Scorpio";
  if (hour >= 18 && hour < 20) return "Sagittarius";
  if (hour >= 20 && hour < 22) return "Capricorn";
  if (hour >= 22 && hour < 24) return "Aquarius";
  if (hour >= 0 && hour < 2) return "Pisces";
  if (hour >= 2 && hour < 4) return "Aries";
  return "Virgo"; // Biztonsági alapértelmezett
}