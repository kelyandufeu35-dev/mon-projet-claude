#!/usr/bin/env node
// Mixage de la vidéo verticale : voix off + nappe synthétisée + effets de transition, normalisé à −14 LUFS.
// Tout est généré de façon déterministe avec ffmpeg (aucune bibliothèque sonore externe) ; les instants viennent
// de tiktok/timeline.fr.json, donc le son suit les plans si la voix change.
//
// Usage : node tools/mix-tiktok.mjs [--voice tiktok/voice/fr/bm_george/narration.wav] [--out tiktok/audio/mix.wav]
// Sortie : un WAV stéréo 48 kHz, −14 LUFS intégrés, crête vraie ≤ −1,5 dBTP, + rapport de mesure.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, r) => (x.startsWith('--') ? [...a, [x.slice(2), r[i + 1]]] : a), []));
const tl = JSON.parse(fs.readFileSync('tiktok/timeline.fr.json', 'utf8'));
const voice = args.voice || `tiktok/voice/${tl.lang}/${tl.voice}/narration.wav`;
const out = args.out || 'tiktok/audio/mix.wav';
const D = 63;

// Limites des plans (voir tiktok/src/timing.js).
const B = tl.beats;
const S = { fab: B.foundry.start - 0.13, hall: B.systems.start - 0.17, stack: B.software.start - 0.2, camp: B.economy.start - 0.2, globe: B.close.start - 0.16 };
const C = tl.cues;
const f = (x) => x.toFixed(3);

// Effets : impacts (sub qui descend + claquement), montées (bruit + glissando), carillons.
const impacts = [[0.05, 0.9], [S.fab, 1.0], [S.hall, 0.55], [S.stack, 0.9], [S.camp, 0.55], [S.globe, 1.0]];
const risers = [[S.fab - 1.2, S.fab], [S.stack - 1.0, S.stack], [S.globe - 1.2, S.globe], [D - 1.3, D]];
const chimes = [[C['software.cuda'], 880, 0.5], [C['economy.revenue'] + 1.75, 660, 0.55], [S.globe + 5.9, 523.25, 0.4]];

const impactExpr = impacts.map(([t0, a]) => `${a}*sin(2*PI*(42+210*exp(-9*(t-${f(t0)})))*(t-${f(t0)}))*exp(-2.4*(t-${f(t0)}))*gte(t,${f(t0)})`).join('+');
const clickExpr = impacts.map(([t0, a]) => `${a}*exp(-14*(t-${f(t0)}))*gte(t,${f(t0)})`).join('+');
const riserTone = risers.map(([t0, t1]) => { const T = t1 - t0; return `0.5*sin(2*PI*(220*(t-${f(t0)})+1500*pow(t-${f(t0)},3)/(3*${f(T * T)})))*pow((t-${f(t0)})/${f(T)},2)*between(t,${f(t0)},${f(t1)})`; }).join('+');
const riserNoise = risers.map(([t0, t1]) => `pow((t-${f(t0)})/${f(t1 - t0)},2.2)*between(t,${f(t0)},${f(t1)})`).join('+');
const chimeExpr = chimes.map(([t0, fr, a]) => `${a}*(sin(2*PI*${fr}*(t-${f(t0)}))+0.5*sin(2*PI*${fr * 1.5}*(t-${f(t0)})))*exp(-2.2*(t-${f(t0)}))*gte(t,${f(t0)})`).join('+');
// Balayage montant pendant le remplissage de l'anneau (économie).
const sweepT0 = C['economy.revenue'] + 0.15, sweepT1 = sweepT0 + 1.6;
const sweepExpr = `0.35*sin(2*PI*(200*(t-${f(sweepT0)})+600*pow(t-${f(sweepT0)},2)/${f(1.6)}))*between(t,${f(sweepT0)},${f(sweepT1)})`;

// Sections (niveau de l'air de la salle, du souffle...).
const air = `'0.05+0.12*between(t,${f(S.fab)},${f(S.hall)})+0.17*between(t,${f(S.hall)},${f(S.stack)})*min(1,(t-${f(S.hall)})/3)+0.05*between(t,${f(S.stack)},${f(S.camp)})+0.07*between(t,${f(S.camp)},${f(S.globe)})'`;
const pulseGate = `(between(t,8.6,${f(S.fab)})*0.5+between(t,${f(S.stack)},${f(S.camp)})*0.30+between(t,${f(S.camp)},${f(S.globe - 0.3)})*0.42+between(t,${f(S.globe)},${f(D - 1.4)})*0.3)`;

const inputs = [
  ['sine=f=55', null], ['sine=f=82.5', null],
  ['anoisesrc=color=pink:amplitude=0.5:seed=7', null],
  [`aevalsrc='0.5*sin(2*PI*220*t)+0.4*sin(2*PI*329.63*t)+0.35*sin(2*PI*440*t)+0.25*sin(2*PI*659.25*t)':s=48000`, 'raw'],
  [`aevalsrc='sin(2*PI*55*t)*exp(-11*mod(t,0.5))*${pulseGate}':s=48000`, 'raw'],
  [`aevalsrc='sin(2*PI*(1500+700*mod(floor(t*9.3+0.37*floor(t*3))*7,5))*t)*lt(mod(t*9.3+0.37*floor(t*3),1),0.06)*(1-mod(t*9.3+0.37*floor(t*3),1)/0.06)*(between(t,9.4,${f(S.fab - 0.4)})+between(t,${f(S.stack + 2)},${f(S.camp - 0.5)}))':s=48000`, 'raw'],
  [`aevalsrc='${impactExpr}':s=48000`, 'raw'],
  ['anoisesrc=color=white:amplitude=0.5:seed=11', null],
  [`aevalsrc='${riserTone}':s=48000`, 'raw'],
  ['anoisesrc=color=white:amplitude=0.5:seed=13', null],
  [`aevalsrc='${chimeExpr}+${sweepExpr}':s=48000`, 'raw'],
];
const lav = inputs.flatMap(([src, kind]) => ['-f', 'lavfi', '-i', kind === 'raw' ? `${src.replace(/^aevalsrc=/, 'aevalsrc=')}:d=${D}` : `${src}:d=${D}:sample_rate=48000`]);
// Graphe de filtres. Entrées : 0 voix ; 1 sine55, 2 sine82.5, 3 bruit rose, 4 nappe, 5 pulsation, 6 tics,
// 7 impacts, 8 bruit blanc (claquements), 9 montées (tonalité), 10 bruit blanc (montées), 11 carillons.
const fc = [
  `[0]aresample=48000,highpass=f=75,acompressor=threshold=0.08:ratio=3:attack=8:release=140:makeup=2,aecho=0.85:0.45:55:0.10,apad=whole_dur=${D},atrim=0:${D},volume=${args['no-voice'] ? 0 : 2.4}[vo]`,
  '[vo]asplit=2[v1][v2]',
  "[1]volume='0.50+0.22*sin(2*PI*t*0.11)':eval=frame[a0]",
  "[2]volume='0.28*(0.6+0.4*sin(2*PI*t*0.07+1))':eval=frame[a1]",
  `[3]highpass=f=180,lowpass=f=2600,volume=${air}:eval=frame[a2]`,
  `[4]lowpass=f=900,volume='0.10*min(1,t/8)*(0.7+0.3*sin(2*PI*t*0.09))*min(1,(${D}-t)/3)':eval=frame[a3]`,
  '[5]lowpass=f=300,volume=0.85[a4]',
  '[6]highpass=f=1500,lowpass=f=7000,volume=0.16[a5]',
  '[7]lowpass=f=1400,volume=0.75[a6]',
  `[8]highpass=f=1800,lowpass=f=10000,volume='0.45*(${clickExpr})':eval=frame[a7]`,
  '[9]lowpass=f=5000,volume=0.22[a8]',
  `[10]highpass=f=1800,lowpass=f=10000,volume='0.40*(${riserNoise})':eval=frame[a9]`,
  '[11]highpass=f=500,lowpass=f=6000,volume=0.20[a10]',
  `[a0][a1][a2][a3][a4][a5][a6][a7][a8][a9][a10]amix=inputs=11:normalize=0,lowpass=f=14000,volume=${args['no-bed'] ? 0 : 0.55}[bed]`,
  '[bed][v1]sidechaincompress=threshold=0.012:ratio=8:attack=15:release=420:makeup=1[ducked]',
  '[ducked][v2]amix=inputs=2:normalize=0,alimiter=limit=0.9:level=disabled,asplit[l][r]',
  '[l]anull[L]',
  '[r]adelay=14[R]',
  '[L][R]amerge=inputs=2',
].join(';');

fs.mkdirSync('tiktok/audio', { recursive: true });
const raw = args['no-voice'] || args['no-bed'] ? 'tiktok/audio/stem.wav' : 'tiktok/audio/mix-raw.wav';
const base = ['-y', '-hide_banner', '-loglevel', 'error', '-i', voice, ...lav, '-filter_complex', fc, '-t', String(D), '-ar', '48000', '-c:a', 'pcm_s16le'];
execFileSync('ffmpeg', [...base, raw], { stdio: ['ignore', 'inherit', 'inherit'] });

if (args['no-voice'] || args['no-bed']) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  console.log((args['no-voice'] ? 'lit seul (sans voix)' : 'voix seule') + ' : ' + r.stderr.slice(r.stderr.lastIndexOf('Summary:')).split('\n').filter((l) => /I:/.test(l)).join(' ').trim());
  process.exit(0);
}
// Normalisation à −14 LUFS en deux passes (mesure, puis correction linéaire).
const m = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{')));
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af',
  `loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`,
  '-ar', '48000', '-c:a', 'pcm_s16le', out]);
const v = spawnSync('ffmpeg', ['-hide_banner', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
const sum = v.stderr.slice(v.stderr.lastIndexOf('Summary:'));
console.log(`écrit : ${out}\n` + sum.split('\n').filter((l) => /I:|LRA:|Peak:/.test(l)).join('\n'));
