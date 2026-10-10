// Génère le bloc <audio> des compositions (index.html paysage FR, tiktok/index.html portrait FR, tiktok-en/index.html portrait EN) :
// voix off, musique, effets. Temps vidéo = HOOK (d'ouverture) + temps de scène.
// Usage : node scripts/audio-tags.mjs   (remplace le contenu entre <!-- AUDIO:BEGIN --> et <!-- AUDIO:END -->, met à jour data-duration)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const len = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `assets/audio/sfx/${f}.mp3`]).toString().trim());
const sfxLen = {};
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const LANGS = { fr: { narr: rd('data/narration.json'), dur: rd('data/vo_durations.json') }, en: { narr: rd('data/narration.en.json'), dur: rd('data/vo_durations.en.json') } };
const narr = LANGS.fr.narr;
const sfx = JSON.parse(fs.readFileSync('data/sfx.json', 'utf8'));
const SCENE = 93.5, HOOK = narr.hook.duration, TOTAL = +(HOOK + SCENE).toFixed(3);
const r2 = (x) => +x.toFixed(3);
const block = (lang) => {
  const { narr, dur } = LANGS[lang];
  const out = [];
  out.push(`      <audio id="music" data-start="0" data-duration="${TOTAL}" data-track-index="20" data-volume="${sfx.music.volume}" src="${sfx.music.file}"></audio>`);
  const vo = (l, start) => out.push(`      <audio id="vo-${l.id}" data-start="${r2(start)}" data-duration="${Math.min(dur[l.id], TOTAL - start).toFixed(2)}" data-track-index="21" data-volume="1" src="assets/audio/vo/${l.id}.mp3"></audio>`);
  for (const l of narr.hook.lines) vo(l, l.t);
  for (const l of narr.lines) vo(l, l.t + HOOK);
  const cues = [...sfx.hook.map((c) => ({ ...c })), ...sfx.cues.map((c) => ({ ...c, t: c.t + HOOK }))];
  cues.forEach((c, i) => { sfxLen[c.f] ??= Math.min(len(c.f), 2.6); out.push(`      <audio id="sfx-${i}" data-start="${r2(c.t)}" data-duration="${sfxLen[c.f].toFixed(2)}" data-track-index="${22 + (i % 6)}" data-volume="${c.v}" src="assets/audio/sfx/${c.f}.mp3"></audio>`); });
  return { n: out.length, html: `<!-- AUDIO:BEGIN (généré par scripts/audio-tags.mjs) -->\n${out.join('\n')}\n      <!-- AUDIO:END -->` };
};
let total = 0;
for (const [f, lang] of [['index.html', 'fr'], ['tiktok/index.html', 'fr'], ['tiktok-en/index.html', 'en']]) {
  const block_ = block(lang); total = block_.n;
  let html = fs.readFileSync(f, 'utf8');
  html = html.replace(/<!-- AUDIO:BEGIN[\s\S]*?AUDIO:END -->/, () => block_.html).replace(/(id="root" data-composition-id="main" data-start="0" data-duration=")[\d.]+"/, `$1${TOTAL}"`);
  fs.writeFileSync(f, html);
}
console.log(`audio : ${total} balises par composition, durée totale ${TOTAL} s`);
