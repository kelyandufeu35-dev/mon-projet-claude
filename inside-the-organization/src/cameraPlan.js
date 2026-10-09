import { cameraPlan } from './engine/camera.js';
import * as THREE from 'three';
import { at, TIERS } from './sets/chart.js';
import { CITY_POS } from './sets/city.js';
const W = (l, d, y) => at(l, d, y).add(CITY_POS);
import { easeInOutCubic, smoother } from './util/math.js';

// Plan de caméra global. Chaque entrée = plan clé ; l'interpolation est douce entre deux plans.
// (H = hauteur visible en unités monde : plus petit = zoom avant.)
export function buildCameraPlan(info) {
  const yTop = info.yTop;
  const dive = info.dive || { x: 0, y: 19, z: 0 };
  return cameraPlan([
    // Scène 1 — le siège
    { t: 0.0, tx: 0, ty: 9.5, tz: 0, H: 54, az: 30, el: 25, sx: -0.26 },
    { t: 3.4, tx: 0, ty: 10.5, tz: 0, H: 46, az: 38, el: 27, sx: -0.24 },
    { t: 5.9, tx: 0, ty: 15.5, tz: 0, H: 30, az: 45, el: 30, sx: 0 },
    { t: 8.8, tx: 0, ty: yTop + 0.4, tz: -0.2, H: 12.8, az: 49, el: 35, sy: 0.05 },
    { t: 14.6, tx: 0, ty: yTop + 0.4, tz: 0.0, H: 12.2, az: 58, el: 37, sy: 0.05 },
    // Scène 2 — les directions
    { t: 18.6, tx: 0, ty: 8.5, tz: 0, H: 56, az: 46, el: 31, sy: 0 },
    { t: 25.0, tx: 0, ty: 8.0, tz: 0, H: 58, az: 62, el: 32 },
    { t: 30.0, tx: 0, ty: 8.0, tz: 0, H: 60, az: 70, el: 33 },
    // Scène 3 — globe
    { t: 32.2, tx: 0, ty: 6.5, tz: 0, H: 66, az: 58, el: 37 },
    { t: 35.4, tx: 0, ty: 18.5, tz: 0, H: 46, az: 48, el: 27 },
    { t: 43.5, tx: 0, ty: 19.0, tz: 0, H: 44, az: 44, el: 26 },
    // Scène 4 — plongeon dans le marché (zoom exponentiel), éclair, puis la ville se dévoile depuis les arches
    { t: 44.97, tx: dive.x, ty: dive.y, tz: dive.z, H: 2.6, az: 44, el: 26 },
    { t: 45.0, tx: 400 - 6.2, ty: 5.7, tz: 4 - 5.4, H: 3.0, az: 44, el: 26 },
    { t: 47.8, tx: 400 - 10, ty: 11, tz: 6, H: 66, az: 44, el: 31 },
    { t: 53.4, tx: 400 - 10, ty: 10, tz: 8, H: 62, az: 48, el: 31 },
    { t: 55.0, tx: 400 + 0.5, ty: 3.5, tz: 10.5, H: 30, az: 52, el: 29 },
    { t: 55.9, tx: 400 + 2.6, ty: 1.7, tz: 12.0, H: 11.5, az: 52, el: 26 },
    { t: 57.6, tx: 400 + 2.6, ty: 1.7, tz: 12.0, H: 12.5, az: 58, el: 26 },
    { t: 58.7, tx: 400 - 8, ty: 7, tz: -2, H: 76, az: 48, el: 33 },
    { t: 60.0, tx: 400 + 1, ty: 4, tz: 5, H: 40, az: 47, el: 34 },
    // Scène 5 — intérieur du restaurant
    { t: 62.6, tx: 400 + 2, ty: 2.2, tz: 4.4, H: 12.6, az: 46, el: 38 },
    { t: 74.4, tx: 400 + 1.8, ty: 2.2, tz: 3.8, H: 12.2, az: 54, el: 39 },
    // Scène 6 — la caméra s'élève, tout se réassemble en organigramme
    { t: 77.2, tx: 400 + 2, ty: 8, tz: 3, H: 52, az: 50, el: 36 },
    { t: 79.8, tx: W(20, 37, 14).x, ty: W(20, 37, 14).y, tz: W(20, 37, 14).z, H: 108, az: 46, el: 33 },
    { t: 82.4, tx: W(0, 62, 26).x, ty: W(0, 62, 26).y, tz: W(0, 62, 26).z, H: 70, az: 44, el: 33 },
    { t: 84.2, tx: W(46, 22, 10).x, ty: W(46, 22, 10).y, tz: W(46, 22, 10).z, H: 74, az: 46, el: 33 },
    { t: 85.7, tx: W(18, 38, 13).x, ty: W(18, 38, 13).y, tz: W(18, 38, 13).z, H: 110, az: 45, el: 33, sx: -0.21, sy: 0.07 },
    { t: 93.5, tx: W(18, 38, 13).x, ty: W(18, 38, 13).y, tz: W(18, 38, 13).z, H: 104, az: 47, el: 33, sx: -0.21, sy: 0.07 },
  ]);
}
