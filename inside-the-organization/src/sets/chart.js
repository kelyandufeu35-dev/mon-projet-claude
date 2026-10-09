import * as THREE from 'three';
import { C, LINK } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';
import { rbox, cyl, makeTable } from '../components/furniture.js';
import { makeTower, makeArches, makeMiniRestaurant } from '../components/building.js';
import { makeFranchiseOffice, makeMarketOffice } from '../components/restaurant.js';
import * as ICONS from '../components/icons.js';
import { isLand } from '../data/landmask.js';
import { FUNCTIONS } from './plaza.js';
import { R0, CITY_POS } from './city.js';
import { roundedPath } from '../engine/links.js';
import { seg, smooth, smoother, easeOutBack, easeOutCubic, easeInOutCubic, clamp, lerp, DEG, rng } from '../util/math.js';

/* =========================================================================
 * L'ORGANIGRAMME GÉANT — scène 6.
 * Les éléments des scènes précédentes (restaurants, bureaux de franchisés) s'envolent de la ville
 * vers leur place ; le reste se reconstruit autour. Quatre types de liaisons, quatre couleurs.
 * Illustration pédagogique : ce n'est PAS l'organigramme officiel exact.
 * ========================================================================= */
export const CH_T = {
  rise0: 75.0,
  collapse0: 75.3, collapse1: 77.4,
  slabs: 77.0, nodes0: 77.6, links0: 79.4, legend: 79.8, tour0: 82.0, final: 87.0,
};

// axes iso du plan de l'organigramme (repère ville)
const uL = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);   // latéral (droite écran)
const uB = new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2);  // profondeur (vers le haut de l'écran)
const ORG = new THREE.Vector3(R0.x, 0, R0.z).addScaledVector(uL, -26);
export const at = (l, d, y = 0, out = new THREE.Vector3()) => out.copy(ORG).addScaledVector(uL, l).addScaledVector(uB, d).add(new THREE.Vector3(0, y, 0));
export const TIERS = { T0: { d: 0, y: 0 }, T1: { d: 24, y: 10 }, T2: { d: 48, y: 20 }, T3: { d: 74, y: 31 } };

function pawn(color, s = 1, head = C.skin[0]) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2 * s, 0.34 * s, 3, 10), std(color, { rough: 0.5 })); b.position.y = 0.36 * s; b.castShadow = true; g.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 14, 10), std(head, { rough: 0.6 })); h.position.y = 0.88 * s; h.castShadow = true; g.add(h);
  return g;
}
function slab(w, d, edge, h = 0.9) {
  const g = new THREE.Group();
  const b = rbox(w, h, d, std(0x30333b, { rough: 0.55, metal: 0.15 }), { r: 0.25 }); b.position.y = -h; g.add(b);
  const e = rbox(w + 0.15, 0.1, d + 0.15, std(edge, { rough: 0.35, emissive: edge, emI: 0.55 }), { r: 0.05 }); e.position.y = -0.14; g.add(e);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: edge, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 0.03; g.add(glow);
  return g;
}

export function buildChart(ctx, cityCtx) {
  const { links, labels } = ctx;
  const city = cityCtx.group;
  const root = new THREE.Group(); root.name = 'chart'; city.add(root);
  const nodes = [];          // { g, t0, to(scale) }
  const addNode = (g, pos, t0, scale = 1, yaw = 0) => { g.position.copy(pos); g.rotation.y = yaw; root.add(g); nodes.push({ g, t0, s: scale }); g.scale.setScalar(0.0001); return g; };

  // ---- dalles de paliers (couleur de bord = nature de la branche) ----
  const slabs = [];
  const mkSlab = (l, tier, w, d, edge, t0 = CH_T.slabs, yaw = 0) => {
    const T = TIERS[tier]; const g = slab(w, d, edge); g.position.copy(at(l, T.d, T.y));
    g.rotation.y = Math.PI / 4; // aligné sur les axes iso (dalles définies dans le repère latéral/profondeur)
    root.add(g); slabs.push({ g, t0 }); g.scale.setScalar(0.0001); return g;
  };
  mkSlab(0, 'T3', 62, 16, 0xffffff, 77.0);                 // gouvernance & direction
  mkSlab(-30, 'T2', 34, 17, C.red, 77.2);                  // fonctions centrales
  mkSlab(2, 'T2', 20, 17, C.red, 77.3);                    // organisations internationales
  mkSlab(2, 'T1', 28, 15, C.red, 77.4);                    // structures locales
  mkSlab(46, 'T1', 40, 15, C.yellow, 77.5);                // branche franchisés (distincte)
  mkSlab(0, 'T0', 24, 15, C.red, 77.6);                    // restaurants exploités par la société
  mkSlab(46, 'T0', 52, 17, C.yellow, 77.7);                // restaurants franchisés et équipes

  // ---- T3 : siège, conseil, direction générale ----
  const hq = new THREE.Group();
  const hqt = makeTower({ w: 4.6, d: 4.6, floors: 12, fh: 1.1, wall: C.white, glass: C.glass, seed: 5, fins: C.red, bands: { at: [4, 8], color: C.red }, base: { w: 7.4, d: 7.4, h: 0.8, color: C.white } });
  hq.add(hqt.group);
  const ha = makeArches({ size: 1.4 }); ha.position.set(3.2, 0.85, 3.2); ha.rotation.y = 0.5; hq.add(ha);
  addNode(hq, at(0, TIERS.T3.d, TIERS.T3.y + 0.0), 78.0, 1.25, 0);
  const boardNode = new THREE.Group();
  boardNode.add(makeTable({ w: 4.2, d: 2.8, h: 0.5, round: true }));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const p = pawn(i % 2 ? C.grey1 : C.white, 0.85); p.position.set(Math.cos(a) * 2.5, 0, Math.sin(a) * 1.8); boardNode.add(p); }
  addNode(boardNode, at(-18, TIERS.T3.d, TIERS.T3.y), 78.3, 1.5);
  const execNode = new THREE.Group();
  execNode.add(makeTable({ w: 4.2, d: 2.8, h: 0.5, round: true }));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = pawn(i === 0 ? C.red : C.charcoal, i === 0 ? 1.0 : 0.85); p.position.set(Math.cos(a) * 2.5, 0, Math.sin(a) * 1.8); execNode.add(p); }
  addNode(execNode, at(18, TIERS.T3.d, TIERS.T3.y), 78.6, 1.5);

  // ---- T2 : fonctions centrales (7 mini-immeubles + icônes) ----
  const funcs = new THREE.Group(); const fIcons = [];
  FUNCTIONS.forEach((f, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.3, rx = 11.5, rz = 4.4;
    const t = makeTower({ w: 2.8, d: 2.6, floors: Math.max(3, Math.round(f.floors * 0.7)), fh: 0.9, wall: C.white, glass: C.glass, seed: 20 + i, fins: f.accent === C.grey2 || f.accent === C.grey1 ? C.red : f.accent, cap: C.grey2, lit: 0.6 });
    t.group.position.set(Math.cos(a) * rx, 0, Math.sin(a) * rz); funcs.add(t.group);
    const ic = f.icon(); ic.group.scale.setScalar(0.62); ic.group.position.set(Math.cos(a) * rx, t.height + 0.15, Math.sin(a) * rz); funcs.add(ic.group); fIcons.push(ic);
    funcs.userData['p' + i] = new THREE.Vector3(Math.cos(a) * rx, t.height + 1.6, Math.sin(a) * rz);
  });
  addNode(funcs, at(-30, TIERS.T2.d, TIERS.T2.y), 78.9, 1.3, Math.PI / 4);

  // ---- T2 : organisations internationales (mini-globe en points + 3 pins) ----
  const gl = new THREE.Group();
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(3.0, 40, 30), std(0x2a2d35, { rough: 0.85, emissive: 0x15171c, emI: 0.8 })); ocean.position.y = 4.2; ocean.castShadow = true; gl.add(ocean);
  {
    const pts = []; const ga = Math.PI * (3 - Math.sqrt(5)); const NN = 2600;
    for (let i = 0; i < NN; i++) {
      const y = 1 - (2 * (i + 0.5)) / NN, rad = Math.sqrt(1 - y * y), th = i * ga;
      const lat = Math.asin(y) / DEG, lon = ((th / DEG + 180) % 360 + 360) % 360 - 180;
      if (isLand(lon, lat)) pts.push(new THREE.Vector3(rad * Math.cos(th), y, -rad * Math.sin(th)));
    }
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 6).translate(0, 0.035, 0), new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: 0.5, emissive: 0x33363e, emissiveIntensity: 0.6 }), pts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    pts.forEach((v, i) => { q.setFromUnitVectors(up, v); m4.compose(v.clone().multiplyScalar(3.02).add(new THREE.Vector3(0, 4.2, 0)), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
    gl.add(im);
  }
  const pinsDef = [[C.red, -1.1, 0.4], [C.yellow, 0.5, -0.9], [0xffffff, 1.2, 0.8]];
  const pins = pinsDef.map(([col, lx, lz]) => { const v = new THREE.Vector3(lx, 1.7, lz).normalize().multiplyScalar(3.15).add(new THREE.Vector3(0, 4.2, 0)); const p = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 10).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 })); p.position.copy(v).add(new THREE.Vector3(0, 0.35, 0)); gl.add(p); return p; });
  const gring = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.85, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.yellow })); gring.position.y = 0.05; gl.add(gring);
  addNode(gl, at(2, TIERS.T2.d, TIERS.T2.y), 79.2, 1);

  // ---- T1 : structures locales (marchés) ----
  const mk1 = makeMarketOffice(); mk1.scale.setScalar(0.5); addNode(mk1, at(-6, TIERS.T1.d, TIERS.T1.y), 79.4, 1);
  const mk2 = makeMarketOffice(); mk2.scale.setScalar(0.5); addNode(mk2, at(10, TIERS.T1.d, TIERS.T1.y), 79.5, 1);
  // ---- T1 : franchisés (bureaux de la ville qui s'envolent) ----
  const offs = [cityCtx.officeA, cityCtx.officeB, cityCtx.officeC];
  const offSlots = [at(32, TIERS.T1.d, TIERS.T1.y), at(46, TIERS.T1.d, TIERS.T1.y), at(60, TIERS.T1.d, TIERS.T1.y)];
  // ---- T0 : restaurants (ceux de la ville s'envolent) ----
  const rest = cityCtx.restaurants; // 0 focal, 1..6
  const restSlots = [
    at(26, 0, 0), at(38, 0, 0), at(50, 0, 0), at(62, 0, 0),    // franchisés : focal + R1,R2,R3
    at(-6, 0, 0), at(6, 0, 0),                                  // exploités par la société : R5,R6 -> (R4 reste décor)
  ];
  const restIdx = [0, 1, 2, 3, 5, 6];
  const flyers = [];
  restIdx.forEach((ri, k) => flyers.push({ g: rest[ri].r.group, from: rest[ri].r.group.position.clone(), to: restSlots[k], s: 0.5, t0: 76.2 + k * 0.18, dur: 1.5, kind: 'rest', k }));
  offs.forEach((o, k) => flyers.push({ g: o, from: o.position.clone(), to: offSlots[k], s: 0.55, t0: 76.0 + k * 0.2, dur: 1.5, kind: 'off', k }));
  // équipes (pions) devant chaque restaurant
  const teams = restSlots.map((p, k) => {
    const g = new THREE.Group();
    const spec = [[C.charcoal, 1.0, 0xffffff], [C.yellow, 0.85], [C.yellow, 0.85], [C.red, 0.8], [C.red, 0.8], [C.red, 0.8]];
    spec.forEach(([col, s], i) => { const pw = pawn(col, s, C.skin[(i + k) % 6]); pw.position.set(-1.7 + i * 0.7, 0, 0); g.add(pw); });
    addNode(g, p.clone().add(uB.clone().multiplyScalar(-6.8)).add(new THREE.Vector3(0, 0, 0)), 79.0 + k * 0.1, 1.9);
    return g;
  });

  // ---- liens ----
  const lk = (curve, type, t0, o = {}) => links.add({ curve, type, parent: city, t0, drawDur: 1.1, t1: Infinity, radius: 0.13, pulses: 3, speed: 0.4, ...o });
  const up = (v, h) => v.clone().add(new THREE.Vector3(0, h, 0));
  const hqP = at(0, TIERS.T3.d, TIERS.T3.y), bP = at(-18, TIERS.T3.d, TIERS.T3.y), eP = at(18, TIERS.T3.d, TIERS.T3.y);
  // gouvernance (blanc) : conseil -> direction générale -> siège
  lk(new THREE.CatmullRomCurve3([up(bP, 2.6), up(hqP, 7.5).add(new THREE.Vector3(0, 2, 0)), up(eP, 2.6)]), 'gouvernance', 80.2, { radius: 0.15 });
  // hiérarchie (rouge) : direction générale -> fonctions / international ; international -> structures locales -> restaurants -> équipes
  const pFn = at(-30, TIERS.T2.d, TIERS.T2.y), pIn = at(2, TIERS.T2.d, TIERS.T2.y);
  lk(roundedPath([up(eP, 1.2), up(eP, 1.2).add(new THREE.Vector3(0, 0, 0)), up(at(18, 61, TIERS.T3.y - 6), 0), up(at(-30, 61, TIERS.T2.y + 8), 0), up(pFn, 5.5)], 3), 'hierarchie', 80.6, {});
  lk(roundedPath([up(eP, 1.2), up(at(18, 61, TIERS.T3.y - 6), 0), up(at(2, 61, TIERS.T2.y + 8), 0), up(pIn, 8.4)], 3), 'hierarchie', 80.8, {});
  const pM1 = at(-6, TIERS.T1.d, TIERS.T1.y), pM2 = at(10, TIERS.T1.d, TIERS.T1.y);
  lk(roundedPath([up(pIn, 1.0), up(at(2, 36, TIERS.T1.y + 4), 0), up(at(-6, 36, TIERS.T1.y + 4), 0), up(pM1, 4.8)], 2.4), 'hierarchie', 81.1, {});
  lk(roundedPath([up(pIn, 1.0), up(at(2, 36, TIERS.T1.y + 4), 0), up(at(10, 36, TIERS.T1.y + 4), 0), up(pM2, 4.8)], 2.4), 'hierarchie', 81.2, {});
  const pr5 = restSlots[4], pr6 = restSlots[5];
  lk(roundedPath([up(pM1, 1.0), up(at(-6, 12, 5), 0), up(pr5, 3.6)], 2.4), 'hierarchie', 81.5, {});
  lk(roundedPath([up(pM2, 1.0), up(at(10, 12, 5), 0), up(pr6, 3.6)], 2.4), 'hierarchie', 81.6, {});
  restSlots.forEach((p, k) => lk(roundedPath([up(p, 3.4), up(p.clone().addScaledVector(uB, -4.2), 1.0)], 1), 'hierarchie', 82.6 + k * 0.1, { radius: 0.09, drawDur: 0.7 }));
  // contractuel (jaune) : siège -> branche franchisés (branche distincte), puis vers chaque bureau
  const trunkEnd = at(46, 30, TIERS.T1.y + 8);
  lk(new THREE.CatmullRomCurve3([up(at(8, TIERS.T3.d, TIERS.T3.y), 9), up(at(34, 78, TIERS.T3.y), 11), up(at(58, 68, TIERS.T3.y), 8), up(at(64, 48, 24), 0), up(at(56, 36, 19), 0), trunkEnd]), 'contrat', 81.9, { radius: 0.17, drawDur: 1.8 });
  offSlots.forEach((p, k) => {
    lk(new THREE.QuadraticBezierCurve3(trunkEnd.clone(), at(46 + (k - 1) * 7, 28, TIERS.T1.y + 8), up(p, 3.6)), 'contrat', 83.2 + k * 0.15, { radius: 0.12, drawDur: 0.9 });
  });
  // franchisé -> restaurants (hiérarchie du franchisé)
  const own = [[0, [0]], [1, [1]], [2, [2, 3]]];
  own.forEach(([oi, rs]) => rs.forEach((ri, n) => lk(new THREE.QuadraticBezierCurve3(up(offSlots[oi], 1.0), up(offSlots[oi].clone().lerp(restSlots[ri], 0.5), 6), up(restSlots[ri], 3.6)), 'hierarchie', 83.4 + oi * 0.15 + n * 0.1, { radius: 0.1, drawDur: 0.9 })));
  // coordination (cyan, pointillé) : entre fonctions, et avec l'international
  const fp = (i) => funcs.localToWorld(funcs.userData['p' + i].clone());
  // (les positions locales sont converties à la volée via la matrice du groupe, après placement)
  const coordPending = [];
  for (let i = 0; i < 7; i++) coordPending.push([i, (i + 1) % 7]);
  coordPending.push([2, -1], [4, -1]);

  // ---- étiquettes : jeu « parcours » (pendant la visite) puis jeu « final » (vue d'ensemble) ----
  const T_END = 85.4;
  const card = (title, sub, color, pos, dx, dy, t0, t1, align = 'center', scale = 1.1, num = null) => labels.add({ kind: 'card', title, sub, color, scale, anchor: (t, v) => { v.copy(pos).add(CITY_POS); return v; }, dx, dy, t0, t1, align, num });
  // visite
  card('McDonald’s Corporation', 'Siège mondial', C.red, up(hqP, 14), 0, -70, 80.2, T_END, 'center', 1.15, 'SOMMET');
  card('Conseil d’administration', 'Gouvernance', 0xffffff, up(bP, 3.5), -120, -50, 80.6, T_END, 'right', 1.0);
  card('Direction générale', 'PDG et équipe exécutive', C.red, up(eP, 3.5), 120, -50, 80.9, T_END, 'left', 1.0);
  card('Fonctions centrales', 'Sept fonctions qui collaborent', C.cyan, up(pFn, 9), -40, -78, 81.3, T_END, 'center', 1.05);
  card('Organisations internationales', 'Marchés, filiales, partenaires', C.yellow, up(pIn, 9.5), 140, -52, 81.5, T_END, 'left', 1.05);
  card('Structures locales', 'Responsabilités variables selon les pays', C.grey1, up(pM2, 6.4), 150, -40, 81.9, T_END, 'left', 1.0);
  card('Franchisés indépendants', 'Branche distincte · contrats de franchise', C.yellow, up(offSlots[1], 6.4), 40, -86, 83.4, T_END, 'left', 1.05, 'BRANCHE FRANCHISE');
  card('Restaurants exploités par la société', null, C.red, up(restSlots[5], 5.2), -130, 30, 82.3, T_END, 'right', 0.95);
  card('Restaurants franchisés', 'Exploités par leurs franchisés', C.yellow, up(restSlots[2], 5.2), 40, 100, 84.2, T_END, 'left', 1.0);
  card('Responsables et équipes', 'Dans chaque restaurant', C.red, restSlots[1].clone().addScaledVector(uB, -9).add(new THREE.Vector3(0, 2.4, 0)), 90, 120, 84.8, T_END, 'left', 1.0, 'BASE');
  // vue d'ensemble : étiquettes compactes
  const F0 = 85.8, fs = 0.8;
  const tag = (title, color, pos, dx, dy, align) => labels.add({ kind: 'tag', title, color, scale: 1.05, anchor: (t, v) => { v.copy(pos).add(CITY_POS); return v; }, dx, dy, t0: F0, t1: 88.3, align, stem: true, className: 'fin' });
  tag('McDonald’s Corporation', C.red, up(hqP, 13), 0, -46, 'center');
  tag('Conseil d’administration', 0xffffff, up(bP, 3.5), -60, -40, 'right');
  tag('Direction générale', C.red, up(eP, 3.5), 60, -40, 'left');
  tag('Fonctions centrales', C.cyan, up(pFn, 7), -20, -56, 'center');
  tag('Organisations internationales', C.yellow, up(pIn, 8.6), 80, -40, 'left');
  tag('Structures locales', C.grey1, up(pM1, 5.6), -70, -34, 'right');
  tag('Franchisés indépendants', C.yellow, up(offSlots[1], 5.6), 30, -52, 'center');
  tag('Restaurants de la société', C.red, up(restSlots[4], 4.6), -40, 40, 'right');
  tag('Restaurants franchisés', C.yellow, up(restSlots[2], 4.6), 50, 56, 'left');
  tag('Responsables et équipes', C.red, restSlots[1].clone().addScaledVector(uB, -9).add(new THREE.Vector3(0, 2.4, 0)), -30, 56, 'center');

  // ---- mise à jour ----
  const tmp = new THREE.Vector3();
  let coordDone = false;
  function ensureCoord() {
    if (coordDone) return; coordDone = true;
    root.updateMatrixWorld(true); city.updateMatrixWorld(true);
    const wp = (i) => funcs.localToWorld(funcs.userData['p' + i].clone()).sub(CITY_POS);
    const globeTop = up(pIn, 8.0);
    coordPending.forEach(([i, j], n) => {
      const A = wp(i), B = j >= 0 ? wp(j) : globeTop;
      const c = new THREE.QuadraticBezierCurve3(A, A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, 4.5, 0)), B);
      lk(c, 'coordination', 80.4 + n * 0.14, { radius: 0.09, drawDur: 0.9, dash: 0.9, pulses: 2 });
    });
  }
  function update(t) {
    const live = t > CH_T.rise0 - 0.2;
    root.visible = live; if (!live) return;
    ensureCoord();
    // dalles
    for (const s of slabs) { const p = easeOutBack(clamp((t - s.t0) / 0.9), 1.2); s.g.visible = p > 0.001; s.g.scale.setScalar(Math.max(0.0001, p)); }
    // nœuds
    for (const n of nodes) { const p = easeOutBack(clamp((t - n.t0) / 0.9), 1.5); n.g.visible = p > 0.001; n.g.scale.setScalar(Math.max(0.0001, p * n.s)); }
    hqt.build(clamp((t - 78.0) / 1.6));
    ha.rotation.y = 0.5 + Math.sin(t * 0.8) * 0.2;
    fIcons.forEach((ic) => ic.update(t));
    gl.rotation.y = t * 0.25;
    // vols : restaurants et bureaux quittent la ville
    for (const f of flyers) {
      const u = easeInOutCubic(clamp((t - f.t0) / f.dur));
      f.g.position.copy(f.from).lerp(f.to, u); f.g.position.y += Math.sin(Math.PI * u) * 14;
      const base = f.kind === 'off' ? 1 : 1;
      f.g.scale.setScalar(lerp(base, f.s, u)); f.g.visible = true;
      if (f.kind === 'rest') f.g.rotation.y = lerp(0, 0, u);
    }
    // ceinture : restaurants non transférés disparaissent dès l'effondrement de la ville
    const collapse = seg(t, CH_T.collapse0, CH_T.collapse1, (x) => x);
    const r4 = rest[4].r.group; r4.scale.setScalar(Math.max(0.0001, 1 - easeInOutCubic(collapse))); r4.visible = collapse < 0.999;
  }
  return { update, root, restSlots, offSlots, hqP, TIERS, at };
}
