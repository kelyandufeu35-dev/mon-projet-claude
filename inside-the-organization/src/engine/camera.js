import * as THREE from 'three';
import { DEG, lerp, smoother, invLerp } from '../util/math.js';

/**
 * Caméra orthographique isométrique pilotable.
 * Paramètres : cible (tx,ty,tz), hauteur visible H (zoom), azimut az, élévation el, roulis.
 * Le zoom ortho remplace le travelling : H petit = zoom avant.
 */
export class CameraRig {
  constructor(width, height) {
    this.aspect = width / height;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 1400);
    this.state = { tx: 0, ty: 0, tz: 0, H: 40, az: 45, el: 32, roll: 0, sx: 0, sy: 0 };
  }
  apply(s) {
    this.state = s;
    const a = s.az * DEG, e = s.el * DEG, d = 500;
    const dx = Math.cos(e) * Math.sin(a), dy = Math.sin(e), dz = Math.cos(e) * Math.cos(a);
    const c = this.cam;
    c.position.set(s.tx + dx * d, s.ty + dy * d, s.tz + dz * d);
    c.up.set(0, 1, 0);
    c.lookAt(s.tx, s.ty, s.tz);
    if (s.roll) c.rotateZ(s.roll * DEG);
    const hh = s.H / 2, hw = hh * this.aspect;
    // sx, sy : décalage du cadrage en unités d'écran (pour placer le sujet hors centre)
    c.left = -hw + (s.sx || 0) * hw; c.right = hw + (s.sx || 0) * hw;
    c.top = hh + (s.sy || 0) * hh; c.bottom = -hh + (s.sy || 0) * hh;
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
  }
  /** Projette un point monde vers des pixels écran (0..W, 0..H). */
  project(v, out = new THREE.Vector3(), W = 1920, H = 1080) {
    out.copy(v).project(this.cam);
    out.x = (out.x * 0.5 + 0.5) * W;
    out.y = (-out.y * 0.5 + 0.5) * H;
    return out;
  }
}

/**
 * Plan de caméra : liste de plans clés {t, tx,ty,tz,H,az,el,...}.
 * Interpolation douce (smootherstep) entre plans consécutifs ; `hold` ajoute une dérive vivante.
 */
export function cameraPlan(keys) {
  const props = ['tx', 'ty', 'tz', 'H', 'az', 'el', 'roll', 'sx', 'sy'];
  const def = { tx: 0, ty: 0, tz: 0, H: 40, az: 45, el: 32, roll: 0, sx: 0, sy: 0 };
  const full = keys.map((k) => ({ ...def, ...k }));
  return (t) => {
    let out;
    if (t <= full[0].t) out = { ...full[0] };
    else if (t >= full[full.length - 1].t) out = { ...full[full.length - 1] };
    else {
      let i = 1;
      while (t > full[i].t) i++;
      const a = full[i - 1], b = full[i];
      const ease = b.ease || smoother;
      const u = ease(invLerp(a.t, b.t, t));
      out = {};
      for (const p of props) {
        // H s'interpole en logarithmique : un zoom régulier à l'oeil
        out[p] = p === 'H' ? Math.exp(lerp(Math.log(a.H), Math.log(b.H), u)) : lerp(a[p], b[p], u);
      }
    }
    // dérive subtile : la caméra n'est jamais figée
    out.az += Math.sin(t * 0.37) * 0.8;
    out.el += Math.sin(t * 0.29 + 1.3) * 0.35;
    return out;
  };
}
