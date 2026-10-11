#!/usr/bin/env node
// Outil de développement : empaquette une entrée JS, la charge dans le Chrome headless de
// Hyperframes (même moteur et mêmes drapeaux WebGL logiciel que le rendu final), appelle la
// fonction de rendu exposée par la page et enregistre l'image en PNG.
//
// Usage :
//   node tools/shot.mjs --entry tools/dev/macro-entry.js --out img.png [--t 0] [--w 1280] [--h 720]
//        [--samples 6] [--fn __shot] [--cam '{"pos":[0,0.1,0.2]}'] [--cache .cache]
import puppeteer from 'puppeteer-core';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const { entry, out, times = '', t = '0', w = '1280', h = '720', samples = '', fn = '__shot', cam = '', cache = 'tools/.cache', extra = '', full = '' } = args;
if (!entry || !out) {
  console.error('--entry et --out sont obligatoires');
  process.exit(2);
}

fs.mkdirSync(cache, { recursive: true });
const name = path.basename(entry, '.js');
const bundle = path.resolve(cache, `${name}.js`);
await build({ entryPoints: [entry], bundle: true, format: 'iife', outfile: bundle, logLevel: 'warning', sourcemap: false });
const html = path.resolve(cache, `${name}.html`);
fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style></head><body><canvas id="gl"></canvas><script src="./${name}.js"></script></body></html>`);

const chrome = execSync('npx hyperframes browser path', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop();
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${w},${h}`],
  defaultViewport: { width: +w, height: +h, deviceScaleFactor: 1 },
  protocolTimeout: 3_600_000,
});
const p = await browser.newPage();
p.on('console', (m) => {
  const s = m.text();
  if (!s.includes('GL Driver') && !s.includes('GPU stall')) console.log('[page]', s);
});
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.evaluateOnNewDocument((W, H, C, X) => {
  window.__W = W;
  window.__H = H;
  if (C) window.__cam = JSON.parse(C);
  if (X) window.__extra = JSON.parse(X);
}, +w, +h, cam, extra);
await p.goto(pathToFileURL(html).href, { waitUntil: 'load' });
const el = await p.$('#gl');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const list = times ? times.split(',').map(Number) : [+t];
for (const tt of list) {
  const res = await p.evaluate(async (f, x, s) => window[f](x, s ? +s : undefined), fn, tt, samples);
  const file = times ? out.replace(/\.png$/, `_${String(tt).replace('.', 'p')}.png`) : out;
  if (full) await p.screenshot({ path: file, clip: { x: 0, y: 0, width: +w, height: +h } });
  else await el.screenshot({ path: file });
  console.log(file.split('/').pop(), JSON.stringify({ ms: res.ms }));
}
await browser.close();
