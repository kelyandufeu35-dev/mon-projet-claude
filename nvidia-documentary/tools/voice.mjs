#!/usr/bin/env node
// Voix off : lit tiktok/narration.json, synthétise chaque phrase avec Kokoro (hyperframes tts), mesure les
// durées réelles et assemble une piste unique avec les silences prévus.
//
// Usage : node tools/voice.mjs [--script tiktok/narration.fr.json] [--voice bm_george] [--speed 1.05] [--pitch -4]
//   --pitch : décalage de hauteur en demi-tons appliqué après synthèse (expérimental, ex. voix féminine → plus grave)
//   --shifts <json>       : décalage (s) par phrase, ajouté au début du créneau (recentre les mots-clés ; avec --fit)
//   --fit <timeline.json> : cale chaque phrase sur le créneau [début, fin] de cette chronologie (vitesse ajustée
//                           par phrase, bornée à 0,8–1,25) — sert à changer de voix sans refaire le rendu image.
// Un beat peut porter `tts` : texte phonétique lu à la place de `text` (sigles, noms de marque).
// Sorties (tiktok/voice/<langue>/<voix>/) : <id>.wav, timing.json (début/fin de chaque phrase), narration.wav
// Les phrases déjà synthétisées (même texte, même voix, même vitesse) sont réutilisées.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => (x.startsWith('--') ? [...a, [x.slice(2), r[i + 1]]] : a), []));
const script = JSON.parse(fs.readFileSync(args.script || 'tiktok/narration.fr.json', 'utf8'));
const lang = script.language || 'en';
const pitch = +(args.pitch || 0);
const voice = args.voice || script.voice;
const speed = +(args.speed || script.speed || 1);
const outDir = path.resolve('tiktok/voice', lang, pitch ? `${voice}${pitch > 0 ? '+' : ''}${pitch}` : voice);
fs.mkdirSync(outDir, { recursive: true });
const env = { ...process.env, HYPERFRAMES_PYTHON: path.resolve('tools/.venv-tts/bin/python') };

const LANG = { en: 'en-us', fr: 'fr-fr' };
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();

const fit = args.fit ? JSON.parse(fs.readFileSync(args.fit, 'utf8')) : null;
const shifts = args.shifts ? JSON.parse(fs.readFileSync(args.shifts, 'utf8')) : {};
const synth = (b, sp) => {
  const spoken = b.tts || b.text;
  const wav = path.join(outDir, `${b.id}.wav`);
  const key = crypto.createHash('sha1').update(`${voice}|${sp}|${lang}|${pitch}|${spoken}`).digest('hex').slice(0, 12);
  const stamp = `${wav}.${key}`;
  if (!fs.existsSync(wav) || !fs.existsSync(stamp)) {
    for (const f of fs.readdirSync(outDir)) if (f.startsWith(`${b.id}.wav.`)) fs.rmSync(path.join(outDir, f));
    const raw = pitch ? `${wav}.raw.wav` : wav;
    execFileSync('npx', ['hyperframes', 'tts', spoken, '-v', voice, '-s', String(sp), '-l', LANG[lang] || lang, '-o', raw], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    if (pitch) {
      // Décalage de hauteur par ré-échantillonnage, durée conservée par atempo.
      const k = 2 ** (pitch / 12);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', `asetrate=${Math.round(24000 * k)},aresample=24000,atempo=${(1 / k).toFixed(5)}`, wav]);
      fs.rmSync(raw);
    }
    fs.writeFileSync(stamp, '');
  }
  return { wav, d: dur(wav) };
};

let t = script.leadIn ?? 0.4;
const timing = [];
for (const b of script.beats) {
  let sp = b.speed ?? speed;
  let at = null;
  let r = synth(b, sp);
  if (fit) {
    const slot = fit.beats[b.id];
    at = slot.start + (shifts[b.id] ?? 0);
    const target = slot.end - slot.start;
    // Deux affinages : la durée est à peu près inversement proportionnelle à la vitesse.
    for (let i = 0; i < 2; i++) {
      const next = Math.min(1.25, Math.max(0.8, +(sp * r.d / target).toFixed(2)));
      if (Math.abs(next - sp) < 0.005) break;
      sp = next;
      r = synth(b, sp);
    }
  }
  if (at != null) t = at;
  timing.push({ id: b.id, start: +t.toFixed(2), end: +(t + r.d).toFixed(2), duration: +r.d.toFixed(2), words: b.text.split(/\s+/).length, speed: sp });
  t += r.d + (b.pauseAfter ?? 0.4);
}
const total = fit ? fit.total : +(timing[timing.length - 1].end + 0.5).toFixed(2);
fs.writeFileSync(path.join(outDir, 'timing.json'), JSON.stringify({ voice, speed, total, beats: timing }, null, 2));

// Piste assemblée : chaque phrase est placée à son instant de début.
const inputs = timing.flatMap((b) => ['-i', path.join(outDir, `${b.id}.wav`)]);
const filter = timing.map((b, i) => `[${i}]adelay=${Math.round(b.start * 1000)}|${Math.round(b.start * 1000)},apad=whole_dur=${total}[a${i}]`).join(';')
  + ';' + timing.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${timing.length}:normalize=0:duration=longest[o]`;
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[o]', '-ar', '24000', '-ac', '1', path.join(outDir, 'narration.wav')]);
console.log(`voix ${voice} (${lang}${pitch ? `, ${pitch} demi-tons` : ''}) : ${timing.reduce((s, b) => s + b.words, 0)} mots, durée totale ${total} s`);
for (const b of timing) console.log(`${b.id.padEnd(9)} ${String(b.start).padStart(5)} → ${String(b.end).padStart(5)}  (${b.duration.toFixed(1)} s, ${b.words} mots, vitesse ${b.speed})`);
