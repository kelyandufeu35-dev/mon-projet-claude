import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';

const rb = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
export function rbox(w, h, d, mat, { r = 0.06, y0 = true, cast = true, receive = true } = {}) {
  const g = rb(w, h, d, r);
  if (y0) g.translate(0, h / 2, 0); // origine = base
  const m = new THREE.Mesh(g, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
export function cyl(rt, rb_, h, mat, seg = 24, { cast = true } = {}) {
  const g = new THREE.CylinderGeometry(rt, rb_, h, seg); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; return m;
}

/** Chaise : assise + dossier. Orientée vers +z (dossier à -z). */
export function makeChair(color = C.grey3, h = 0.17) {
  const g = new THREE.Group();
  const mat = std(color, { rough: 0.7 });
  const seat = rbox(0.42, 0.06, 0.42, mat, { r: 0.03 }); seat.position.y = h - 0.06; g.add(seat);
  const back = rbox(0.42, 0.34, 0.05, mat, { r: 0.025 }); back.position.set(0, h, -0.2); g.add(back);
  const stem = cyl(0.03, 0.03, h - 0.06, M.grey4(), 8); g.add(stem);
  const base = cyl(0.16, 0.16, 0.025, M.grey4(), 14); g.add(base);
  return g;
}

/** Table ovale ou rectangulaire (plateau + pied). */
export function makeTable({ w = 4.6, d = 1.9, h = 0.46, round = true, top = C.white, leg = C.grey3 } = {}) {
  const g = new THREE.Group();
  const topMat = std(top, { rough: 0.35, metal: 0.05 });
  let t;
  if (round) {
    t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 48).scale(w, 1, d).translate(0, h - 0.07, 0), topMat);
  } else {
    t = rbox(w, 0.07, d, topMat, { r: 0.03 }); t.position.y = h - 0.07;
  }
  t.castShadow = t.receiveShadow = true; g.add(t);
  const lm = std(leg, { rough: 0.6 });
  const pedestal = cyl(Math.min(w, d) * 0.12, Math.min(w, d) * 0.18, h - 0.07, lm, 20); g.add(pedestal);
  return g;
}

export function makeDesk({ w = 1.5, d = 0.7, h = 0.4, top = C.white } = {}) {
  const g = new THREE.Group();
  const t = rbox(w, 0.05, d, std(top, { rough: 0.4 }), { r: 0.02 }); t.position.y = h - 0.05; g.add(t);
  for (const sx of [-1, 1]) {
    const l = rbox(0.05, h - 0.05, d * 0.9, M.grey3(), { r: 0.01 }); l.position.x = sx * (w / 2 - 0.05); g.add(l);
  }
  return g;
}

/** Écran d'ordinateur ; `glow` = couleur émissive de l'écran. */
export function makeMonitor(glow = C.cyan, s = 1) {
  const g = new THREE.Group();
  const body = rbox(0.5 * s, 0.32 * s, 0.03, M.charcoal(), { r: 0.012 }); body.position.y = 0.13 * s; g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44 * s, 0.26 * s), new THREE.MeshStandardMaterial({ color: 0x0c1218, emissive: glow, emissiveIntensity: 0.9 }));
  scr.position.set(0, 0.29 * s, 0.017); g.add(scr);
  const stand = cyl(0.025 * s, 0.025 * s, 0.14 * s, M.grey3(), 8); g.add(stand);
  const foot = rbox(0.2 * s, 0.012, 0.14 * s, M.grey3(), { r: 0.005 }); g.add(foot);
  g.userData.screen = scr;
  return g;
}

/** Plante stylisée grise/blanche (palette stricte). */
export function makePlant(s = 1) {
  const g = new THREE.Group();
  const pot = cyl(0.14 * s, 0.1 * s, 0.2 * s, M.white(), 14); g.add(pot);
  const lm = std(C.grey1, { rough: 0.8 });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s - i * 0.02, 12, 10), lm);
    b.position.set(Math.sin(i * 2.1) * 0.07 * s, (0.3 + i * 0.12) * s, Math.cos(i * 2.1) * 0.07 * s); b.castShadow = true; g.add(b);
  }
  return g;
}

/** Hologramme : disque de lumière + faisceau (additif). */
export function makeHoloBase(radius = 1.4, color = C.cyan) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.86, radius, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.y = 0.02; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.86, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.position.y = 0.015; g.add(disc);
  return g;
}

/** Voiture miniature (corps arrondi + habitacle). */
export function makeCar(color = C.yellow) {
  const g = new THREE.Group();
  const body = rbox(1.5, 0.34, 0.74, std(color, { rough: 0.35, metal: 0.2 }), { r: 0.12 }); body.position.y = 0.1; g.add(body);
  const cab = rbox(0.8, 0.28, 0.66, M.glass(), { r: 0.1 }); cab.position.set(-0.1, 0.4, 0); g.add(cab);
  for (const [x, z] of [[-0.5, 0.36], [0.5, 0.36], [-0.5, -0.36], [0.5, -0.36]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12).rotateX(Math.PI / 2), M.charcoal());
    w.position.set(x, 0.14, z); w.castShadow = true; g.add(w);
  }
  return g;
}
