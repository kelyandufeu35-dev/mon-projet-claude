#!/usr/bin/env node
// Vérifie la synchronisation d'une vidéo (export MP4, enregistrement du navigateur ou
// enregistrement d'écran) en mesurant, dans le fichier lui-même, l'écart entre chaque éclair
// d'impact à l'image et l'attaque de la note correspondante dans le son.
//
//   npm run verify -- video.mp4 [--project projet.json]
//
// Dépendance : ffmpeg dans le PATH.

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demoProject } from '../src/melody.js';
import { buildScene } from '../src/scene.js';
import { measureAttacks, detectFlashes, alignFlashes } from '../src/verify.js';

const argv = process.argv.slice(2);
const pi = argv.indexOf('--project');
const video = argv.find((a, i) => !a.startsWith('--') && (pi < 0 || i !== pi + 1));
if (!video) {
  console.log('Usage : npm run verify -- video.mp4 [--project projet.json]');
  process.exit(1);
}
const file = pi >= 0 ? JSON.parse(await readFile(resolve(argv[pi + 1]), 'utf8')) : null;
const scene = file ? buildScene(file, file.settings) : buildScene(demoProject());
const impacts = [...new Set(scene.events.map((e) => e.t))];

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', resolve(video), ...args, '-'], { maxBuffer: 2 ** 31 });
  if (r.error) throw new Error('ffmpeg est introuvable dans le PATH.');
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return r.stdout;
}

// Instant de départ de chaque flux : le son d'un enregistrement ne commence pas toujours à 0.
function startTime(kind) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', kind, '-show_entries', 'stream=start_time', '-of', 'csv=p=0', resolve(video)]);
  return Number(r.stdout.toString().trim().split('\n')[0]) || 0;
}
const videoStart = startTime('v');
const audioStart = startTime('a');

const fps = 60;
const W = 108;
const H = 192;
// Cadence fixée à 60 i/s (les enregistrements du navigateur ont une cadence variable) et son
// recalé sur ses horodatages, comme le fait un lecteur vidéo.
const gray = ffmpeg(['-an', '-vf', `fps=${fps},scale=${W}:${H},format=gray`, '-f', 'rawvideo']);
const sampleRate = 48000;
const pcm = ffmpeg(['-vn', '-ac', '1', '-ar', String(sampleRate), '-af', 'aresample=async=1', '-f', 'f32le']);
const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));

const flashes = detectFlashes(gray, W, H, fps).map((t) => t + videoStart);
const { offset, matched } = alignFlashes(impacts, flashes, fps);
const audio = measureAttacks(samples, sampleRate, impacts.map((t) => t + offset - audioStart), { window: 0.06 });
audio.attacks = audio.attacks.map((a) => (a === null ? null : a + audioStart));

// Pour chaque impact : éclair à l'image (première image qui le montre) et attaque dans le son.
const deltas = [];
let j = 0;
impacts.forEach((t, i) => {
  const at = t + offset;
  while (j < flashes.length && flashes[j] < at - 1.5 / fps) j++;
  const flash = j < flashes.length && Math.abs(flashes[j] - at) <= 1.5 / fps ? flashes[j] : null;
  if (flash !== null && audio.attacks[i] !== null) deltas.push(audio.attacks[i] - flash);
});
const ms = (x) => `${(x * 1000).toFixed(1)} ms`;
const v = scene.verification;
console.log(`Parcours : ${v.count} impacts, contacts exacts (${v.maxContactErrorPx.toExponential(1)} px), ${v.collisions} collision`);
console.log(`Image : ${matched}/${impacts.length} éclairs d’impact retrouvés (début de l’animation à ${ms(offset)} dans la vidéo)`);
console.log(`Son   : ${audio.matched}/${impacts.length} attaques retrouvées`);
if (!deltas.length) {
  console.log('Impossible de mesurer l’écart image/son (vérifiez que la vidéo correspond au projet).');
  process.exit(2);
}
deltas.sort((a, b) => a - b);
// Cadence réelle du fichier (les enregistrements du navigateur perdent parfois des images).
// (Les WebM de MediaRecorder n'indiquent pas leur durée : on lit les horodatages des images.)
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', resolve(video)]);
const pts = probe.stdout.toString().split('\n').map(Number).filter(Number.isFinite).sort((a, b) => a - b);
const frame = pts.length > 2 ? (pts.at(-1) - pts[0]) / (pts.length - 1) : 1 / fps;
const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
// L'éclair apparaît sur la première image qui suit l'instant de la note : un fichier parfait donne
// des écarts répartis entre −1 image et 0, centrés sur −½ image.
const offsetAv = mean + frame / 2;
console.log(`Cadence réelle : ${(1 / frame).toFixed(1)} i/s (une image = ${ms(frame)})`);
console.log(`Écart son − image sur ${deltas.length} impacts : de ${ms(deltas[0])} à ${ms(deltas.at(-1))} (parfait : entre −${ms(frame)} et 0)`);
console.log(`Décalage moyen son/image, quantification des images retirée : ${offsetAv >= 0 ? '+' : ''}${ms(offsetAv)}`);
const exact = deltas[0] > -frame - 0.004 && deltas.at(-1) < 0.004;
let ok = exact;
if (exact) console.log('✓ Synchronisation exacte à l’image près');
else if (Math.abs(offsetAv) <= 0.025) {
  ok = true;
  console.log('≈ Écart moyen imperceptible (moins de 25 ms) ; les variations viennent d’images irrégulières pendant l’enregistrement.');
} else {
  console.log(`✗ Le son arrive ${offsetAv > 0 ? 'après' : 'avant'} l’image d’environ ${ms(Math.abs(offsetAv))}.`);
  console.log(`  Réglez « Décalage audio » sur ${Math.round(offsetAv * 1000)} ms dans l’application, ou utilisez l’export MP4.`);
}
process.exit(ok ? 0 : 2);
