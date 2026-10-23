import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMidi, extractParts, suggestMelodyPart, toMonophonic, trimMelody, firstTempoBpm } from '../src/midi.js';
import { smf, track, tempo, name } from './helpers.mjs';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

function sampleFile() {
  // Piste 0 : tempo 120 puis 60 BPM à partir du temps 4 (tick 1920).
  const conductor = track([[0, ...tempo(120)], [1920, ...tempo(60)]]);
  // Piste 1 : mélodie, avec running status et note-on vélocité 0 comme note-off.
  const melody = track([
    [0, ...name('Melodie')],
    [0, 0xc0, 73],
    [0, 0x90, 72, 100],
    [480, 72, 0], // running status (statut 0x90 implicite) : vélocité 0 = arrêt de 72
    [0, 74, 90],
    [480, 0x80, 74, 0],
    [960, 0x90, 76, 80], // tick 1920 : changement de tempo
    [480, 0x80, 76, 0],
  ]);
  // Piste 2 : accords graves sur le canal 2. Piste 3 : batterie (canal 10).
  const chords = track([
    [0, 0x91, 48, 90], [0, 0x91, 52, 90], [0, 0x91, 55, 90],
    [960, 0x81, 48, 0], [0, 0x81, 52, 0], [0, 0x81, 55, 0],
  ]);
  const drums = track([[0, 0x99, 36, 100], [240, 0x89, 36, 0], [0, 0x99, 38, 100], [240, 0x89, 38, 0], [0, 0x99, 36, 100], [240, 0x89, 36, 0], [0, 0x99, 38, 100], [240, 0x89, 38, 0], [0, 0x99, 42, 100], [240, 0x89, 42, 0]]);
  return smf([conductor, melody, chords, drums]);
}

test('lit les notes et convertit les ticks en secondes avec la carte des tempos', () => {
  const midi = parseMidi(sampleFile());
  assert.equal(midi.format, 1);
  assert.equal(midi.tracks.length, 4);
  assert.equal(firstTempoBpm(midi), 120);
  const parts = extractParts(midi);
  const melody = parts.find((p) => p.name === 'Melodie');
  assert.deepEqual(melody.notes.map((n) => n.midi), [72, 74, 76]);
  close(melody.notes[0].time, 0);
  close(melody.notes[0].duration, 0.5);
  close(melody.notes[1].time, 0.5);
  // tick 1920 = 2 s à 120 BPM ; la note dure 480 ticks à 60 BPM = 1 s
  close(melody.notes[2].time, 2);
  close(melody.notes[2].duration, 1);
  close(melody.notes[2].velocity, 80 / 127);
  assert.equal(melody.instrument, 'Flûtes');
});

test('reconnaît la batterie et propose la piste mélodique', () => {
  const parts = extractParts(parseMidi(sampleFile()));
  assert.ok(parts.find((p) => p.channel === 9).isDrums);
  const chords = parts.find((p) => p.channel === 1);
  assert.ok(chords.stats.polyphony > 0.5);
  assert.equal(suggestMelodyPart(parts).name, 'Melodie');
});

test('réduit une partie à une note à la fois en gardant la note du dessus', () => {
  const notes = [
    { time: 0, midi: 60, duration: 1, velocity: 1 },
    { time: 0.01, midi: 67, duration: 1, velocity: 1 },
    { time: 0, midi: 64, duration: 1, velocity: 1 },
    { time: 0.5, midi: 65, duration: 0.5, velocity: 1 },
    { time: 0.52, midi: 62, duration: 0.5, velocity: 1 }, // trop proche : retirée
    { time: 1, midi: 69, duration: 0.5, velocity: 1 },
  ];
  const { notes: mono, dropped } = toMonophonic(notes, { minGap: 0.07 });
  assert.deepEqual(mono.map((n) => n.midi), [67, 65, 69]);
  assert.equal(dropped, 3);
  close(mono[0].duration, 0.5); // tronquée à la note suivante
  for (let i = 1; i < mono.length; i++) assert.ok(mono[i].time - mono[i - 1].time >= 0.07);
});

test('recale la mélodie à 0 s et la limite en durée', () => {
  const notes = [1, 2, 3, 40].map((time) => ({ time, midi: 60, duration: 0.2 }));
  assert.deepEqual(trimMelody(notes, 30).map((n) => n.time), [0, 1, 2]);
});

test('refuse un fichier qui n’est pas un MIDI', () => {
  assert.throws(() => parseMidi(new TextEncoder().encode('bonjour, je ne suis pas un MIDI')), /MIDI/);
});
