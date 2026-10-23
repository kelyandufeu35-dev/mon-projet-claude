#!/usr/bin/env node
// Export MP4 vertical 1080×1920 image par image, son synchronisé.
//
//   npm run export -- [--project projet.json] [--out video.mp4] [--fps 60] [--crf 16]
//                     [--width 1080|1440|2160] [--workers 4]
//
// --width 2160 donne une vidéo 4K (2160×3840). Les images sont dessinées par plusieurs
// navigateurs en parallèle (--workers, un par cœur par défaut).
//
// Dépendances externes : ffmpeg (avec libx264) dans le PATH, et Playwright avec Chromium
// (`npm install` puis `npx playwright install chromium`). Le script ouvre l'application dans un
// Chromium sans fenêtre, dessine chaque image à l'instant exact frame/fps avec le même code que la
// lecture, rend le son avec OfflineAudioContext sur la même horloge, puis ffmpeg assemble le tout.
// Aucune image ne peut donc glisser par rapport au son.

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from './serve.mjs';

function parseArgs(argv) {
  const args = { project: null, out: null, fps: 60, crf: 16, width: 1080, workers: Math.min(4, cpus().length), chrome: process.env.CHROME_PATH || null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'help' || key === 'h') args.help = true;
    else if (key in args) args[key] = argv[++i];
    else throw new Error(`Option inconnue : ${argv[i]}`);
  }
  args.fps = Number(args.fps);
  args.crf = Number(args.crf);
  args.width = Math.round(Number(args.width) / 2) * 2;
  args.workers = Math.max(1, Number(args.workers));
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
  console.log('Usage : npm run export -- [--project projet.json] [--out video.mp4] [--fps 60] [--crf 16] [--width 2160] [--workers 4] [--chrome /chemin/chrome]');
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

const height = Math.round((args.width * 16) / 9 / 2) * 2;

async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } }); // un processus par page
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('Erreur dans la page :', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.billeReady === true);
  return page;
}

try {
  const page = await openPage();
  const info = await page.evaluate(([p, w]) => window.billeRender.setup(p, w), [project, args.width]);
  const v = info.verification;
  const out = resolve(args.out || `${(info.title || 'bille-musicale').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.mp4`);
  console.log(`« ${info.title} » : ${info.notes} notes, ${info.duration.toFixed(2)} s, ${args.width}×${height}, ${args.fps} i/s`);
  console.log(`Parcours : contacts exacts (${v.maxContactErrorPx.toExponential(1)} px), ${v.collisions} collision, ${v.wrongSide} rebond à l’envers`);

  const { wav, sync } = await page.evaluate(() => window.billeRender.audio(48000));
  const wavPath = join(work, 'audio.wav');
  await writeFile(wavPath, Buffer.from(wav, 'base64'));
  console.log(`Son : ${sync.matched}/${sync.expected} attaques retrouvées, écart max ${sync.maxErrorMs.toFixed(1)} ms`);

  // Images : chaque navigateur prend le prochain paquet libre et écrit ses images sur disque.
  const total = Math.ceil(info.duration * args.fps);
  const pages = [page];
  for (let w = 1; w < args.workers; w++) {
    const p = await openPage();
    await p.evaluate(([proj, wd]) => window.billeRender.setup(proj, wd), [project, args.width]);
    pages.push(p);
  }
  const batch = 8;
  let next = 0;
  let done = 0;
  const started = Date.now();
  await Promise.all(
    pages.map(async (p) => {
      while (next < total) {
        const f = next;
        const count = Math.min(batch, total - f);
        next += count;
        const frames = await p.evaluate(([s0, c, fps]) => window.billeRender.frames(s0, c, fps), [f, count, args.fps]);
        await Promise.all(frames.map((b64, i) => writeFile(join(work, `f${String(f + i).padStart(6, '0')}.jpg`), Buffer.from(b64, 'base64'))));
        done += count;
        process.stdout.write(`\rImages : ${done}/${total} (${Math.round((done / total) * 100)} %)`);
      }
    }),
  );
  console.log(`\nImages dessinées en ${((Date.now() - started) / 1000).toFixed(0)} s, encodage…`);

  // aq-mode=3 garde du débit pour les zones sombres et unies (le fond), où naissent les « marches ».
  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-framerate', String(args.fps), '-i', join(work, 'f%06d.jpg'),
      '-i', wavPath,
      '-map', '0:v', '-map', '1:a',
      '-vf', `scale=${args.width}:${height}:flags=lanczos`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(args.crf), '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-x264-params', 'aq-mode=3', '-r', String(args.fps),
      '-c:a', 'aac', '-b:a', '256k',
      '-t', (total / args.fps).toFixed(4),
      '-movflags', '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  if (ffmpeg.status !== 0) throw new Error(`ffmpeg a échoué (code ${ffmpeg.status})`);
  console.log(`✓ ${out} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
} finally {
  await browser.close();
  server.close();
  await rm(work, { recursive: true, force: true });
}
