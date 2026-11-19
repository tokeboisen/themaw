// Giver main.js og style.css et versionsstempel i dist/index.html, så browseren altid henter den nye kode efter et
// deploy og aldrig blander gammel klient med ny server.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('./dist/index.html', import.meta.url);
const stamp = Date.now().toString(36);
const html = readFileSync(file, 'utf8')
  .replace('src="main.js"', `src="main.js?v=${stamp}"`)
  .replace('href="style.css"', `href="style.css?v=${stamp}"`);
if (!html.includes(`main.js?v=${stamp}`)) throw new Error('main.js was not found in index.html');
writeFileSync(file, html);
console.log(`Stamped index.html with ${stamp}`);
