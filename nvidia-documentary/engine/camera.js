// Caméra cinéma : optique physique (focale, ouverture, mise au point, capteur Super 35)
// et rail de caméra par images-clés avec interpolation lisse.

import * as THREE from 'three';
import { clamp, smoothNoise } from './rng.js';

export const SENSOR_W = 0.02489; // largeur d'un capteur Super 35 (m)

/**
 * Configure une caméra perspective à partir de paramètres d'objectif réels.
 * @returns {{aperture:number, focusDistance:number}} lentille pour le pipeline (rayon de pupille en m)
 */
export function configureCamera(camera, { pos, target, focal = 35, fstop = 2.8, focus = null, aspect = 16 / 9, near = 0.01, far = 200, roll = 0, up = [0, 1, 0] }) {
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.up.set(up[0], up[1], up[2]);
  camera.lookAt(target[0], target[1], target[2]);
  if (roll) camera.rotateZ(roll);
  const f = focal / 1000;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_W / aspect / 2 / f));
  camera.aspect = aspect;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const dist = focus ?? camera.position.distanceTo(new THREE.Vector3(target[0], target[1], target[2]));
  return { aperture: f / (2 * fstop), focusDistance: dist };
}

const ease = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  inOut5: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
};

// Catmull-Rom centripète non uniforme sur 1 canal vectoriel : trajectoire sans à-coups.
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return p0.map((_, i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

/**
 * Rail de caméra : suite d'images-clés {t, pos, target, focal, fstop, focus?, roll?, near, far}.
 * - pos / target : interpolés en Catmull-Rom (passent par chaque point) ;
 * - focal / fstop / near / far / focus : interpolés en espace logarithmique (zoom et mise au point naturels) ;
 * - `ease` d'une clé : courbe appliquée sur le segment qui la suit.
 * `shake` ajoute un léger mouvement d'épaule déterministe (amplitudes en m et rad).
 */
export class CameraRig {
  constructor(keys, { shake = null } = {}) {
    this.keys = keys.slice().sort((a, b) => a.t - b.t);
    this.shake = shake;
  }

  sample(t) {
    const K = this.keys;
    const tt = clamp(t, K[0].t, K[K.length - 1].t);
    let i = 0;
    while (i < K.length - 2 && tt > K[i + 1].t) i++;
    const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
    const span = k2.t - k1.t || 1;
    const u0 = clamp((tt - k1.t) / span, 0, 1);
    const u = (ease[k1.ease] || ease.inOut)(u0);
    const pos = catmull(k0.pos, k1.pos, k2.pos, k3.pos, u);
    const target = catmull(k0.target, k1.target, k2.target, k3.target, u);
    const lerpLog = (a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * u);
    const lerpLin = (a, b) => a + (b - a) * u;
    const out = {
      pos,
      target,
      focal: lerpLog(k1.focal ?? 35, k2.focal ?? 35),
      fstop: lerpLog(k1.fstop ?? 2.8, k2.fstop ?? 2.8),
      near: lerpLog(k1.near ?? 0.01, k2.near ?? 0.01),
      far: lerpLog(k1.far ?? 200, k2.far ?? 200),
      roll: lerpLin(k1.roll ?? 0, k2.roll ?? 0),
      focus: null,
      up: [0, 1, 2].map((a) => lerpLin((k1.up ?? [0, 1, 0])[a], (k2.up ?? [0, 1, 0])[a])),
    };
    if (k1.focus != null && k2.focus != null) out.focus = lerpLog(k1.focus, k2.focus);
    if (this.shake) {
      const s = this.shake;
      const sc = s.scale ? s.scale(tt) : 1;
      const f = s.freq ?? 0.7;
      for (let a = 0; a < 3; a++) out.pos[a] += smoothNoise(tt * f + a * 10.3, 1) * s.pos * sc;
      for (let a = 0; a < 3; a++) out.target[a] += smoothNoise(tt * f * 1.3 + a * 7.7, 2) * s.target * sc;
      out.roll += smoothNoise(tt * f * 0.9, 3) * s.roll * sc;
    }
    return out;
  }
}

/**
 * Piste de valeur animée : suite de [t, valeur, courbe?]. La courbe indiquée sur une clé s'applique
 * au segment qui la suit. Hors intervalle, la valeur est maintenue.
 */
export function track(keys, defaultEase = 'inOut') {
  const K = keys.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (t <= K[0][0]) return K[0][1];
    if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0;
    while (t > K[i + 1][0]) i++;
    const [t0, v0, e0] = K[i];
    const [t1, v1] = K[i + 1];
    const u = (ease[e0 || defaultEase] || ease.inOut)((t - t0) / (t1 - t0));
    return v0 + (v1 - v0) * u;
  };
}
