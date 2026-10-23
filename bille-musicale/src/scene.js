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
  // Un événement sonore par impact, au même instant : c'est la seule source d'horaires.
  const events = course.impacts.map((imp) => ({ t: imp.t, midi: imp.midi, velocity: imp.velocity, duration: imp.duration }));
  return restyleScene({
    title: project.title || '',
    bpm: project.bpm ? project.bpm * tempo : null,
    settings,
    course,
    camera,
    events,
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
