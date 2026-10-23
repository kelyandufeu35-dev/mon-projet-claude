// Assemble un projet (notes + réglages) en scène prête à jouer et à dessiner.

import { buildCourse, buildCamera, laneOptions, DEFAULTS, WORLD_W } from './planner.js';
import { verifyCourse } from './verify.js';
import { PALETTES, platformColor, rotateColors, hexToRgb } from './palettes.js';

const SECTION_STYLES = ['zigzag', 'traversee', 'escalier', 'flottant'];

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
  evolveColors: true, // une palette par partie du morceau
  variedCourse: true, // une forme de parcours par partie
  livelyDecor: true, // poussières, pulsations, ondes de changement de partie
  lane2Volume: 0.5, // la deuxième bille (l'accompagnement) environ 6 dB sous la mélodie
  audioOffsetMs: 0,
};

export function normalizeSettings(settings = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  s.colors = { ...(PALETTES[s.palette] || PALETTES.neon), ...(settings.colors || {}) };
  return s;
}

// Une piste par main (ou par partie) : `project.parts` en donne plusieurs, sinon `project.notes`.
export function projectParts(project) {
  return project.parts?.length ? project.parts : [{ name: project.title, notes: project.notes }];
}

export function buildScene(project, settingsIn) {
  const settings = normalizeSettings(settingsIn ?? project.settings);
  const tempo = Math.max(0.25, Math.min(3, settings.tempo));
  const parts = projectParts(project)
    .map((part) => ({
      name: part.name,
      notes: part.notes.map((n) => ({
        time: n.time / tempo,
        duration: (n.duration ?? 0.3) / tempo,
        midi: n.midi + 12 * settings.transpose,
        chord: n.chord?.map((m) => m + 12 * settings.transpose),
        velocity: n.velocity ?? 0.8,
      })),
    }))
    .filter((part) => part.notes.length);
  // Même amorce pour toutes les pistes : les billes partagent la même horloge.
  const first = Math.min(...parts.map((p) => p.notes[0].time));
  const lead = Math.max(0, DEFAULTS.leadIn - first);
  // Parties du morceau : toutes les 8 mesures quand le tempo est connu (une phrase musicale),
  // 4 pour un morceau court,
  // sinon toutes les 12 s. Chacune a sa forme de parcours et sa palette.
  const last = Math.max(...parts.map((p) => p.notes.at(-1).time)) + lead;
  const bar = project.bpm ? (4 * 60) / (project.bpm * tempo) : 0;
  const sectionLength = bar ? ((last - lead - first) / bar >= 24 ? 8 : 4) * bar : 12; // morceau court : toutes les 4 mesures
  const sections = [{ t0: 0, style: 'zigzag' }];
  for (let i = 1; lead + first + i * sectionLength < last; i++) {
    sections.push({ t0: lead + first + i * sectionLength, style: settings.variedCourse ? SECTION_STYLES[i % SECTION_STYLES.length] : 'zigzag' });
  }
  const options = { ...laneOptions(parts.length), lead, sections };
  const courses = parts.map((part) => buildCourse(part.notes, options));
  const duration = Math.max(...courses.map((c) => c.duration));
  const lanes = courses.map((course, i) => {
    course.duration = duration;
    return { name: parts[i].name, course, camera: buildCamera(course), x: (i * WORLD_W) / courses.length, width: WORLD_W / courses.length };
  });
  const checks = courses.map((c) => verifyCourse(c));
  const verification = {
    ok: checks.every((v) => v.ok),
    count: checks.reduce((a, v) => a + v.count, 0),
    maxContactErrorPx: Math.max(...checks.map((v) => v.maxContactErrorPx)),
    maxTimeErrorMs: Math.max(...checks.map((v) => v.maxTimeErrorMs)),
    collisions: checks.reduce((a, v) => a + v.collisions, 0),
    wrongSide: checks.reduce((a, v) => a + v.wrongSide, 0),
    warnings: checks.flatMap((v) => v.warnings),
    lanes: checks.length,
  };
  // Un événement sonore par impact, au même instant : c'est la seule source d'horaires des notes.
  // La batterie suit la même grille, décalée de la même amorce.
  const events = courses
    .flatMap((c, lane) => c.impacts.map((imp) => ({ t: imp.t, lane, midi: imp.midi, chord: imp.chord, velocity: imp.velocity, duration: imp.duration })))
    .sort((a, b) => a.t - b.t);
  const beat = project.beat && settings.drums ? beatEvents(project.beat, tempo, options.lead, duration) : [];
  // Pulsations du décor : grosse caisse s'il y a une batterie, sinon premier temps de chaque mesure.
  const kicks = beat.filter((e) => e.drum === 'kick').map((e) => e.t);
  const pulses = kicks.length ? kicks : downbeats(project.bpm && project.bpm * tempo, lead + first, duration);
  // Notes accentuées (fortes ou sur un premier temps) : impacts plus spectaculaires.
  for (const c of courses) {
    for (const imp of c.impacts) imp.strong = imp.velocity >= 0.85 || pulses.some((p) => Math.abs(p - imp.t) < 0.02);
  }
  return restyleScene(
    {
      title: project.title || '',
      bpm: project.bpm ? project.bpm * tempo : null,
      settings,
      lanes,
      course: lanes[0].course,
      camera: lanes[0].camera,
      events,
      beat,
      kicks,
      pulses,
      sections,
      duration,
      verification,
      mix: laneMix(settings, lanes.length),
    },
    settings,
  );
}

// Dosage des billes : la première (la mélodie) à plein volume un peu à gauche, les suivantes
// plus bas et un peu à droite, comme à l'écran.
export function laneMix(settings, lanes) {
  if (lanes < 2) return null;
  const gains = [1];
  const pans = [-0.3];
  for (let i = 1; i < lanes; i++) {
    gains.push(settings.lane2Volume ?? DEFAULT_SETTINGS.lane2Volume);
    pans.push(0.3);
  }
  return { gains, pans };
}

// Changement d'apparence seulement : les parcours et les horaires restent identiques.
export function restyleScene(scene, settingsIn) {
  const settings = normalizeSettings(settingsIn);
  const order = Object.keys(PALETTES);
  const start = order.indexOf(settings.palette);
  // Palette de chaque partie : celle choisie d'abord, puis les suivantes de la liste (ou, pour
  // une palette personnalisée, la même aux teintes tournées). La bille garde sa couleur.
  const sections = (scene.sections || [{ t0: 0 }]).map((sec, i) => {
    let colors = settings.colors;
    if (i > 0 && settings.evolveColors) {
      colors = start >= 0 ? { ...PALETTES[order[(start + i) % order.length]], ball: settings.colors.ball } : rotateColors(settings.colors, 55 * i);
    }
    return { ...sec, colors, rgb: Object.fromEntries(['bgTop', 'bgBottom', 'low', 'mid', 'high'].map((k) => [k, hexToRgb(colors[k])])) };
  });
  const sectionAt = (t) => {
    let k = 0;
    while (k + 1 < sections.length && sections[k + 1].t0 <= t + 1e-9) k++;
    return sections[k];
  };
  const lanes = scene.lanes.map((lane) => {
    const midis = lane.course.impacts.map((imp) => imp.midi);
    const minMidi = Math.min(...midis);
    const maxMidi = Math.max(...midis);
    const colors = lane.course.impacts.map((imp) => platformColor(sectionAt(imp.t).colors, settings.colorMode, imp.midi, minMidi, maxMidi));
    return { ...lane, colors };
  });
  return { ...scene, settings, lanes, sections, colors: lanes[0].colors };
}

function downbeats(bpm, from, duration) {
  if (!bpm) return [];
  const out = [];
  for (let t = from; t < duration; t += (4 * 60) / bpm) out.push(t);
  return out;
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
