// Re-rend un segment [start, end) du film à 30 i/s (même fonction pure du temps que le rendu Hyperframes)
// et l'encode en H.264 BT.709 pour être épissé dans le master (scripts/splice.sh).
// Usage : node scripts/render-segment.mjs <start_s> <end_s> <out.mp4>
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [start, end, out] = [parseFloat(process.argv[2]), parseFloat(process.argv[3]), process.argv[4]];
const FPS = 30, f0 = Math.round(start * FPS), f1 = Math.round(end * FPS);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(pathToFileURL(path.resolve('index.html')).href);
await page.waitForFunction(() => typeof window.__seek === 'function', null, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
  '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((r) => ff.on('close', r));
for (let f = f0; f < f1; f++) {
  await page.evaluate((t) => window.__seek(t), f / FPS);
  const png = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if ((f - f0) % 30 === 0) console.log(`frame ${f - f0}/${f1 - f0}`);
}
ff.stdin.end(); await done; await browser.close();
console.log('segment écrit :', out);
