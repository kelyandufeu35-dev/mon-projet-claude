// Instruments synthétisés (aucun échantillon à télécharger) et chaîne de sortie commune
// au temps réel et au rendu hors ligne : l'export sonne exactement comme la lecture.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseBuffers = new WeakMap();
function noise(ctx) {
  if (!noiseBuffers.has(ctx)) {
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
    const rnd = mulberry32(7);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return noiseBuffers.get(ctx);
}

// Réverbération douce : bruit stéréo à décroissance exponentielle, graine fixe.
function impulse(ctx, seconds = 2.2, decay = 3) {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const rnd = mulberry32(101 + c);
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) data[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 90 ? i / 90 : 1);
  }
  return buf;
}

export function createOutput(ctx, destination, { volume = 0.8 } = {}) {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0.9;
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  // Limiteur doux sans latence. (DynamicsCompressorNode retarde le signal de 6 ms par
  // anticipation, ce qui décalerait chaque note par rapport à son impact.)
  const limiter = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.4) / Math.tanh(1.4);
  limiter.curve = curve;
  limiter.oversample = 'none';
  const master = ctx.createGain();
  master.gain.value = volume;
  input.connect(dry).connect(limiter);
  input.connect(reverb).connect(wet).connect(limiter);
  limiter.connect(master).connect(destination);
  return { input, master, setVolume: (v) => master.gain.setTargetAtTime(v, ctx.currentTime, 0.02) };
}

function click(ctx, out, t, freq, q, amp, decay) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = clamp(freq, 200, 16000);
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(amp, t);
  g.gain.setTargetAtTime(0, t, decay);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + decay * 8 + 0.01);
}

// Partiels sinusoïdaux à décroissance exponentielle.
function modal(ctx, out, t, f0, modes, decay, amp, stopAt) {
  for (const [ratio, a, d] of modes) {
    const f = f0 * ratio;
    if (f > 17000) continue;
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp * a, t + 0.0015);
    g.gain.setTargetAtTime(0, t + 0.0015, decay * d);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(stopAt);
  }
}

function xylophone(ctx, out, t, midi, vel) {
  const f0 = mtof(midi);
  const decay = clamp(0.55 * Math.pow(2, -(midi - 72) / 24), 0.12, 1.1);
  const amp = 0.3 * (0.35 + 0.65 * vel);
  modal(ctx, out, t, f0, [[1, 1, 1], [3.0, 0.42, 0.32], [6.1, 0.17, 0.13], [9.8, 0.07, 0.06]], decay, amp, t + decay * 7);
  click(ctx, out, t, 2800, 0.8, 0.22 * amp, 0.004);
}

function musicBox(ctx, out, t, midi, vel) {
  const f0 = mtof(midi);
  const decay = clamp(1.1 * Math.pow(2, -(midi - 72) / 30), 0.3, 2);
  const amp = 0.24 * (0.35 + 0.65 * vel);
  modal(ctx, out, t, f0, [[1, 1, 1], [2, 0.22, 0.55], [4.07, 0.12, 0.25], [5.43, 0.07, 0.17], [8.9, 0.035, 0.08]], decay, amp, t + decay * 7);
  click(ctx, out, t, 6000, 1.2, 0.12 * amp, 0.002);
}

function piano(ctx, out, t, midi, vel, dur) {
  const f0 = mtof(midi);
  const amp = 0.17 * (0.3 + 0.7 * vel);
  const decay = clamp(2.6 * Math.pow(2, -(midi - 60) / 18), 0.35, 4);
  const release = t + Math.max(dur, 0.12);
  const stopAt = release + 0.8;

  const vca = ctx.createGain();
  vca.gain.setValueAtTime(0, t);
  vca.gain.linearRampToValueAtTime(amp, t + 0.003);
  vca.gain.setValueAtTime(amp, release);
  vca.gain.setTargetAtTime(0, release, 0.12);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(clamp(f0 * (7 + 10 * vel), 800, 16000), t);
  lp.frequency.setTargetAtTime(clamp(f0 * 3, 400, 16000), t, decay * 0.4);
  lp.connect(vca).connect(out);

  const B = 0.0004; // inharmonicité des cordes
  for (let n = 1; n <= 8; n++) {
    const f = f0 * n * Math.sqrt(1 + B * n * n);
    if (f > 15000) break;
    const g = ctx.createGain();
    const a = (n === 1 ? 1 : 0.85) / Math.pow(n, 1.15);
    g.gain.setValueAtTime(a, t);
    g.gain.setTargetAtTime(0, t, (decay * 1.4) / (1 + 0.55 * (n - 1)));
    g.connect(lp);
    for (const detune of n <= 2 ? [-1.2, 1.2] : [0]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      osc.detune.value = detune;
      osc.connect(g);
      osc.start(t);
      osc.stop(stopAt);
    }
  }
  click(ctx, out, t, f0 * 6, 0.9, 0.9 * amp, 0.006); // attaque du marteau
}

// Piano feutré : attaque plus lente, timbre sombre, presque pas de bruit de marteau. Le son
// démarre toujours à l'instant de la note : seule la montée (12 ms) est plus douce.
function softPiano(ctx, out, t, midi, vel, dur) {
  const f0 = mtof(midi);
  const amp = 0.14 * (0.35 + 0.65 * vel);
  const decay = clamp(3 * Math.pow(2, -(midi - 60) / 20), 0.5, 4.5);
  const release = t + Math.max(dur, 0.15);
  const stopAt = release + 1.2;
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(0, t);
  vca.gain.linearRampToValueAtTime(amp, t + 0.012);
  vca.gain.setValueAtTime(amp, release);
  vca.gain.setTargetAtTime(0, release, 0.25);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(clamp(f0 * (2.5 + 3 * vel), 300, 5000), t);
  lp.frequency.setTargetAtTime(clamp(f0 * 1.6, 250, 5000), t, decay * 0.5);
  lp.connect(vca).connect(out);
  for (let n = 1; n <= 5; n++) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(1 / Math.pow(n, 1.6), t);
    g.gain.setTargetAtTime(0, t, (decay * 1.5) / (1 + 0.7 * (n - 1)));
    g.connect(lp);
    const osc = ctx.createOscillator();
    osc.frequency.value = f0 * n * Math.sqrt(1 + 0.0003 * n * n);
    osc.detune.value = n === 1 ? 0.8 : 0;
    osc.connect(g);
    osc.start(t);
    osc.stop(stopAt);
  }
  click(ctx, out, t, f0 * 2, 0.7, 0.18 * amp, 0.012); // feutre du marteau
}

// Batterie de type rap : grosse caisse, caisse claire, clap, charleston et basse 808.
const shapers = new WeakMap();
function saturation(ctx) {
  if (!shapers.has(ctx)) {
    // Saturation douce : ajoute des harmoniques pour que la 808 s'entende sur un haut-parleur
    // de téléphone, qui ne restitue pas les fréquences sous 100 Hz.
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 3);
    shapers.set(ctx, curve);
  }
  const ws = ctx.createWaveShaper();
  ws.curve = shapers.get(ctx);
  return ws;
}

// La batterie reste environ 6 dB sous la mélodie : chaque rebond doit s'entendre nettement.
const DRUM_LEVEL = 0.6;

function drum(ctx, out, t, e) {
  const v = (e.velocity ?? 1) * DRUM_LEVEL;
  if (e.drum === 'kick') {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * v, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.002, 0.08);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.6);
    click(ctx, out, t, 3500, 0.7, 0.07 * v, 0.003);
  } else if (e.drum === 'bass') {
    const f = mtof(e.midi);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f * 1.3, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const drive = ctx.createGain();
    drive.gain.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2 * v, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, (e.duration ?? 0.6) * 0.5);
    osc.connect(drive).connect(saturation(ctx)).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + (e.duration ?? 0.6) * 3 + 0.1);
  } else if (e.drum === 'snare') {
    click(ctx, out, t, 1900, 0.7, 0.3 * v, 0.05);
    const osc = ctx.createOscillator();
    osc.frequency.value = 190;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16 * v, t);
    g.gain.setTargetAtTime(0, t, 0.035);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  } else if (e.drum === 'clap') {
    for (const d of [0, 0.011, 0.022]) click(ctx, out, t + d, 1500, 1.1, 0.24 * v, 0.008);
    click(ctx, out, t + 0.03, 1400, 0.9, 0.2 * v, 0.06);
  } else if (e.drum === 'hat') {
    click(ctx, out, t, 9000, 0.8, 0.09 * v, 0.012);
  }
}

export const INSTRUMENTS = {
  xylophone: { label: 'Xylophone', play: xylophone },
  piano: { label: 'Piano', play: piano },
  softpiano: { label: 'Piano doux (feutré)', play: softPiano },
  musicbox: { label: 'Boîte à musique', play: musicBox },
};

export function playNote(ctx, out, instrument, when, note) {
  if (note.drum) return drum(ctx, out, when, note);
  if (note.chord?.length > 1) {
    // Accord : toutes ses notes à la fois, chacune moins fort pour que l'accord ne couvre pas la mélodie.
    const v = ((note.velocity ?? 0.8) * 1.1) / Math.sqrt(note.chord.length);
    for (const midi of note.chord) playNote(ctx, out, instrument, when, { ...note, midi, chord: null, velocity: v });
    return;
  }
  (INSTRUMENTS[instrument] || INSTRUMENTS.xylophone).play(ctx, out, when, note.midi, note.velocity ?? 0.8, note.duration ?? 0.3);
}

// Rendu hors ligne de toute la piste, avec les mêmes instruments et la même chaîne de sortie.
export async function renderOffline(events, duration, { instrument, volume = 0.8, sampleRate = 48000 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const out = createOutput(ctx, ctx.destination, { volume });
  for (const e of events) playNote(ctx, out.input, instrument, e.t, e);
  return ctx.startRendering();
}

export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new ArrayBuffer(44 + frames * channels * 2);
  const v = new DataView(bytes);
  const text = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + frames * channels * 2, true);
  text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, frames * channels * 2, true);
  const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      v.setInt16(o, clamp(data[c][i], -1, 1) * 32767, true);
      o += 2;
    }
  }
  return new Uint8Array(bytes);
}
