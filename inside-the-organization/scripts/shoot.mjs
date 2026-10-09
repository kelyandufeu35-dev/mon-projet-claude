// Capture d'images de contrôle à des instants précis (hors Hyperframes), pour itérer vite.
// Usage : node scripts/shoot.mjs --out /tmp/shots 0 2.5 8 ...
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
let out = '/tmp/shots'; const times = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--out') out = args[++i]; else times.push(parseFloat(args[i])); }
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: exe, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.resolve('index.html')).href);
await page.waitForFunction(() => typeof window.__renderAt === 'function', null, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
for (const t of times) {
  const ms = await page.evaluate((tt) => { const a = performance.now(); window.__seek ? window.__seek(tt) : window.__renderAt(tt); return performance.now() - a; }, t);
  const f = path.join(out, `t${String(t.toFixed(2)).padStart(6, '0')}.png`);
  await page.screenshot({ path: f });
  console.log(f, `${ms.toFixed(0)}ms`);
}
if (errors.length) console.log('--- console ---\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
