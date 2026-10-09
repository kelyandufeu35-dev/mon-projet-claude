import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';
import { rbox, cyl } from './furniture.js';
import { makeArches } from './building.js';
import { makeCharacter, OUTFIT } from './character.js';

/* Icônes 3D posées sur le toit de chaque fonction. Chaque icône expose update(t). */
const gold = () => std(C.yellow, { rough: 0.3, metal: 0.35, emissive: C.yellow, emI: 0.3 });

export function iconFinance() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const c = cyl(0.62, 0.62, 0.16, gold(), 40); c.position.set(((i % 2) - 0.5) * 0.06, i * 0.17, 0); g.add(c);
    const ring = cyl(0.64, 0.64, 0.03, std(C.gold, { rough: 0.4, metal: 0.4 }), 40); ring.position.set(((i % 2) - 0.5) * 0.06, i * 0.17 + 0.07, 0); g.add(ring);
  }
  // barres de croissance
  for (let i = 0; i < 3; i++) {
    const b = rbox(0.28, 0.5 + i * 0.4, 0.28, i === 2 ? M.red() : M.white(), { r: 0.04 }); b.position.set(1.0 + i * 0.36, 0, 0); g.add(b);
  }
  return { group: g, update: (t) => { g.rotation.y = Math.sin(t * 0.6) * 0.25; } };
}
export function iconMarketing() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.75, 1.1, 28, 1, true).rotateZ(-Math.PI / 2), std(C.red, { rough: 0.4, side: THREE.DoubleSide }));
  cone.position.set(0.15, 0.9, 0); cone.castShadow = true; g.add(cone);
  const back = cyl(0.26, 0.26, 0.35, M.white(), 20); back.rotation.z = Math.PI / 2; back.position.set(-0.55, 0.9, 0); g.add(back);
  const handle = rbox(0.14, 0.45, 0.14, M.charcoal(), { r: 0.04 }); handle.position.set(-0.45, 0.4, 0); g.add(handle);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.35, 0.025, 6, 32, Math.PI * 0.7).rotateY(Math.PI / 2).rotateZ(-Math.PI * 0.35), new THREE.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0.8 }));
    r.position.set(1.0 + i * 0.1, 0.9, 0); g.add(r); rings.push(r);
  }
  return { group: g, update: (t) => { rings.forEach((r, i) => { const k = ((t * 0.9 + i * 0.33) % 1); r.material.opacity = 0.85 * (1 - k); r.scale.setScalar(0.7 + k * 0.7); }); g.rotation.y = Math.sin(t * 0.5) * 0.2; } };
}
export function iconOperations() {
  const g = new THREE.Group();
  const gear = new THREE.Group();
  const body = cyl(0.62, 0.62, 0.3, M.grey1(), 32); gear.add(body);
  const hole = cyl(0.22, 0.22, 0.32, M.charcoal(), 20); gear.add(hole);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tooth = rbox(0.24, 0.3, 0.3, M.grey1(), { r: 0.03 }); tooth.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72); tooth.rotation.y = -a; gear.add(tooth);
  }
  const ac = cyl(0.62, 0.62, 0.02, M.red(), 32); ac.position.y = 0.31; gear.add(ac);
  gear.position.y = 0.2; g.add(gear);
  const gear2 = gear.clone(); gear2.scale.setScalar(0.55); gear2.position.set(1.2, 0.2, 0.35); g.add(gear2);
  return { group: g, update: (t) => { gear.rotation.y = t * 0.8; gear2.rotation.y = -t * 0.8 * 1.8 + 0.3; } };
}
export function iconPeople(seedBase = 0) {
  const g = new THREE.Group();
  const disc = cyl(1.0, 1.0, 0.1, M.white(), 36); g.add(disc);
  const chars = [];
  const cols = [OUTFIT.crew(1), OUTFIT.shift(2), OUTFIT.assistant(0)];
  for (let i = 0; i < 3; i++) {
    const ch = makeCharacter({ ...cols[i], scale: 0.9 });
    const a = (i / 3) * Math.PI * 2;
    ch.root.position.set(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5); ch.root.rotation.y = a + Math.PI / 2 + 0.5;
    g.add(ch.root); chars.push(ch);
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 0.7 }));
  heart.position.y = 1.6; g.add(heart);
  return { group: g, update: (t) => { g.rotation.y = t * 0.35; heart.position.y = 1.6 + Math.sin(t * 2.5) * 0.08; heart.scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * 0.2); } };
}
export function iconTech() {
  const g = new THREE.Group();
  const post = cyl(0.07, 0.1, 0.9, M.grey2(), 10); g.add(post);
  const dishG = new THREE.Group(); dishG.position.y = 0.95; g.add(dishG);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.32).rotateX(Math.PI), std(C.white, { rough: 0.35, side: THREE.DoubleSide }));
  dish.rotation.x = -0.6; dish.position.y = 0.2; dish.castShadow = true; dishG.add(dish);
  const feed = cyl(0.025, 0.025, 0.7, M.grey2(), 6); feed.position.set(0, 0.2, 0.28); feed.rotation.x = -0.6 + Math.PI / 2 * 0.0; dishG.add(feed);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: C.cyan, emissive: C.cyan, emissiveIntensity: 1.2 }));
  tip.position.set(0, 0.62, 0.55); dishG.add(tip);
  // puce
  const chip = rbox(0.9, 0.1, 0.9, M.charcoal(), { r: 0.04 }); chip.position.set(1.3, 0, 0); g.add(chip);
  for (let i = 0; i < 6; i++) { const pin = rbox(0.06, 0.04, 0.12, M.yellow(), { r: 0.01 }); pin.position.set(1.3 - 0.4 + i * 0.16, 0.03, 0.5); g.add(pin); const p2 = pin.clone(); p2.position.z = -0.5; g.add(p2); }
  const core = rbox(0.36, 0.06, 0.36, new THREE.MeshStandardMaterial({ color: 0x0c1218, emissive: C.cyan, emissiveIntensity: 0.9 }), { r: 0.02 }); core.position.set(1.3, 0.1, 0); g.add(core);
  return { group: g, update: (t) => { dishG.rotation.y = Math.sin(t * 0.7) * 0.9; core.material.emissiveIntensity = 0.7 + Math.sin(t * 4) * 0.35; } };
}
export function iconFranchise() {
  const g = new THREE.Group();
  const shop = rbox(1.7, 0.7, 1.1, M.white(), { r: 0.06 }); g.add(shop);
  const roof = rbox(1.85, 0.12, 1.25, M.red(), { r: 0.04 }); roof.position.y = 0.7; g.add(roof);
  const win = rbox(1.2, 0.35, 0.04, M.glass(), { r: 0.02 }); win.position.set(0, 0.18, 0.56); g.add(win);
  const aw = rbox(1.8, 0.06, 0.45, M.yellow(), { r: 0.02 }); aw.position.set(0, 0.55, 0.65); aw.rotation.x = 0.28; g.add(aw);
  const arches = makeArches({ size: 0.85, tilt: 0 }); arches.position.set(0, 0.82, 0); g.add(arches);
  // clef (contrat de franchise)
  const key = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 20), gold()); key.add(ring);
  const shaft = rbox(0.7, 0.07, 0.07, gold(), { r: 0.02 }); shaft.position.set(0.5, -0.035, 0); key.add(shaft);
  const tooth = rbox(0.07, 0.18, 0.07, gold(), { r: 0.01 }); tooth.position.set(0.8, -0.1, 0); key.add(tooth);
  key.position.set(1.6, 0.9, 0.2); key.rotation.z = 0.5; g.add(key);
  return { group: g, update: (t) => { arches.rotation.y = Math.sin(t * 0.8) * 0.35; key.rotation.y = t * 0.9; } };
}
export function iconLegal() {
  const g = new THREE.Group();
  const post = cyl(0.07, 0.12, 1.5, M.grey1(), 12); g.add(post);
  const base = cyl(0.55, 0.62, 0.14, M.grey1(), 28); g.add(base);
  const beamG = new THREE.Group(); beamG.position.y = 1.5; g.add(beamG);
  const beam = rbox(2.2, 0.07, 0.1, gold(), { r: 0.02 }); beamG.add(beam);
  const mkPan = (x) => {
    const p = new THREE.Group(); p.position.set(x, 0, 0);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), gold()); dish.position.y = -0.62; dish.castShadow = true; p.add(dish);
    for (const a of [0, 1, 2]) {
      const l = cyl(0.008, 0.008, 0.62, M.white(), 4); l.position.y = -0.62; l.rotation.z = (a - 1) * 0.55; p.add(l);
    }
    beamG.add(p); return p;
  };
  const pL = mkPan(-1.0), pR = mkPan(1.0);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), gold()); orb.position.y = 1.62; g.add(orb);
  return { group: g, update: (t) => { const a = Math.sin(t * 0.9) * 0.12; beamG.rotation.z = a; pL.rotation.z = -a; pR.rotation.z = -a; pL.position.y = -Math.sin(a) * 1.0 * -1; pR.position.y = Math.sin(a) * 1.0 * -1; } };
}
