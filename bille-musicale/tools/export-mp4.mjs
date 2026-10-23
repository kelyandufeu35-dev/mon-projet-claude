#!/usr/bin/env node
// Export MP4 vertical 1080×1920 image par image, son synchronisé.
//
//   npm run export -- [--project projet.json] [--out video.mp4] [--fps 60] [--crf 18]
//
// Dépendances externes : ffmpeg (avec libx264) dans le PATH, et Playwright avec Chromium
// (`npm install` puis `npx playwright install chromium`). Le script ouvre l'application dans un
// Chromium sans fenêtre, dessine chaque image à l'instant exact frame/fps avec le même code que la
// lecture, rend le son avec OfflineAudioContext sur la même horloge, puis ffmpeg assemble le tout.
// Aucune image ne peut donc glisser par rapport au son.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from './serve.mjs';

function parseArgs(argv) {
  const args = { project: null, out: null, fps: 60, crf: 18, chrome: process.env.CHROME_PATH || null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'help' || key === 'h') args.help = true;
    else if (key in args) args[key] = argv[++i];
    else throw new Error(`Option inconnue : ${argv[i]}`);
  }
  args.fps = Number(args.fps);
  args.crf = Number(args.crf);
  return args;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return (await import(name)).chromium;
    } catch {}
  }
  fail('Playwright est introuvable. Dans le dossier bille-musicale : `npm install` puis `npx playwright install chromium`.');
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log('Usage : npm run export -- [--project projet.json] [--out video.mp4] [--fps 60] [--crf 18] [--chrome /chemin/chrome]');
  process.exit(0);
}
if (spawnSync('ffmpeg', ['-version']).error) {
  fail('ffmpeg est introuvable dans le PATH. Installez-le (macOS : `brew install ffmpeg`, Ubuntu : `sudo apt install ffmpeg`, Windows : `winget install ffmpeg`).');
}

const chromium = await loadPlaywright();
const project = args.project ? JSON.parse(await readFile(resolve(args.project), 'utf8')) : null;
const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}/index.html?render=1`;
const browser = await chromium.launch(args.chrome ? { executablePath: args.chrome } : {});
const work = await mkdtemp(join(tmpdir(), 'bille-'));

try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('Erreur dans la page :', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.billeReady === true);
  const info = await page.evaluate((p) => window.billeRender.setup(p), project);
  const v = info.verification;
  const out = resolve(args.out || `${(info.title || 'bille-musicale').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.mp4`);
  console.log(`« ${info.title} » : ${info.notes} notes, ${info.duration.toFixed(2)} s, ${args.fps} i/s`);
  console.log(`Parcours : contacts exacts (${v.maxContactErrorPx.toExponential(1)} px), ${v.collisions} collision, ${v.wrongSide} rebond à l’envers`);

  const { wav, sync } = await page.evaluate(() => window.billeRender.audio(48000));
  const wavPath = join(work, 'audio.wav');
  await writeFile(wavPath, Buffer.from(wav, 'base64'));
  console.log(`Son : ${sync.matched}/${sync.expected} attaques retrouvées, écart max ${sync.maxErrorMs.toFixed(1)} ms`);

  const total = Math.ceil(info.duration * args.fps);
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(args.fps), '-c:v', 'mjpeg', '-i', '-',
      '-i', wavPath,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(args.crf), '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-r', String(args.fps),
      '-c:a', 'aac', '-b:a', '192k',
      '-t', (total / args.fps).toFixed(4),
      '-movflags', '+faststart',
      out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const done = new Promise((res, rej) => ffmpeg.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg a échoué (code ${code})`)))));

  const batch = 12;
  const started = Date.now();
  for (let f = 0; f < total; f += batch) {
    const count = Math.min(batch, total - f);
    const frames = await page.evaluate(([s, c, fps]) => window.billeRender.frames(s, c, fps), [f, count, args.fps]);
    for (const b64 of frames) {
      if (!ffmpeg.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    }
    const pct = Math.round(((f + count) / total) * 100);
    process.stdout.write(`\rImages : ${f + count}/${total} (${pct} %)`);
  }
  ffmpeg.stdin.end();
  await done;
  console.log(`\n✓ ${out} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
} finally {
  await browser.close();
  server.close();
  await rm(work, { recursive: true, force: true });
}
