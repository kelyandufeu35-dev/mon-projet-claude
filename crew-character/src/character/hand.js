/* Main détaillée : paume arrondie, 4 doigts à 3 phalanges, pouce à 2 phalanges.
   Modèle « main droite » (pouce vers +x, paume vers +z, doigts vers -y). La gauche est un miroir (scale.x = -1). */
import * as THREE from "three";
import { limb, rbox, sphere } from "./builders.js";
import { clamp, lerp } from "../core/util.js";

const FINGERS = [
  { x: 0.027, len: [0.034, 0.024, 0.02], r: 0.0128, spread: 0.2, curl: 1.0 },   // index
  { x: 0.0085, len: [0.037, 0.026, 0.021], r: 0.0132, spread: 0.06, curl: 1.04 }, // majeur
  { x: -0.0095, len: [0.034, 0.024, 0.02], r: 0.0124, spread: -0.08, curl: 1.08 }, // annulaire
  { x: -0.028, len: [0.027, 0.019, 0.017], r: 0.0112, spread: -0.24, curl: 1.14 }, // auriculaire
];

export class Hand {
  constructor(mat, side = 1) {
    this.group = new THREE.Group();
    const inner = new THREE.Group(); inner.scale.setScalar(1.3); this.group.add(inner);
    if (side < 0) this.group.scale.x = -1; // main gauche = miroir
    inner.add(rbox(0.084, 0.092, 0.04, 0.017, mat, { pos: [0, -0.047, 0] }));
    inner.add(sphere(0.026, mat, { pos: [0.03, -0.03, 0.009], scale: [1, 1.1, 0.9] })); // thénar
    inner.add(sphere(0.024, mat, { pos: [0, 0.0, 0], scale: [1.05, 0.8, 0.9] }));       // poignet
    this.fingers = FINGERS.map((f) => {
      const g1 = new THREE.Group(); g1.position.set(f.x, -0.088, 0); inner.add(g1);
      g1.add(limb(f.r, f.r * 0.94, f.len[0], mat));
      const g2 = new THREE.Group(); g2.position.y = -f.len[0]; g1.add(g2); g2.add(limb(f.r * 0.94, f.r * 0.88, f.len[1], mat));
      const g3 = new THREE.Group(); g3.position.y = -f.len[1]; g2.add(g3); g3.add(limb(f.r * 0.88, f.r * 0.8, f.len[2], mat));
      return { g1, g2, g3, f };
    });
    const t0 = new THREE.Group(); t0.position.set(0.034, -0.026, 0.008); inner.add(t0);
    t0.add(limb(0.0155, 0.0145, 0.03, mat));
    const t1 = new THREE.Group(); t1.position.y = -0.03; t0.add(t1); t1.add(limb(0.0142, 0.0125, 0.027, mat));
    this.thumb = { t0, t1 };
    this.set(0.25, 0.1, 0.2);
  }
  /* curl : 0 main ouverte … 1 poing ; spread : écartement des doigts ; thumb : 0 pouce ouvert … 1 replié */
  set(curl, spread, thumb) {
    curl = clamp(curl, 0, 1); spread = clamp(spread, 0, 1); thumb = clamp(thumb, 0, 1);
    this.fingers.forEach((fg) => {
      const c = curl * fg.f.curl;
      fg.g1.rotation.set(-c * 1.35, 0, fg.f.spread * spread * 1.1);
      fg.g2.rotation.x = -c * 1.45; fg.g3.rotation.x = -c * 0.95;
    });
    this.thumb.t0.rotation.set(lerp(-0.25, -0.95, thumb), 0, lerp(0.62, -0.05, thumb));
    this.thumb.t1.rotation.set(-thumb * 0.55 - 0.1, 0, -thumb * 0.35);
  }
}
