import test from 'node:test';
import assert from 'node:assert/strict';
import { measureAttacks } from '../src/verify.js';
import { rng } from './helpers.mjs';

// Notes synthétiques : partiels amortis avec une attaque de 1,5 ms, notes qui se chevauchent.
function synth(times, sr, shift = 0) {
  const out = new Float32Array(Math.ceil((times.at(-1) + 1) * sr));
  const r = rng(3);
  for (let i = 0; i < out.length; i++) out[i] = (r() - 0.5) * 1e-4;
  times.forEach((t, k) => {
    const f = 440 * 2 ** ((k % 7) / 12);
    const start = Math.round((t + shift) * sr);
    for (let n = 0; n < sr * 0.8 && start + n < out.length; n++) {
      const env = Math.min(1, n / (0.0015 * sr)) * Math.exp(-n / (0.25 * sr));
      out[start + n] += 0.3 * env * (Math.sin((2 * Math.PI * f * n) / sr) + 0.4 * Math.sin((6 * Math.PI * f * n) / sr));
    }
  });
  return out;
}

const times = [0.5, 0.75, 0.875, 1.0, 1.5, 1.62, 1.74, 2.4, 3.0];

// Sinusoïdes pures sans transitoire (cas le plus difficile) : on exige moins d'un tiers d'image à 60 i/s.
test('retrouve chaque attaque à moins de 5 ms', () => {
  const r = measureAttacks(synth(times, 48000), 48000, times);
  assert.equal(r.matched, times.length);
  assert.ok(r.maxErrorMs < 5, `écart max ${r.maxErrorMs} ms`);
});

test('mesure un décalage réel entre le son et les impacts', () => {
  const r = measureAttacks(synth(times, 48000, 0.012), 48000, times);
  assert.ok(Math.abs(r.meanSignedErrorMs - 12) < 2, `décalage mesuré ${r.meanSignedErrorMs} ms`);
});

test('signale les notes absentes', () => {
  const r = measureAttacks(synth(times.slice(0, 4), 48000), 48000, [...times.slice(0, 4), 2.5]);
  assert.deepEqual(r.missing, [4]);
});
