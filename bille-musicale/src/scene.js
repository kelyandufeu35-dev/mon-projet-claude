// Assemble un projet (notes + réglages) en scène prête à jouer et à dessiner.

import { buildCourse, buildCamera } from './planner.js';
import { verifyCourse } from './verify.js';
import { PALETTES, platformColor } from './palettes.js';

export const DEFAULT_SETTINGS = {
  tempo: 1,
  instrument: 'xylophone',
  transpose: 0,
  volume: 0.8,
  palette: 'neon',
  colors: { ...PALETTES.neon },
  colorMode: 'pitch',
  showNoteNames: false,
  showTitle: true,
  drums: true,
  audioOffsetMs: 0,
};

export function normalizeSettings(settings = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  s.colors = { ...(PALETTES[s.palette] || PALETTES.neon), ...(settings.colors || {}) };
  return s;
}

export function buildScene(project, settingsIn) {
  const settings = normalizeSettings(settingsIn ?? project.settings);
  const tempo = Math.max(0.25, Math.min(3, settings.tempo));
  const notes = project.notes.map((n) => ({
    time: n.time / tempo,
    duration: (n.duration ?? 0.3) / tempo,
    midi: n.midi + 12 * settings.transpose,
    velocity: n.velocity ?? 0.8,
  }));
  const course = buildCourse(notes);
  const camera = buildCamera(course);
  const verification = verifyCourse(course);
  // Un événement sonore par impact, au même instant : c'est la seule source d'horaires de la
  // mélodie. La batterie suit la même grille, décalée de la même amorce.
  const events = course.impacts.map((imp) => ({ t: imp.t, midi: imp.midi, velocity: imp.velocity, duration: imp.duration }));
  const beat = project.beat && settings.drums ? beatEvents(project.beat, tempo, course.lead, course.duration) : [];
  return restyleScene({
    title: project.title || '',
    bpm: project.bpm ? project.bpm * tempo : null,
    settings,
    course,
    camera,
    events,
    beat,
    kicks: beat.filter((e) => e.drum === 'kick').map((e) => e.t),
    duration: course.duration,
    verification,
  }, settings);
}

// Changement d'apparence seulement : le parcours et les horaires restent identiques.
export function restyleScene(scene, settingsIn) {
  const settings = normalizeSettings(settingsIn);
  const midis = scene.course.impacts.map((imp) => imp.midi);
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const colors = scene.course.impacts.map((imp) => platformColor(settings.colors, settings.colorMode, imp.midi, minMidi, maxMidi));
  return { ...scene, settings, colors };
}

// Rythmes sur 16 doubles-croches par mesure.
const PATTERNS = {
  // Trap : demi-temps (clap sur le 3e temps), charleston en croches, roulements en fin de phrase.
  trap: { kick: [[0, 10], [0, 7, 10]], snare: [8], clapSnare: 'clap', hat: 2, roll: true },
  // Drill : grosses caisses décalées, caisse claire sur le 3e temps.
  drill: { kick: [[0, 11], [0, 6, 13]], snare: [8], clapSnare: 'snare', hat: 3, roll: true },
  // Boom-bap : caisse claire sur 2 et 4.
  boom: { kick: [[0, 7, 10], [0, 10]], snare: [4, 12], clapSnare: 'snare', hat: 2, roll: false },
  pop: { kick: [[0, 8], [0, 6, 8]], snare: [4, 12], clapSnare: 'clap', hat: 2, roll: false },
};

export function beatEvents(beat, tempo, lead, duration) {
  const p = PATTERNS[beat.style] || PATTERNS.trap;
  const step = 60 / beat.bpm / tempo / 4;
  const bar = 16 * step;
  const events = [];
  for (let b = 0; b < beat.bars; b++) {
    const t0 = lead + b * bar;
    const kicks = p.kick[b % p.kick.length];
    const root = beat.bass[b % beat.bass.length];
    kicks.forEach((s, k) => {
      const next = kicks[k + 1] ?? 16;
      events.push({ t: t0 + s * step, drum: 'kick', velocity: s === 0 ? 1 : 0.85 });
      events.push({ t: t0 + s * step, drum: 'bass', midi: root, duration: (next - s) * step, velocity: 1 });
    });
    for (const s of p.snare) events.push({ t: t0 + s * step, drum: p.clapSnare, velocity: 1 });
    const rolling = p.roll && b % 2 === 1;
    for (let s = 0; s < 16; s += 1) {
      const onGrid = p.hat === 3 ? [0, 3, 6, 8, 11, 14].includes(s) : s % p.hat === 0;
      if (onGrid || (rolling && s >= 12)) events.push({ t: t0 + s * step, drum: 'hat', velocity: s % 4 === 0 ? 0.9 : 0.6 });
    }
  }
  // Coup final sur la mesure suivante, si l'animation dure encore.
  const end = lead + beat.bars * bar;
  if (end < duration - 0.3) {
    events.push({ t: end, drum: 'kick', velocity: 1 }, { t: end, drum: 'bass', midi: beat.bass[0], duration: 1.2, velocity: 1 });
  }
  return events.filter((e) => e.t < duration).sort((a, b) => a.t - b.t);
}
