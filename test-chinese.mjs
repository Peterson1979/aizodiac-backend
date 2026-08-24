// test-chinese.mjs
import assert from "node:assert";
import { getChineseZodiac_FULL } from "./lib/chineseZodiac.js";

console.log("==================================================");
console.log("RUNNING CHINESE ZODIAC REGRESSION TESTS");
console.log("==================================================");

// Case 1: 01/12/2025 (Snake, Wood, Yin)
const res2025 = getChineseZodiac_FULL("01/12/2025");
assert.strictEqual(res2025.animal, "Snake");
assert.strictEqual(res2025.element, "Wood");
assert.strictEqual(res2025.yinYang, "Yin");
assert.strictEqual(res2025.symbol, "🐍");
console.log("✅ 2025-12-01 test passed: Snake / Wood / Yin");

// Case 2: Before CNY in 2024 (e.g. 15/01/2024 is still Rabbit / Water, CNY was Feb 10 2024)
const resEarly2024 = getChineseZodiac_FULL("15/01/2024");
assert.strictEqual(resEarly2024.animal, "Rabbit");
assert.strictEqual(resEarly2024.element, "Water");
assert.strictEqual(resEarly2024.yinYang, "Yin");
console.log("✅ 2024-01-15 (pre-CNY) test passed: Rabbit / Water / Yin");

// Case 3: After CNY in 2024 (e.g. 15/03/2024 is Dragon / Wood / Yang)
const resLate2024 = getChineseZodiac_FULL("15/03/2024");
assert.strictEqual(resLate2024.animal, "Dragon");
assert.strictEqual(resLate2024.element, "Wood");
assert.strictEqual(resLate2024.yinYang, "Yang");
console.log("✅ 2024-03-15 (post-CNY) test passed: Dragon / Wood / Yang");

console.log("==================================================");
console.log("ALL CHINESE ZODIAC TESTS PASSED! 🎉");
console.log("==================================================");