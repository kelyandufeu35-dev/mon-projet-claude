// Génère le bloc <audio> de index.html (voix off, musique, effets) à partir des données.
// Usage : node scripts/audio-tags.mjs   (remplace le contenu entre <!-- AUDIO:BEGIN --> et <!-- AUDIO:END -->)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const len = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `assets/audio/sfx/${f}.mp3`]).toString().trim());
const sfxLen = {};
const narr = JSON.parse(fs.readFileSync('data/narration.json', 'utf8'));
const dur = JSON.parse(fs.readFileSync('data/vo_durations.json', 'utf8'));
const sfx = JSON.parse(fs.readFileSync('data/sfx.json', 'utf8'));
const TOTAL = Number(/data-duration="([\d.]+)"/.exec(fs.readFileSync('index.html', 'utf8'))[1]);
const out = [];
out.push(`      <audio id="music" data-start="0" data-duration="${TOTAL}" data-track-index="20" data-volume="${sfx.music.volume}" src="${sfx.music.file}"></audio>`);
for (const l of narr.lines) {
  const d = Math.min(dur[l.id], TOTAL - l.t);
  out.push(`      <audio id="vo-${l.id}" data-start="${l.t}" data-duration="${d.toFixed(2)}" data-track-index="21" data-volume="1" src="assets/audio/vo/${l.id}.mp3"></audio>`);
}
sfx.cues.forEach((c, i) => { sfxLen[c.f] ??= Math.min(len(c.f), 2.6); out.push(`      <audio id="sfx-${i}" data-start="${c.t}" data-duration="${sfxLen[c.f].toFixed(2)}" data-track-index="${22 + (i % 6)}" data-volume="${c.v}" src="assets/audio/sfx/${c.f}.mp3"></audio>`); });
let html = fs.readFileSync('index.html', 'utf8');
const block = `<!-- AUDIO:BEGIN (généré par scripts/audio-tags.mjs) -->\n${out.join('\n')}\n      <!-- AUDIO:END -->`;
html = /<!-- AUDIO:BEGIN[\s\S]*?AUDIO:END -->/.test(html) ? html.replace(/<!-- AUDIO:BEGIN[\s\S]*?AUDIO:END -->/, block) : html.replace('      <div id="labels"></div>', `      <div id="labels"></div>\n      ${block}`);
fs.writeFileSync('index.html', html);
console.log(`audio : ${out.length} balises`);
