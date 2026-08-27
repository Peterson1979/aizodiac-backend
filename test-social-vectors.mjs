import sharp from "sharp";
import { ZODIAC_SVG_PATHS, getZodiacSvgGlyph, renderVectorArrowSvg } from "./lib/social/render/zodiacVectors.js";

async function main() {
  console.log("Testing all 12 Zodiac Vector SVG Glyphs...");
  const signs = Object.keys(ZODIAC_SVG_PATHS);
  if (signs.length !== 12) {
    throw new Error(`Expected 12 signs, got ${signs.length}`);
  }

  for (const sign of signs) {
    const glyphSvg = getZodiacSvgGlyph(sign, "#fbbf24", 3.5);
    const svg = `
      <svg width="180" height="180" viewBox="-90 -90 180 180" xmlns="http://www.w3.org/2000/svg">
        <circle cx="0" cy="0" r="88" fill="#141733" stroke="#fbbf24" stroke-width="2.5"/>
        ${glyphSvg}
      </svg>
    `.trim();

    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    const meta = await sharp(buf).metadata();
    if (meta.width !== 180 || meta.height !== 180) {
      throw new Error(`Bad metadata for ${sign}`);
    }
    console.log(`✓ ${sign} rendered successfully (${buf.length} bytes)`);
  }

  const arrowSvg = renderVectorArrowSvg({ color: "#c4b5fd", width: 28, height: 28 });
  const arrowBuf = await sharp(Buffer.from(arrowSvg)).png().toBuffer();
  console.log(`✓ Vector Arrow rendered successfully (${arrowBuf.length} bytes)`);
  console.log("ALL VECTOR GLYPHS TESTED SUCCESSFULLY!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
