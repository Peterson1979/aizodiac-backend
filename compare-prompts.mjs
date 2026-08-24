// compare-prompts.mjs
import { PROMPTS as newPrompts } from "./lib/prompts.js";
import { execSync } from "child_process";
import fs from "fs";

const oldFile = execSync("git show 2621e5b:lib/prompts.js", { encoding: "utf-8" });
fs.writeFileSync("./old_prompts_temp.mjs", oldFile);

const { PROMPTS: oldPrompts } = await import("./old_prompts_temp.mjs");

console.log("| Request Type | Old Length (chars) | New Length (chars) | Reduction (%) |");
console.log("| :--- | :--- | :--- | :--- |");

for (const key of Object.keys(oldPrompts)) {
  const oldLen = oldPrompts[key].trim().length;
  const newLen = (newPrompts[key] || "").trim().length;
  const pct = (((oldLen - newLen) / oldLen) * 100).toFixed(1);
  console.log(`| ${key} | ${oldLen} | ${newLen} | ${pct}% |`);
}

fs.unlinkSync("./old_prompts_temp.mjs");
