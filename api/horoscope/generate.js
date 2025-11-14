// api/horoscope/generate.js

// Importáljuk a logikát a lib mappából
const generateAstroContent = require("../../lib/generateAstroContent");

// Exportáljuk Vercel handlerként
module.exports = async (req, res) => {
  // A generateAstroContent eredetileg úgy van írva, hogy Express/Next.js stílusú req/res-t vár
  // De a Vercel Serverless Functions is kompatibilis vele
  return generateAstroContent(req, res);
};