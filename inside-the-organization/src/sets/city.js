import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { M, std, facadeMaterial } from '../engine/materials.js';
import { rbox, cyl, makeCar, makeChair, makeDesk } from '../components/furniture.js';
import { makeTower, makeArches, facadeBoxGeo, makeMiniRestaurant } from '../components/building.js';
import { makeRestaurant, makeFranchiseOffice, makeMarketOffice, REST } from '../components/restaurant.js';
import { makeCharacter, Actor, OUTFIT } from '../components/character.js';
import { arcPath } from '../engine/links.js';
import { seg, smooth, smoother, easeOutBack, easeOutCubic, easeInOutCubic, clamp, lerp, rng } from '../util/math.js';

/* =========================================================================
 * VILLE MINIATURE — scène 4 (franchise) et scène 5 (restaurant en coupe).
 * Les coordonnées ci-dessous sont relatives au groupe `city` (placé à CITY_POS dans le monde).
 * ========================================================================= */
export const CITY_POS = new THREE.Vector3(400, 0, 0);
export const CT = {
  reveal0: 45.0, reveal1: 48.0,       // la ville se construit en onde depuis le restaurant
  office: 47.6,                        // bureau du franchisé
  tier: 48.7,                          // palier « entreprise » flottant
  linkRed: 50.0, linkContract: 50.9, linkStd: 52.2,
  walk0: 53.2, shake: 56.3,
  groups: 57.0,                        // autres franchisés
  roofOpen0: 60.3, roofOpen1: 62.6,    // scène 5
  collapse0: 75.3, collapse1: 76.9, ground0: 76.4, ground1: 77.6,  // scène 6 : la ville s'efface
};
export const R0 = { x: 2, z: 4 };        // restaurant focal (repère ville)
export const OFFICE_A = { x: -15, z: -8 };
export const TIER = { x: -30, y: 17, z: 18 };

const FLOORH = 1.25;

export function buildCity(ctx) {
  const { scene, links, labels } = ctx;
  const city = new THREE.Group(); city.name = 'city'; city.position.copy(CITY_POS); scene.add(city);

  // ---------- sol : plateforme, routes, trottoirs ----------
  const S = 170;
  const ground = new THREE.Group(); city.add(ground);
  const base = rbox(S, 1.4, S, std(0x2a2c32, { rough: 0.95 }), { r: 1.0 }); base.position.y = -1.46; ground.add(base);
  const blocks = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const b = rbox(46, 0.14, 46, std(0x3d4048, { rough: 0.9 }), { r: 0.6 }); b.position.set(i * 52, -0.14, j * 52); ground.add(b);
    blocks.push({ x: i * 52, z: j * 52 });
  }
  // marquage routier (tirets jaunes) — instancié
  const dashG = new THREE.BoxGeometry(2.0, 0.03, 0.22).translate(0, 0.02, 0);
  const dashes = [];
  for (const k of [-26, 26]) for (let a = -80; a <= 80; a += 4.2) { dashes.push([k, a, 0]); dashes.push([a, k, 1]); }
  const dashM = new THREE.InstancedMesh(dashG, std(C.yellow, { rough: 0.6, emissive: C.yellow, emI: 0.2 }), dashes.length);
  const mt = new THREE.Matrix4(), qq = new THREE.Quaternion();
  dashes.forEach(([x, z, r], i) => { mt.compose(new THREE.Vector3(x, -0.12, z), qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r ? 0 : Math.PI / 2), new THREE.Vector3(1, 1, 1)); dashM.setMatrixAt(i, mt); });
  ground.add(dashM);

  // ---------- restaurants ----------
  const restaurantsDef = [
    { id: 'R0', x: R0.x, z: R0.z, group: 'A', focal: true },
    { id: 'R5', x: -2, z: 54, group: 'A' },
    { id: 'R1', x: -50, z: 12, group: 'B' }, { id: 'R2', x: -52, z: -44, group: 'B' },
    { id: 'R3', x: 50, z: 10, group: 'C' }, { id: 'R4', x: 52, z: -46, group: 'C' }, { id: 'R6', x: 50, z: 58, group: 'C' },
  ];
  const restaurants = restaurantsDef.map((d) => {
    const r = makeRestaurant({ interior: !!d.focal, parking: true, sign: true });
    r.group.position.set(d.x, 0, d.z); city.add(r.group);
    return { ...d, r };
  });
  const focal = restaurants[0].r;
  ctx.restaurant = focal; ctx.restaurantPos = new THREE.Vector3(R0.x, 0, R0.z).add(CITY_POS);

  // ---------- bâtiments génériques instanciés (ville remplie) ----------
  const rand = rng(77);
  const excl = [
    ...restaurants.map((d) => ({ x: d.x + 4, z: d.z + 3, r: 19 })),
    { x: OFFICE_A.x, z: OFFICE_A.z, r: 11 }, { x: -46, z: -24, r: 11 }, { x: 46, z: -28, r: 11 },
  ];
  const classes = [
    { k: 2, w: 8, d: 8, wall: 0x6b707a }, { k: 3, w: 9, d: 7, wall: 0x5f646e }, { k: 4, w: 8, d: 8, wall: 0x777c86 },
    { k: 6, w: 9, d: 9, wall: 0x646973 }, { k: 8, w: 8, d: 8, wall: 0x6f747e }, { k: 5, w: 10, d: 8, wall: 0x5a5f69 },
  ];
  const insts = classes.map(() => []);
  for (const b of blocks) {
    for (let gx = -18; gx <= 18; gx += 12) for (let gz = -18; gz <= 18; gz += 12) {
      if (rand() < 0.2) continue;
      const x = b.x + gx + (rand() - 0.5) * 2, z = b.z + gz + (rand() - 0.5) * 2;
      if (excl.some((e) => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
      const ci = Math.floor(rand() * classes.length);
      insts[ci].push({ x, z, rot: Math.floor(rand() * 2) * Math.PI / 2, delay: Math.hypot(x - R0.x, z - R0.z) / 120 });
    }
  }
  const genMeshes = classes.map((c, ci) => {
    const geo = facadeBoxGeo(c.w, c.k * FLOORH, c.d, 0, c.k);
    const fac = facadeMaterial(c.wall, 0x7e8a96, { litProb: 0.3, seed: 100 + ci, accentLit: 0.05, emI: 0.55 });
    const roofM = std(0x5b606a, { rough: 0.8 });
    const im = new THREE.InstancedMesh(geo, [fac, fac, roofM, roofM, fac, fac], Math.max(1, insts[ci].length));
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.count = insts[ci].length;
    city.add(im);
    return { im, list: insts[ci], c };
  });
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let genKey = -1;
  function updateGeneric(t) {
    const p = seg(t, CT.reveal0, CT.reveal1, (x) => x);
    const col = seg(t, CT.collapse0, CT.collapse1, (x) => x);
    const key = (p >= 1 ? 1 : p) + col * 7;
    if (key === genKey) return; genKey = key;
    for (const g of genMeshes) {
      g.list.forEach((it, i) => {
        const u = easeOutBack(clamp((p - it.delay * 0.55) / 0.45), 1.15);
        const dn = easeInOutCubic(clamp((col * 1.6 - it.delay * 0.6) / 1.0));
        const sy = Math.max(0.0001, u * (1 - dn)), sxz = Math.max(0.0001, 1 - dn);
        tmpM.compose(tmpP.set(it.x, 0, it.z), tmpQ.setFromAxisAngle(yAxis, it.rot), tmpS.set(sxz, sy, sxz));
        g.im.setMatrixAt(i, tmpM);
      });
      g.im.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- bureau du franchisé, palier entreprise (flottant) ----------
  const officeA = makeFranchiseOffice(); officeA.position.set(OFFICE_A.x, 0, OFFICE_A.z); officeA.rotation.y = 0; city.add(officeA);
  const officeB = makeFranchiseOffice(); officeB.position.set(-46, 0, -24); city.add(officeB);
  const officeC = makeFranchiseOffice(); officeC.position.set(46, 0, -28); city.add(officeC);

  const tier = new THREE.Group(); tier.position.set(TIER.x, TIER.y, TIER.z); city.add(tier);
  const pad = rbox(30, 0.5, 15, std(C.grey4, { rough: 0.6, metal: 0.1 }), { r: 0.2 }); pad.position.y = -0.5; tier.add(pad);
  const padEdge = rbox(30.2, 0.12, 15.2, std(C.yellow, { rough: 0.4, emissive: C.yellow, emI: 0.5 }), { r: 0.05 }); padEdge.position.y = -0.2; tier.add(padEdge);
  const padGlow = new THREE.Mesh(new THREE.PlaneGeometry(30, 15).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })); padGlow.position.y = 0.02; tier.add(padGlow);
  const corp = makeTower({ w: 5, d: 5, floors: 10, fh: 1.3, wall: C.white, glass: C.glass, seed: 5, fins: C.red, bands: { at: [3, 6], color: C.red }, base: { w: 8, d: 8, h: 0.9, color: C.white } });
  corp.group.position.set(-8, 0, 0); tier.add(corp.group);
  const corpArch = makeArches({ size: 1.6 }); corpArch.position.set(-4.2, 0.95, 3.4); tier.add(corpArch);
  const market = makeMarketOffice(); market.position.set(8, 0, 0); market.scale.setScalar(1.0); tier.add(market);

  // ---------- circulation et piétons ----------
  const cars = [];
  [C.yellow, C.white, C.red, C.grey1, C.yellow, C.white, C.grey2, C.red, C.white].forEach((col, i) => {
    const car = makeCar(col); city.add(car);
    cars.push({ car, a0: i * 0.9, w: (i % 2 ? 1 : -1) * (0.05 + (i % 3) * 0.008), half: i % 3 === 0 ? 26 + (i % 2 ? 1.6 : -1.6) : i % 3 === 1 ? 78 : 26 + (i % 2 ? 1.6 : -1.6) });
  });
  const loop = (a, half) => {
    const p = 7, ca = Math.cos(a), sa = Math.sin(a);
    return [half * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p), half * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p)];
  };

  // ---------- personnages de la scène 4 ----------
  const fr = (n) => ({ t: 0, a: n });
  const doorA = { x: R0.x + 3.2, z: R0.z + REST.D / 2 + 0.6 };
  const franchisee = new Actor(makeCharacter(OUTFIT.franchisee()), {
    path: [
      { t: 0, x: OFFICE_A.x + 1, z: OFFICE_A.z + 3.2 }, { t: CT.walk0 - 0.2, x: OFFICE_A.x + 1, z: OFFICE_A.z + 3.2 },
      { t: CT.walk0 + 2.2, x: OFFICE_A.x + 4, z: R0.z + 9.5 }, { t: CT.walk0 + 3.9, x: doorA.x - 1.5, z: doorA.z + 2.2 },
      { t: CT.shake + 2.2, x: doorA.x - 1.5, z: doorA.z + 2.2 }, { t: CT.shake + 3.6, x: doorA.x, z: doorA.z },
      { t: 59.6, x: R0.x + 3.2, z: R0.z + 3.4 }, { t: 61.4, x: R0.x + 5.0, z: R0.z - 3.4 }, { t: 90, x: R0.x + 5.0, z: R0.z - 3.4 },
    ],
    face: [fr(0)], acts: [{ t0: CT.shake, t1: CT.shake + 2.1, act: 'shake' }, { t0: 61.4, t1: 66.0, act: 'typeStand' }, { t0: 66.0, t1: 90, act: 'talk' }],
    appear: { t: 47.9, dur: 0.5 }, vanish: { t: 74.6, dur: 0.5 }, phase: 0.3,
  });
  city.add(franchisee.root);
  const mgrSpec = OUTFIT.manager();
  const manager = new Actor(makeCharacter(mgrSpec), {
    path: [
      { t: 0, x: doorA.x - 4.2, z: doorA.z + 2.0 }, { t: CT.shake + 2.2, x: doorA.x - 4.2, z: doorA.z + 2.0 },
      { t: CT.shake + 3.6, x: doorA.x - 3.2, z: doorA.z + 0.2 }, { t: 61.0, x: R0.x + 0.5, z: R0.z + 0.6 }, { t: 90, x: R0.x + 0.5, z: R0.z + 0.6 },
    ],
    face: [fr(Math.PI * 0.75), { t: CT.shake + 2.2, a: Math.PI * 0.75 }], acts: [{ t0: CT.shake, t1: CT.shake + 2.1, act: 'shake' }],
    appear: { t: 49.0, dur: 0.5 }, vanish: { t: 74.6, dur: 0.5 }, phase: 1.4,
  });
  city.add(manager.root);
  const crewOut = [0, 1, 2].map((i) => {
    const a = new Actor(makeCharacter({ ...OUTFIT.crew(i), scale: 1.0 }), {
      path: [{ t: 0, x: doorA.x - 6 + i * 1.3, z: doorA.z + 3.4 + (i % 2) * 0.6 }, { t: 90, x: doorA.x - 6 + i * 1.3, z: doorA.z + 3.4 + (i % 2) * 0.6 }],
      face: [fr(Math.PI * 0.2 + i * 0.2)], acts: [{ t0: 0, t1: 999, act: i === 1 ? 'talk' : 'idle' }], appear: { t: 55.4 + i * 0.2, dur: 0.5 }, vanish: { t: 59.7 + i * 0.12, dur: 0.4 }, phase: i * 2.2,
    });
    city.add(a.root); return a;
  });
  // piétons de la ville (décor vivant)
  const walkers = [];
  const wr = rng(31);
  for (let k = 0; k < 10; k++) {
    const ch = makeCharacter({ ...OUTFIT.visitor(k), scale: 1.0 }); city.add(ch.root);
    const path = []; let t = 0;
    let cur = { x: -40 + wr() * 80, z: (wr() < 0.5 ? -1 : 1) * (22 + wr() * 3) };
    path.push({ t: 0, ...cur });
    for (let n = 0; n < 24; n++) {
      const horiz = n % 2 === 0;
      const nxt = horiz ? { x: Math.max(-70, Math.min(70, cur.x + (wr() - 0.5) * 60)), z: cur.z } : { x: cur.x, z: cur.z + (wr() < 0.5 ? -1 : 1) * 0 };
      const dist = Math.hypot(nxt.x - cur.x, nxt.z - cur.z); if (dist < 0.1) continue;
      t += dist / 1.2; path.push({ t, ...nxt }); t += 0.4 + wr(); path.push({ t, ...nxt }); cur = nxt;
    }
    walkers.push(new Actor(ch, { path, acts: [], phase: k * 0.7, appear: { t: 46.4 + k * 0.15, dur: 0.5 } }));
  }

  // ---------- liens et paquets ----------
  const wpos = (x, y, z) => new THREE.Vector3(x, y, z);
  const corpTop = wpos(TIER.x - 8, TIER.y + 10.6, TIER.z), mktTop = wpos(TIER.x + 8, TIER.y + 7.2, TIER.z);
  const officeTop = wpos(OFFICE_A.x, 5.2, OFFICE_A.z);
  links.add({ curve: new THREE.QuadraticBezierCurve3(corpTop.clone().add(wpos(0.6, -2.2, 0)), wpos(TIER.x, TIER.y + 12.5, TIER.z), mktTop.clone().add(wpos(-1.0, -0.6, 0))), parent: city, type: 'hierarchie', t0: CT.linkRed, drawDur: 1.0, t1: 60, radius: 0.12, pulses: 3 });
  const cContract = new THREE.CubicBezierCurve3(mktTop.clone().add(wpos(0, -1.2, 1.5)), wpos(TIER.x + 14, TIER.y - 2, TIER.z + 10), wpos(OFFICE_A.x - 3, 14, OFFICE_A.z + 8), officeTop.clone().add(wpos(0, 0.6, 1.6)));
  const lContract = links.add({ curve: cContract, parent: city, type: 'contrat', t0: CT.linkContract, drawDur: 1.2, t1: 60, radius: 0.16, pulses: 2, speed: 0.3 });
  const restaurantTop = wpos(R0.x + 2, 6.6, R0.z + 3);
  const cStd = new THREE.CubicBezierCurve3(mktTop.clone().add(wpos(1.5, -2.0, 3)), wpos(TIER.x + 26, TIER.y - 4, TIER.z + 10), wpos(R0.x - 8, 10, R0.z + 8), restaurantTop);
  const lStd = links.add({ curve: cStd, parent: city, type: 'contrat', color: 0xffe6a0, t0: CT.linkStd, drawDur: 1.2, t1: 60, radius: 0.1, pulses: 2, speed: 0.5, dash: 0.7 });
  const cOwn = new THREE.QuadraticBezierCurve3(officeTop.clone().add(wpos(1.5, 0.4, 0)), wpos((OFFICE_A.x + R0.x) / 2 + 2, 9.0, (OFFICE_A.z + R0.z) / 2), restaurantTop.clone().add(wpos(-3.2, 0.0, -2.0)));
  links.add({ curve: cOwn, parent: city, type: 'hierarchie', t0: 54.0, drawDur: 1.0, t1: 60, radius: 0.1, pulses: 3 });
  const stdOthers = [restaurants[1], restaurants[2], restaurants[3], restaurants[4], restaurants[5], restaurants[6]].map((r, i) => {
    const top = wpos(r.x + 2, 6.0, r.z + 3);
    const c = new THREE.CubicBezierCurve3(mktTop.clone().add(wpos(0, -2, 3)), wpos(TIER.x + 20 + i * 4, TIER.y - 3, TIER.z + 6), wpos(r.x - 6, 12, r.z - 8), top);
    return links.add({ curve: c, parent: city, type: 'contrat', color: 0xffe6a0, t0: 57.6 + i * 0.16, drawDur: 1.0, t1: 60, radius: 0.08, pulses: 2, speed: 0.5, dash: 0.7 });
  });
  // paquets (contrats / standards) qui circulent sur les liens jaunes
  const mkDoc = (col) => { const g = new THREE.Group(); const s = rbox(0.9, 0.05, 1.15, M.white(), { r: 0.02 }); g.add(s); const sl = cyl(0.17, 0.17, 0.06, col === 'y' ? M.yellow() : M.red(), 16); sl.position.set(0.2, 0.03, 0.38); g.add(sl); for (let i = 0; i < 3; i++) { const l = rbox(0.55, 0.055, 0.05, M.grey2(), { r: 0.005 }); l.position.set(-0.05, 0.03, -0.36 + i * 0.22); g.add(l); } city.add(g); return g; };
  const packets = [];
  for (let k = 0; k < 4; k++) packets.push({ g: mkDoc('y'), curve: cContract, t0: CT.linkContract + 1.3, speed: 0.17, off: k / 4, kind: 'contract' });
  for (let k = 0; k < 4; k++) packets.push({ g: mkDoc('r'), curve: cStd, t0: CT.linkStd + 1.3, speed: 0.19, off: k / 4, kind: 'std' });

  // ---------- étiquettes scène 4 ----------
  const L = labels;
  L.add({ kind: 'card', title: 'McDonald’s Corporation', sub: 'Marque, standards, contrats de franchise', color: C.red, scale: 0.9, anchor: (t, v) => v.set(CITY_POS.x + TIER.x - 8, TIER.y + 11.5, TIER.z), dx: -40, dy: -110, t0: CT.tier + 0.9, t1: 59.4, align: 'center', num: 'ENTREPRISE' });
  L.add({ kind: 'card', title: 'Structure de marché', sub: 'Filiale, marché exploité ou partenaire', color: C.grey1, scale: 0.9, anchor: (t, v) => v.set(CITY_POS.x + TIER.x + 8, TIER.y + 8.6, TIER.z), dx: 190, dy: -80, t0: CT.tier + 1.6, t1: 59.4, align: 'left', num: 'MARCHÉ' });
  L.add({ kind: 'card', title: 'Franchisé indépendant', sub: 'Exploitant — pas un employé du siège', color: C.yellow, scale: 0.9, anchor: (t, v) => v.set(CITY_POS.x + OFFICE_A.x, 3.0, OFFICE_A.z + 2), dx: 70, dy: 120, t0: CT.office + 0.9, t1: 59.4, align: 'left', num: 'EXPLOITANT' });
  L.add({ kind: 'chip', title: 'Contrat de franchise', sub: 'droits et obligations des deux parties', color: C.yellow, anchor: (t, v) => { cContract.getPointAt(0.55, v); v.add(CITY_POS); return v; }, dx: 120, dy: -34, t0: CT.linkContract + 0.9, t1: 59.4, align: 'left', stem: true });
  L.add({ kind: 'chip', title: 'Standards de marque', sub: 'identité, qualité, service', color: 0xffe6a0, anchor: (t, v) => { cStd.getPointAt(0.6, v); v.add(CITY_POS); return v; }, dx: 130, dy: -10, t0: CT.linkStd + 0.9, t1: 59.4, align: 'left', stem: true });
  L.add({ kind: 'card', title: 'Restaurant', sub: 'Exploité et staffé par le franchisé', color: C.red, scale: 0.9, anchor: (t, v) => v.set(CITY_POS.x + R0.x + 8, 3.6, R0.z + 6), dx: 190, dy: 30, t0: 54.6, t1: 59.4, align: 'left', num: 'RESTAURANT' });
  L.add({ kind: 'card', title: 'Ses propres équipes', sub: 'Il emploie, planifie et encadre', color: C.yellow, scale: 0.9, anchor: (t, v) => { franchisee.anchor(v, 1.5); v.add(CITY_POS); return v; }, dx: -230, dy: 90, t0: CT.shake + 0.4, t1: 59.0, align: 'right' });
  L.add({ kind: 'card', title: 'Des milliers d’exploitants', sub: 'chacun avec ses restaurants, tous sous la même marque', color: C.yellow, scale: 0.95, anchor: (t, v) => v.set(CITY_POS.x - 46, 6, -24), dx: 100, dy: -130, t0: CT.groups + 0.2, t1: 59.8, align: 'left' });

  // ---------- paliers de franchisés supplémentaires (anneaux de propriété) ----------
  const owner = new THREE.Group(); city.add(owner);
  const ringCols = { A: C.yellow, B: C.white, C: C.red };
  const rings = restaurants.map((d) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(9.0, 9.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ringCols[d.group], transparent: true, opacity: 0.0 }));
    r.position.set(d.x + 1, 0.12, d.z + 2); owner.add(r); return { r, d };
  });
  const ownLinks = [[officeB, [restaurants[2], restaurants[3]]], [officeC, [restaurants[4], restaurants[5], restaurants[6]]]];
  ownLinks.forEach(([off, rs]) => {
    rs.forEach((r, i) => {
      const a = wpos(off.position.x, 5.0, off.position.z), b = wpos(r.x + 1, 3.6, r.z + 2);
      const c = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(wpos(0, 8, 0)), b);
      links.add({ curve: c, parent: city, type: 'hierarchie', t0: CT.groups + 0.6 + i * 0.25, drawDur: 0.9, t1: 60, radius: 0.09, pulses: 2 });
    });
  });

  // ---------- update ----------
  function update(t) {
    const vis = t > CT.reveal0 - 0.2;
    city.visible = vis; if (!vis) return;
    updateGeneric(t);
    // restaurants + parcelles
    restaurants.forEach((d, i) => {
      const p = d.focal ? 1 : easeOutBack(clamp((t - CT.reveal0 - (Math.hypot(d.x - R0.x, d.z - R0.z) / 120) * 2.4) / 0.9), 1.25);
      d.r.group.visible = p > 0.001; d.r.group.scale.setScalar(Math.max(0.0001, p));
    });
    // restaurant focal : toit ouvert en scène 5 (+ léger retour à la scène 6)
    const open = seg(t, CT.roofOpen0, CT.roofOpen1, smoother) * (1 - seg(t, 74.4, 76.2, smoother));
    focal.open(open, 1);
    if (focal.arches) focal.arches.rotation.y = Math.sin(t * 0.8) * 0.12;
    // bureaux
    const po = easeOutBack(clamp((t - CT.office) / 0.9), 1.4);
    officeA.visible = po > 0.001; officeA.scale.setScalar(Math.max(0.0001, po)); officeA.userData.doc.rotation.y = t * 0.9; officeA.userData.doc.position.y = 5.3 + Math.sin(t * 2) * 0.12;
    const pg = easeOutBack(clamp((t - CT.groups) / 0.9), 1.4);
    for (const o of [officeB, officeC]) { o.visible = pg > 0.001; o.scale.setScalar(Math.max(0.0001, pg)); o.userData.doc.rotation.y = t * 0.9; }
    rings.forEach(({ r, d }) => { const k = d.group === 'A' ? seg(t, 54.4, 55.4, (x) => x) : seg(t, CT.groups + 0.2, CT.groups + 1.0, (x) => x); r.material.opacity = 0.85 * k * (1 - seg(t, 59.6, 60.4, (x) => x)); r.scale.setScalar(1 + 0.05 * Math.sin(t * 3 + d.x)); });
    // palier entreprise
    const pt = easeOutBack(clamp((t - CT.tier) / 1.1), 1.3);
    tier.visible = pt > 0.001 && t < 61; tier.scale.setScalar(Math.max(0.0001, pt));
    corp.build(clamp((t - CT.tier) / 1.3));
    market.userData.globe.rotation.y = t * 0.8;
    // paquets
    for (const pk of packets) {
      const u = ((t - pk.t0) * pk.speed + pk.off) % 1;
      const on = t > pk.t0 && t < 59.6;
      pk.g.visible = on; if (!on) continue;
      pk.curve.getPointAt(u, pk.g.position); pk.g.position.y += 0.2; pk.g.rotation.y = t * 1.2 + pk.off * 6; pk.g.rotation.x = -0.3;
      pk.g.scale.setScalar(Math.sin(Math.PI * u) * 0.9 + 0.05);
    }
    const gcol = seg(t, CT.ground0, CT.ground1, smoother);
    ground.scale.set(Math.max(0.0001, 1 - gcol), 1, Math.max(0.0001, 1 - gcol)); ground.visible = gcol < 0.999;
    const traffic = t < CT.collapse0 + 0.2;
    // voitures, piétons
    for (const c of cars) {
      c.car.visible = traffic; if (!traffic) continue;
      const a = c.a0 + c.w * t; const [x, z] = loop(a, c.half);
      const [x2, z2] = loop(a + 0.01 * Math.sign(c.w), c.half);
      c.car.position.set(x, 0.02, z); c.car.rotation.y = Math.atan2(-(z2 - z), x2 - x);
    }
    if (traffic) walkers.forEach((w) => w.update(t)); else walkers.forEach((w) => { w.root.visible = false; });
    franchisee.update(t); manager.update(t); crewOut.forEach((a) => a.update(t));
  }
  return { update, group: city, focal, restaurants, franchisee, manager, officeA, officeB, officeC, tier, cars, ground };
}
