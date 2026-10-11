// Monde de la vidéo verticale « Comment NVIDIA fonctionne vraiment » : un seul pipeline de rendu, plusieurs
// sous-mondes (un graphe de scène par grande séquence), choisis selon l'instant. Chaque sous-monde est créé
// à la première image qui en a besoin (un rendu par tranches n'a donc pas à tout construire).
//
// Interface d'un sous-monde (le temps `t` est toujours le temps global de la vidéo, en secondes) :
//   evaluate(t)        -> { scene, camera, lens }  met la scène à l'instant t
//   placeCamera(cam,t) -> lens                      pose une caméra à l'instant t (sert au flou de mouvement)
//   shutterFrac(t), sampleFactor(t)                 obturateur (fraction de période) et facteur d'échantillons

import * as THREE from 'three';
import { CinePipeline } from '../../engine/pipeline.js';
import { createMotionPlanner } from '../../engine/motion.js';
import { createWorld as createPilot } from '../../pilot/src/world.js';
import { S, DURATION, bump } from './timing.js';
import { createStub } from './shots/stub.js';
import { createFab } from './shots/fab.js';
import { createStack } from './shots/stack.js';
import { createCampus } from './shots/campus.js';
import { createGlobe } from './shots/globe.js';

export { DURATION };

// Interpolation linéaire par morceaux : [[t, valeur], ...].
const piecewise = (a) => (t) => {
  if (t <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    if (t <= a[i][0]) {
      const [t0, v0] = a[i - 1], [t1, v1] = a[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return a[a.length - 1][1];
};

// Temps de la pilote (16:9) réemployée : puce et plongée (plans 1-2), puis plateau et allée (plan 4).
const mapChip = piecewise([[0, 0], [S.design, 6.4], [7.3, 8.5], [S.foundry, 14.2]]);
const mapHall = piecewise([[S.systems, 21.4], [S.software, 31.8]]);

// Recadrage vertical des images-clés de la pilote : à l'intérieur de la puce (avant la sortie), la caméra
// regardait l'horizon, ce qui laissait la moitié haute du cadre vide en 9:16. On la fait plonger vers le
// plan de calcul avec une focale plus longue (champ vertical plus étroit).
function tweakPilotKeys(w) {
  const L = w.L;
  for (const k of w.rig.keys) {
    if (Math.abs(k.t - 12.8) < 1e-6) Object.assign(k, { pos: L(-0.0025, 0.0030, 0.0018), target: L(-0.0026, 0.0003, -0.0018), focal: 40 });
    if (Math.abs(k.t - 14.2) < 1e-6) Object.assign(k, { pos: L(-0.0027, 0.0030, -0.0020), target: L(-0.0028, 0.0002, -0.0044), focal: 40 });
  }
  return w;
}

function pilotView(w, map) {
  return {
    evaluate: (t) => w.evaluate(map(t)),
    placeCamera: (cam, t) => w.placeCamera(cam, map(t)).lens,
    shutterFrac: (t) => w.shutterFrac(map(t)),
    sampleFactor: (t) => w.sampleFactor(map(t)),
  };
}

export function createTikTokWorld({ canvas, width, height, samples = 6, shadowType = 'basic' }) {
  const pipe = new CinePipeline({ canvas, width, height, samples, shadowType });
  const defaultGrade = JSON.parse(JSON.stringify(pipe.grade));
  const common = { pipe, width, height };

  const worlds = {};
  const factories = {
    pilot: () => tweakPilotKeys(createPilot({ canvas, width, height, samples, shadowType, pipe })),
    fab: () => createFab(common),
    stack: () => createStack(common),
    campus: () => createCampus(common),
    globe: () => createGlobe(common),
  };
  const get = (id) => (worlds[id] ||= factories[id]());

  // Séquences : [fin, vue].
  const views = {};
  const sequences = [
    { id: 'chip', t1: S.foundry, view: () => (views.chip ||= pilotView(get('pilot'), mapChip)) },
    { id: 'fab', t1: S.systems, view: () => get('fab') },
    { id: 'hall', t1: S.software, view: () => (views.hall ||= pilotView(get('pilot'), mapHall)) },
    { id: 'stack', t1: S.economy, view: () => get('stack') },
    { id: 'campus', t1: S.close, view: () => get('campus') },
    { id: 'globe', t1: Infinity, view: () => get('globe') },
  ];
  const sequenceAt = (t) => sequences.find((s) => t < s.t1) || sequences[sequences.length - 1];
  const viewAt = (t) => sequenceAt(t).view();

  // Transitions : éclat blanc ou plongée au noir centrés sur les limites de plans.
  function transitions(t) {
    const flash =
      bump(t, S.foundry, 0.22, 0.34, 2.4) +
      bump(t, S.software, 0.18, 0.3, 1.6) +
      bump(t, S.close, 0.2, 0.34, 2.0) +
      bump(t, 0, 0.0001, 0.45, 1.4) +            // ouverture : l'éclat de la boucle retombe
      bump(t, DURATION, 0.7, 0.0001, 1.4);        // fermeture : l'éclat monte et reboucle sur l'ouverture
    const dip = bump(t, S.economy, 0.1, 0.14, 1) + bump(t, S.systems, 0.06, 0.1, 0.8);
    return { flash, fade: 1 - dip };
  }

  const dummy = new THREE.Vector3();
  function evaluate(t) {
    Object.assign(pipe.grade, JSON.parse(JSON.stringify(defaultGrade)));
    const r = viewAt(t).evaluate(t);
    const tr = transitions(t);
    pipe.grade.flash += tr.flash;
    pipe.grade.fade = tr.fade;
    return r;
  }

  const planner = createMotionPlanner({
    placeCamera: (cam, t) => viewAt(t).placeCamera(cam, t),
    duration: DURATION,
    shutterFrac: (t) => viewAt(t).shutterFrac(t),
    sampleFactor: (t) => viewAt(t).sampleFactor(t),
  });

  // Point d'ancrage (projeté par l'interface) d'un décor : { camera, point }.
  const anchor = (id) => { const w = get(id === 'cuda' ? 'stack' : id); return { camera: w.camera, point: w.anchors[id] }; };

  return { pipe, evaluate, anchor, DURATION, get, sequenceAt, samplesFor: planner.samplesFor, shutterFor: planner.shutterFor, motionPx: planner.motionPx, dummy };
}
