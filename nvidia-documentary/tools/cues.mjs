#!/usr/bin/env node
// Instants-clés de la voix off : synthétise le début de chaque phrase (jusqu'au mot-clé) et ajoute sa durée
// au début de la phrase mesuré par tools/voice.mjs. Sert à caler les images sur des mots précis.
// Usage : node tools/cues.mjs [--voice bm_george] [--lang fr]
// Sorties : tiktok/voice/<langue>/<voix>/cues.json  { "<id>": instant (s) } ; avec --write-timeline, écrit aussi
// tiktok/timeline.<langue>.json (la chronologie sur laquelle la vidéo est rendue : n'y toucher qu'en refaisant le rendu).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => (x.startsWith('--') ? [...a, [x.slice(2), r[i + 1]]] : a), []));
const lang = args.lang || 'fr';
const narr = JSON.parse(fs.readFileSync(`tiktok/narration.${lang}.json`, 'utf8'));
const voice = args.voice || narr.voice;
const speed = +(args.speed || narr.speed || 1);
const dir = path.resolve('tiktok/voice', lang, voice);
const timing = JSON.parse(fs.readFileSync(path.join(dir, 'timing.json'), 'utf8'));
const cues = JSON.parse(fs.readFileSync(`tiktok/cues.${lang}.json`, 'utf8')).cues;
const env = { ...process.env, HYPERFRAMES_PYTHON: path.resolve('tools/.venv-tts/bin/python') };
const LANG = { en: 'en-us', fr: 'fr-fr' };
const PY = path.resolve('tools/.venv-tts/bin/python');
const cacheDir = path.join(dir, 'cues');
fs.mkdirSync(cacheDir, { recursive: true });

const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const out = {};
for (const c of cues) {
  const beat = timing.beats.find((b) => b.id === c.beat);
  const key = crypto.createHash('sha1').update(`${voice}|${speed}|${c.before}`).digest('hex').slice(0, 12);
  const wav = path.join(cacheDir, `${key}.wav`);
  const sp = beat.speed ?? speed;
  const key2 = crypto.createHash('sha1').update(`${voice}|${sp}|${c.before}`).digest('hex').slice(0, 12);
  const wav2 = path.join(cacheDir, `${key2}.wav`);
  if (!fs.existsSync(wav2)) execFileSync(PY, ['tools/tts.py', c.before, voice, String(sp), LANG[lang], wav2], { stdio: ['ignore', 'pipe', 'pipe'] });
  out[c.id] = +(beat.start + dur(wav2)).toFixed(2);
}
fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify(out, null, 2));
// Chronologie unique de la composition (importée par tiktok/src) : phrases + instants-clés.
const beats = Object.fromEntries(timing.beats.map((b) => [b.id, { start: b.start, end: b.end }]));
if (args['write-timeline']) fs.writeFileSync(`tiktok/timeline.${lang}.json`, JSON.stringify({ voice, lang, total: timing.total, beats, cues: out }, null, 2) + '\n');
console.log(JSON.stringify(out, null, 1));
