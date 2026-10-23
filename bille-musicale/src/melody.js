// Notes, noms français et mélodie de démonstration originale.

const NOTE_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// « E5 », « F#4 », « Bb3 » → numéro MIDI (Do4 = 60).
export function parseNote(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Note invalide : ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]] + acc;
}

// « Cascade de verre » : 8 mesures à 4 temps, une note à la fois. [note, durée en temps]
const DEMO_SCORE = [
  ['E5', 1], ['G5', 0.5], ['A5', 0.5], ['B5', 1], ['A5', 0.5], ['G5', 0.5],
  ['E5', 1.5], ['D5', 0.5], ['E5', 2],
  ['G5', 0.5], ['A5', 0.5], ['B5', 0.5], ['D6', 0.5], ['C6', 1], ['B5', 1],
  ['A5', 1.5], ['G5', 0.5], ['A5', 2],
  ['B5', 1], ['C6', 0.5], ['B5', 0.5], ['A5', 1], ['G5', 1],
  ['E5', 0.5], ['G5', 0.5], ['A5', 0.5], ['B5', 0.5], ['A5', 1], ['G5', 1],
  ['E5', 1], ['D5', 0.5], ['E5', 0.5], ['G5', 1], ['F#5', 1],
  ['E5', 1], ['B4', 1], ['E5', 2],
];

export const DEMO_BPM = 112;

export function demoProject() {
  const spb = 60 / DEMO_BPM;
  let beat = 0;
  const notes = DEMO_SCORE.map(([name, beats]) => {
    const onBar = Math.abs(beat % 4) < 1e-9;
    const note = {
      time: beat * spb,
      midi: parseNote(name),
      duration: beats * spb,
      velocity: onBar ? 0.92 : beat % 1 === 0 ? 0.8 : 0.7,
    };
    beat += beats;
    return note;
  });
  return { title: 'Cascade de verre', bpm: DEMO_BPM, notes };
}
