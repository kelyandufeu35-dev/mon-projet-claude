// Point d'entrée de la composition Hyperframes verticale (9:16).
//
// Hyperframes pilote le temps : à chaque image à capturer, le runtime émet l'évènement `hf-seek`
// (detail.time en secondes) ; la scène étant une fonction pure du temps, l'image est rendue de façon synchrone.
//
// Variables de rendu (--variables '{"samples":5,"scale":1,"fps":24,"timeOffset":0}') :
//   samples    : sous-échantillons de base par image (le planificateur de mouvement en ajoute si besoin)
//   scale      : échelle de la résolution interne (1 = 1080x1920 ; 2 = 2160x3840)
//   fps        : cadence (sert à régler l'obturateur)
//   timeOffset : décalage de lecture (s), pour les tranches de rendu

import { createTikTokWorld, DURATION } from './world.js';
import { createHud } from './hud.js';

const BASE_W = 1080;
const BASE_H = 1920;

function readVars() {
  try {
    const hf = window.__hyperframes;
    return (hf && typeof hf.getVariables === 'function' && hf.getVariables()) || {};
  } catch {
    return {};
  }
}

const vars = readVars();
const samples = Number(vars.samples ?? window.__NV_SAMPLES ?? 5);
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

const world = createTikTokWorld({ canvas, width: W, height: H, samples, shadowType: 'basic' });
const hud = createHud({ root: document.getElementById('hud'), world, width: BASE_W, height: BASE_H });

function renderAt(tRaw) {
  const t = Math.min(Math.max(tRaw + timeOffset, 0), DURATION);
  world.pipe.renderFrame({
    time: t,
    frameIndex: Math.round(t * fps),
    shutter: world.shutterFor(t, fps, samples),
    samples: world.samplesFor(t, samples, fps),
    evaluate: (tt) => world.evaluate(tt),
  });
  world.evaluate(t); // remet les caméras à la pose exacte (sans décalage de pupille) pour l'interface
  hud.update(t);
}

window.addEventListener('hf-seek', (e) => renderAt(Number(e.detail && e.detail.time) || 0));
window.__nvRender = renderAt;
window.__nvInfo = { W, H, samples, scale, fps, caps: world.pipe.caps };
renderAt(0);
