import * as THREE from 'three';
import { createStage } from './engine/stage.js';
import { LinkSystem } from './engine/links.js';
import { Labels } from './engine/labels.js';
import { buildCameraPlan } from './cameraPlan.js';
import { buildHQ } from './sets/hq.js';
import { buildPlaza } from './sets/plaza.js';
import { buildGlobe } from './sets/globe.js';
import { buildCity } from './sets/city.js';
import { buildInterior } from './sets/interior.js';
import { buildChart } from './sets/chart.js';
import { buildOverlay } from './overlay.js';
import { HOOK, VIDEO_TOTAL, toScene } from './timeline.js';

const stage = createStage();
const links = new LinkSystem(stage.scene);
const labels = new Labels(document.getElementById('labels'), stage.rig);
const ctx = { scene: stage.scene, links, labels, rig: stage.rig, stage };

const hq = buildHQ(ctx);
const plaza = buildPlaza(ctx);
let camAt = buildCameraPlan({ yTop: ctx.hq.yTop });
ctx.camAt = camAt;
const globe = buildGlobe(ctx);
const divePos = globe.markerWorldAt('us', 44.9);
camAt = buildCameraPlan({ yTop: ctx.hq.yTop, dive: divePos });
ctx.camAt = camAt;
const city = buildCity(ctx);
const interior = buildInterior(ctx, city);
const chart = buildChart(ctx, city);
ctx.chart = chart;

function renderScene(t, withLabels) {
  const s = camAt(t);
  stage.rig.apply(s);
  stage.updateForCamera(s);
  hq.update(t);
  plaza.update(t);
  globe.update(t);
  city.update(t);
  interior.update(t);
  chart.update(t);
  stage.scene.updateMatrixWorld(true);
  links.update(t);
  labels.update(withLabels ? t : -1e9);
  stage.renderer.render(stage.scene, stage.rig.cam);
}

const overlayTl = buildOverlay(document.getElementById('root'));
// temps vidéo -> temps de scène (le hook d'ouverture échantillonne des moments clés du film)
export function renderAt(tv) {
  const { ts, hook } = toScene(tv);
  renderScene(ts, !hook);
}
window.__overlayTimeline = overlayTl;
window.__HOOK = HOOK; window.__VIDEO_TOTAL = VIDEO_TOTAL;
window.__seek = (t) => { overlayTl.time(t, false); renderAt(t); };
window.__renderAt = renderAt;
window.__stage = stage; window.__labels = labels;
window.addEventListener('hf-seek', (e) => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
