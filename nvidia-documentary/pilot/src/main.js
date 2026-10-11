// Point d'entrée de la composition Hyperframes.
//
// Hyperframes pilote le temps : à chaque image à capturer, le runtime émet l'évènement `hf-seek`
// (detail.time en secondes). La scène étant une fonction pure du temps, on rend l'image demandée
// de façon synchrone dans le gestionnaire.
//
// Variables de rendu (--variables '{"samples":12,"scale":1}') :
//   samples  : nombre de sous-échantillons par image (anticrénelage + flou de mouvement + profondeur de champ)
//   scale    : échelle de la résolution interne du canevas (1 = 1920x1080 ; 2 = 3840x2160)
//   fps      : cadence de la composition (sert à régler l'obturateur à 180°)
//   timeOffset : décalage de lecture (secondes), pour des rendus de test d'un extrait

import { createWorld, DURATION } from './world.js';
import { createHud } from './hud.js';

const BASE_W = 1920;
const BASE_H = 1080;

function readVars() {
  try {
    const hf = window.__hyperframes;
    return (hf && typeof hf.getVariables === 'function' && hf.getVariables()) || {};
  } catch {
    return {};
  }
}

const vars = readVars();
const samples = Number(vars.samples ?? window.__NV_SAMPLES ?? 8);
const scale = Number(vars.scale ?? window.__NV_SCALE ?? 1);
const fps = Number(vars.fps ?? 24);
const timeOffset = Number(vars.timeOffset ?? 0);

const canvas = document.getElementById('gl');
const W = Math.round(BASE_W * scale);
const H = Math.round(BASE_H * scale);
canvas.width = W;
canvas.height = H;
canvas.style.width = `${BASE_W}px`;
canvas.style.height = `${BASE_H}px`;

const world = createWorld({ canvas, width: W, height: H, samples, shadowType: 'basic' });
const hud = createHud({ root: document.getElementById('hud'), world, width: BASE_W, height: BASE_H });


function renderAt(tRaw) {
  const t = Math.min(Math.max(tRaw + timeOffset, 0), DURATION);
  world.pipe.renderFrame({
    time: t,
    frameIndex: Math.round(t * fps),
    shutter: world.shutterFor(t, fps, samples),
    samples: world.samplesFor(t, samples, fps),
    evaluate: world.evaluate,
  });
  world.evaluate(t); // remet la caméra à la pose exacte (sans décalage de pupille) pour l'interface
  hud.update(t);
}

window.addEventListener('hf-seek', (e) => renderAt(Number(e.detail && e.detail.time) || 0));
window.__nvRender = renderAt;
window.__nvInfo = { W, H, samples, scale, fps, caps: world.pipe.caps };
renderAt(0);
