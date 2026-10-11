#!/usr/bin/env node
// Profil de mouvement de la scène pilote, sans rendu d'image : pour chaque image, vitesse apparente
// maximale pendant l'obturateur (px sur 1920) et nombre de sous-échantillons retenu.
// Usage : node tools/motion-profile.mjs [--fps 24] [--base 5] [--from 0] [--to 32]
import puppeteer from 'puppeteer-core';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => (x.startsWith('--') ? [...a, [x.slice(2), r[i + 1]]] : a), []));
const fps = +(args.fps || 24), base = +(args.base || 5), from = +(args.from || 0), to = +(args.to || 32);
fs.mkdirSync('tools/.cache', { recursive: true });
await build({ entryPoints: ['tools/dev/pilot-entry.js'], bundle: true, format: 'iife', outfile: 'tools/.cache/motion.js', logLevel: 'warning' });
fs.writeFileSync('tools/.cache/motion.html', '<!doctype html><body><script src="./motion.js"></script></body>');
const chrome = execSync('npx hyperframes browser path', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await browser.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.evaluateOnNewDocument(() => { window.__W = 320; window.__H = 180; });
await p.goto(pathToFileURL(path.resolve('tools/.cache/motion.html')).href);
const rows = await p.evaluate(async (fps, base, from, to) => {
  const out = [];
  for (let f = Math.round(from * fps); f < Math.round(to * fps); f++) {
    const t = f / fps;
    const r = await window.__speed(t, base, fps);
    out.push(r);
  }
  return out;
}, fps, base, from, to);
console.log('t(s)  obt  px/obt  N(manuel)  N(retenu)');
for (const r of rows) console.log(`${r.t.toFixed(2).padStart(5)} ${r.shutter.toFixed(2).padStart(5)} ${r.px.toFixed(1).padStart(7)}  ${String(r.manual).padStart(5)}  ${String(r.n).padStart(8)}`);
await browser.close();
