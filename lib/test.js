// lib/test.js
const { getChineseZodiac_FULL } = require("./chineseZodiac.js");

console.log(getChineseZodiac_FULL("29/06/1971")); // → Pig
console.log(getChineseZodiac_FULL("26/01/1971")); // → Rat
console.log(getChineseZodiac_FULL("27/01/1971")); // → Ox