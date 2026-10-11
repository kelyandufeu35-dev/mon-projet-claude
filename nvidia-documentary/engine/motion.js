// Planificateur de flou de mouvement : obturateur et nombre de sous-échantillons dimensionnés d'après la
// vitesse apparente de la caméra.
//
// Le flou de mouvement est une accumulation de N images prises à des instants répartis dans l'obturateur.
// Si un contour se déplace de plus de quelques pixels entre deux sous-échantillons, on ne voit pas un flou
// continu mais N copies translucides distinctes. Ici la vitesse apparente est mesurée (projection de points
// de la vue, à trois profondeurs, aux deux bornes de l'obturateur) et :
//   - l'obturateur de la piste est raccourci si le budget d'échantillons ne suffit pas à le remplir ;
//   - N est relevé jusqu'à ce que l'écart entre copies tombe sous `ghostPx` (mesuré sur 1920 px de large).

import * as THREE from 'three';

const GRID = [-0.85, -0.4, 0, 0.4, 0.85];

/**
 * @param {object} p
 * @param {(cam:THREE.PerspectiveCamera, t:number)=>{focusDistance:number}} p.placeCamera  pose la caméra à l'instant t
 * @param {number} p.duration            durée totale (s)
 * @param {(t:number)=>number} p.shutterFrac   fraction de la période d'image (0.5 = 180°)
 * @param {(t:number)=>number} p.sampleFactor  facteur de sous-échantillons « manuel » (× base)
 * @param {number} [p.ghostPx]           écart toléré entre sous-échantillons consécutifs (px sur 1920)
 * @param {number} [p.budget]            sous-échantillons maximum = budget × base
 * @param {number} [p.refWidth]          largeur de référence des pixels (défaut 1920)
 */
export function createMotionPlanner({ placeCamera, duration, shutterFrac, sampleFactor, ghostPx = 6, budget = 2, refWidth = 1920 }) {
  const c0 = new THREE.PerspectiveCamera(), c1 = new THREE.PerspectiveCamera(), cm = new THREE.PerspectiveCamera();
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();

  // Vitesse apparente maximale (px sur `refWidth` de large pour le plus grand côté) des points de l'espace
  // devant la caméra pendant l'ouverture de l'obturateur.
  function motionPx(t, shutterSec) {
    if (shutterSec <= 0) return 0;
    const ta = Math.max(0, t - shutterSec / 2), tb = Math.min(duration, t + shutterSec / 2);
    placeCamera(c0, ta);
    placeCamera(c1, tb);
    const lens = placeCamera(cm, t);
    const F = lens.focusDistance;
    const sx = refWidth / 2, sy = (refWidth / 2) / cm.aspect;
    let worst = 0;
    for (const dk of [0.5, 1, 2]) {
      for (const x of GRID) {
        for (const y of GRID) {
          p.set(x, y, 0.5).unproject(cm).sub(cm.position).normalize().multiplyScalar(F * dk).add(cm.position);
          a.copy(p).project(c0);
          b.copy(p).project(c1);
          if (a.z > 1 || b.z > 1 || Math.abs(a.x) > 1.1 || Math.abs(a.y) > 1.1) continue;
          const d = Math.hypot((b.x - a.x) * sx, (b.y - a.y) * sy);
          if (d > worst) worst = d;
        }
      }
    }
    return worst;
  }

  function shutterFor(t, fps, base = 5) {
    const s0 = shutterFrac(t) / fps;
    const disp = motionPx(t, s0);
    const maxDisp = (budget * base - 1) * ghostPx;
    return disp > maxDisp ? Math.max(s0 * maxDisp / disp, 0.03 / fps) : s0;
  }

  function samplesFor(t, base, fps = 24) {
    const manual = Math.max(2, Math.round(base * sampleFactor(t)));
    const need = Math.ceil(motionPx(t, shutterFor(t, fps, base)) / ghostPx) + 1;
    return Math.max(manual, Math.min(need, budget * base));
  }

  return { motionPx, shutterFor, samplesFor };
}
