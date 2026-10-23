import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProject } from '../src/melody.js';
import { buildCourse, buildCamera, cameraAt, ballAt, clearance, WORLD_H, WORLD_W } from '../src/planner.js';
import { verifyCourse } from '../src/verify.js';
import { buildScene } from '../src/scene.js';
import { rng } from './helpers.mjs';

const scaled = (notes, tempo) => notes.map((n) => ({ ...n, time: n.time / tempo, duration: n.duration / tempo }));

test('démo : chaque impact tombe à l’horaire de sa note, bille au contact', () => {
  const { notes } = demoProject();
  const course = buildCourse(notes);
  assert.equal(course.impacts.length, notes.length);
  course.impacts.forEach((imp, i) => {
    assert.equal(imp.t, notes[i].time + course.lead);
    const b = ballAt(course, imp.t);
    assert.ok(Math.abs(clearance(b.x, b.y, imp.platform, course.options.ballRadius)) < 1e-6);
  });
  const v = verifyCourse(course);
  assert.ok(v.ok, JSON.stringify(v));
});

for (const tempo of [0.5, 0.75, 1, 1.25, 1.6]) {
  test(`démo à ${tempo * 100} % : aucune collision parasite`, () => {
    const v = verifyCourse(buildCourse(scaled(demoProject().notes, tempo)));
    assert.equal(v.collisions, 0);
    assert.equal(v.wrongSide, 0);
    assert.ok(v.ok, JSON.stringify(v));
  });
}

test('mélodies aléatoires (notes très rapides, silences longs) : parcours valides', () => {
  const gaps = [0.07, 0.1, 0.15, 0.25, 0.4, 0.6, 1, 2.5];
  for (let seed = 1; seed <= 25; seed++) {
    const r = rng(seed * 7919);
    let t = 0;
    const notes = [];
    for (let i = 0; i < 60; i++) {
      notes.push({ time: t, midi: 55 + Math.floor(r() * 30), duration: 0.2, velocity: 0.8 });
      t += gaps[Math.floor(r() * gaps.length)];
    }
    const course = buildCourse(notes);
    const v = verifyCourse(course);
    assert.ok(v.ok, `graine ${seed} : ${JSON.stringify(v)}`);
    for (const imp of course.impacts) {
      assert.ok(imp.platform.cx > 0 && imp.platform.cx < WORLD_W, 'plateforme hors cadre');
    }
  }
});

test('la caméra garde la bille dans le cadre jusqu’au dernier impact', () => {
  const course = buildCourse(demoProject().notes);
  const camera = buildCamera(course);
  for (let t = 0; t <= course.lastT; t += 1 / 60) {
    const y = ballAt(course, t).y - cameraAt(camera, t);
    assert.ok(y > 0.05 * WORLD_H && y < 0.9 * WORLD_H, `bille à ${y.toFixed(0)} px du haut à t=${t.toFixed(2)}`);
  }
});

test('la scène programme un son par impact, au même instant', () => {
  const scene = buildScene(demoProject(), { tempo: 1.3, transpose: 1 });
  assert.equal(scene.events.length, scene.course.impacts.length);
  scene.events.forEach((e, i) => {
    assert.equal(e.t, scene.course.impacts[i].t);
    assert.equal(e.midi, scene.course.impacts[i].midi);
  });
  assert.equal(scene.events[0].midi, demoProject().notes[0].midi + 12);
});

test('mélodies de l’appli : parcours valides à tous les tempos, batterie sur la même grille', async () => {
  const { LIBRARY, libraryProject } = await import('../src/melody.js');
  for (const entry of LIBRARY) {
    for (const bar of entry.bars) assert.equal(bar.reduce((s, [, beats]) => s + beats, 0), 4, `${entry.id} : mesure de 4 temps`);
    for (const tempo of [0.75, 1, 1.25]) {
      const scene = buildScene(libraryProject(entry.id), { tempo });
      assert.ok(scene.verification.ok, `${entry.id} à ${tempo} : ${JSON.stringify(scene.verification)}`);
      // Le premier temps de la batterie tombe sur la première note.
      assert.ok(Math.abs(scene.beat[0].t - scene.events[0].t) < 1e-9);
      const step = 60 / entry.bpm / tempo / 4;
      for (const e of scene.beat) {
        const k = (e.t - scene.events[0].t) / step;
        assert.ok(Math.abs(k - Math.round(k)) < 1e-6, `${entry.id} : coup hors grille`);
      }
    }
    assert.equal(buildScene(libraryProject(entry.id), { drums: false }).beat.length, 0);
  }
});
