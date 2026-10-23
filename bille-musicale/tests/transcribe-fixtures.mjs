// Signaux de test pour la transcription : notes connues, rendues comme un piano (attaques
// franches) ou comme une voix fredonnée (legato, vibrato), avec ou sans bruit de fond.
import { rng } from './helpers.mjs';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export function render(notes, { rate = 44100, style = 'piano', noise = 0, seed = 1 } = {}) {
  const end = Math.max(...notes.map((n) => n.time + n.duration)) + 0.5;
  const out = new Float32Array(Math.ceil(end * rate));
  const r = rng(seed);
  for (const n of notes) {
    const f = mtof(n.midi);
    const start = Math.round(n.time * rate);
    const len = Math.round((style === 'piano' ? Math.max(n.duration, 0.6) : n.duration) * rate);
    let phase = 0;
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / rate;
      let env;
      let freq = f;
      if (style === 'piano') env = Math.min(1, t / 0.003) * Math.exp(-t / 0.5) * (t > n.duration ? Math.exp(-(t - n.duration) / 0.08) : 1);
      else {
        env = Math.min(1, t / 0.03) * Math.min(1, (len / rate - t) / 0.03);
        freq = f * 2 ** ((0.25 * Math.sin(2 * Math.PI * 5.5 * t)) / 12); // vibrato ±¼ de ton
      }
      phase += (2 * Math.PI * freq) / rate;
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(h * phase) / h ** (style === 'piano' ? 1.4 : 1);
      out[start + i] += 0.25 * (n.velocity ?? 0.8) * env * v;
    }
  }
  if (noise) for (let i = 0; i < out.length; i++) out[i] += (r() - 0.5) * 2 * noise;
  return { samples: out, rate };
}

// Précision : une note est retrouvée si une note transcrite a la même hauteur et commence à ±60 ms.
export function score(expected, found, tolerance = 0.06) {
  let hits = 0;
  let worst = 0;
  const used = new Set();
  for (const e of expected) {
    const k = found.findIndex((f, i) => !used.has(i) && f.midi === e.midi && Math.abs(f.time - e.time) <= tolerance);
    if (k >= 0) {
      used.add(k);
      hits++;
      worst = Math.max(worst, Math.abs(found[k].time - e.time));
    }
  }
  return { recall: hits / expected.length, precision: hits / Math.max(1, found.length), worstMs: worst * 1000 };
}
