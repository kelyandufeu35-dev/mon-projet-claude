import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProject } from '../src/melody.js';
import { transcribe } from '../src/transcribe.js';
import { render, score } from './transcribe-fixtures.mjs';

const melody = demoProject().notes.map((n) => ({ ...n, time: n.time + 0.3 }));

test('mélodie au piano : toutes les notes, attaques à moins de 15 ms', async () => {
  const { samples, rate } = render(melody);
  const { notes } = await transcribe(samples, rate);
  const s = score(melody, notes);
  assert.equal(s.recall, 1);
  assert.ok(s.precision >= 0.95, `précision ${s.precision}`);
  assert.ok(s.worstMs < 15, `écart ${s.worstMs} ms`);
});

test('mélodie fredonnée (legato, vibrato, bruit de fond)', async () => {
  const low = melody.map((n) => ({ ...n, midi: n.midi - 12 }));
  const { samples, rate } = render(low, { style: 'voice', noise: 0.02 });
  const { notes } = await transcribe(samples, rate);
  const s = score(low, notes);
  assert.ok(s.recall >= 0.95 && s.precision >= 0.95, JSON.stringify(s));
});

test('mélodie avec accords et grosse caisse (mode accompagné)', async () => {
  const spb = 60 / 112;
  const chords = [];
  for (let bar = 0; bar < 8; bar++) {
    for (const midi of [40, 47, 52]) chords.push({ time: 0.3 + bar * 4 * spb, midi, duration: 4 * spb, velocity: 0.5 });
  }
  const a = render(melody);
  const b = render(chords, { style: 'voice' });
  const mix = new Float32Array(a.samples.length);
  for (let i = 0; i < mix.length; i++) mix[i] = a.samples[i] + 0.6 * (b.samples[i] || 0);
  for (let beat = 0; beat < 32; beat++) {
    const s0 = Math.round((0.3 + beat * spb) * a.rate);
    for (let i = 0; i < 6000 && s0 + i < mix.length; i++) {
      mix[s0 + i] += 0.25 * Math.sin((2 * Math.PI * (60 + 80 * Math.exp(-i / 600)) * i) / a.rate) * Math.exp(-i / 2500);
    }
  }
  const solo = score(melody, (await transcribe(mix, a.rate)).notes);
  const accompanied = score(melody, (await transcribe(mix, a.rate, { mode: 'mix' })).notes);
  assert.ok(accompanied.recall >= 0.95 && accompanied.precision >= 0.85, JSON.stringify(accompanied));
  assert.ok(accompanied.recall > solo.recall, 'le mode accompagné doit faire mieux que le mode seul');
});

test('« Enlever la voix » retire ce qui est au centre du mixage stéréo', async () => {
  const { excerpt } = await import('../src/transcribe.js');
  const { rng } = await import('./helpers.mjs');
  const r = rng(5);
  const voiceNotes = [];
  for (let t = 0.3; t < 17; t += 0.22) voiceNotes.push({ time: t, midi: 50 + Math.floor(r() * 8), duration: 0.2, velocity: 1 });
  const piano = render(melody).samples;
  const voice = render(voiceNotes, { style: 'voice' }).samples;
  const n = Math.min(piano.length, voice.length);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = piano[i] * 0.9 + voice[i] * 1.2; // piano à gauche, voix au centre
    right[i] = piano[i] * 0.25 + voice[i] * 1.2;
  }
  const audio = { left, right, stereo: true, rate: 44100 };
  const kept = score(melody, (await transcribe(excerpt(audio, 0, 30), 44100, { mode: 'mix' })).notes);
  const removed = score(melody, (await transcribe(excerpt(audio, 0, 30, { removeVoice: true }), 44100, { mode: 'mix' })).notes);
  assert.ok(removed.recall >= 0.95 && removed.precision >= 0.9, JSON.stringify(removed));
  assert.ok(removed.precision > kept.precision);
});
