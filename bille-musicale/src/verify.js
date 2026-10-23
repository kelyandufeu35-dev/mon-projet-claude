// Vérifications : contacts géométriques, collisions parasites et synchronisation audio.

import { ballAt, clearance, hopAt } from './planner.js';

export function verifyCourse(course, expectedTimes = null) {
  const o = course.options;
  const { impacts, hops } = course;
  let maxContactError = 0;
  let maxTimeError = 0;
  let minClearance = Infinity;
  const collisions = [];
  const wrongSide = [];

  impacts.forEach((imp, i) => {
    const expected = expectedTimes ? expectedTimes[i] : imp.noteTime + course.lead;
    maxTimeError = Math.max(maxTimeError, Math.abs(imp.t - expected));
    // La bille, évaluée par la même fonction que le rendu, touche bien sa plateforme à l'instant de la note.
    const b = ballAt(course, imp.t);
    maxContactError = Math.max(maxContactError, Math.abs(clearance(b.x, b.y, imp.platform, o.ballRadius)));
    const before = ballAt(course, imp.t - 1e-4);
    const after = ballAt(course, imp.t + 1e-4);
    const inDot = before.vx * imp.nx + before.vy * imp.ny;
    const outDot = after.vx * imp.nx + after.vy * imp.ny;
    if (!(inDot < 0 && outDot > 0)) wrongSide.push(i);
  });

  // Chaque rebond est échantillonné toutes les 2 ms contre toutes les plateformes proches.
  for (let h = 0; h < hops.length; h++) {
    const hop = hops[h];
    const own = h - 1; // plateforme de départ (-1 pour la chute initiale)
    const next = h; // plateforme d'arrivée
    const steps = Math.max(10, Math.ceil((hop.t1 - hop.t0) / 0.002));
    for (let s = 0; s <= steps; s++) {
      const t = hop.t0 + ((hop.t1 - hop.t0) * s) / steps;
      const p = hopAt(hop, t);
      for (let j = 0; j < impacts.length; j++) {
        const plat = impacts[j].platform;
        if (Math.abs(plat.cy - p.y) > plat.width + o.ballRadius) continue;
        const c = clearance(p.x, p.y, plat, o.ballRadius);
        const isContact = j === own || j === next;
        if (!isContact) minClearance = Math.min(minClearance, c);
        if (c < -o.tolerance) {
          collisions.push({ hop: h, platform: j, t, depth: -c });
          break;
        }
      }
    }
  }
  const uniqueCollisions = [...new Set(collisions.map((c) => `${c.hop}:${c.platform}`))].length;
  return {
    ok: uniqueCollisions === 0 && wrongSide.length === 0 && maxContactError < 0.01 && maxTimeError < 1e-6,
    count: impacts.length,
    maxContactErrorPx: maxContactError,
    maxTimeErrorMs: maxTimeError * 1000,
    minClearancePx: Number.isFinite(minClearance) ? minClearance : null,
    collisions: uniqueCollisions,
    wrongSide: wrongSide.length,
    warnings: course.warnings,
  };
}

// Mesure de la synchronisation sonore : pour chaque note, on cherche dans le son rendu, à ±30 ms
// de l'horaire prévu, l'instant où l'énergie de la dérivée seconde du signal (qui isole les
// transitoires) monte le plus fort, puis on recule jusqu'au début de cette montée. Une note absente, ou décalée de plus de 30 ms, est signalée manquante.
export function measureAttacks(samples, sampleRate, expected, { window = 0.03, minRise = 6 } = {}) {
  const hop = Math.max(1, Math.round(sampleRate * 0.0005));
  const frameDur = hop / sampleRate;
  const frames = Math.floor(samples.length / hop);
  const db = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let acc = 0;
    for (let k = Math.max(2, f * hop); k < (f + 1) * hop; k++) {
      const d = samples[k] - 2 * samples[k - 1] + samples[k - 2];
      acc += d * d;
    }
    db[f] = 10 * Math.log10(acc / hop + 1e-16);
  }
  const avg = (a, b) => {
    let sum = 0;
    for (let k = a; k < b; k++) sum += db[Math.max(0, Math.min(frames - 1, k))];
    return sum / (b - a);
  };
  const errors = [];
  const missing = [];
  const attacks = [];
  expected.forEach((t, i) => {
    const center = Math.round(t / frameDur);
    const span = Math.round(window / frameDur);
    let best = -Infinity;
    let at = center;
    for (let f = center - span; f <= center + span; f++) {
      const rise = avg(f, f + 3) - avg(f - 24, f - 2); // 1,5 ms après contre 1 à 12 ms avant
      if (rise > best) {
        best = rise;
        at = f;
      }
    }
    if (best < minRise) {
      missing.push(i);
      attacks.push(null);
      return;
    }
    const ref = avg(at - 24, at - 2);
    while (at > center - span && db[at - 1] > ref + 3) at--;
    errors.push(at * frameDur - t);
    attacks.push(at * frameDur);
  });
  const abs = errors.map(Math.abs);
  return {
    expected: expected.length,
    matched: errors.length,
    missing,
    attacks,
    maxErrorMs: abs.length ? Math.max(...abs) * 1000 : 0,
    meanErrorMs: abs.length ? (abs.reduce((a, b) => a + b, 0) / abs.length) * 1000 : 0,
    meanSignedErrorMs: errors.length ? (errors.reduce((a, b) => a + b, 0) / errors.length) * 1000 : 0,
  };
}

// Instants (s) où un éclair d'impact apparaît dans une vidéo : nombre de pixels qui s'éclaircissent
// brusquement d'une image à l'autre, comparé à la médiane locale (le défilement de la caméra
// produit un fond régulier, l'éclair un pic net sur une seule image).
export function detectFlashes(frames, width, height, fps, { jump = 12, ratio = 1.6 } = {}) {
  const size = width * height;
  const n = Math.floor(frames.length / size);
  const score = new Float64Array(Math.max(0, n - 1));
  for (let f = 1; f < n; f++) {
    let count = 0;
    for (let p = 0; p < size; p++) if (frames[f * size + p] - frames[(f - 1) * size + p] > jump) count++;
    score[f - 1] = count;
  }
  const rel = new Float64Array(score.length);
  for (let i = 0; i < score.length; i++) {
    const win = Array.from(score.subarray(Math.max(0, i - 15), i + 16)).sort((a, b) => a - b);
    rel[i] = score[i] / Math.max(1, win[win.length >> 1]);
  }
  const flashes = [];
  for (let i = 0; i < rel.length; i++) {
    if (rel[i] <= ratio) continue;
    let isMax = true;
    for (let k = Math.max(0, i - 3); k <= Math.min(rel.length - 1, i + 3); k++) if (rel[k] > rel[i]) isMax = false;
    if (isMax) flashes.push((i + 1) / fps);
  }
  return flashes;
}

// Décalage entre le temps de la scène et le temps du fichier (début de l'animation dans la vidéo),
// estimé en alignant les éclairs détectés sur les horaires des impacts.
export function alignFlashes(impactTimes, flashes, fps) {
  const tol = 1.5 / fps;
  let best = { offset: 0, matched: -1 };
  for (const f of flashes.slice(0, 8)) {
    for (const t of impactTimes.slice(0, 8)) {
      const offset = f - t - 0.5 / fps;
      let matched = 0;
      let j = 0;
      for (const ti of impactTimes) {
        while (j < flashes.length && flashes[j] < ti + offset - tol) j++;
        if (j < flashes.length && Math.abs(flashes[j] - (ti + offset)) <= tol) matched++;
      }
      if (matched > best.matched) best = { offset, matched };
    }
  }
  return best;
}
