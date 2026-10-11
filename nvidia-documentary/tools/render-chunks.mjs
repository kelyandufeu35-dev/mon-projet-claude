#!/usr/bin/env node
// Rend la scène pilote par tranches (chaque tranche = un vrai rendu Hyperframes), puis assemble les
// tranches et mixe le son. Reprenable : une tranche déjà rendue (fichier valide) est ignorée.
//
// Usage :
//   node tools/render-chunks.mjs --name final --samples 6 --scale 1 [--chunk 4] [--quality delivery]
//        [--fps 24] [--from 0] [--to 8] [--concat-only]
// Sorties : pilot/renders/<name>/chunk-XX.mp4  puis  pilot/renders/<name>/<name>.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']] : acc), [])
);
const name = args.name || 'final';
const samples = +(args.samples || 6);
const scale = +(args.scale || 1);
const chunk = +(args.chunk || 4);
const quality = args.quality || 'delivery';
const fps = +(args.fps || 24);
const DURATION = 32;
const nChunks = Math.ceil(DURATION / chunk);
const from = +(args.from || 0);
const to = +(args.to || nChunks);

const outDir = path.resolve('pilot/renders', name);
fs.mkdirSync(outDir, { recursive: true });
const log = (m) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.log(line);
  fs.appendFileSync(path.join(outDir, 'progress.log'), line + '\n');
};

const probeOk = (f, expectFrames) => {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
    return +out === expectFrames;
  } catch {
    return false;
  }
};

const pad = (i) => String(i).padStart(2, '0');
const chunkFile = (i) => path.join(outDir, `chunk-${pad(i)}.mp4`);

if (!args['concat-only']) {
  const base = fs.readFileSync('pilot/index.html', 'utf8');
  for (let i = from; i < to; i++) {
    const start = i * chunk;
    const dur = Math.min(chunk, DURATION - start);
    const frames = Math.round(dur * fps);
    if (probeOk(chunkFile(i), frames)) {
      log(`tranche ${i} (${start}–${start + dur}s) : déjà rendue, ignorée`);
      continue;
    }
    // Composition de la tranche : durée réduite, sans piste audio (le son est mixé à la fin).
    let html = base
      .replaceAll('data-duration="32"', `data-duration="${dur}"`)
      .replace('tl.to({}, { duration: 32 });', `tl.to({}, { duration: ${dur} });`)
      .replace(/\s*<audio[^>]*><\/audio>/, '');
    const comp = `chunk-${name}-${pad(i)}.html`;
    fs.writeFileSync(path.join('pilot', comp), html);
    const t0 = Date.now();
    log(`tranche ${i} (${start}–${start + dur}s, ${frames} images) : rendu…`);
    const r = spawnSync('npx', [
      'hyperframes', 'render', '-c', comp, '--quality', quality, '--fps', String(fps), '--workers', '1',
      '--variables', JSON.stringify({ samples, scale, fps, timeOffset: start }),
      '--player-ready-timeout', '300000', '--protocol-timeout', '3600000', '--quiet',
      '-o', chunkFile(i),
    ], { cwd: 'pilot', stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, HF_DE_STALL_MS: process.env.HF_DE_STALL_MS || '1200000' } });
    fs.writeFileSync(path.join(outDir, `chunk-${pad(i)}.log`), (r.stdout || '') + (r.stderr || ''));
    fs.rmSync(path.join('pilot', comp), { force: true });
    if (r.status !== 0 || !probeOk(chunkFile(i), frames)) {
      log(`tranche ${i} : ÉCHEC (voir chunk-${pad(i)}.log)`);
      process.exit(1);
    }
    log(`tranche ${i} : ok en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}

// Assemblage + son (uniquement si toutes les tranches existent).
const all = Array.from({ length: nChunks }, (_, i) => chunkFile(i));
if (all.every((f) => fs.existsSync(f))) {
  const list = path.join(outDir, 'list.txt');
  fs.writeFileSync(list, all.map((f) => `file '${f}'`).join('\n') + '\n');
  const video = path.join(outDir, `${name}-video.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
  const finalFile = path.join(outDir, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', 'pilot/assets/bed.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', finalFile]);
  log(`assemblé : ${finalFile}`);
} else {
  log('assemblage différé : toutes les tranches ne sont pas encore rendues');
}
