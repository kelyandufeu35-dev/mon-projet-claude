import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';
import { rbox, cyl, makeChair, makeTable, makeDesk, makeMonitor, makePlant, makeCar } from './furniture.js';
import { makeArches, makeGlassWall } from './building.js';
import { smooth, clamp, lerp } from '../util/math.js';

/* =========================================================================
 * Restaurant McDonald's miniature, ouvert en coupe.
 * Repère local : sol intérieur à y = FLOOR, parois arrière à -x et -z, façade vers +z.
 * ========================================================================= */
export const REST = { W: 14, D: 10, WH: 2.7, FLOOR: 0.2 };

export function makeRestaurant({ interior = false, parking = true, sign = true } = {}) {
  const { W, D, WH, FLOOR } = REST;
  const g = new THREE.Group();

  const slab = rbox(W + 1.0, 0.32, D + 1.0, std(C.grey1, { rough: 0.8 }), { r: 0.1 }); slab.position.y = -0.12; g.add(slab);
  const floor = rbox(W - 0.3, 0.06, D - 0.3, std(0xa6a9af, { rough: 0.55 }), { r: 0.02 }); floor.position.y = FLOOR - 0.06; g.add(floor);
  if (interior) {
    const tile = rbox(7.6, 0.02, 4.4, std(0x8e9199, { rough: 0.5 }), { r: 0.01 }); tile.position.set(-2.3, FLOOR, 2.6); g.add(tile);
  }
  if (parking) {
    const lot = rbox(W + 10, 0.12, D + 8, std(0x2a2c32, { rough: 0.95 }), { r: 0.2 }); lot.position.set(3.5, -0.2, 3.2); g.add(lot);
    for (let i = 0; i < 5; i++) { const l = rbox(0.1, 0.02, 2.2, M.white(), { r: 0.0 }); l.position.set(-4.5 + i * 2.4, -0.13, 9.2); g.add(l); }
    const drive = rbox(3.2, 0.03, D + 8, std(0x34363d, { rough: 0.95 }), { r: 0.0 }); drive.position.set(W / 2 + 3.8, -0.12, 3.2); g.add(drive);
    for (let i = 0; i < 6; i++) { const l = rbox(0.12, 0.02, 1.0, M.yellow(), { r: 0.0 }); l.position.set(W / 2 + 3.8, -0.1, -2.6 + i * 2.4); g.add(l); }
  }

  // Parois : arrière (-z), gauche (-x) fixes ; avant (+z), droite (+x) rabattables
  const back = makeGlassWall(W, WH, { solid: 0.9 }); back.position.set(0, FLOOR, -D / 2 + 0.11); g.add(back);
  const left = makeGlassWall(D, WH, { solid: 0.9 }); left.rotation.y = Math.PI / 2; left.position.set(-W / 2 + 0.11, FLOOR, 0); g.add(left);
  const front = makeGlassWall(W, WH, { solid: 0.55, doorAt: 3.2 }); front.position.set(0, FLOOR, D / 2 - 0.11); g.add(front);
  const right = makeGlassWall(D, WH, { solid: 0.55 }); right.rotation.y = Math.PI / 2; right.position.set(W / 2 - 0.11, FLOOR, 0); g.add(right);

  // Toit (soulevable)
  const roof = new THREE.Group(); roof.position.y = FLOOR + WH; g.add(roof);
  const rs = rbox(W + 0.7, 0.3, D + 0.7, M.red(), { r: 0.08 }); roof.add(rs);
  const rt = rbox(W + 0.78, 0.1, D + 0.78, M.yellow(), { r: 0.03 }); rt.position.y = 0.3; roof.add(rt);
  const rtop = rbox(W - 0.6, 0.18, D - 0.6, M.white(), { r: 0.05 }); rtop.position.y = 0.4; roof.add(rtop);
  for (const [x, z] of [[-3.2, -1.4], [1.5, -1.8]]) { const u = rbox(1.7, 0.7, 1.3, M.grey1(), { r: 0.08 }); u.position.set(x, 0.58, z); roof.add(u); }
  let arches = null;
  if (sign) {
    const pole = cyl(0.12, 0.14, 4.6, M.grey2(), 10); pole.position.set(-W / 2 - 1.6, 0, -D / 2 - 0.8); g.add(pole);
    arches = makeArches({ size: 1.55 }); arches.position.set(-W / 2 - 1.6, 4.5, -D / 2 - 0.8); arches.rotation.y = 0.0; g.add(arches);
  }

  let slots = null, inter = null;
  if (interior) {
    inter = new THREE.Group(); g.add(inter);
    const Y = FLOOR;
    // — Comptoir de commande
    const counter = rbox(8.6, 0.72, 0.9, M.white(), { r: 0.06 }); counter.position.set(-2.3, Y, -0.9); inter.add(counter);
    const cfront = rbox(8.64, 0.5, 0.06, M.red(), { r: 0.02 }); cfront.position.set(-2.3, Y + 0.08, -0.43); inter.add(cfront);
    const ctop = rbox(8.7, 0.06, 1.0, std(C.grey3, { rough: 0.3, metal: 0.15 }), { r: 0.02 }); ctop.position.set(-2.3, Y + 0.72, -0.9); inter.add(ctop);
    [-5.0, -3.2, -1.4].forEach((x) => { const m = makeMonitor(C.yellowSoft ?? C.yellow, 0.9); m.position.set(x, Y + 0.78, -0.95); m.rotation.y = Math.PI; inter.add(m); });
    // — Cuisine : îlot central + équipements + étagères
    const island = rbox(8.6, 0.78, 0.9, std(0xb7bbc2, { rough: 0.3, metal: 0.4 }), { r: 0.05 }); island.position.set(-2.3, Y, -3.05); inter.add(island);
    const grill = rbox(1.9, 0.12, 0.7, std(0x3b3e45, { rough: 0.4, metal: 0.5, emissive: C.red, emI: 0.35 }), { r: 0.03 }); grill.position.set(-4.7, Y + 0.78, -3.05); inter.add(grill);
    const fryer = rbox(1.3, 0.25, 0.7, M.charcoal(), { r: 0.04 }); fryer.position.set(-2.4, Y + 0.78, -3.05); inter.add(fryer);
    for (const dx of [-0.35, 0.35]) { const b = rbox(0.36, 0.1, 0.42, M.yellow(), { r: 0.03 }); b.position.set(-2.4 + dx, Y + 1.0, -3.05); inter.add(b); }
    const prep = rbox(1.9, 0.12, 0.7, M.white(), { r: 0.03 }); prep.position.set(0.1, Y + 0.78, -3.05); inter.add(prep);
    const shelfBack = rbox(8.6, 0.06, 0.5, M.grey2(), { r: 0.02 }); shelfBack.position.set(-2.3, Y + 1.5, -D / 2 + 0.5); inter.add(shelfBack);
    const shelfBack2 = rbox(8.6, 0.06, 0.5, M.grey2(), { r: 0.02 }); shelfBack2.position.set(-2.3, Y + 1.05, -D / 2 + 0.5); inter.add(shelfBack2);
    for (let i = 0; i < 9; i++) { const bx = rbox(0.5, 0.3, 0.36, i % 3 === 0 ? M.red() : i % 3 === 1 ? M.white() : M.yellow(), { r: 0.03 }); bx.position.set(-6.1 + i * 0.95, Y + 1.56, -D / 2 + 0.5); inter.add(bx); }
    // — Salle : tables + chaises
    const tables = [];
    [[-5.0, 2.1], [-2.0, 2.1], [1.0, 2.1], [-5.0, 4.0], [-2.0, 4.0]].forEach(([x, z], i) => {
      const tb = makeTable({ w: 1.2, d: 1.2, h: 0.46, round: true, top: i % 2 ? C.white : C.paper, leg: C.grey3 }); tb.position.set(x, Y, z); inter.add(tb);
      [[0, -0.85, 0], [0, 0.85, Math.PI], [-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]].forEach(([dx, dz, h], k) => {
        if ((i + k) % 3 === 2) return;
        const ch = makeChair(i % 2 ? C.red : C.grey3); ch.position.set(x + dx, Y, z + dz); ch.rotation.y = h; inter.add(ch);
      });
      tables.push({ x, z });
    });
    // — Bornes de commande
    [[2.8, 3.8], [4.2, 3.8]].forEach(([x, z]) => {
      const k = rbox(0.7, 1.15, 0.35, M.charcoal(), { r: 0.05 }); k.position.set(x, Y, z); inter.add(k);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x0c1218, emissive: C.red, emissiveIntensity: 0.9 })); sc.position.set(x, Y + 0.75, z + 0.18); inter.add(sc);
    });
    // — Bureau du responsable / exploitant (coin arrière droit, cloisons vitrées)
    const officeFloor = rbox(3.8, 0.04, 4.2, std(C.grey4, { rough: 0.9 }), { r: 0.01 }); officeFloor.position.set(4.8, Y, -3.0); inter.add(officeFloor);
    const partFront = rbox(3.8, 1.9, 0.08, M.glass(), { r: 0.02 }); partFront.position.set(4.8, Y, -0.9); inter.add(partFront);
    const partLeft = rbox(0.08, 1.9, 4.2, M.glass(), { r: 0.02 }); partLeft.position.set(2.9, Y, -3.0); inter.add(partLeft);
    const desk = makeDesk({ w: 2.2, d: 0.85, h: 0.5 }); desk.position.set(5.0, Y, -4.1); inter.add(desk);
    const mon = makeMonitor(C.cyan, 1.1); mon.position.set(4.7, Y + 0.5, -4.15); mon.rotation.y = 0; inter.add(mon);
    const mon2 = makeMonitor(C.yellowSoft ?? C.yellow, 1.0); mon2.position.set(5.5, Y + 0.5, -4.15); inter.add(mon2);
    const och = makeChair(C.charcoal, 0.2); och.position.set(5.0, Y, -3.4); och.rotation.y = Math.PI; inter.add(och);
    const plant = makePlant(1.2); plant.position.set(6.2, Y, -1.5); inter.add(plant);
    slots = {
      Y, tables,
      counter: [[-5.0, -1.75], [-3.2, -1.75], [-1.4, -1.75]],
      kitchen: [[-4.7, -3.75], [-2.4, -3.75], [0.1, -3.75], [-6.1, -3.75]],
      office: [5.0, -3.4], door: [3.2, D / 2 - 0.2],
    };
  }

  const open = (p, fly = 0) => {
    const lift = smooth(clamp(p / 0.45));
    roof.position.y = FLOOR + WH + lift * 1.5 + smooth(clamp((p - 0.4) / 0.6)) * 34 * fly;
    roof.rotation.z = smooth(clamp((p - 0.3) / 0.7)) * -0.12 * fly;
    const drop = smooth(clamp((p - 0.2) / 0.6));
    front.scale.y = right.scale.y = lerp(1, 0.14, drop);
  };
  g.userData = { W, D, WH, FLOOR };
  return { group: g, roof, open, front, right, slots, arches, inter };
}

/** Bureau du franchisé : petit immeuble d'affaires, auvent jaune, enseigne. */
export function makeFranchiseOffice() {
  const g = new THREE.Group();
  const base = rbox(8.4, 0.3, 6.4, std(C.grey1, { rough: 0.8 }), { r: 0.1 }); base.position.y = -0.1; g.add(base);
  const body = rbox(7.2, 3.2, 5.2, M.white(), { r: 0.1 }); body.position.y = 0.2; g.add(body);
  const glass = rbox(6.2, 1.5, 0.12, M.glass(), { r: 0.04 }); glass.position.set(0, 0.55, 2.62); g.add(glass);
  const glass2 = rbox(0.12, 1.5, 4.2, M.glass(), { r: 0.04 }); glass2.position.set(3.62, 0.55, 0); g.add(glass2);
  const glassU = rbox(6.2, 1.0, 0.12, M.glass(), { r: 0.04 }); glassU.position.set(0, 2.0, 2.62); g.add(glassU);
  const awn = rbox(6.6, 0.12, 1.5, M.yellow(), { r: 0.04 }); awn.position.set(0, 1.9, 3.25); awn.rotation.x = 0.16; g.add(awn);
  const roofSlab = rbox(7.5, 0.28, 5.5, std(C.grey2, { rough: 0.6 }), { r: 0.07 }); roofSlab.position.y = 3.4; g.add(roofSlab);
  const flag = cyl(0.05, 0.05, 1.7, M.grey3(), 6); flag.position.set(-3.0, 3.68, -2.0); g.add(flag);
  const cloth = rbox(0.9, 0.55, 0.04, M.yellow(), { r: 0.01 }); cloth.position.set(-2.55, 4.9, -2.0); g.add(cloth);
  const a = makeArches({ size: 0.9 }); a.position.set(1.4, 3.68, 0); a.rotation.y = 0.35; g.add(a);
  // enseigne « contrat » : feuille + sceau
  const doc = new THREE.Group();
  const sheet = rbox(0.9, 0.05, 1.15, M.white(), { r: 0.02 }); doc.add(sheet);
  for (let i = 0; i < 4; i++) { const ln = rbox(0.6, 0.055, 0.05, M.grey2(), { r: 0.005 }); ln.position.set(0, 0.01, -0.36 + i * 0.2); doc.add(ln); }
  const seal = cyl(0.17, 0.17, 0.06, M.yellow(), 20); seal.position.set(0.2, 0.01, 0.38); doc.add(seal);
  doc.position.set(-1.5, 5.3, 0.4); doc.rotation.x = -0.3; g.add(doc);
  g.userData.doc = doc; g.userData.height = 4.4;
  return g;
}

/** Structure de marché : immeuble de bureaux avec globe filaire. */
export function makeMarketOffice() {
  const g = new THREE.Group();
  const base = rbox(9.0, 0.3, 7.0, std(C.grey1, { rough: 0.8 }), { r: 0.1 }); base.position.y = -0.1; g.add(base);
  const body = rbox(7.6, 4.6, 5.6, std(C.paper, { rough: 0.6 }), { r: 0.1 }); body.position.y = 0.2; g.add(body);
  for (let i = 0; i < 3; i++) {
    const w = rbox(6.6, 0.8, 0.1, M.glass(), { r: 0.03 }); w.position.set(0, 0.8 + i * 1.3, 2.84); g.add(w);
    const w2 = rbox(0.1, 0.8, 4.6, M.glass(), { r: 0.03 }); w2.position.set(3.84, 0.8 + i * 1.3, 0); g.add(w2);
  }
  const band = rbox(7.8, 0.22, 5.8, M.red(), { r: 0.05 }); band.position.y = 4.8; g.add(band);
  const globe = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 18), std(0x2a2d35, { rough: 0.5, emissive: 0x15171c, emI: 0.5 })); globe.add(core);
  for (const r of [0, Math.PI / 3, (2 * Math.PI) / 3]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.035, 6, 36), new THREE.MeshBasicMaterial({ color: C.yellow })); t.rotation.y = r; globe.add(t); }
  const eq = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.035, 6, 36), new THREE.MeshBasicMaterial({ color: C.yellow })); eq.rotation.x = Math.PI / 2; globe.add(eq);
  globe.position.set(0, 6.0, 0); g.add(globe);
  g.userData.globe = globe; g.userData.height = 6.9;
  return g;
}
