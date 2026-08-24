// lib/reserveContent.js

/**
 * Localized Zodiac Sign Names across all 28 supported Android languages.
 */
export const ZODIAC_NAMES = {
  en: { Aries: "Aries", Taurus: "Taurus", Gemini: "Gemini", Cancer: "Cancer", Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Scorpio", Sagittarius: "Sagittarius", Capricorn: "Capricorn", Aquarius: "Aquarius", Pisces: "Pisces" },
  hu: { Aries: "Kos", Taurus: "Bika", Gemini: "Ikrek", Cancer: "Rák", Leo: "Oroszlán", Virgo: "Szűz", Libra: "Mérleg", Scorpio: "Skorpió", Sagittarius: "Nyilas", Capricorn: "Bak", Aquarius: "Vízöntő", Pisces: "Halak" },
  de: { Aries: "Widder", Taurus: "Stier", Gemini: "Zwillinge", Cancer: "Krebs", Leo: "Löwe", Virgo: "Jungfrau", Libra: "Waage", Scorpio: "Skorpion", Sagittarius: "Schütze", Capricorn: "Steinbock", Aquarius: "Wassermann", Pisces: "Fische" },
  fr: { Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer", Leo: "Lion", Virgo: "Vierge", Libra: "Balance", Scorpio: "Scorpion", Sagittarius: "Sagittaire", Capricorn: "Capricorne", Aquarius: "Verseau", Pisces: "Poissons" },
  it: { Aries: "Ariete", Taurus: "Toro", Gemini: "Gemelli", Cancer: "Cancro", Leo: "Leone", Virgo: "Vergine", Libra: "Bilancia", Scorpio: "Scorpione", Sagittarius: "Sagittario", Capricorn: "Capricorno", Aquarius: "Acquario", Pisces: "Pesci" },
  ru: { Aries: "Овен", Taurus: "Телец", Gemini: "Близнецы", Cancer: "Рак", Leo: "Лев", Virgo: "Дева", Libra: "Весы", Scorpio: "Скорпион", Sagittarius: "Стрелец", Capricorn: "Козерог", Aquarius: "Водолей", Pisces: "Рыбы" },
  es: { Aries: "Aries", Taurus: "Tauro", Gemini: "Géminis", Cancer: "Cáncer", Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Escorpio", Sagittarius: "Sagitario", Capricorn: "Capricornio", Aquarius: "Acuario", Pisces: "Piscis" },
  pt: { Aries: "Áries", Taurus: "Touro", Gemini: "Gêmeos", Cancer: "Câncer", Leo: "Leão", Virgo: "Virgem", Libra: "Libra", Scorpio: "Escorpião", Sagittarius: "Sagitário", Capricorn: "Capricórnio", Aquarius: "Aquário", Pisces: "Peixes" },
  zh: { Aries: "白羊座", Taurus: "金牛座", Gemini: "双子座", Cancer: "巨蟹座", Leo: "狮子座", Virgo: "处女座", Libra: "天秤座", Scorpio: "天蝎座", Sagittarius: "射手座", Capricorn: "摩羯座", Aquarius: "水瓶座", Pisces: "双鱼座" },
  ja: { Aries: "牡羊座", Taurus: "牡牛座", Gemini: "双子座", Cancer: "蟹座", Leo: "獅子座", Virgo: "乙女座", Libra: "天秤座", Scorpio: "蠍座", Sagittarius: "射手座", Capricorn: "山羊座", Aquarius: "水瓶座", Pisces: "魚座" },
  ko: { Aries: "양자리", Taurus: "황소자리", Gemini: "쌍둥이자리", Cancer: "게자리", Leo: "사자자리", Virgo: "처녀자리", Libra: "천칭자리", Scorpio: "전갈자리", Sagittarius: "사수자리", Capricorn: "염소자리", Aquarius: "물병자리", Pisces: "물고기자리" },
  ar: { Aries: "الحمل", Taurus: "الثور", Gemini: "الجوزاء", Cancer: "السرطان", Leo: "الأسد", Virgo: "العذراء", Libra: "الميزان", Scorpio: "العقرب", Sagittarius: "القوس", Capricorn: "الجدي", Aquarius: "الدلو", Pisces: "الحوت" },
  hi: { Aries: "मेष", Taurus: "वृषभ", Gemini: "मिथुन", Cancer: "कर्क", Leo: "सिंह", Virgo: "कन्या", Libra: "तुला", Scorpio: "वृश्चिक", Sagittarius: "धनु", Capricorn: "मकर", Aquarius: "कुंभ", Pisces: "मीन" },
  tr: { Aries: "Koç", Taurus: "Boğa", Gemini: "İkizler", Cancer: "Yengeç", Leo: "Aslan", Virgo: "Başak", Libra: "Terazi", Scorpio: "Akrep", Sagittarius: "Yay", Capricorn: "Oğlak", Aquarius: "Kova", Pisces: "Balık" },
  pl: { Aries: "Baran", Taurus: "Byk", Gemini: "Bliźnięta", Cancer: "Rak", Leo: "Lew", Virgo: "Panna", Libra: "Waga", Scorpio: "Skorpion", Sagittarius: "Strzelec", Capricorn: "Koziorożec", Aquarius: "Wodnik", Pisces: "Ryby" },
  nl: { Aries: "Ram", Taurus: "Stier", Gemini: "Tweelingen", Cancer: "Kreeft", Leo: "Leeuw", Virgo: "Maagd", Libra: "Weegschaal", Scorpio: "Schorpioen", Sagittarius: "Boogschutter", Capricorn: "Steenbok", Aquarius: "Waterman", Pisces: "Vissen" },
  uk: { Aries: "Овен", Taurus: "Телець", Gemini: "Близнюки", Cancer: "Рак", Leo: "Лев", Virgo: "Діва", Libra: "Терези", Scorpio: "Скорпіон", Sagittarius: "Стрілець", Capricorn: "Козоріг", Aquarius: "Водолій", Pisces: "Риби" },
  ro: { Aries: "Berbec", Taurus: "Taur", Gemini: "Gemeni", Cancer: "Rac", Leo: "Leu", Virgo: "Fecioară", Libra: "Balanță", Scorpio: "Scorpion", Sagittarius: "Săgetător", Capricorn: "Capricorn", Aquarius: "Vărsător", Pisces: "Pești" },
  vi: { Aries: "Bạch Dương", Taurus: "Kim Ngưu", Gemini: "Song Tử", Cancer: "Cự Giải", Leo: "Sư Tử", Virgo: "Xử Nữ", Libra: "Thiên Bình", Scorpio: "Bọ Cạp", Sagittarius: "Nhân Mã", Capricorn: "Ma Kết", Aquarius: "Bảo Bình", Pisces: "Song Ngư" },
  th: { Aries: "ราศีเมษ", Taurus: "ราศีพฤษภ", Gemini: "ราศีเมถุน", Cancer: "ราศีกรกฎ", Leo: "ราศีสิงห์", Virgo: "ราศีกันย์", Libra: "ราศีตุลย์", Scorpio: "ราศีพิจิก", Sagittarius: "ราศีธนู", Capricorn: "ราศีมังกร", Aquarius: "ราศีกุมภ์", Pisces: "ราศีมีน" },
  id: { Aries: "Aries", Taurus: "Taurus", Gemini: "Gemini", Cancer: "Cancer", Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Scorpio", Sagittarius: "Sagitarius", Capricorn: "Capricorn", Aquarius: "Aquarius", Pisces: "Pisces" },
  ms: { Aries: "Aries", Taurus: "Taurus", Gemini: "Gemini", Cancer: "Cancer", Leo: "Leo", Virgo: "Virgo", Libra: "Libra", Scorpio: "Scorpio", Sagittarius: "Sagittarius", Capricorn: "Capricorn", Aquarius: "Aquarius", Pisces: "Pisces" },
  bn: { Aries: "মেষ", Taurus: "বৃষ", Gemini: "মিথুন", Cancer: "কর্কট", Leo: "সিংহ", Virgo: "কন্যা", Libra: "তুলা", Scorpio: "বৃশ্চিক", Sagittarius: "ধনু", Capricorn: "মকর", Aquarius: "কুম্ভ", Pisces: "মীন" },
  fa: { Aries: "حمل", Taurus: "ثور", Gemini: "جوزا", Cancer: "سرطان", Leo: "اسد", Virgo: "سنبله", Libra: "میزان", Scorpio: "عقرب", Sagittarius: "قوس", Capricorn: "جدی", Aquarius: "دلو", Pisces: "حوت" },
  ur: { Aries: "حمل", Taurus: "ثور", Gemini: "جوزا", Cancer: "سرطان", Leo: "اسد", Virgo: "سنبلہ", Libra: "میزان", Scorpio: "عقرب", Sagittarius: "قوس", Capricorn: "جدی", Aquarius: "دلو", Pisces: "حوت" },
  ta: { Aries: "மேஷம்", Taurus: "ரிஷபம்", Gemini: "மிதுனம்", Cancer: "கடகம்", Leo: "சிம்மம்", Virgo: "கன்னி", Libra: "துலாம்", Scorpio: "விருச்சிகம்", Sagittarius: "தனுசு", Capricorn: "மகரம்", Aquarius: "கும்பம்", Pisces: "மீனம்" },
  te: { Aries: "మేషం", Taurus: "వృషభం", Gemini: "మిథునం", Cancer: "కర్కాటకం", Leo: "సింహం", Virgo: "కన్య", Libra: "తుల", Scorpio: "వృశ్చికం", Sagittarius: "ధనుస్సు", Capricorn: "మకరం", Aquarius: "కుంభం", Pisces: "మీనం" },
  sw: { Aries: "Punda", Taurus: "Ng'ombe", Gemini: "Mapacha", Cancer: "Kaa", Leo: "Simba", Virgo: "Bikira", Libra: "Mizani", Scorpio: "Nge", Sagittarius: "Mshale", Capricorn: "Mbuzi", Aquarius: "Ndoo", Pisces: "Samaki" }
};
ZODIAC_NAMES.in = ZODIAC_NAMES.id;

export const WEEKDAYS = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  hu: ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"],
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  fr: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
  it: ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"],
  ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
  pt: ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"],
  zh: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
  ja: ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
  ko: ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"],
  ar: ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
  hi: ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"],
  tr: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
  pl: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
  nl: ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"],
  uk: ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"],
  ro: ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"],
  vi: ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"],
  th: ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"],
  id: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
  ms: ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"],
  bn: ["সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার"],
  fa: ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یکشنبه"],
  ur: ["پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"],
  ta: ["திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி", "ஞாயிறு"],
  te: ["సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం", "ఆదివారం"],
  sw: ["Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"]
};
WEEKDAYS.in = WEEKDAYS.id;

export const LUCKY_COLORS = {
  en: ["Gold", "Silver", "Emerald Green", "Royal Blue", "Crimson", "Violet", "Amber", "Turquoise"],
  hu: ["Arany", "Ezüst", "Smaragdzöld", "Királykék", "Bíbor", "Ibolya", "Borostyán", "Türkiz"],
  de: ["Gold", "Silber", "Smaragdgrün", "Königsblau", "Karmesinrot", "Violett", "Bernstein", "Türkis"],
  fr: ["Or", "Argent", "Vert émeraude", "Bleu royal", "Cramoisi", "Violet", "Ambre", "Turquoise"],
  it: ["Oro", "Argento", "Verde smeraldo", "Blu reale", "Cremisi", "Viola", "Ambra", "Turchese"],
  ru: ["Золотой", "Серебряный", "Изумрудный", "Королевский синий", "Пурпурный", "Фиолетовый", "Янтарный", "Бирюзовый"],
  es: ["Dorado", "Plateado", "Verde Esmeralda", "Azul Real", "Carmesí", "Violeta", "Ámbar", "Turquesa"],
  pt: ["Dourado", "Prateado", "Verde esmeralda", "Azul royal", "Carmesim", "Violeta", "Âmbar", "Turquesa"],
  zh: ["金色", "银色", "翡翠绿", "皇家蓝", "深红", "紫罗兰", "琥珀色", "绿松石色"],
  ja: ["ゴールド", "シルバー", "エメラルドグリーン", "ロイヤルブルー", "真紅", "バイオレット", "アンバー", "ターコイズ"],
  ko: ["골드", "실버", "에메랄드 그린", "로열 블루", "크림슨", "바이올렛", "앰버", "터키석색"],
  ar: ["الذهبي", "الفضي", "الزمردي", "الأزرق الملكي", "القرمزي", "البنفسجي", "الكهرماني", "الفيروزي"],
  hi: ["सुनहरा", "चांदी", "पन्ना हरा", "शाही नीला", "गहरा लाल", "बैंगनी", "अंबर", "फ़िरोज़ा"],
  tr: ["Altın", "Gümüş", "Zümrüt Yeşili", "Kraliyet Mavisi", "Kızıl", "Menekşe", "Kehribar", "Turkuaz"],
  pl: ["Złoty", "Srebrny", "Szmaragdowy", "Królewski błękit", "Karmazynowy", "Fioletowy", "Bursztynowy", "Turkusowy"],
  nl: ["Goud", "Zilver", "Smaragdgroen", "Koningsblauw", "Karmozijnrood", "Violet", "Barnsteen", "Turkoois"],
  uk: ["Золотий", "Срібний", "Смарагдовий", "Королівський синій", "Багряний", "Фіолетовий", "Бурштиновий", "Бірюзовий"],
  ro: ["Auriu", "Argintiu", "Verde smarald", "Albastru regal", "Stacojiu", "Violet", "Chihlimbar", "Turcoaz"],
  vi: ["Vàng kim", "Bạc", "Xanh lục bảo", "Xanh hoàng gia", "Đỏ thẫm", "Tím", "Hổ phách", "Ngọc lam"],
  th: ["สีทอง", "สีเงิน", "สีเขียวมรกต", "สีน้ำเงินเข้ม", "สีแดงเข้ม", "สีม่วง", "สีอำพัน", "สีเทอร์ควอยซ์"],
  id: ["Emas", "Perak", "Hijau Zamrud", "Biru Royal", "Merah Tua", "Ungu", "Amber", "Pirus"],
  ms: ["Emas", "Perak", "Hijau Zamrud", "Biru Diraja", "Merah Lembayung", "Ungu", "Amber", "Pirus"],
  bn: ["সোনালী", "রূপালী", "পান্না সবুজ", "রাজকীয় নীল", "গাঢ় লাল", "বেগুনী", "অ্যাম্বার", "ফিরোজা"],
  fa: ["طلایی", "نقره‌ای", "سبز زمردی", "آبی سلطنتی", "زرشکی", "بنفش", "کهربایی", "فیروزه‌ای"],
  ur: ["سنہری", "چاندی", "زمردی سبز", "شاہی نیلا", "گہرا سرخ", "جامنی", "عنبری", "فیروزی"],
  ta: ["தங்கம்", "வெள்ளி", "மரகத பச்சை", "ராயல் நீலம்", "கருஞ்சிவப்பு", "ஊதா", "ஆம்பர்", "நீலப்பச்சை"],
  te: ["బంగారు", "వెండి", "పచ్చని ఆకుపచ్చ", "రాయల్ బ్లూ", "ఎరుపు", "వైలెట్", "అంబర్", "టర్కోయిస్"],
  sw: ["Dhahabu", "Fedha", "Kijani Zumaridi", "Bluu ya Kifalme", "Nyekundu Iliyoiva", "Zambarau", "Kahawia", "Zumaridi"]
};
LUCKY_COLORS.in = LUCKY_COLORS.id;

/**
 * Concise native inspirational quotes per language.
 */
export const DAILY_QUOTES = {
  en: ["The stars illuminate the path, but your heart chooses the direction.", "Harmony arrives when inner clarity aligns with outer action."],
  hu: ["A csillagok megvilágítják az utat, de a szíved választja meg az irányt.", "A harmónia akkor érkezik el, amikor a belső tisztaság cselekvéssé válik."],
  de: ["Die Sterne erleuchten den Weg, doch dein Herz wählt die Richtung.", "Harmonie entsteht, wenn innere Klarheit zu bewusstem Handeln führt."],
  fr: ["Les étoiles éclairent le chemin, mais votre cœur choisit la direction.", "L'harmonie arrive lorsque la clarté intérieure guide vos actions."],
  it: ["Le stelle illuminano il cammino, ma il tuo cuore sceglie la direzione.", "L'armonia nasce quando la chiarezza interiore guida le tue azioni."],
  ru: ["Звезды освещают путь, но направление выбирает ваше сердце.", "Гармония наступает, когда внутренняя ясность ведет к верным действиям."],
  es: ["Las estrellas iluminan el sendero, pero tu corazón elige la dirección.", "La armonía florece cuando la claridad interior guía tus acciones."],
  pt: ["As estrelas iluminam o caminho, mas o seu coração escolhe a direção.", "A harmonia surge quando a clareza interior se alinha com a ação."],
  zh: ["星光指引前行的道路，而内心决定选择的方向。", "当内在的明晰化为行动时，和谐便自然降临。"],
  ja: ["星々は道を照らし、心がその進路を選びます。", "内なる明晰さが行動と調和するとき、真の調和が訪れます。"],
  ko: ["별들은 길을 비추지만, 마음이 방향을 선택합니다.", "내면의 명확함이 행동과 일치할 때 진정한 조화가 찾아옵니다."],
  ar: ["تضيء النجوم الدرب، لكن قلبك هو الذي يختار الاتجاه.", "يتحقق الانسجام عندما يتوافق الوضوح الداخلي مع العمل الواعي."],
  hi: ["सितारे राह दिखाते हैं, लेकिन दिशा आपका दिल चुनता है।", "सच्चा सामंजस्य तब आता है जब आंतरिक स्पष्टता कर्म में बदलती है।"],
  tr: ["Yıldızlar yolu aydınlatır, ancak yönü kalbiniz seçer.", "İçsel berraklık eylemlerinizle birleştiğinde huzur doğar."],
  pl: ["Gwiazdy oświetlają drogę, lecz to twoje serce wybiera kierunek.", "Harmonia pojawia się, gdy wewnętrzna jasność kieruje działaniem."],
  nl: ["De sterren verlichten het pad, maar je hart kiest de richting.", "Harmonie ontstaat wanneer innerlijke helderheid leidt tot actie."],
  uk: ["Зірки освітлюють шлях, але напрямок обирає ваше серце.", "Гармонія приходить тоді, коли внутрішня ясність керує діями."],
  ro: ["Stelele luminează calea, dar inima ta alege direcția.", "Armonia apare atunci când claritatea interioară ghidează acțiunea."],
  vi: ["Các vì sao soi sáng con đường, nhưng trái tim bạn mới chọn hướng đi.", "Sự hài hòa xuất hiện khi tâm trí sáng suốt định hướng hành động."],
  th: ["ดวงดาวส่องทาง แต่หัวใจของคุณคือผู้เลือกทิศทาง", "ความสามัคคีเกิดขึ้นเมื่อความชัดเจนภายในนำไปสู่การกระทำ"],
  id: ["Bintang-bintang menerangi jalan, tetapi hatimu yang memilih arah.", "Keharmonisan hadir saat kejernihan batin selaras dengan tindakan."],
  ms: ["Bintang-bintang menerangi jalan, tetapi hati anda yang memilih arah.", "Keharmonian tiba apabila kejelasan dalaman membimbing tindakan."],
  bn: ["নক্ষত্রেরা পথ দেখায়, কিন্তু আপনার হৃদয়ই দিক বেছে নেয়।", "অভ্যন্তরীণ স্পষ্টতা যখন কাজে প্রকাশ পায়, তখনই সামঞ্জস্য আসে।"],
  fa: ["ستارگان راه را روشن می‌کنند، اما قلب شما مسیر را برمی‌گزیند.", "هماهنگی زمانی پدیدار می‌شود که وضوح درونی به عمل تبدیل شود."],
  ur: ["ستارے راستہ دکھاتے ہیں، مگر سمت کا انتخاب آپ کا دل کرتا ہے۔", "ہم آہنگی تب آتی ہے جب اندرونی وضاحت عمل سے ہم آہنگ ہو۔"],
  ta: ["நட்சத்திரங்கள் வழியைக் காட்டுகின்றன, ஆனால் உங்கள் இதயம் திசையைத் தேர்ந்தெடுக்கிறது.", "உள் தெளிவு செயலுடன் இணையும் போது நல்லிணக்கம் ஏற்படுகிறது."],
  te: ["నక్షత్రాలు మార్గాన్ని ప్రకాశింపజేస్తాయి, కానీ మీ హృదయమే దిశను ఎంచుకుంటుంది.", "అంతర్గత స్పష్టత కర్మతో కలిసినప్పుడు సామరస్యం లభిస్తుంది."],
  sw: ["Nyota huangaza njia, lakini moyo wako huchagua mwelekeo.", "Amani hutokea wakati hekima ya ndani inaongoza matendo yako."]
};
DAILY_QUOTES.in = DAILY_QUOTES.id;

/**
 * Native phrase components for all 28 supported Android languages.
 */
export const COMPONENT_POOLS = {
  en: {
    intros: ["A period of clarity and focused vitality surrounds your sign.", "Cosmic alignments invite balance between ambition and inner reflection."],
    forecasts: ["Your natural instincts are sharp, making it an ideal time to prioritize meaningful goals.", "Favorable momentum supports constructive decisions."],
    love: ["Heartfelt conversations deepen mutual trust and emotional closeness.", "Warmth and attentive listening invite romantic harmony."],
    career: ["Steady dedication and clear organization bring recognition in your workplace.", "Creative problem-solving allows you to stand out."],
    finances: ["Prudent budgeting and mindful planning support long-term security.", "Financial stability is reinforced through measured decisions."],
    energies: ["Harmonious and focused, with strong emotional resilience.", "Dynamic vitality balanced by grounded clarity."],
    advices: ["Stay grounded in your values and proceed with calm certainty.", "Trust your intuition while honoring practical steps."]
  },

  hu: {
    intros: ["A tisztánlátás és a megújult életerő időszaka köszönt be a jegyedbe.", "A csillagok állása egyensúlyt kínál az ambíció és a belső elcsendesedés között."],
    forecasts: ["Megbízhatóak a megérzéseid, így kiváló alkalom nyílik a fontos célok előtérbe helyezésére.", "A kedvező lendület segíti a határozott lépéseket."],
    love: ["Az őszinte és mély beszélgetések erősítik az egymás iránti bizalmat és intimitást.", "A figyelem és a melegség harmonikus légkört teremt."],
    career: ["A kitartó munka és a rendszerezett figyelem elismerést hoz a hivatásodban.", "A kreatív megoldások révén magabiztosan érvényesülhetsz."],
    finances: ["A megfontolt tervezés és a tudatosság biztonságos alapot teremt a jövőhöz.", "A pénzügyi stabilitást a fegyelmezett döntések garantálják."],
    energies: ["Harmonikus és céltudatos, stabil érzelmi teherbírással.", "Dinamikus életerő, amelyet megbízható józanság egészít ki."],
    advices: ["Maradj hű az értékeidhez, és haladj nyugodt magabiztossággal.", "Bízz a belső hangodban, miközben a gyakorlati lépésekre is figyelsz."]
  },

  de: {
    intros: ["Eine Phase der Klarheit und spürbaren Vitalität begleitet dein Zeichen.", "Die kosmische Konstellation schenkt Ausgewogenheit zwischen Tatkraft und Besonnenheit."],
    forecasts: ["Deine Intuition ist treffsicher, was dir hilft, wesentliche Ziele klar anzusteuern.", "Günstige Impulse unterstützen konstruktive Entscheidungen."],
    love: ["Aufrichtige Gespräche vertiefen das gegenseitige Vertrauen und die Nähe.", "Einfühlsames Zuhören schafft eine liebevolle Atmosphäre."],
    career: ["Zuverlässiger Einsatz und gute Struktur bringen dir verdiente Anerkennung.", "Kreative Ansätze ermöglichen dir klare Akzente."],
    finances: ["Vorausschauende Planung sichert deine finanzielle Stabilität.", "Kluge Entscheidungen stärken dein materielles Fundament."],
    energies: ["Harmonisch und konzentriert mit hoher innerer Widerstandskraft.", "Ausgeglichene Vitalität, getragen von klarer Gelassenheit."],
    advices: ["Bleibe deinen Grundsätzen treu und gehe besonnen deinen Weg.", "Vertraue auf deine Intuition und halte dich an greifbare Schritte."]
  },

  fr: {
    intros: ["Une période de clarté et de vitalité entoure votre signe.", "Les alignements cosmiques invitent à l'équilibre entre ambition et réflexion."],
    forecasts: ["Votre instinct est aiguisé, idéal pour prioriser vos objectifs.", "Une dynamique favorable soutient des décisions constructives."],
    love: ["Des échanges sincères renforcent la confiance et la proximité.", "L'écoute bienveillante crée une harmonie affective apaisante."],
    career: ["Votre dévouement et votre organisation vous valent de la reconnaissance.", "Vos solutions créatives font la différence au travail."],
    finances: ["Une gestion prudente consolide votre sécurité matérielle.", "Des choix mesurés préservent vos équilibres financiers."],
    energies: ["Harmonieuse et concentrée, avec une belle résilience émotionnelle.", "Vitalité dynamique portée par une grande clarté d'esprit."],
    advices: ["Restez fidèle à vos principes et avancez avec sérénité.", "Faites confiance à votre intuition tout en restant pragmatique."]
  },

  it: {
    intros: ["Un periodo di limpidezza ed energia positiva accompagna il tuo segno.", "Gli astri favoriscono l'equilibrio tra aspirazioni e riflessione interiore."],
    forecasts: ["Il tuo intuito è pronto a guidarti verso obiettivi significativi.", "Uno slancio favorevole supporta scelte costruttive e stabili."],
    love: ["Dialoghi sinceri rafforzano la fiducia e la vicinanza emotiva.", "L'ascolto attento crea una serena armonia nelle relazioni."],
    career: ["L'impegno costante e l'ordine ti garantiscono meritati riconoscimenti.", "Il pensiero creativo ti aiuta a superare ogni sfida."],
    finances: ["Una pianificazione accurata protegge la tua stabilità materiale.", "Scelte ponderate assicurano sicurezza economica nel tempo."],
    energies: ["Armoniosa e focalizzata, con solida fermezza interiore.", "Vitalità brillante unita a un lucido buon senso."],
    advices: ["Rimani fedele ai tuoi valori e procedi con calma sicurezza.", "Ascolta la tua voce interiore mantenendo concretezza."]
  },

  ru: {
    intros: ["Период ясности и уверенной энергии открывается для вашего знака.", "Космические влияния способствуют балансу между делами и размышлениями."],
    forecasts: ["Ваша интуиция точна, помогая сосредоточиться на главных целях.", "Благоприятный импульс поддерживает конструктивные шаги."],
    love: ["Искренние беседы укрепляют взаимное доверие и душевную близость.", "Теплота и чуткость создают атмосферу гармонии."],
    career: ["Ответственный подход и четкая организация приносят признание.", "Творческие решения позволяют успешно решать задачи."],
    finances: ["Взвешенное планирование обеспечивает стабильность и спокойствие.", "Осмотрительность защищает ваши финансовые ресурсы."],
    energies: ["Гармоничная и собранная, с высокой эмоциональной устойчивостью.", "Динамичная сила в сочетании со спокойной ясностью."],
    advices: ["Следуйте своим ценностям и действуйте со спокойной уверенностью.", "Доверяйте интуиции, опираясь на практический расчет."]
  },

  es: {
    intros: ["Un ciclo de claridad y renovada vitalidad acompaña a tu signo.", "La alineación cósmica favorece el equilibrio entre la acción y la reflexión."],
    forecasts: ["Tu intuición se encuentra aguda, permitiéndote priorizar tus metas.", "El impulso astral favorece decisiones firmes y constructivas."],
    love: ["Las conversaciones sinceras profundizan la confianza y la cercanía.", "La empatía genera una atmósfera afectiva muy armónica."],
    career: ["La dedicación constante y la organización rinden frutos en tu labor.", "Tu enfoque creativo te permite destacar y resolver retos."],
    finances: ["La planificación prudente brinda estabilidad y seguridad futura.", "Decisiones meditadas protegen tu patrimonio."],
    energies: ["Armoniosa y centrada, con gran resiliencia emocional.", "Vitalidad dinámica respaldada por una mente despejada."],
    advices: ["Permanece fiel a tus principios y avanza con firmeza tranquila.", "Confía en tu voz interior sin descuidar los pasos prácticos."]
  },

  pt: {
    intros: ["Um período de clareza e vitalidade renovada envolve o seu signo.", "Os alinhamentos cósmicos convidam ao equilíbrio entre ambição e reflexão."],
    forecasts: ["A sua intuição está apurada para definir prioridades claras.", "Um ritmo favorável apoia escolhas construtivas e seguras."],
    love: ["Conversas sinceras aprofundam a confiança e o carinho mútuo.", "A atenção afetuosa cria um clima de harmonia duradoura."],
    career: ["A dedicação constante e a boa organização trazem reconhecimento.", "A criatividade permite-lhe destacar-se no trabalho."],
    finances: ["O planeamento prudente assegura estabilidade financeira a longo prazo.", "Decisões ponderadas protegem os seus recursos materiais."],
    energies: ["Harmoniosa e focada, com excelente equilíbrio emocional.", "Vitalidade ativa acompanhada por serenidade mental."],
    advices: ["Mantenha-se fiel aos seus valores e avance com confiança serena.", "Confie na sua intuição mantendo passos práticos e seguros."]
  },

  zh: {
    intros: ["今日你的星座迎来明晰与沉稳的能量流动。", "星象提示在进取心与内在反思之间寻求和谐平衡。"],
    forecasts: ["你的直觉清晰敏锐，正是明确重要目标并付诸实践的良机。", "积极的势头有利于做出明智决断。"],
    love: ["真诚坦率的交流能够加深彼此的信任与情感默契。", "温柔耐心的倾听能为亲密关系营造温馨和睦的氛围。"],
    career: ["踏实的投入与清晰的条理将为你赢得工作中的认可。", "创造性的思维助你在专业领域脱颖而出。"],
    finances: ["审慎的预算与长期规划有助于巩固财务安全。", "稳健的理财决策能帮助你保持资金链健康。"],
    energies: ["沉着而专注，拥有良好的心理韧性与适应力。", "充沛的活力与清醒的头脑相得益彰。"],
    advices: ["坚守内在的核心原则，以从容笃定的步伐前行。", "在倾听直觉的同时，认真落实每一个实际步骤。"]
  },

  ja: {
    intros: ["明確さと前向きな活力に満ちた流れがあなたの星座を包んでいます。", "宇宙の配置は、目標への前進と内省の調和を促しています。"],
    forecasts: ["直感が冴え渡り、大切な目標に優先的に取り組むのに最適な時期です。", "建設的な判断とスムーズな対話が力強く後押しされます。"],
    love: ["心温まる対話がお互いの信頼と精神的な絆をより深めます。", "思いやりのある傾聴が、穏やかで調和のとれた関係を育みます。"],
    career: ["着実な努力と整理された計画が、仕事での高い評価をもたらします。", "柔軟で創造的な発想が、課題の解決に役立ちます。"],
    finances: ["計画的な管理と見通しを持った行動が、安心できる基盤を築きます。", "堅実な判断が、経済的な安定をしっかりと支えます。"],
    energies: ["調和が取れ、集中力と柔軟な回復力に恵まれています。", "穏やかな自信に支えられた、力強い活力に満ちています。"],
    advices: ["自分自身の価値観を大切にし、落ち着いた確信を持って進んでください。", "直感を信じながら、現実的で着実な一歩を重ねましょう。"]
  },

  ko: {
    intros: ["명확한 판단력과 활력이 당신의 별자리를 둘러싸고 있습니다.", "우주의 흐름은 목표 지향과 내면의 평온 사이의 균형을 이끕니다."],
    forecasts: ["직관이 예리해져 의미 있는 목표에 집중하기에 최적의 시기입니다.", "긍정적인 에너지가 건설적인 결정을 뒷받침합니다."],
    love: ["진솔한 대화가 서로의 신뢰와 정서적 유대를 한층 깊게 만듭니다.", "따뜻한 경청이 관계에 평온하고 조화로운 안정을 선사합니다."],
    career: ["성실한 집중과 체계적인 준비가 직무에서 좋은 인정을 이끕니다.", "창의적인 접근법으로 어려움을 능숙하게 해결할 수 있습니다."],
    finances: ["신중한 계획과 절제가 장기적인 재정적 안정을 지켜줍니다.", "현명한 소비와 관리가 탄탄한 물질적 안정을 보장합니다."],
    energies: ["마음의 탄력성을 바탕으로 한 조화롭고 집중된 에너지입니다.", "차분한 통찰력과 건강한 활력이 조화를 이루고 있습니다."],
    advices: ["자신의 가치를 신뢰하며 평온한 확신을 가지고 나아가세요.", "내면의 소리에 귀 기울이면서도 실천적인 발걸음을 유지하세요."]
  },

  ar: {
    intros: ["تسود علامتك فترة من الوضوح والحيوية والتركيز الإيجابي.", "تدعو التوافقات الفلكية إلى التوازن بين الطموح والتأمل الداخلي الهادئ."],
    forecasts: ["بصيرتك حادة وموثوقة لتحديد أولوياتك الحقيقية.", "تدعم الطاقات الإيجابية القرارات البناءة."],
    love: ["الحوارات الصادقة تعزز مشاعر الثقة والتقارب العاطفي.", "الاستماع بلطف يخلق أجواء من المودة والراحة."],
    career: ["الالتزام المستمر والتنظيم الواضح يثمران تقديراً ملحوظاً في عملك.", "تمكنك الحلول المبتكرة من تحقيق إنجازات مهنية بارزة."],
    finances: ["التخطيط المالي الحكيم يضمن الاستقرار ويدعم الأمان المستقبلي.", "القرارات المدروسة تحافظ على التوازن المالي."],
    energies: ["متوازنة ومفعمة بالحيوية مع قدرة عالية على الثبات.", "طاقة نشطة يسندها هدوء ذهني واستقرار."],
    advices: ["تمسك بمبادئك وتقدم بثقة وهدوء نحو تحقيق غاياتك.", "ثق بحدسك الداخلي مع الحرص على الخطوات العملية."]
  },

  hi: {
    intros: ["आपके नक्षत्र में स्पष्टता और सकारात्मक ऊर्जा का संचार हो रहा है।", "ग्रहों की स्थिति महत्वाकांक्षा और आत्मचिंतन के बीच संतुलन की प्रेरणा देती है।"],
    forecasts: ["आपकी अंतर्दृष्टि मजबूत है, जो प्राथमिक लक्ष्यों को पूरा करने में सहायक होगी।", "सकारात्मक प्रवाह रचनात्मक निर्णयों को बल प्रदान करता है।"],
    love: ["सच्ची और खुली बातचीत आपसी विश्वास और आत्मीयता को प्रगाढ़ बनाती है।", "सहानुभूतिपूर्ण दृष्टिकोण रिश्तों में मधुरता और शांति लाता है।"],
    career: ["नियमित परिश्रम और व्यवस्थित सोच कार्यक्षेत्र में सम्मान दिलाती है।", "रचनात्मक उपाय आपको अपनी पहचान बनाने में मदद करेंगे।"],
    finances: ["दूरदर्शिता और संयमित योजना आर्थिक स्थिरता को मजबूत करती है।", "सोच-समझकर उठाए गए कदम भविष्य को सुरक्षित बनाते हैं।"],
    energies: ["संतुलित और केंद्रित, जिसमें आंतरिक मनोबल का समावेश है।", "शांत स्पष्टता के साथ सक्रिय जीवनशक्ति।"],
    advices: ["अपने मूल सिद्धांतों पर टिके रहें और शांत आत्मविश्वास के साथ आगे बढ़ें।", "अपनी आंतरिक आवाज पर भरोसा रखें और ठोस कदम उठाएं।"]
  },

  tr: {
    intros: ["Burcunuzu berraklık ve yenilenmiş bir canlılık sarmalıyor.", "Göksel dengeler, azim ile içsel huzur arasında güzel bir denge kuruyor."],
    forecasts: ["Sezgileriniz güçlü, önemli hedeflerinize odaklanmak için harika bir zaman.", "Olumlu akış, yapıcı ve sağlam kararları destekliyor."],
    love: ["İçten ve samimi sohbetler karşılıklı güveni ve duygusal bağı derinleştirir.", "Özenli bir dinleme ilişkilerde huzurlu bir uyum yaratır."],
    career: ["Düzenli çalışma ve disiplin işinizde hak ettiğiniz takdiri getirir.", "Yaratıcı çözümlerle sorumluluklarınızda öne çıkabilirsiniz."],
    finances: ["Ölçülü bütçeleme ve dikkatli planlama maddi güvenliğinizi korur.", "Dengeli kararlar ekonomik istikrarınızı sağlamlaştırır."],
    energies: ["Dengeli ve odaklanmış, güçlü bir içsel dirence sahip.", "Sakin bir zihinle bütünleşmiş dinamik bir enerji."],
    advices: ["Değerlerinize sadık kalın ve sakin bir kararlılıkla ilerleyin.", "İç sesinize güvenirken somut adımları ihmal etmeyin."]
  },

  pl: {
    intros: ["Okres przejrzystości i nowej energii otacza twój znak.", "Układ planet sprzyja harmonii między ambicją a wewnętrznym spokojem."],
    forecasts: ["Twoja intuicja jest wyostrzona, co ułatwia skupienie się na kluczowych celach.", "Sprzyjająca aura wspiera konstruktywne decyzje."],
    love: ["Szczere rozmowy pogłębiają wzajemne zaufanie i bliskość.", "Empatyczne słuchanie wnosi do relacji ciepło i zrozumienie."],
    career: ["Konsekwencja i dobra organizacja przynoszą zasłużone uznanie w pracy.", "Kreatywne podejście pozwala skutecznie rozwiązywać wyzwania."],
    finances: ["Rozważne planowanie i umiar zapewniają stabilność materialną.", "Przemyślane kroki chronią twoje zasoby finansowe."],
    energies: ["Zharmonizowana i skoncentrowana, o dużej odporności psychicznej.", "Dynamiczna witalność połączona z jasnością umysłu."],
    advices: ["Bądź wierny swoim zasadom i krocz naprzód z pewnością siebie.", "Ufaj intuicji, pamiętając o praktycznych realiach."]
  },

  nl: {
    intros: ["Een periode van helderheid en hernieuwde vitaliteit omringt je sterrenbeeld.", "De kosmische stand brengt balans tussen daadkracht en bezinning."],
    forecasts: ["Je intuïtie is scherp om doelen doelgericht na te streven.", "Gunstige impulsen ondersteunen verstandige besluiten."],
    love: ["Oprechte gesprekken verdiepen het wederzijdse vertrouwen.", "Aandachtig luisteren brengt rust en harmonie in de liefde."],
    career: ["Toewijding en structuur zorgen voor erkenning op het werk.", "Creatieve inzichten helpen je op te vallen in je vak."],
    finances: ["Vooruitziende planning waarborgt je financiële zekerheid.", "Beheerste keuzes versterken je materiële basis."],
    energies: ["Harmonieus en doelgericht met een sterke innerlijke rust.", "Levendige energie gedragen door een heldere blik."],
    advices: ["Blijf trouw aan je waarden en ga met vertrouwen voorwaarts.", "Vertrouw op je gevoel en zet weloverwogen stappen."]
  },

  uk: {
    intros: ["Період ясності та оновленої життєвої сили наповнює ваш знак.", "Космічні енергії спонукають до балансу між амбіціями та внутрішнім спокоєм."],
    forecasts: ["Ваша інтуїція точна, що дозволяє чітко розставити життєві пріоритети.", "Сприятливий рух підтримує конструктивні рішення."],
    love: ["Щирі розмови зміцнюють взаємну довіру та емоційну близькість.", "Турбота та увага створюють атмосферу справжньої гармонії."],
    career: ["Наполеглива праця та організованість приносять заслужене визнання.", "Творчий підхід допомагає впоратися з будь-якими завданнями."],
    finances: ["Зважене планування забезпечує надійну матеріальну стабільність.", "Обачні рішення надійно захищають ваші фінансові справи."],
    energies: ["Гармонійна і зосереджена, з високою стійкістю духу.", "Динамічна сила у поєднанні зі спокійною розсудливістю."],
    advices: ["Залишайтеся вірними своїм цінностям і дійте зі спокійною впевненістю.", "Довіряйте внутрішньому голосу, спираючись на реальні кроки."]
  },

  ro: {
    intros: ["O perioadă de claritate și vitalitate benefică vă însoțește zodia.", "Alinierea cerească oferă echilibru între determinare și reflecție."],
    forecasts: ["Intuiția dumneavoastră este ascuțită pentru a alege obiective importante.", "Energia pozitivă susține decizii constructive."],
    love: ["Conversațiile sincere aprofundează încrederea și apropierea sufletească.", "Ascultarea caldă aduce armonie și liniște în relații."],
    career: ["Dedicarea constantă și buna organizare vă aduc recunoaștere profesională.", "Soluțiile creative vă permit să vă evidențiați."],
    finances: ["Planificarea chibzuită susține stabilitatea materială de durată.", "Deciziile cumpătate consolidează siguranța financiară."],
    energies: ["Armonioasă și concentrată, cu o rezistență interioară solidă.", "Vitalitate dinamică susținută de o minte limpede."],
    advices: ["Rămâneți fidel valorilor dumneavoastră și înaintați cu încredere calmă.", "Aveți încredere în intuiție, urmând pași concreți."]
  },

  vi: {
    intros: ["Giai đoạn sáng suốt và tràn đầy sức sống đang đồng hành cùng cung hoàng đạo của bạn.", "Năng lượng vũ trụ mang lại sự cân bằng giữa mục tiêu và sự an yên nội tâm."],
    forecasts: ["Trực giác nhạy bén giúp bạn dễ dàng xác định những mục tiêu quan trọng.", "Khí thế thuận lợi hỗ trợ các quyết định mang tính xây dựng."],
    love: ["Những cuộc trò chuyện chân thành làm sâu sắc thêm niềm tin và sự gắn kết.", "Sự lắng nghe thấu hiểu mang lại bầu không khí hòa hợp ấm áp."],
    career: ["Sự tận tâm và tính tổ chức khoa học mang lại thành quả xứng đáng trong công việc.", "Tư duy sáng tạo giúp bạn giải quyết tốt mọi thách thức."],
    finances: ["Lập kế hoạch cẩn trọng giúp củng cố sự an toàn tài chính lâu dài.", "Những quyết định tiết chế bảo vệ sự ổn định vật chất."],
    energies: ["Hài hòa và tập trung, với sức mạnh tinh thần vững vàng.", "Sinh lực dồi dào kết hợp cùng sự điềm tĩnh sáng suốt."],
    advices: ["Hãy kiên định với các giá trị của mình và tiến bước với sự tự tin điềm đạm.", "Tin tưởng vào trực giác nhưng luôn bám sát các bước thực tế."]
  },

  th: {
    intros: ["ช่วงเวลาแห่งความชัดเจนและพลังชีวิตที่ดีกำลังหมุนเวียนรอบราศีของคุณ", "การเคลื่อนตัวของดวงดาวสร้างสมดุลระหว่างความมุ่งมั่นและความสงบในใจ"],
    forecasts: ["สัญชาตญาณของคุณเฉียบคม เหมาะสำหรับการตั้งเป้าหมายที่สำคัญ", "กระแสพลังที่ดีช่วยสนับสนุนการตัดสินใจที่สร้างสรรค์"],
    love: ["การพูดคุยอย่างจริงใจช่วยเพิ่มพูนความไว้วางใจและความผูกพัน", "การรับฟังอย่างเข้าอกเข้าใจสร้างความอบอุ่นในความสัมพันธ์"],
    career: ["ความตั้งใจจริงและความเป็นระเบียบจะนำมาซึ่งความสำเร็จในหน้าที่การงาน", "การคิดแก้ปัญหาอย่างสร้างสรรค์ช่วยให้คุณโดดเด่น"],
    finances: ["การวางแผนอย่างรอบคอบช่วยเสริมสร้างความมั่นคงทางการเงินในระยะยาว", "การตัดสินใจอย่างมีสติช่วยรักษาความสมดุลทางการเงิน"],
    energies: ["สมดุลและมีสมาธิ พร้อมด้วยความเข้มแข็งทางอารมณ์", "พลังงานที่มีชีวิตชีวาและสติปัญญาที่แจ่มใส"],
    advices: ["ยึดมั่นในคุณค่าของตนเองและก้าวไปข้างหน้าด้วยความมั่นใจที่สงบนิ่ง", "เชื่อมั่นในสัญชาตญาณควบคู่ไปกับการลงมือปฏิบัติจริง"]
  },

  id: {
    intros: ["Periode kejernihan dan vitalitas terfokus menyertai zodiak Anda.", "Penyelarasan kosmik mengajak pada keseimbangan antara ambisi dan refleksi diri."],
    forecasts: ["Naluri Anda tajam untuk memprioritaskan tujuan yang bermakna.", "Momentum positif mendukung keputusan yang membangun."],
    love: ["Percakapan yang tulus memperdalam kepercayaan dan kedekatan emosional.", "Mendengarkan dengan penuh perhatian menciptakan harmoni cinta."],
    career: ["Dedikasi yang konsisten dan kerapian membawa apresiasi di tempat kerja.", "Pemecahan masalah secara kreatif membuat Anda unggul."],
    finances: ["Perencanaan anggaran yang bijak menjamin keamanan finansial jangka panjang.", "Keputusan yang terukur memperkuat stabilitas materi."],
    energies: ["Harmonis dan fokus dengan ketahanan emosional yang baik.", "Vitalitas dinamis yang diimbangi dengan ketenangan pikiran."],
    advices: ["Pegang teguh nilai-nilai Anda dan melangkahlah dengan keyakinan tenang.", "Percayalah pada intuisi Anda sambil tetap mengambil langkah nyata."]
  },

  ms: {
    intros: ["Tempoh kejelasan dan kecergasan positif kini menyelubungi zodiak anda.", "Kedudukan kosmik menggalakkan keseimbangan antara azam dan ketenangan jiwa."],
    forecasts: ["Naluri semula jadi anda tajam untuk mengutamakan matlamat bermakna.", "Momentum yang baik menyokong keputusan yang membina."],
    love: ["Perbualan ikhlas memperkukuh rasa percaya dan kemesraan.", "Mendengar dengan penuh perhatian mengundang keharmonian kasih sayang."],
    career: ["Dedikasi yang teguh dan susunan kerja yang teratur membawa penghargaan.", "Penyelesaian kreatif membolehkan anda tampil cemerlang."],
    finances: ["Perancangan kewangan yang berhemah menyokong jaminan jangka panjang.", "Keputusan yang bijak mengekalkan kestabilan rezeki."],
    energies: ["Harmoni dan fokus dengan ketahanan emosi yang kukuh.", "Kecergasan bertenaga yang diimbangi dengan ketenangan fikiran."],
    advices: ["Kekal berpegang pada prinsip anda dan melangkah dengan keyakinan tenang.", "Percayai gerak hati sambil menyusul langkah praktikal."]
  },

  bn: {
    intros: ["আপনার রাশিতে স্পষ্টতা এবং নব উদ্যমের সময় বিরাজ করছে।", "গ্রহের অবস্থান উচ্চাকাঙ্ক্ষা ও মানসিক প্রশান্তির মধ্যে ভারসাম্য তৈরি করে।"],
    forecasts: ["আপনার অন্তর্দৃষ্টি অত্যন্ত সজাগ, যা গুরুত্বপূর্ণ লক্ষ্যে পৌঁছাতে সাহায্য করবে।", "অনুকূল পরিস্থিতি গঠনমূলক সিদ্ধান্তকে সহজ করে তোলে।"],
    love: ["খোলামেলা এবং আন্তরিক কথোপকথন পারস্পরিক বিশ্বাসকে আরও গভীর করে।", "সহমর্মিতার সাথে শোনা সম্পর্কের মধ্যে উষ্ণতা বয়ে আনে।"],
    career: ["একনিষ্ঠ পরিশ্রম এবং গোছানো কাজ কর্মক্ষেত্রে সুনাম বয়ে আনবে।", "সৃজনশীল ভাবনা আপনাকে জটিল বিষয় সহজে সমাধান করতে সহায়তা করবে।"],
    finances: ["হিসাবি পরিকল্পনা দীর্ঘমেয়াদী আর্থিক নিরাপত্তাকে সুদৃঢ় করে।", "সুচিন্তিত সিদ্ধান্ত বৈষয়িক ভিত্তিকে মজবুত রাখে।"],
    energies: ["ভারসাম্যপূর্ণ এবং মনযোগী, যার সাথে দৃঢ় মানসিক স্থিরতা রয়েছে।", "শান্ত চিন্তার সাথে সক্রিয় জীবনীশক্তি।"],
    advices: ["নিজের নীতিতে অটল থাকুন এবং শান্ত আত্মবিশ্বাসের সাথে এগিয়ে যান।", "নিজের অন্তর্লীন অনুভূতিকে বিশ্বাস করে বাস্তব পদক্ষেপে মনোযোগ দিন।"]
  },

  fa: {
    intros: ["دوره‌ای از شفافیت و انرژی متمرکز نشانه فلکی شما را فرا گرفته است.", "چیدمان کیهانی شما را به تعادل میان تلاش و آرامش درونی دعوت می‌کند."],
    forecasts: ["شهود شما قوی است و به اولویت‌بندی اهداف باارزش کمک می‌کند.", "حرکت مثبت کیهانی از تصمیم‌های سازنده پشتیبانی می‌کند."],
    love: ["گفت‌وگوهای صمیمانه اعتماد متقابل و پیوند عاطفی را عمیق‌تر می‌سازد.", "گوش دادن با مهر و محبت، آرامش را در روابط به ارمغان می‌آورد."],
    career: ["پشتکار مداوم و نظم شفاف در محیط کار برایتان شایستگی می‌آورد.", "راه‌حل‌های خلاقانه به پیشرفت حرفه‌ای شما یاری می‌رساند."],
    finances: ["برنامه‌ریزی دقیق و حساب‌شده امنیت مالی پایداری ایجاد می‌کند.", "تصمیم‌های سنجیده بنیان مادی شما را تقویت می‌نماید."],
    energies: ["هماهنگ و متمرکز همراه با تاب‌آوری روحی بالا.", "نشاط پویا در کنار آرامش و خرد روشن."],
    advices: ["به ارزش‌های درونی خود وفادار بمانید و با اطمینان گام بردارید.", "به ندای درون اعتماد کنید و گام‌های عملی و استوار بردارید."]
  },

  ur: {
    intros: ["آپ کے برج میں واضح بصیرت اور مثبت توانائی کا نیا دور شروع ہو رہا ہے۔", "فلکیاتی ترتیب محنت اور اندرونی سکون کے درمیان توازن کی ترغیب دیتی ہے۔"],
    forecasts: ["آپ کی بصیرت تیز ہے جو اہم مقاصد کو ترجیح دینے میں مدد دے گی۔", "سازگار حالات تعمیری اور درست فیصلوں میں معاون ہیں۔"],
    love: ["مخلصانہ گفتگو باہمی اعتماد اور محبت کو گہرا کرتی ہے۔", "توجہ سے سننا تعلقات میں خوشگوار ہم آہنگی پیدا کرتا ہے۔"],
    career: ["مسلسل محنت اور باقاعدگی کام کی جگہ پر آپ کو عزت دلاتی ہے۔", "تخلیقی سوچ آپ کو پیشہ ورانہ میدان میں نمایاں کرتی ہے۔"],
    finances: ["سوچ سمجھ کر کیا گیا منصوبہ طویل مدتی مالی تحفظ فراہم کرتا ہے۔", "سنجیدہ فیصلے آپ کے معاشی استحکام کو قائم رکھتے ہیں۔"],
    energies: ["متوازن اور پرعزم، جس میں مضبوط جذباتی استقامت شامل ہے۔", "پرسکون ذہن کے ساتھ متحرک توانائی۔"],
    advices: ["اپنے اصولوں پر قائم رہیں اور پرسکون اعتماد کے ساتھ آگے بڑھیں۔", "اپنے دل کی آواز پر بھروسہ کریں اور عملی قدم اٹھائیں۔"]
  },

  ta: {
    intros: ["உங்கள் ராசியில் தெளிவும் புத்துணர்ச்சியூட்டும் ஆற்றலும் நிறைகிறது.", "கோள்களின் நிலை முயற்சிக்கும் மன அமைதிக்கும் இடையே சமநிலையைத் தருகிறது."],
    forecasts: ["உங்கள் உள்ளுணர்வு கூர்மையாக உள்ளது, முக்கிய இலக்குகளை அடைய இது நல்ல நேரம்.", "நேர்மறையான சூழல் ஆக்கபூர்வமான முடிவுகளுக்கு உதவுகிறது."],
    love: ["மனம் திறந்த உரையாடல்கள் பரஸ்பர நம்பிக்கையையும் அன்பையும் வளர்க்கும்.", "அக்கறையுடன் கவனிப்பது உறவுகளில் நல்லிணக்கத்தை உருவாக்குகிறது."],
    career: ["விடாமுயற்சியும் திட்டமிடலும் பணியிடத்தில் நற்பெயரை பெற்றுத் தரும்.", "படைப்பாற்றல்மிக்க அணுகுமுறை சவால்களை சமாளிக்க உதவும்."],
    finances: ["திட்டமிட்ட நிதி மேலாண்மை நீண்டகால பாதுகாப்பை உறுதி செய்கிறது.", "அளவான முடிவுகள் பொருளாதார ஸ்திரத்தன்மையை காக்கும்."],
    energies: ["சமநிலையான மற்றும் மன உறுதி கொண்ட ஆற்றல்.", "அமைதியான தெளிவுடன் கூடிய சுறுசுறுப்பான செயல்பாடு."],
    advices: ["உங்கள் கொள்கைகளில் உறுதியாக இருந்து அமைதியான நம்பிக்கையுடன் முன்னேறுங்கள்.", "உள்ளுணர்வை நம்பி நடைமுறை நடவடிக்கைகளை மேற்கொள்ளுங்கள்."]
  },

  te: {
    intros: ["మీ రాశిలో స్పష్టత మరియు సానుకూల జీవకళ ప్రవహిస్తోంది.", "గ్రహాల స్థితులు పట్టుదలకు మరియు అంతర్గత శాంతికి మధ్య సమతుల్యతను కలిగిస్తాయి."],
    forecasts: ["మీ సహజ అంతర్దృష్టి బలంగా ఉంది, ప్రధాన లక్ష్యాలపై దృష్టి పెట్టడానికి ఇది మంచి సమయం.", "అనుకూల వేగం నిర్మాణాత్మక నిర్ణయాలకు మద్దతు ఇస్తుంది."],
    love: ["మనస్ఫూర్తిగా మాట్లాడటం వల్ల పరస్పర నమ్మకం మరియు అనుబంధం బలపడుతుంది.", "ఆప్యాయతతో వినడం సంబంధాలలో శాంతిని చేకూరుస్తుంది."],
    career: ["నిరంతర కృషి మరియు క్రమశిక్షణ పని ప్రదేశంలో మంచి గుర్తింపును తెస్తాయి.", "సృజనాత్మక ఆలోచనలు మిమ్మల్ని ముందుంచుతాయి."],
    finances: ["ముందుచూపుతో చేసే ప్రణాళిక దీర్ఘకాలిక ఆర్థిక భద్రతను నిర్ధారిస్తుంది.", "సమతుల్య నిర్ణయాలు భౌతిక స్థిరత్వాన్ని కాపాడతాయి."],
    energies: ["సహనంతో కూడిన సమతుల్య మరియు ఏకాగ్రత గల శక్తి.", "శాంతమైన స్పష్టతతో కూడిన చురుకైన జీవశక్తి."],
    advices: ["మీ విలువలకు కట్టుబడి ఉండి ప్రశాంతమైన ఆత్మవిశ్వాసంతో ముందుకు సాగండి.", "అంతరాత్మను నమ్ముతూ ఆచరణాత్మక అడుగులు వేయండి."]
  },

  sw: {
    intros: ["Kipindi cha uwazi na nguvu mpya kinazunguka nyota yako.", "Mpangilio wa sayari unaleta usawa kati ya malengo na utulivu wa ndani."],
    forecasts: ["Hekima yako ya asili ni imara, ikikusaidia kuzingatia mambo muhimu.", "Mwelekeo mzuri unasaidia maamuzi yenye tija."],
    love: ["Mazungumzo ya dhati yanazidisha uaminifu na upendo.", "Kusikiliza kwa wema kunaleta amani katika mahusiano."],
    career: ["Kujituma kwa utaratibu kunaleta heshima katika kazi yako.", "Mawazo ya ubunifu yanakusaidia kufanikiwa."],
    finances: ["Kupanga matumizi vizuri kunaleta usalama wa kifedha wa muda mrefu.", "Uamuzi makini unalinda uchumi wako."],
    energies: ["Yenye amani na umakini, ikiwa na utulivu thabiti wa hisia.", "Nguvu ya vitendo inayoongozwa na akili tulivu."],
    advices: ["Shikilia maadili yako na usonge mbele kwa ujasiri tulivu.", "Amini hisia zako za ndani huku ukichukua hatua thabiti."]
  }
};
COMPONENT_POOLS.in = COMPONENT_POOLS.id;

/**
 * Ask the Stars category classifications and answers for all 28 languages.
 */
export const ASK_STARS_CATEGORIES = {
  love: {
    keywords: [
      "love", "relationship", "crush", "marry", "marriage", "partner", "dating", "ex", "soulmate", "heart",
      "szerel", "kapcsolat", "pár", "házas", "randi", "szív", "szakít",
      "liebe", "beziehung", "partner", "heirat", "herz", "romantik",
      "amour", "mariage", "couple", "amoureux", "coeur",
      "amore", "matrimonio", "coppia", "fidanzato", "cuore",
      "любовь", "отношения", "брак", "партнер", "сердце", "свадьба",
      "amor", "pareja", "matrimonio", "relacion", "corazon", "enamorado", "novio", "novia",
      "casamento", "namorado", "namorada", "relacionamento",
      "爱", "感情", "结婚", "伴侣", "恋爱", "前任", "心仪", "姻缘",
      "愛", "恋愛", "結婚", "パートナー", "恋人", "復縁",
      "사랑", "연애", "결혼", "애인", "인연", "짝사랑",
      "حب", "علاقة", "زواج", "تزوج", "اتزوج", "شريك", "حبيب", "قلب", "خطوبة",
      "प्यार", "प्रेम", "विवाह", "शादी", "रिश्ता", "साथी",
      "aşk", "ilişki", "evlilik", "sevgili", "kalp", "eş",
      "miłość", "związek", "małżeństwo", "partner", "serce",
      "liefde", "relatie", "huwelijk", "partner", "hart",
      "кохання", "стосунки", "шлюб", "партнер", "серце",
      "dragoste", "relație", "căsătorie", "partener", "inimă",
      "tình yêu", "kết hôn", "người yêu", "hôn nhân",
      "ความรัก", "แต่งงาน", "แฟน", "คู่ครอง", "คนรัก",
      "cinta", "hubungan", "pernikahan", "jodoh", "pasangan",
      "kasih", "kahwin", "pasangan hidup",
      "ভালোবাসা", "প্রেম", "বিয়ে", "সঙ্গী", "সম্পর্ক",
      "عشق", "ازدواج", "رابطه", "همسر", "یار",
      "محبت", "شادی", "رشتہ", "ہمسفر",
      "காதல்", "திருமணம்", "துணை", "உறவு",
      "ప్రేమ", "వివాహం", "పెళ్లి", "భాగస్వామి",
      "mapenzi", "ndoa", "mpenzi", "uhusiano"
    ],
    answers: {
      en: "The stars suggest opening your heart to genuine understanding. Focus on mutual respect and allow connections to unfold naturally without rushing.",
      hu: "A csillagok arra intenek, hogy nyisd meg a szíved az őszinte megértés előtt. Építs a kölcsönös tiszteletre, és hagyd a kapcsolatokat természetesen kibontakozni.",
      de: "Die Gestirne raten dazu, dein Herz für aufrichtiges Verständnis zu öffnen. Baue auf gegenseitigen Respekt und lass Gefühle natürlich wachsen.",
      fr: "Les astres vous invitent à ouvrir votre cœur à une compréhension sincère. Fondez vos relations sur le respect mutuel et laissez les liens se tisser naturellement.",
      it: "Gli astri consigliano di aprire il cuore a una comprensione sincera. Punta sul rispetto reciproco e lascia che i sentimenti crescano con naturalezza.",
      ru: "Звезды советуют открыть сердце для искреннего понимания. Опирайтесь на взаимное уважение и позвольте отношениям развиваться гармонично.",
      es: "Los astros te invitan a abrir el corazón a la comprensión mutua. Confía en el respeto sincero y permite que los lazos crezcan con naturalidad.",
      pt: "Os astros aconselham a abrir o coração para uma compreensão genuína. Valorize o respeito mútuo e permita que os laços se desenvolvam com naturalidade.",
      zh: "星象启示敞开内心去真诚理解彼此。专注于相互尊重，让真挚的情感在自然节奏中生根发芽。",
      ja: "星々は心を開いて真摯に向き合うことを勧めています。お互いの尊重を大切にし、絆が自然に深まるのを見守りましょう。",
      ko: "별들은 진실된 이해를 위해 마음을 열 것을 조언합니다. 상호 존중을 바탕으로 인연이 자연스럽게 자라나도록 하세요.",
      ar: "تشير النجوم إلى أهمية فتح قلبك للتفاهم الصادق. ركز على الاحترام المتبادل ودع المشاعر تتطور بتناغم وهدوء.",
      hi: "सितारे सच्चे दृष्टिकोण और खुले दिल की सलाह देते हैं। आपसी सम्मान पर ध्यान दें और रिश्तों को स्वाभाविक रूप से आगे बढ़ने दें।",
      tr: "Yıldızlar kalbinizi samimi bir anlayışa açmanızı öneriyor. Karşılıklı saygıya odaklanın ve bağların doğal akışında gelişmesine izin verin.",
      pl: "Gwiazdy radzą otworzyć serce na szczere zrozumienie. Skup się na wzajemnym szacunku i pozwól relacjom rozwijać się naturalnie.",
      nl: "De sterren adviseren je hart te openen voor oprecht begrip. Focus op wederzijds respect en laat gevoelens op natuurlijke wijze groeien.",
      uk: "Зірки радять відкрити серце для щирого розуміння. Спирайтеся на взаємну повагу та дайте стосункам розвиватися гармонійно.",
      ro: "Astrele vă îndeamnă să vă deschideți inima către o înțelegere sinceră. Bazați-vă pe respect reciproc și lăsați sentimentele să evolueze natural.",
      vi: "Các vì sao khuyên bạn nên mở lòng để thấu hiểu chân thành. Hãy xây dựng trên sự tôn trọng lẫn nhau và để tình cảm phát triển tự nhiên.",
      th: "ดวงดาวแนะนำให้เปิดใจรับความเข้าใจที่แท้จริง มุ่งเน้นการเคารพซึ่งกันและกัน และปล่อยให้ความสัมพันธ์เติบโตอย่างเป็นธรรมชาติ",
      id: "Bintang-bintang menyarankan untuk membuka hati pada pengertian yang tulus. Fokuslah pada saling menghormati dan biarkan ikatan berkembang secara alami.",
      ms: "Bintang-bintang mencadangkan anda membuka hati untuk saling memahami. Berikan keutamaan kepada rasa hormat dan biarkan hubungan mekar secara semula jadi.",
      bn: "নক্ষত্রেরা মন খুলে আন্তরিক বোঝাপড়ার পরামর্শ দেয়। পারস্পরিক শ্রদ্ধাবোধ বজায় রাখুন এবং সম্পর্ককে স্বাভাবিক গতিতে এগিয়ে যেতে দিন।",
      fa: "ستارگان به شما پیشنهاد می‌کنند قلبتان را به روی درک متقابل بگشایید و بگذارید پیوندها با احترام و در آرامش شکوفا شوند.",
      ur: "ستارے دل کو مخلصانہ فہم کے لیے کھولنے کا مشورہ دیتے ہیں۔ باہمی احترام پر توجہ دیں اور رشتوں کو قدرتی انداز میں پروان چڑھنے دیں۔",
      ta: "உண்மையான புரிதலுக்காக உங்கள் இதயத்தைத் திறக்க நட்சத்திரங்கள் அறிவுறுத்துகின்றன. பரஸ்பர மரியாதையுடன் உறவுகள் இயல்பாக மலர அனுமதியுங்கள்.",
      te: "నిజమైన అవగాహన కోసం హృదయాన్ని తెరవాలని నక్షత్రాలు సూచిస్తున్నాయి. పరస్పర గౌరవాన్ని కాపాడుకుంటూ బంధాలు సహజంగా వికసించనివ్వండి.",
      sw: "Nyota zinashauri kufungua moyo wako kwa maelewano ya dhati. Zingatia kuheshimiana na uruhusu uhusiano ukue kwa utulivu wa asili."
    }
  },

  career: {
    keywords: [
      "job", "career", "work", "boss", "interview", "promotion", "business", "project", "hired", "profession",
      "munka", "karrier", "állás", "főnök", "előléptet", "üzlet", "hivatás",
      "arbeit", "beruf", "karriere", "chef", "bewerbung",
      "travail", "carrière", "emploi", "métier", "projet",
      "lavoro", "carriera", "colloquio", "progetto",
      "работа", "карьера", "профессия", "бизнес", "проект",
      "trabajo", "carrera", "empleo", "jefe", "negocio",
      "trabalho", "carreira", "emprego", "negócio",
      "工作", "事业", "职业", "升职", "面试", "项目",
      "仕事", "就職", "キャリア", "昇進", "面接",
      "직장", "취업", "승진", "커리어", "사업",
      "عمل", "مهنة", "وظيفة", "ترقية", "مشروع",
      "नौकरी", "काम", "करियर", "व्यवसाय", "पदोन्नति",
      "iş", "kariyer", "meslek", "terfi", "mülakat",
      "praca", "kariera", "zawód", "awans",
      "werk", "baan", "carrière", "promotie",
      "робота", "кар'єра", "посада", "бізнес",
      "muncă", "carieră", "serviciu", "profesie",
      "công việc", "sự nghiệp", "thăng tiến", "kinh doanh",
      "การงาน", "อาชีพ", "สมัครงาน", "เลื่อนตำแหน่ง",
      "pekerjaan", "karier", "usaha", "promosi",
      "kerjaya", "tugas", "jawatan",
      "চাকরি", "কাজ", "পেশা", "উন্নতি", "ব্যবসা",
      "شغل", "کار", "حرفه", "ترفیع",
      "ملازمت", "کام", "کاروبار", "ترقی",
      "வேலை", "தொழில்", "பதவி உயர்வு",
      "ఉద్యోగం", "వృత్తి", "పని", "వ్యాపారం",
      "kazi", "ajira", "biashara", "wadhifa"
    ],
    answers: {
      en: "Your diligence and structured focus will reveal new professional clarity. Trust your skills and take measured, steady steps toward your objectives.",
      hu: "Szorgalmad és fegyelmezett összpontosításod új szakmai tisztánlátást hoz. Bízz a képességeidben, és haladj megfontolt lépésekkel a céljaid felé.",
      de: "Dein Fleiß und strukturierter Fokus eröffnen berufliche Klarheit. Vertraue deinen Fähigkeiten und gehe überlegte Schritte auf deine Ziele zu.",
      fr: "Votre persévérance et votre organisation vous apporteront une belle clarté professionnelle. Ayez confiance en vos compétences et avancez avec méthode.",
      it: "La tua dedizione e il rigore apriranno nuove strade professionali. Abbi fiducia nelle tue capacità e avanza con passi sicuri.",
      ru: "Ваше усердие и четкая организация откроют новые профессиональные горизонты. Доверяйте своим навыкам и двигайтесь к целям уверенно.",
      es: "Tu constancia y enfoque metódico te aportarán claridad profesional. Confía en tu talento y avanza con pasos firmes y bien meditados.",
      pt: "A sua dedicação e método trarão nova clareza à sua vida profissional. Confie nas suas competências e dê passos firmes rumo às suas metas.",
      zh: "你的专注与勤勉将带来清晰的职业发展路径。信任自身专业实力，稳步践行既定计划。",
      ja: "地道な努力と計画的な集中が、仕事における新たな可能性を開きます。自身のスキルを信じ、着実に目標へ向かいましょう。",
      ko: "성실한 노력과 체계적인 집중이 직업적 성취의 길을 열어줄 것입니다. 자신의 능력을 신뢰하고 차분하게 목표를 향해 나아가세요.",
      ar: "جهدك المستمر وتركيزك المنظم سيمنحانك وضوحاً مهنياً كبيراً. ثق بمهاراتك واخطُ خطوات مدروسة ومدركة نحو أهدافك.",
      hi: "आपकी लगन और व्यवस्थित ध्यान कार्यक्षेत्र में नए मार्ग खोलेगा। अपने कौशल पर विश्वास रखें और सधे हुए कदमों से आगे बढ़ें।",
      tr: "Azminiz ve düzenli çalışmanız mesleki anlamda yeni kapılar aralayacaktır. Yeteneklerinize güvenin ve hedeflerinize kararlılıkla ilerleyin.",
      pl: "Twoja pracowitość i konsekwencja przyniosą jasność zawodową. Ufaj swoim umiejętnościom i stawiaj przemyślane kroki ku celom.",
      nl: "Je toewijding en gestructureerde aanpak brengen professionele helderheid. Vertrouw op je capaciteiten en zet doordachte stappen.",
      uk: "Ваша наполегливість та організованість відкриють нові професійні перспективи. Довіряйте своїм знанням і впевнено йдіть до мети.",
      ro: "Perseverența și organizarea vă vor aduce claritate profesională. Aveți încredere în abilitățile dumneavoastră și înaintați metodic.",
      vi: "Sự kiên trì và định hướng rõ ràng sẽ mở ra những bước tiến mới trong sự nghiệp. Hãy tự tin vào kỹ năng của mình và vững bước.",
      th: "ความมุ่งมั่นและความเป็นระเบียบจะช่วยเปิดเส้นทางใหม่ในการทำงาน จงเชื่อมั่นในทักษะของตนเองและก้าวไปสู่เป้าหมายอย่างมั่นคง",
      id: "Ketekunan dan fokus terstruktur Anda akan membuka kejelasan karier baru. Percayalah pada kemampuan Anda dan melangkahlah dengan mantap.",
      ms: "Ketekunan dan tumpuan teratur anda akan membuka peluang kerjaya yang jelas. Yakini kebolehan anda dan ambil langkah yang terukur.",
      bn: "আপনার নিষ্ঠা ও সুনির্দিষ্ট পরিকল্পনা কর্মজীবনে নতুন পথ দেখাবে। নিজের দক্ষতার ওপর আস্থা রাখুন এবং লক্ষ্য অর্জনে দৃঢ় পদক্ষেপে এগিয়ে চলুন।",
      fa: "پشتکار و تمرکز شما مسیرهای شغلی روشنی را نمایان می‌سازد. به مهارت‌هایتان اعتماد کنید و گام‌های سنجیده بردارید.",
      ur: "آپ کی محنت اور منظم توجہ پیشہ ورانہ میدان میں نئی راہیں کھولے گی۔ اپنی صلاحیتوں پر بھروسہ رکھیں اور استقامت سے آگے بڑھیں۔",
      ta: "உங்கள் கடின உழைப்பும் திட்டமிடலும் தொழிலில் புதிய தெளிவைத் தரும். உங்கள் திறமையை நம்பி உறுதியான அடிகளை எடுத்து வையுங்கள்.",
      te: "మీ కృషి మరియు ప్రణాళికాబద్ధమైన దృష్టి వృత్తిపరమైన స్పష్టతను ఇస్తాయి. మీ నైపుణ్యాలపై నమ్మకంతో లక్ష్యాల వైపు సాగండి.",
      sw: "Bidii yako na mpangilio mzuri utaleta mafanikio katika kazi yako. Amini ujuzi wako na chukua hatua thabiti kuelekea malengo yako."
    }
  },

  finances: {
    keywords: [
      "money", "wealth", "rich", "crypto", "invest", "finance", "debt", "buy", "sell", "fortune",
      "pénz", "vagyon", "gazdag", "befektet", "adósság",
      "geld", "finanzen", "investieren", "vermögen",
      "argent", "finance", "richesse", "investir",
      "denaro", "soldi", "finanza", "investimento",
      "деньги", "финансы", "богатство", "инвестиции",
      "dinero", "finanzas", "riqueza", "invertir",
      "dinheiro", "finanças", "investimento",
      "钱", "财富", "发财", "投资", "财务",
      "お金", "財運", "投資", "金運",
      "돈", "재물", "투자", "금전",
      "مال", "نقود", "ثروة", "استثمار",
      "धन", "पैसा", "निवेश", "संपत्ति",
      "para", "zenginlik", "yatırım", "finans",
      "pieniądze", "finanse", "majątek", "inwestycje",
      "geld", "financiën", "investeren",
      "гроші", "фінанси", "багатство", "інвестиції",
      "bani", "finanțe", "investiții",
      "tiền", "tài chính", "đầu tư",
      "เงิน", "การเงิน", "ลงทุน", "ความร่ำรวย",
      "uang", "keuangan", "investasi",
      "wang", "kewangan", "pelaburan",
      "টাকা", "অর্থ", "সম্পদ", "বিনিয়োগ",
      "پول", "ثروت", "سرمایه‌گذاری",
      "دولت", "پیسہ", "سرمایہ کاری",
      "பணம்", "செல்வம்", "முதலீடு",
      "డబ్బు", "ఆర్థికం", "సంపద", "పెట్టుబడి",
      "pesa", "utajiri", "uwekezaji"
    ],
    answers: {
      en: "A grounded, disciplined perspective supports sustainable material balance. Prioritize long-term value over short-term impulses.",
      hu: "A megfontolt, fegyelmezett szemlélet segíti az anyagi egyensúlyt. Részesítsd előnyben a tartós értékeket a pillanatnyi vágyakkal szemben.",
      de: "Eine besonnene, disziplinierte Haltung stärkt dein materielles Fundament. Setze auf nachhaltigen Wert statt kurzfristige Impulse.",
      fr: "Une approche mesurée et réfléchie favorise la stabilité financière. Privilégiez la valeur durable aux impulsions passagères.",
      it: "Un approccio disciplinato protegge il tuo equilibrio economico. Dai la priorità al valore duraturo rispetto a spese impulsive.",
      ru: "Осмотрительный и дисциплинированный подход укрепляет финансовую стабильность. Отдавайте предпочтение долгосрочным ценностям.",
      es: "Una perspectiva prudente y disciplinada favorece la estabilidad económica. Da prioridad al valor duradero frente a impulsos pasajeros.",
      pt: "Uma visão disciplinada e realista apoia a estabilidade financeira. Dê prioridade a valores duradouros em vez de impulsos efémeros.",
      zh: "务实自律的视角有助于保持长远财务健康。注重长期价值积累，理性面对眼前诱惑。",
      ja: "堅実で計画的な視点が、持続可能な経済的安定を支えます。目先の衝動よりも長期的な価値を優先しましょう。",
      ko: "현명하고 절제된 시각이 지속 가능한 재정적 균형을 지탱합니다. 일시적인 충동보다는 장기적인 가치에 우선순위를 두세요.",
      ar: "النظرة الحكيمة والمنضبطة تدعم استقرارك المالي طويل الأمد. اجعل الأولوية للقيمة الدائمة على حساب الرغبات العابرة.",
      hi: "संयमित और व्यावहारिक दृष्टिकोण दीर्घकालिक आर्थिक संतुलन बनाए रखता है। क्षणिक इच्छाओं की तुलना में स्थायी मूल्य को प्राथमिकता दें।",
      tr: "Sağduyulu ve planlı bir yaklaşım uzun vadeli maddi dengeyi korur. Geçici hevesler yerine kalıcı değerlere öncelik verin.",
      pl: "Rozważne i zdyscyplinowane podejście wspiera stabilność finansową. Przedkładaj długoterminową wartość nad chwilowe zachcianki.",
      nl: "Een nuchtere en gedisciplineerde blik bevordert duurzame financiële rust. Kies voor langetermijnwaarde boven kortstondige impulsen.",
      uk: "Зважений та дисциплінований підхід зміцнює фінансову рівновагу. Віддавайте перевагу тривалій цінності над миттєвими бажаннями.",
      ro: "O perspectivă cumpătată sprijină stabilitatea financiară durabilă. Puneți preț pe valoarea pe termen lung înaintea impulsurilor de moment.",
      vi: "Góc nhìn thực tế và có kỷ luật giúp duy trì sự cân bằng tài chính bền vững. Hãy ưu tiên giá trị lâu dài thay vì những thôi thúc ngắn hạn.",
      th: "มุมมองที่มีวินัยและรอบคอบช่วยส่งเสริมความมั่นคงทางการเงินในระยะยาว ให้ความสำคัญกับคุณค่าที่ยั่งยืนมากกว่าความอยากชั่วคราว",
      id: "Sudut pandang yang bijak dan disiplin mendukung stabilitas keuangan. Utamakan nilai jangka panjang daripada dorongan sesaat.",
      ms: "Pendekatan yang berdisiplin menyokong kestabilan kewangan berterusan. Utamakan nilai jangka panjang berbanding dorongan sementara.",
      bn: "একটি সুশৃঙ্খল ও বাস্তবসম্মত দৃষ্টিভঙ্গি দীর্ঘমেয়াদী আর্থিক স্থায়িত্ব বজায় রাখে। ক্ষণস্থায়ী ইচ্ছার চেয়ে স্থায়ী মূল্যকে অগ্রাধিকার দিন।",
      fa: "دیدگاهی سنجیده و منضبط به پایداری مالی شما کمک می‌کند. ارزش‌های پایدار را به خواسته‌های گذرا ترجیح دهید.",
      ur: "حکمت اور نظم و ضبط سے بھرپور سوچ پائیدار مالی استحکام لاتی ہے۔ عارضی خواہشات پر دیرپا اقدار کو ترجیح دیں۔",
      ta: "ஒழுக்கமான பார்வை நீண்டகால நிதி ஸ்திரத்தன்மையை உறுதி செய்கிறது. தற்காலிக ஆசைகளை விட நிலையான மதிப்பிற்கு முன்னுரிமை கொடுங்கள்.",
      te: "క్రమశిక్షణతో కూడిన దృక్పథం దీర్ఘకాలిక ఆర్థిక సమతుల్యతను కాపాడుతుంది. తాత్కాలిక ఆలోచనల కంటే శాశ్వత విలువలకు ప్రాధాన్యత ఇవ్వండి.",
      sw: "Msimamo makini na nidhamu unaleta utulivu thabiti wa kiuchumi. Weka kipaumbele kwenye thamani ya kudumu kuliko tamaa za muda mfupi."
    }
  },

  decision: {
    keywords: [
      "should i", "choose", "choice", "decision", "decide", "which", "path", "unsure",
      "kell-e", "válassz", "döntés", "döntsek", "melyik",
      "soll ich", "entscheiden", "entscheidung", "wahl",
      "dois-je", "choisir", "décision", "décider",
      "devo", "scegliere", "decisione", "dubbio",
      "стоит ли", "выбрать", "решение", "сомнения",
      "debo", "elegir", "decision", "decidir",
      "devo", "escolher", "decisão", "dúvida",
      "该不该", "选择", "决定", "迷茫", "纠结",
      "決断", "選択", "迷い", "どうすべき",
      "선택", "결정", "고민", "망설임",
      "هل يجب", "اختار", "قرار", "طريق", "محتار",
      "क्या मुझे", "फैसला", "निर्णय", "चुनाव",
      "yapmalı mıyım", "karar", "seçim", "ikilem",
      "czy powinienem", "wybór", "decyzja",
      "moet ik", "kiezen", "beslissing",
      "чи варто", "вибір", "рішення",
      "ar trebui", "alegere", "decizie",
      "tôi có nên", "lựa chọn", "quyết định",
      "ควรหรือไม่", "ตัดสินใจ", "ทางเลือก",
      "haruskah", "memilih", "keputusan", "ragu",
      "patutkah", "pilihan", "keputusan",
      "আমার কি করা উচিত", "সিদ্ধান্ত", "পছন্দ",
      "آیا باید", "انتخاب", "تصمیم", "دو دل",
      "کیا مجھے", "فیصلہ", "انتخاب",
      "நான் செய்ய வேண்டுமா", "முடிவு", "தேர்வு",
      "నేను చేయాలా", "నిర్ణయం", "ఎంపిక",
      "je, nifanye", "uamuzi", "chaguo"
    ],
    answers: {
      en: "Align your choice with what brings lasting peace rather than immediate gratification. When your inner values guide you, clarity follows.",
      hu: "Igazítsd a döntésedet ahhoz, ami tartós békét hoz, nem pedig pillanatnyi kényelmet. Amikor a belső értékeid vezetnek, megérkezik a bizonyosság.",
      de: "Richte deine Wahl nach dem aus, was dir echten inneren Frieden bringt. Wenn deine Grundwerte dich leiten, folgt die Klarheit von selbst.",
      fr: "Orientez votre choix vers ce qui apporte une sérénité durable plutôt qu'un soulagement éphémère. Vos valeurs fondamentales éclaireront votre voie.",
      it: "Orienta la tua scelta verso ciò che porta pace duratura anziché gratificazione immediata. Quando i tuoi valori ti guidano, la chiarezza arriva.",
      ru: "Согласуйте свой выбор с тем, что приносит долгосрочный душевный покой. Когда вами руководят истинные ценности, ясность приходит сама.",
      es: "Guía tu elección hacia aquello que te brinde paz interior duradera. Cuando tus valores esenciales te orientan, la certeza aparece.",
      pt: "Oriente a sua escolha para aquilo que traz paz duradoura. Quando os seus valores autênticos guiam o caminho, a clareza manifesta-se.",
      zh: "将你的选择建立在带来持久宁静的事物上。当内在核心价值观为你导航时，明朗与笃定便会随之而来。",
      ja: "一時的な満足よりも、長く続く心の安らぎをもたらす選択を心がけてください。自身の信念に従うことで、自ずと答えは見えてきます。",
      ko: "일시적인 만족보다는 지속적인 마음의 평화를 가져다주는 길을 선택하세요. 진정한 내면의 가치를 따를 때 명확한 해답이 나타납니다.",
      ar: "وجّه خيارك نحو ما يجلب لك الطمأنينة وراحة البال الدائمة. عندما ترشدك مبادئك العمیقة، تتضح الرؤية بشكل طبيعي.",
      hi: "क्षणिक संतुष्टि के स्थान पर उस विकल्प को चुनें जो स्थायी मानसिक शांति दे। जब आपके आंतरिक मूल्य मार्गदर्शन करते हैं, तो स्पष्टता स्वतः आ जाती है।",
      tr: "Seçiminizi geçici hevesler yerine size kalıcı iç huzuru getirecek olana göre yapın. Öz değerleriniz rehberiniz olduğunda berraklık kendiliğinden gelir.",
      pl: "Kieruj się tym, co przynosi trwały spokój, a nie tylko chwilową ulgę. Gdy przewodnikami są twoje wartości, jasność pojawia się sama.",
      nl: "Kies voor wat duurzame innerlijke vrede brengt in plaats van kortstondig gemak. Wanneer je kernwaarden je leiden, volgt helderheid vanzelf.",
      uk: "Обирайте те, що дарує тривалий душевний спокій, а не миттєву вигоду. Коли вас ведуть справжні цінності, вірний шлях стає очевидним.",
      ro: "Alegeți ceea ce aduce pace sufletească durabilă. Când valorile dumneavoastră fundamentale vă ghidează, claritatea apare de la sine.",
      vi: "Hãy hướng sự lựa chọn vào điều mang lại sự bình an lâu dài. Khi các giá trị cốt lõi soi đường, sự sáng suốt sẽ tự khắc xuất hiện.",
      th: "เลือกสิ่งที่นำมาซึ่งความสงบสุขที่ยั่งยืนมากกว่าความพึงพอใจชั่วขณะ เมื่อคุณยึดมั่นในคุณค่าภายใน ความชัดเจนจะตามมาเอง",
      id: "Arahkan pilihan Anda pada hal yang membawa kedamaian abadi. Ketika nilai-nilai batin memandu, kejelasan akan hadir dengan sendirinya.",
      ms: "Halakan pilihan anda kepada perkara yang membawa ketenangan jiwa yang berpanjangan. Apabila nilai murni membimbing anda, kejelasan akan menyusul.",
      bn: "ক্ষণিকের সন্তুষ্টির চেয়ে যা দীর্ঘস্থায়ী শান্তি আনে এমন পথ বেছে নিন। যখন আপনার অন্তরের মূল্যবোধ পথ দেখায়, তখন সংশয় দূর হয়ে স্পষ্টতা আসে।",
      fa: "انتخاب خود را با آنچه آرامش پایدار می‌آورد هماهنگ کنید. زمانی که ارزش‌های اصیل راهنمای شما باشند، وضوح پدیدار می‌شود.",
      ur: "اپنے فیصلے کو اس بات سے ہم آہنگ کریں جو دیرپا سکون لائے۔ جب آپ کی اندرونی اقدار رہنمائی کرتی ہیں تو وضاحت خود بخود آ جاتی ہے۔",
      ta: "தற்காலிக மகிழ்ச்சியை விட நிலையான மன அமைதியைத் தரும் வழியைத் தேர்ந்தெடுங்கள். உங்கள் உண்மையான கொள்கைகள் வழிநடத்தும் போது தெளிவு பிறக்கும்.",
      te: "తాత్కాలిక ఆనందం కంటే శాశ్వత శాంతిని ఇచ్చే దిశగా నిర్ణయం తీసుకోండి. అంతర్గత విలువలు మార్గనిర్దేశం చేసినప్పుడు స్పష్టత దానంతట అదే వస్తుంది.",
      sw: "Chagua njia inayoleta amani ya kudumu ya moyo. Wakati misingi yako ya ndani inakuongoza, mwanga na ukweli utajidhihirisha wazi."
    }
  },

  general: {
    keywords: [],
    answers: {
      en: "The planetary energy encourages patience and self-trust. Focus on what is within your control, and allow the broader cycle to support your growth.",
      hu: "A csillagok türelemre és önbizalomra biztatnak. Koncentrálj arra, ami a te kezedben van, és engedd, hogy az idő támogassa a kibontakozásodat.",
      de: "Die kosmische Energie schenkt Geduld und Selbstvertrauen. Konzentriere dich auf das Machbare und vertraue dem natürlichen Zeitplan.",
      fr: "Les énergies cosmiques encouragent la patience et la confiance en soi. Concentrez-vous sur ce qui dépend de vous et laissez le temps agir.",
      it: "Gli influssi planetari incoraggiano pazienza e fiducia in te stesso. Concentrati su ciò che puoi controllare e lascia che il tempo lavori per te.",
      ru: "Космические энергии призывают к терпению и уверенности в себе. Сосредоточьтесь на том, что в ваших руках, и доверьтесь естественному ходу событий.",
      es: "La energía cósmica te alienta a cultivar la paciencia y la autoconfianza. Ocúpate de lo que está en tus manos y confía en el tiempo del universo.",
      pt: "A energia cósmica incentiva a paciência e a autoconfiança. Foque no que está ao seu alcance e permita que o tempo apoie o seu crescimento.",
      zh: "宇宙能量启示我们保持耐心与自信。专注于自身所能掌控的当下，静候时间为你沉淀丰硕果实。",
      ja: "宇宙の流れは忍耐と自己信頼を促しています。自身がコントロールできることに集中し、自然なサイクルの恵みを受け入れましょう。",
      ko: "우주의 에너지는 인내와 자기 신뢰를 북돋아 줍니다. 통제 가능한 일에 집중하고 자연스러운 시간의 흐름을 믿으세요.",
      ar: "تشجعك الطاقة الفلكية على الصبر والثقة بالنفس. ركز على ما تستطيع إنجازه ودع الأيام تعمل لصالح نموك وتطورك.",
      hi: "ब्रह्मांडीय ऊर्जा धैर्य और आत्मविश्वास की प्रेरणा देती है। अपने नियंत्रण में मौजूद बातों पर ध्यान दें और समय को अपना काम करने दें।",
      tr: "Kozmik enerjiler sabır ve özgüveni teşvik ediyor. Kontrolünüz dahilinde olan şeylere odaklanın ve zamanın akışına güvenin.",
      pl: "Energie planetarne zachęcają do cierpliwości i zaufania do siebie. Skup się na tym, na co masz wpływ, i pozwól czasowi działać na twoją korzyść.",
      nl: "De planetaire energieën nodigen uit tot geduld en zelfvertrouwen. Richt je op wat binnen je bereik ligt en laat het proces zich ontvouwen.",
      uk: "Космічні впливи спонукають до терпіння та впевненості у собі. Зосередьтеся на тому, що у ваших руках, і дозвольте подіям розвиватися природно.",
      ro: "Energiile astrale vă îndeamnă la răbdare și încredere în sine. Concentrați-vă pe ceea ce depinde de dumneavoastră și lăsați timpul să lucreze.",
      vi: "Năng lượng vũ trụ khích lệ sự kiên nhẫn và tự tin. Hãy tập trung vào những điều trong tầm tay và để thời gian nuôi dưỡng sự trưởng thành.",
      th: "พลังงานจากดวงดาวสนับสนุนความอดทนและความมั่นใจในตนเอง มุ่งเน้นในสิ่งที่คุณควบคุมได้และปล่อยให้วัฏจักรแห่งเวลาช่วยส่งเสริมการเติบโต",
      id: "Energi kosmik mendorong kesabaran dan kepercayaan diri. Fokuslah pada apa yang dapat Anda kendalikan dan biarkan waktu mendukung pertumbuhan Anda.",
      ms: "Tenaga cakerawala menggalakkan kesabaran dan keyakinan diri. Berikan tumpuan pada apa yang dalam kawalan anda dan biarkan masa membimbing.",
      bn: "মহাজাগতিক শক্তি ধৈর্য ও আত্মবিশ্বাসের প্রেরণা যোগায়। যা আপনার নিয়ন্ত্রণে রয়েছে তার ওপর মনোযোগ দিন এবং সময়কে স্বাভাবিকভাবে কাজ করতে দিন।",
      fa: "انرژی‌های کیهانی شما را به شکیبایی و اعتماد به خود فرا می‌خوانند. بر آنچه در توان شماست تمرکز کنید و به زمان اعتماد داشته باشید.",
      ur: "فلکیاتی توانائیاں صبر اور خود اعتمادی کی ترغیب دیتی ہیں۔ ان امور پر توجہ دیں جو آپ کے بس میں ہیں اور وقت کو سازگار ہونے دیں۔",
      ta: "பிரபஞ்ச ஆற்றல் பொறுமையையும் தன்னம்பிக்கையையும் ஊக்குவிக்கிறது. உங்கள் கட்டுப்பாட்டில் உள்ளவற்றில் கவனம் செலுத்தி காலத்தின் போக்கை நம்புங்கள்.",
      te: "విశ్వ శక్తులు ఓపికను మరియు ఆత్మవిశ్వాసాన్ని ప్రోత్సహిస్తున్నాయి. మీ పరిధిలోని విషయాలపై దృష్టి పెట్టి సమయాన్ని నమ్మండి.",
      sw: "Nguvu ya ulimwengu inakuhimiza kuwa na subira na kujiamini. Zingatia yale yaliyo ndani ya uwezo wako na uruhusu wakati ukuongoze vyema."
    }
  }
};
