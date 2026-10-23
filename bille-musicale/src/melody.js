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

// Mélodies originales intégrées à l'appli (libres de droits : composées pour elle).
// Chaque mesure fait 4 temps : [note, durée en temps]. `bass` donne la fondamentale de chaque
// mesure pour la basse 808, `style` le rythme de batterie.
export const LIBRARY = [
  {
    id: 'nuit',
    title: 'Nuit sur la ville',
    bpm: 140,
    style: 'trap',
    bass: ['C#2', 'A1', 'E2', 'B1', 'C#2', 'A1', 'F#1', 'G#1'],
    bars: [
      [['C#5', 0.5], ['E5', 0.5], ['G#5', 1], ['F#5', 0.5], ['E5', 0.5], ['D#5', 1]],
      [['C#5', 0.75], ['C#5', 0.25], ['E5', 0.5], ['G#5', 0.5], ['B5', 1.5], ['A5', 0.5]],
      [['G#5', 0.5], ['F#5', 0.5], ['E5', 0.5], ['F#5', 0.5], ['G#5', 1], ['E5', 1]],
      [['D#5', 1.5], ['B4', 0.5], ['C#5', 2]],
      [['C#5', 0.5], ['E5', 0.5], ['G#5', 1], ['F#5', 0.5], ['E5', 0.5], ['D#5', 1]],
      [['C#5', 0.75], ['C#5', 0.25], ['E5', 0.5], ['G#5', 0.5], ['C#6', 1.5], ['B5', 0.5]],
      [['A5', 0.5], ['G#5', 0.5], ['F#5', 0.5], ['E5', 0.5], ['F#5', 0.5], ['G#5', 0.5], ['E5', 1]],
      [['D#5', 1], ['B4', 1], ['C#5', 2]],
    ],
  },
  {
    id: 'drill',
    title: 'Drill nocturne',
    bpm: 142,
    style: 'drill',
    bass: ['E2', 'C2', 'E2', 'B1', 'E2', 'C2', 'A1', 'B1'],
    bars: [
      [['E5', 0.75], ['E5', 0.75], ['G5', 0.5], ['F#5', 0.75], ['E5', 0.75], ['D5', 0.5]],
      [['B4', 0.75], ['D5', 0.75], ['E5', 0.5], ['G5', 1], ['F#5', 1]],
      [['E5', 0.75], ['E5', 0.75], ['G5', 0.5], ['A5', 0.75], ['G5', 0.75], ['F5', 0.5]],
      [['E5', 1.5], ['D5', 0.5], ['B4', 2]],
      [['E5', 0.75], ['E5', 0.75], ['G5', 0.5], ['F#5', 0.75], ['E5', 0.75], ['D5', 0.5]],
      [['B4', 0.75], ['D5', 0.75], ['E5', 0.5], ['B5', 1], ['A5', 1]],
      [['G5', 0.75], ['F#5', 0.75], ['E5', 0.5], ['F5', 0.75], ['E5', 0.75], ['D5', 0.5]],
      [['E5', 2], ['B4', 1], ['E5', 1]],
    ],
  },
  {
    id: 'reve',
    title: 'Rêve en or',
    bpm: 120,
    style: 'trap',
    bass: ['A2', 'F2', 'G2', 'A2', 'A2', 'F2', 'G2', 'A2'],
    bars: [
      [['A4', 1], ['C5', 0.5], ['E5', 0.5], ['A5', 1], ['G5', 0.5], ['E5', 0.5]],
      [['F5', 1.5], ['E5', 0.5], ['D5', 1], ['C5', 1]],
      [['B4', 0.5], ['C5', 0.5], ['D5', 0.5], ['E5', 0.5], ['G5', 1], ['E5', 1]],
      [['A4', 2], ['E5', 1], ['C5', 1]],
      [['A4', 1], ['C5', 0.5], ['E5', 0.5], ['A5', 1], ['G5', 0.5], ['E5', 0.5]],
      [['F5', 1.5], ['G5', 0.5], ['A5', 1], ['C6', 1]],
      [['B5', 0.5], ['A5', 0.5], ['G5', 0.5], ['E5', 0.5], ['D5', 1], ['E5', 1]],
      [['A5', 2], ['E5', 1], ['A4', 1]],
    ],
  },
  {
    id: 'mirage',
    title: 'Mirage oriental',
    bpm: 100,
    style: 'boom',
    bass: ['D2', 'D2', 'D2', 'D2', 'Bb1', 'Eb2', 'C2', 'D2'],
    bars: [
      [['D5', 0.5], ['Eb5', 0.5], ['F#5', 0.5], ['G5', 0.5], ['A5', 1], ['G5', 0.5], ['F#5', 0.5]],
      [['G5', 0.5], ['F#5', 0.5], ['Eb5', 0.5], ['F#5', 0.5], ['D5', 2]],
      [['A5', 0.5], ['Bb5', 0.5], ['A5', 0.5], ['G5', 0.5], ['F#5', 0.5], ['G5', 0.5], ['A5', 1]],
      [['G5', 0.5], ['F#5', 0.5], ['Eb5', 1], ['D5', 2]],
      [['D6', 1], ['C6', 0.5], ['Bb5', 0.5], ['A5', 1], ['G5', 1]],
      [['A5', 0.5], ['G5', 0.5], ['F#5', 0.5], ['Eb5', 0.5], ['F#5', 2]],
      [['G5', 0.5], ['A5', 0.5], ['Bb5', 0.5], ['A5', 0.5], ['G5', 0.5], ['F#5', 0.5], ['Eb5', 1]],
      [['D5', 2], ['A4', 1], ['D5', 1]],
    ],
  },
  {
    id: 'cascade',
    title: 'Cascade de verre',
    bpm: 112,
    style: 'pop',
    bass: ['E2', 'E2', 'G2', 'A2', 'C2', 'E2', 'D2', 'E2'],
    bars: [
      [['E5', 1], ['G5', 0.5], ['A5', 0.5], ['B5', 1], ['A5', 0.5], ['G5', 0.5]],
      [['E5', 1.5], ['D5', 0.5], ['E5', 2]],
      [['G5', 0.5], ['A5', 0.5], ['B5', 0.5], ['D6', 0.5], ['C6', 1], ['B5', 1]],
      [['A5', 1.5], ['G5', 0.5], ['A5', 2]],
      [['B5', 1], ['C6', 0.5], ['B5', 0.5], ['A5', 1], ['G5', 1]],
      [['E5', 0.5], ['G5', 0.5], ['A5', 0.5], ['B5', 0.5], ['A5', 1], ['G5', 1]],
      [['E5', 1], ['D5', 0.5], ['E5', 0.5], ['G5', 1], ['F#5', 1]],
      [['E5', 1], ['B4', 1], ['E5', 2]],
    ],
  },
];

export function libraryProject(id) {
  const entry = LIBRARY.find((m) => m.id === id) || LIBRARY[0];
  const spb = 60 / entry.bpm;
  let beat = 0;
  const notes = [];
  for (const bar of entry.bars) {
    for (const [name, beats] of bar) {
      const onBar = Math.abs(beat % 4) < 1e-9;
      notes.push({
        time: beat * spb,
        midi: parseNote(name),
        duration: beats * spb,
        velocity: onBar ? 0.92 : beat % 1 === 0 ? 0.8 : 0.7,
      });
      beat += beats;
    }
  }
  return {
    title: entry.title,
    bpm: entry.bpm,
    notes,
    beat: { bpm: entry.bpm, style: entry.style, bars: entry.bars.length, bass: entry.bass.map(parseNote) },
  };
}

export const DEMO_BPM = 112;

export function demoProject() {
  return libraryProject('cascade');
}
