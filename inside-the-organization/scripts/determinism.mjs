// Test de déterminisme : une image obtenue en y allant directement doit être identique (au pixel près)
// à la même image obtenue après un parcours désordonné du film (c'est ce que font les workers parallèles du rendu).
// Usage : node scripts/determinism.mjs [--portrait] t1 t2 ...
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
const dump = process.env.DUMP;   // dossier où écrire les captures (analyse des différences)
const args = process.argv.slice(2); const portrait = args.includes('--portrait');
const times = args.filter((a) => !a.startsWith('--')).map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--force-color-profile=srgb'] });
const open = async () => {
  const page = await browser.newPage({ viewport: portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.resolve(portrait ? 'tiktok/index.html' : 'index.html')).href);
  await page.waitForFunction(() => typeof window.__seek === 'function', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready); return page;
};
const hash = async (page, t, tag) => { await page.evaluate((x) => window.__seek(x), t); const png = await page.screenshot({ type: 'png' }); if (dump) { fs.mkdirSync(dump, { recursive: true }); fs.writeFileSync(`${dump}/${tag}_${t.toFixed(2)}.png`, png); } return crypto.createHash('md5').update(png).digest('hex'); };
const direct = {}; const pA = await open();
for (const t of times) direct[t] = await hash(pA, t, 'A');
const pB = await open();
const order = [...times].reverse(); const junk = [90, 2.2, 47, 12, 3.7, 70, 0.4, 85];
let bad = 0;
for (const t of order) {
  for (const j of junk.slice(0, 3)) await pB.evaluate((x) => window.__seek(x), j);
  const h = await hash(pB, t, 'B'); const ok = h === direct[t]; if (!ok) bad++;
  console.log(t.toFixed(2), ok ? 'identique' : 'DIFFÉRENT');
  junk.push(junk.shift());
}
await browser.close(); console.log(bad ? `${bad} image(s) non déterministes` : 'déterministe');
process.exit(bad ? 1 : 0);
