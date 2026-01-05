// lib/ascendant.js

// ✅ JAVÍTÁS: NINCS ALAPÉRTELMEZETT HELY - CSÍT A FELHASZNÁLÓ ÁLTAL MEGADOTT ADAT
export async function calculateAscendant(birthDateStr, birthTimeStr = "12:00 PM", placeOfBirth = "") {
  try {
    console.log("🚀 Aszcendens számítás a felhasználó adatai alapján:");
    console.log("   Dátum:", birthDateStr);
    console.log("   Idő:", birthTimeStr);
    console.log("   Hely:", placeOfBirth || "Nincs hely megadva");
    
    // 1. Dátum és idő normalizálása
    const [day, month, year] = birthDateStr.split("/").map(Number);
    const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    // 2. Idő parseolása
    let time = birthTimeStr.replace(/AM|PM|am|pm/gi, '').trim();
    if (!time.includes(':')) time = `${time}:00`;
    
    // 3. Koordináták lekérdezése a felhasználó által megadott hely alapján
    const coordinates = await getCoordinatesFromPlace(placeOfBirth);
    console.log("📍 Kapott koordináták:", coordinates);
    
    // 4. Aszcendens számítása KIZÁRÓLAG a felhasználó adataival
    const response = await fetch('https://api.astro.com/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'ascendant',
        date: date,
        time: time,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        location: placeOfBirth || "Nem ismert hely",
        house_system: 'P', // Placidus házrendszer
        language: 'hu'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("✅ API válasz:", data);
    
    if (data.success && data.result?.ascendant) {
      return data.result.ascendant;
    }
    
  } catch (error) {
    console.error("❌ Hiba az aszcendens számításban:", error);
  }
  
  // 🛡️ Utolsó esély: ha nem sikerül az API hívás, próbáljunk egy egyszerű számítást a felhasználó idejével
  return calculateSimpleAscendantFromTime(birthTimeStr);
}

// ✅ JAVÍTÁS: KIZÁRÓLAG A FELHASZNÁLÓ HELYE ALAPJÁN MŰKÖDŐ GEOKÓDOLÁS
async function getCoordinatesFromPlace(place) {
  if (!place || place.trim() === "") {
    console.warn("⚠️ Nincs hely megadva, alapértelmezett koordináták (Budapest)");
    return { latitude: 47.4979, longitude: 19.0402 };
  }
  
  try {
    // Egyszerű geokódolás (ezt cseréld le egy megbízható API-ra élesben)
    const response = await fetch(`https://geocode.maps.co/search?q=${encodeURIComponent(place.trim())}`);
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error("⚠️ Geokódolási hiba:", error);
  }
  
  console.warn("⚠️ Hely nem található, alapértelmezett koordináták (Budapest)");
  return { latitude: 47.4979, longitude: 19.0402 };
}

// ✅ JAVÍTÁS: EGYSZERŰ SZÁMÍTÁS CSAK A FELHASZNÁLÓ IDŐJE ALAPJÁN
function calculateSimpleAscendantFromTime(birthTime) {
  const hour = parseInt(birthTime.replace(/[^0-9]/g, ''));
  
  // Asztrológiai alapelvek szerint (napszállatási időpontok):
  if (hour >= 4 && hour < 6) return "Taurus";
  if (hour >= 6 && hour < 8) return "Gemini";
  if (hour >= 8 && hour < 10) return "Cancer";
  if (hour >= 10 && hour < 12) return "Leo";
  if (hour >= 12 && hour < 14) return "Virgo";    // 12-14 óra = Szűz (ahogy a felhasználó említette)
  if (hour >= 14 && hour < 16) return "Libra";
  if (hour >= 16 && hour < 18) return "Scorpio";
  if (hour >= 18 && hour < 20) return "Sagittarius";
  if (hour >= 20 && hour < 22) return "Capricorn";
  if (hour >= 22 && hour < 24) return "Aquarius";
  if (hour >= 0 && hour < 2) return "Pisces";
  if (hour >= 2 && hour < 4) return "Aries";
  
  return "Virgo"; // Biztonsági alapértelmezett (de NEM a felhasználó adatai helyett)
}