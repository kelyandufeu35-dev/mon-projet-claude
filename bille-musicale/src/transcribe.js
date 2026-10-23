// Transcription d'un son en mélodie (une note à la fois).
//
// 1. Le son est ramené à ~11 kHz en mono (les fondamentales d'une mélodie restent sous 2,5 kHz).
// 2. Hauteur par l'algorithme YIN sur des fenêtres de 46 ms, toutes les 11,6 ms.
// 3. Les trames voisées et assez fortes forment des notes : une note change quand la hauteur
//    bouge de plus d'un demi-ton pendant plusieurs trames, ou quand l'énergie remonte
//    brusquement (même note frappée à nouveau).
// 4. Le début de chaque note est recalé sur la montée d'énergie la plus proche (fenêtres de
//    5,8 ms), pour que le rebond tombe sur l'attaque entendue.
//
// Fonctionne bien sur une mélodie seule : piano, voix fredonnée ou sifflée, flûte, lead de synthé.
// Sur un morceau complet (voix, basse, batterie), la note la plus présente est suivie, avec
// beaucoup d'erreurs.

const TARGET_RATE = 11025;
const WINDOW = 512; // 46 ms
const HOP = 128; // 11,6 ms
const FMIN = 70;
const FMAX = 2000;
const THRESHOLD = 0.15;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Filtre passe-bas (sinus cardinal fenêtré) puis décimation.
export function downsample(samples, rate, target = TARGET_RATE) {
  const factor = Math.max(1, Math.round(rate / target));
  if (factor === 1) return { samples: Float32Array.from(samples), rate };
  const taps = 8 * factor + 1;
  const half = (taps - 1) / 2;
  const cutoff = 0.45 / factor;
  const kernel = new Float32Array(taps);
  let sum = 0;
  for (let k = 0; k < taps; k++) {
    const n = k - half;
    const sinc = n === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n);
    kernel[k] = sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * k) / (taps - 1)));
    sum += kernel[k];
  }
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    const c = i * factor;
    let acc = 0;
    for (let k = 0; k < taps; k++) {
      const j = c + k - half;
      if (j >= 0 && j < samples.length) acc += samples[j] * kernel[k];
    }
    out[i] = acc / sum;
  }
  return { samples: out, rate: rate / factor };
}

function yin(x, start, rate, d) {
  const tauMin = Math.max(2, Math.floor(rate / FMAX));
  const tauMax = Math.ceil(rate / FMIN);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = start; j < start + WINDOW; j++) {
      const v = x[j] - x[j + tau];
      s += v * v;
    }
    d[tau] = s;
  }
  // Différence cumulée normalisée.
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    d[tau] = running ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < THRESHOLD) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    tau = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[tau]) tau = t;
  }
  // Interpolation parabolique autour du minimum.
  let refined = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1];
    const b = d[tau];
    const c = d[tau + 1];
    const den = a - 2 * b + c;
    if (den > 0) refined = tau + (0.5 * (a - c)) / den;
  }
  return { f0: rate / refined, aperiodicity: d[tau] };
}

// FFT réelle (radix 2, en place) : renvoie les modules du spectre.
function magnitudes(frame, size, re, im, win) {
  re.fill(0);
  im.fill(0);
  for (let i = 0; i < frame.length; i++) re[i] = frame[i] * win[i];
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  const mag = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  return mag;
}

// Saillance harmonique : pour chaque hauteur candidate (au quart de ton), somme pondérée du
// spectre aux harmoniques. La mélodie d'un morceau accompagné est en général la voix aiguë
// la plus présente : on cherche donc au-dessus de Mi3 avec une légère préférence pour l'aigu.
const MIX_LOW = 52; // la mélodie est cherchée entre Mi3 et Do7…
const MIX_HIGH = 96;
const MIX_FLOOR = 33; // …mais la saillance est calculée dès La1 pour reconnaître les harmoniques des basses
const MIX_FFT = 4096;
const MIX_WINDOW = 1024; // 93 ms
export const MIX_TUNING = { ratio: 0.45, harmonic: 0.75 };
const curve = new Float64Array((MIX_HIGH - MIX_FLOOR) * 4 + 1);
function salience(mag, rate) {
  const binHz = rate / MIX_FFT;
  let max = 0;
  let total = 0;
  for (let q = 0; q < curve.length; q++) {
    const m = MIX_FLOOR + q / 4;
    const f = 440 * 2 ** ((m - 69) / 12);
    let v = 0;
    for (let h = 1; h <= 8; h++) {
      const bin = (h * f) / binHz;
      if (bin >= mag.length - 1) break;
      const i = Math.floor(bin);
      const frac = bin - i;
      v += 0.8 ** (h - 1) * (mag[i] * (1 - frac) + mag[i + 1] * frac);
    }
    curve[q] = v;
    if (m >= MIX_LOW) {
      total += v;
      max = Math.max(max, v);
    }
  }
  const lowest = (MIX_LOW - MIX_FLOOR) * 4;
  // Pics de saillance : la mélodie est la voix du dessus, donc on garde le pic le plus aigu
  // qui reste assez fort, sauf s'il n'est qu'une harmonique (octave, quinte au-dessus de
  // l'octave, double octave) d'un pic plus grave plus fort.
  const peaks = [];
  for (let q = 1; q < curve.length - 1; q++) {
    if (curve[q] >= curve[q - 1] && curve[q] > curve[q + 1]) peaks.push(q);
  }
  let chosen = -1;
  for (let k = peaks.length - 1; k >= 0 && chosen < 0; k--) {
    const q = peaks[k];
    if (q < lowest || curve[q] < MIX_TUNING.ratio * max) continue;
    const harmonic = peaks.some((p) => p < q && curve[q] < MIX_TUNING.harmonic * curve[p] && [48, 76, 96].some((d) => Math.abs(q - p - d) <= 2));
    if (!harmonic) chosen = q;
  }
  if (chosen < 0) {
    // Aucun pic aigu indépendant : la trame ne contient que l'accompagnement.
    return { midi: 0, value: 0, peakiness: 0 };
  }
  return { midi: MIX_FLOOR + chosen / 4, value: curve[chosen], peakiness: curve[chosen] / (total / (curve.length - lowest) + 1e-12) };
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/**
 * @param {Float32Array} input  signal mono
 * @param {number} inputRate    fréquence d'échantillonnage
 * @returns {Promise<{notes: {time, midi, duration, velocity}[], voicedRatio: number}>}
 */
export async function transcribe(input, inputRate, { onProgress, minDuration = 0.07, mode = 'solo' } = {}) {
  const mix = mode === 'mix';
  const { samples: x, rate } = downsample(input, inputRate);
  const tauMax = Math.ceil(rate / FMIN);
  const frames = Math.max(0, Math.floor((x.length - Math.max(WINDOW + tauMax, MIX_WINDOW) - 1) / HOP));
  const d = new Float64Array(tauMax + 2);
  const midi = new Float64Array(frames);
  const aper = new Float64Array(frames);
  const rms = new Float64Array(frames);
  const sal = new Float64Array(frames);
  const re = new Float64Array(MIX_FFT);
  const im = new Float64Array(MIX_FFT);
  const hann = Float64Array.from({ length: MIX_WINDOW }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (MIX_WINDOW - 1)));
  // En mode accompagné, la fenêtre spectrale (93 ms) est centrée comme la fenêtre YIN (46 ms).
  const mixShift = (MIX_WINDOW - WINDOW) / 2;

  let lastYield = Date.now();
  for (let f = 0; f < frames; f++) {
    const start = f * HOP;
    let e = 0;
    for (let j = start; j < start + WINDOW; j++) e += x[j] * x[j];
    rms[f] = Math.sqrt(e / WINDOW);
    if (rms[f] <= 1e-4) {
      aper[f] = 1;
    } else if (mix) {
      const s0 = Math.max(0, start - mixShift);
      const r = salience(magnitudes(x.subarray(s0, s0 + MIX_WINDOW), MIX_FFT, re, im, hann), rate);
      midi[f] = r.midi;
      sal[f] = r.value;
      aper[f] = r.peakiness ? 1 / r.peakiness : 1; // pic net = mélodie claire
    } else {
      const r = yin(x, start, rate, d);
      midi[f] = 69 + 12 * Math.log2(r.f0 / 440);
      aper[f] = r.aperiodicity;
    }
    if (Date.now() - lastYield > 40) {
      onProgress?.(f / frames);
      await new Promise((res) => setTimeout(res, 0));
      lastYield = Date.now();
    }
  }
  onProgress?.(1);

  // Seuil d'énergie relatif au passage le plus fort (−36 dB) et au bruit de fond.
  let maxRms = 1e-6;
  for (const r of rms) maxRms = Math.max(maxRms, r);
  const sortedRms = Float64Array.from(rms).sort();
  // Le bruit de fond est estimé sur les passages les plus calmes, plafonné : une voix fredonnée
  // sonne presque sans interruption, et ses passages calmes font encore partie de la mélodie.
  const noise = sortedRms[Math.floor(sortedRms.length * 0.05)] || 0;
  const floor = Math.max(maxRms * 0.016, Math.min(noise * 2.5, maxRms * 0.08), 2e-4);
  const voiced = Array.from({ length: frames }, (_, f) => rms[f] > floor && aper[f] < (mix ? 0.45 : 0.35));
  // Lissage médian de la hauteur sur 5 trames voisées.
  const pitch = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    if (!voiced[f]) continue;
    const near = [];
    for (let k = f - 2; k <= f + 2; k++) if (k >= 0 && k < frames && voiced[k]) near.push(midi[k]);
    pitch[f] = median(near);
  }
  // Nouvelle frappe : montée de l'énergie (seul) ou de la saillance de la mélodie (accompagné,
  // pour ne pas couper les notes à chaque coup de batterie).
  const logE = Array.from(mix ? sal : rms, (r) => Math.log(r + 1e-6));
  const onsetAt = (f) => {
    if (f < 3) return false;
    const before = Math.min(logE[f - 1], logE[f - 2], logE[f - 3]);
    return logE[f] - before > (mix ? 0.4 : 0.55) && rms[f] > floor * 1.5;
  };

  // Découpage en notes.
  const raw = [];
  let cur = null;
  let drift = 0;
  let silent = 0;
  const close = (endFrame) => {
    if (cur) {
      cur.end = endFrame;
      raw.push(cur);
    }
    cur = null;
  };
  for (let f = 0; f < frames; f++) {
    if (!voiced[f]) {
      if (cur && ++silent >= 2) close(f - silent + 1);
      continue;
    }
    silent = 0;
    if (!cur) {
      cur = { start: f, pitches: [pitch[f]], peak: rms[f] };
      drift = 0;
      continue;
    }
    const center = median(cur.pitches);
    if (Math.abs(pitch[f] - center) > 0.6) drift++;
    else drift = 0;
    if (drift >= 3) {
      close(f - 2);
      cur = { start: f - 2, pitches: [pitch[f - 2], pitch[f - 1], pitch[f]], peak: rms[f] };
      drift = 0;
    } else if (onsetAt(f) && f - cur.start >= 4) {
      close(f);
      cur = { start: f, pitches: [pitch[f]], peak: rms[f] };
    } else {
      cur.pitches.push(pitch[f]);
      cur.peak = Math.max(cur.peak, rms[f]);
    }
  }
  close(frames);

  // Recalage des débuts sur la montée d'énergie (enveloppe fine de 5,8 ms).
  const fine = 64;
  const env = new Float64Array(Math.floor(x.length / fine));
  for (let i = 0; i < env.length; i++) {
    let e = 0;
    for (let j = i * fine; j < (i + 1) * fine; j++) e += x[j] * x[j];
    env[i] = Math.log(e / fine + 1e-10);
  }
  const attack = (frame) => {
    const center = (frame * HOP + WINDOW / 2) / fine;
    const lo = Math.max(3, Math.floor(center - WINDOW / fine));
    const hi = Math.min(env.length - 1, Math.ceil(center + 2));
    let best = Math.round(clamp(center - WINDOW / 2 / fine, lo, hi));
    let bestRise = -Infinity;
    for (let i = lo; i <= hi; i++) {
      const rise = env[i] - env[i - 3];
      if (rise > bestRise) {
        bestRise = rise;
        best = i;
      }
    }
    return ((best - 1) * fine) / rate;
  };

  const frameTime = (f) => (f * HOP + WINDOW / 2) / rate;
  let notes = raw
    .map((n) => {
      const time = attack(n.start);
      const end = frameTime(n.end) + (HOP / rate) * 0.5;
      return {
        time,
        midi: Math.round(median(n.pitches)),
        duration: end - time,
        velocity: clamp(Math.sqrt(n.peak / maxRms), 0.25, 1),
      };
    })
    .filter((n) => n.duration >= minDuration && n.midi >= 24 && n.midi <= 108);

  // Erreurs d'octave isolées : une note courte à ±12 de deux voisines identiques.
  for (let i = 1; i < notes.length - 1; i++) {
    const [a, b, c] = [notes[i - 1], notes[i], notes[i + 1]];
    if (a.midi === c.midi && Math.abs(b.midi - a.midi) === 12 && b.duration < 0.15) b.midi = a.midi;
  }
  notes = notes.sort((a, b) => a.time - b.time);
  if (mix && notes.length > 4) {
    // Restes d'accompagnement : notes très en dessous du centre de la mélodie.
    const center = median(notes.map((n) => n.midi));
    notes = notes.filter((n) => n.midi >= center - 15);
  }
  const voicedRatio = voiced.filter(Boolean).length / Math.max(1, frames);
  return { notes, voicedRatio };
}

// Décode un fichier audio ou vidéo (MP3, M4A, WAV, MP4…) en gardant les deux canaux.
export async function decodeAudioFile(arrayBuffer) {
  let lastError = null;
  for (const rate of [22050, 44100]) {
    try {
      const ctx = new OfflineAudioContext(1, rate, rate);
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const left = buffer.getChannelData(0);
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
      return { left, right, stereo: buffer.numberOfChannels > 1, rate: buffer.sampleRate, duration: buffer.duration };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error('Impossible de lire ce son. Essayez un fichier MP3, M4A ou WAV, ou une vidéo MP4.', { cause: lastError });
}

// Extrait mono d'un passage. Avec `removeVoice`, on garde la différence gauche − droite : ce qui
// est au centre du mixage (en général la voix, mais aussi souvent la basse et la grosse caisse)
// s'annule, ce qui est placé sur les côtés (nappes, piano, synthés) reste.
export function excerpt(audio, start, duration, { removeVoice = false } = {}) {
  const a = Math.max(0, Math.floor(start * audio.rate));
  const b = Math.min(audio.left.length, Math.floor((start + duration) * audio.rate));
  const out = new Float32Array(Math.max(0, b - a));
  for (let i = 0; i < out.length; i++) {
    const l = audio.left[a + i];
    const r = audio.right[a + i];
    out[i] = removeVoice ? (l - r) / 2 : (l + r) / 2;
  }
  return out;
}

export function loudness(samples) {
  let e = 0;
  for (let i = 0; i < samples.length; i++) e += samples[i] * samples[i];
  return Math.sqrt(e / Math.max(1, samples.length));
}
