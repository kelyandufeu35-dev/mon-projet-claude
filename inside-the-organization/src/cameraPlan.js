import { cameraPlan } from './engine/camera.js';
import { at, LY } from './sets/chart.js';
import { CITY_POS } from './sets/city.js';
import { PORTRAIT } from './format.js';

const Wp = (l, d, y) => at(l, d, y).add(CITY_POS);

/**
 * Plan de caméra global (temps de SCÈNE). Chaque plan clé = { t, cible, H (hauteur visible), az, el, sx, sy }.
 * Chaque clé peut porter `p: {...}` : surcharges appliquées en format PORTRAIT (la fenêtre visible y est 3,2× plus étroite
 * pour une même hauteur : on zoome moins et on décale le sujet vers le haut pour laisser le bas aux sous-titres).
 * az / el restent identiques dans les deux formats (le globe s'en sert pour viser les marchés).
 */
export function buildCameraPlan(info) {
  const yTop = info.yTop;
  const dive = info.dive || { x: 0, y: 19, z: 0 };
  // cibles de l'organigramme (selon la disposition du format)
  const c = PORTRAIT ? Wp(4, 33, 13) : Wp(18, 38, 13);
  const top = PORTRAIT ? Wp(0, 62, 27) : Wp(0, 62, 26);
  const fr = PORTRAIT ? Wp(17, 22, 9) : Wp(46, 22, 10);
  const mid = PORTRAIT ? Wp(4, 33, 13) : Wp(20, 37, 14);
  const keys = [
    // Scène 1 — le siège
    { t: 0.0, tx: 0, ty: 9.5, tz: 0, H: 54, az: 30, el: 25, sx: -0.26, p: { H: 36, ty: 10, sx: 0, sy: 0.16 } },
    { t: 3.4, tx: 0, ty: 10.5, tz: 0, H: 46, az: 38, el: 27, sx: -0.24, p: { H: 33, ty: 11, sx: 0, sy: 0.12 } },
    { t: 5.9, tx: 0, ty: 15.5, tz: 0, H: 30, az: 45, el: 30, sx: 0, p: { H: 27, ty: 15, sy: -0.06 } },
    { t: 8.8, tx: 0, ty: yTop + 0.4, tz: -0.2, H: 12.8, az: 49, el: 35, sy: 0.05, p: { H: 26, sy: -0.1 } },
    { t: 14.6, tx: 0, ty: yTop + 0.4, tz: 0.0, H: 12.2, az: 58, el: 37, sy: 0.05, p: { H: 25, sy: -0.1 } },
    // Scène 2 — les directions
    { t: 18.6, tx: 0, ty: 8.5, tz: 0, H: 56, az: 46, el: 31, sy: 0, p: { H: 84, sy: -0.1 } },
    { t: 25.0, tx: 0, ty: 8.0, tz: 0, H: 58, az: 62, el: 32, p: { H: 86, sy: -0.1 } },
    { t: 30.0, tx: 0, ty: 8.0, tz: 0, H: 60, az: 70, el: 33, p: { H: 88, sy: -0.1 } },
    // Scène 3 — globe
    { t: 32.2, tx: 0, ty: 6.5, tz: 0, H: 66, az: 58, el: 37, p: { H: 108, sy: -0.1 } },
    { t: 35.4, tx: 0, ty: 18.5, tz: 0, H: 46, az: 48, el: 27, p: { H: 78, sy: -0.1 } },
    { t: 43.5, tx: 0, ty: 19.0, tz: 0, H: 44, az: 44, el: 26, p: { H: 74, sy: -0.1 } },
    // Scène 4 — plongeon dans le marché (zoom exponentiel), éclair, puis la ville se dévoile depuis les arches
    { t: 44.97, tx: dive.x, ty: dive.y, tz: dive.z, H: 2.6, az: 44, el: 26, p: { sy: 0 } },
    { t: 45.0, tx: 400 - 6.2, ty: 5.7, tz: 4 - 5.4, H: 3.0, az: 44, el: 26, p: { sy: 0 } },
    { t: 47.8, tx: 400 - 10, ty: 11, tz: 6, H: 66, az: 44, el: 31, p: { H: 104, tx: 400 - 8, sy: -0.1 } },
    { t: 53.4, tx: 400 - 10, ty: 10, tz: 8, H: 62, az: 48, el: 31, p: { H: 96, tx: 400 - 8, sy: -0.1 } },
    { t: 55.0, tx: 400 + 0.5, ty: 3.5, tz: 10.5, H: 30, az: 52, el: 29, p: { H: 58, sy: -0.1 } },
    { t: 55.9, tx: 400 + 2.6, ty: 1.7, tz: 12.0, H: 11.5, az: 52, el: 26, p: { H: 38, sy: -0.1 } },
    { t: 57.6, tx: 400 + 2.6, ty: 1.7, tz: 12.0, H: 12.5, az: 58, el: 26, p: { H: 40, sy: -0.1 } },
    { t: 58.7, tx: 400 - 8, ty: 7, tz: -2, H: 76, az: 48, el: 33, p: { H: 116, sy: -0.1 } },
    { t: 60.0, tx: 400 + 1, ty: 4, tz: 5, H: 40, az: 47, el: 34, p: { H: 66, sy: -0.1 } },
    // Scène 5 — intérieur du restaurant
    { t: 62.6, tx: 400 + 2, ty: 2.2, tz: 4.4, H: 12.6, az: 46, el: 38, p: { H: 36, sy: -0.1 } },
    { t: 74.4, tx: 400 + 1.8, ty: 2.2, tz: 3.8, H: 12.2, az: 54, el: 39, p: { H: 35, sy: -0.1 } },
    // Scène 6 — la caméra s'élève, tout se réassemble en organigramme
    { t: 77.2, tx: 400 + 2, ty: 8, tz: 3, H: 52, az: 50, el: 36, p: { H: 84, sy: -0.1 } },
    { t: 79.8, tx: mid.x, ty: mid.y, tz: mid.z, H: 108, az: 46, el: 33, p: { H: 150, sy: -0.06 } },
    { t: 82.4, tx: top.x, ty: top.y, tz: top.z, H: 70, az: 44, el: 33, p: { H: 96, sy: -0.06 } },
    { t: 84.2, tx: fr.x, ty: fr.y, tz: fr.z, H: 74, az: 46, el: 33, p: { H: 92, sy: -0.08 } },
    { t: 85.7, tx: c.x, ty: c.y, tz: c.z, H: 110, az: 45, el: 33, sx: -0.21, sy: 0.07, p: { H: 150, sx: 0, sy: -0.04 } },
    { t: 93.5, tx: c.x, ty: c.y, tz: c.z, H: 104, az: 47, el: 33, sx: -0.21, sy: 0.07, p: { H: 150, sx: 0, sy: -0.04 } },
  ];
  return cameraPlan(keys.map(({ p, ...k }) => (PORTRAIT ? { ...k, sx: 0, sy: -0.1, ...(p || {}) } : k)));
}
