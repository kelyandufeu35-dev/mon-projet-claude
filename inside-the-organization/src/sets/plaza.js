import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';
import { rbox, cyl, makeDesk, makeMonitor, makeChair, makeCar, makePlant } from '../components/furniture.js';
import { makeTower, makePlatform, makeArches } from '../components/building.js';
import { makeCharacter, Actor, OUTFIT } from '../components/character.js';
import * as ICONS from '../components/icons.js';
import { arcPath } from '../engine/links.js';
import { seg, smooth, easeOutCubic, easeInOutCubic, easeOutBack, clamp, lerp, rng } from '../util/math.js';

/* =========================================================================
 * PLACE DU SIÈGE — plateforme, route, sept « directions » avec bureaux ouverts en coupe.
 * Les sept fonctions sont une présentation pédagogique simplifiée (pas l'organigramme officiel).
 * ========================================================================= */
export const FUNCTIONS = [
  { id: 'finance', label: 'Finance', sub: 'Pilotage financier', floors: 8, accent: C.yellow, icon: ICONS.iconFinance },
  { id: 'marketing', label: 'Marketing', sub: 'Marque et communication', floors: 6, accent: C.red, icon: ICONS.iconMarketing },
  { id: 'operations', label: 'Opérations', sub: 'Standards et performance', floors: 7, accent: C.grey2, icon: ICONS.iconOperations },
  { id: 'rh', label: 'Ressources humaines', sub: 'Talents et culture', floors: 5, accent: C.red, icon: ICONS.iconPeople },
  { id: 'tech', label: 'Technologie et numérique', sub: 'Plateformes et données', floors: 9, accent: C.cyan, icon: ICONS.iconTech },
  { id: 'franchise', label: 'Développement et franchises', sub: 'Croissance du réseau', floors: 6, accent: C.yellow, icon: ICONS.iconFranchise },
  { id: 'juridique', label: 'Juridique et conformité', sub: 'Droit, éthique, conformité', floors: 6, accent: C.grey1, icon: ICONS.iconLegal },
];
export const PLAZA_R = 19.5;
export const funcPos = (i) => {
  const a = (i / 7) * Math.PI * 2 + 0.42;
  return { x: Math.cos(a) * PLAZA_R, z: Math.sin(a) * PLAZA_R, a };
};

export const PL_T = { first: 16.0, step: 0.78, buildDur: 1.5 };

export function buildPlaza(ctx) {
  const { scene, links, labels } = ctx;
  const group = new THREE.Group(); group.name = 'plaza'; scene.add(group);

  // Plateforme + anneaux
  const platform = makePlatform({ r: 35, h: 1.2, color: 0x3a3d45, top: 0x4a4e58,
    ring: { r0: 6.0, r1: 6.25, color: C.yellow, glow: 0.5 } });
  group.add(platform);
  const road = new THREE.Mesh(new THREE.RingGeometry(26.2, 30.2, 120).rotateX(-Math.PI / 2), std(0x23252b, { rough: 0.95 }));
  road.position.y = 0.01; road.receiveShadow = true; group.add(road);
  const roadLine = new THREE.Mesh(new THREE.RingGeometry(28.05, 28.35, 120, 1).rotateX(-Math.PI / 2), std(C.yellow, { rough: 0.6, emissive: C.yellow, emI: 0.25 }));
  roadLine.position.y = 0.02; group.add(roadLine);
  const paving = new THREE.Mesh(new THREE.RingGeometry(8.8, 12.4, 96).rotateX(-Math.PI / 2), std(0x575b66, { rough: 0.9 }));
  paving.position.y = 0.012; paving.receiveShadow = true; group.add(paving);
  // allées radiales vers chaque direction
  FUNCTIONS.forEach((f, i) => {
    const p = funcPos(i);
    const len = PLAZA_R - 8.4 - 3.4, cx = Math.cos(p.a) * (8.4 + len / 2 + 0.4), cz = Math.sin(p.a) * (8.4 + len / 2 + 0.4);
    const path = rbox(1.6, 0.03, len, std(0x5f636f, { rough: 0.9 }), { r: 0.01 }); path.position.set(cx, 0.01, cz); path.rotation.y = -p.a + Math.PI / 2; group.add(path);
  });

  // Lampadaires (instanciés)
  const NL = 28;
  const poleG = new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6).translate(0, 0.8, 0);
  const headG = new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.72, 0);
  const poles = new THREE.InstancedMesh(poleG, M.grey3(), NL), heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffe39b, emissiveIntensity: 1.6 }), NL);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < NL; i++) {
    const a = (i / NL) * Math.PI * 2, r = 31.9;
    mtx.makeTranslation(Math.cos(a) * r, 0, Math.sin(a) * r); poles.setMatrixAt(i, mtx); heads.setMatrixAt(i, mtx);
  }
  poles.castShadow = true; group.add(poles, heads);

  // Voitures sur l'anneau routier
  const cars = [];
  [C.yellow, C.white, C.red, C.grey1, C.yellow, C.white].forEach((col, i) => {
    const car = makeCar(col); group.add(car); cars.push({ car, a0: i * 1.05, w: (i % 2 ? 1 : -1) * 0.075, r: i % 2 ? 27.2 : 29.2 });
  });

  // Immeubles de fonctions
  const items = [];
  const R = rng(11);
  FUNCTIONS.forEach((f, i) => {
    const pos = funcPos(i);
    const g = new THREE.Group(); g.position.set(pos.x, 0, pos.z); g.rotation.y = -pos.a + Math.PI / 2; // « avant » = vers le centre
    group.add(g);
    const plinth = rbox(9.2, 0.18, 8.2, std(0x5a5e69, { rough: 0.85 }), { r: 0.08 }); plinth.position.y = 0.0; g.add(plinth);
    const edge = rbox(9.3, 0.06, 8.3, std(f.accent, { rough: 0.5, emissive: f.accent, emI: 0.35 }), { r: 0.03 }); edge.position.y = 0.0; edge.scale.set(1.0, 0.5, 1.0); g.add(edge);
    const tower = makeTower({
      w: 5.6, d: 5.0, floors: f.floors, fh: 1.25, wall: C.white, glass: f.id === 'tech' ? 0x7fb4d4 : C.glass, seed: 20 + i,
      fins: f.accent === C.grey2 || f.accent === C.grey1 ? C.red : f.accent, bands: i % 2 ? { at: [Math.floor(f.floors / 2)], color: f.accent } : null,
      base: { w: 6.4, d: 5.8, h: 0.9, color: C.white }, cap: C.grey2, lit: 0.6, accentLit: f.id === 'finance' ? 0.6 : 0.15,
    });
    tower.group.position.set(0, 0.18, -0.4); g.add(tower.group);
    // icône de toit
    const icon = f.icon(); icon.group.position.set(0, tower.height + 0.2 + 0.18, -0.4); icon.group.scale.setScalar(1.0); icon.big = 1.5; g.add(icon.group);
    // pod bureau ouvert (en coupe) sur le côté
    const pod = new THREE.Group(); pod.position.set(5.6, 0.18, 0.4); g.add(pod);
    const floor = rbox(4.6, 0.16, 4.2, M.paper(), { r: 0.05 }); pod.add(floor);
    const wB = rbox(4.6, 1.6, 0.14, M.glass(), { r: 0.03 }); wB.position.set(0, 0.16, -2.0); pod.add(wB);
    const wL = rbox(0.14, 1.6, 4.2, M.glass(), { r: 0.03 }); wL.position.set(-2.25, 0.16, 0); pod.add(wL);
    const trim = rbox(4.7, 0.1, 0.18, std(f.accent, { rough: 0.4, emissive: f.accent, emI: 0.4 }), { r: 0.03 }); trim.position.set(0, 1.74, -2.0); pod.add(trim);
    const desks = [];
    [[-0.9, -0.8], [0.9, -0.8]].forEach(([x, z], k) => {
      const d = makeDesk({ w: 1.5, d: 0.75, h: 0.42 }); d.position.set(x, 0.16, z); pod.add(d);
      const mon = makeMonitor(k ? C.cyan : C.yellowSoft ?? C.yellow, 1.0); mon.position.set(x, 0.58, z - 0.1); pod.add(mon);
      const ch = makeChair(C.grey3); ch.position.set(x, 0.16, z + 0.62); ch.rotation.y = Math.PI; pod.add(ch);
      const person = makeCharacter({ ...OUTFIT.worker(i * 2 + k), scale: 0.95 });
      pod.add(person.root);
      desks.push(new Actor(person, {
        path: [{ t: 0, x, z: z + 0.5, y: 0.16 }], face: [{ t: 0, a: Math.PI }], acts: [{ t0: 0, t1: 999, act: 'type' }],
        appear: { t: PL_T.first + i * PL_T.step + 1.0 + k * 0.18, dur: 0.5 }, phase: i * 1.1 + k * 2.1,
      }));
    });
    const planter = makePlant(1.3); planter.position.set(1.9, 0.16, 1.4); pod.add(planter);
    // fondation du pod apparaît avec scale
    items.push({ f, i, g, tower, icon, pod, desks, plinth, edge, t0: PL_T.first + i * PL_T.step });
  });

  // Piétons : ils circulent entre les directions et le siège (déterministes)
  const walkers = [];
  const wr = rng(5);
  for (let k = 0; k < 9; k++) {
    const ch = makeCharacter({ ...OUTFIT.visitor(k), scale: 0.95 }); group.add(ch.root);
    const path = []; let t = 0; const startI = k % 7;
    let cur = { x: Math.cos(funcPos(startI).a) * 13.5, z: Math.sin(funcPos(startI).a) * 13.5 };
    path.push({ t: 0, ...cur });
    for (let n = 0; n < 30; n++) {
      const to = n % 2 === 0 ? { x: Math.cos(funcPos((startI + 1 + Math.floor(wr() * 6)) % 7).a) * 17 + (wr() - 0.5) * 3, z: 0 } : { x: 0, z: 0 };
      const i2 = (startI + 1 + Math.floor(wr() * 6)) % 7; const a2 = funcPos(i2).a + (wr() - 0.5) * 0.25;
      const rr = n % 2 ? 9.8 + wr() * 1.6 : 13.2 + wr() * 1.6;
      const nxt = { x: Math.cos(a2) * rr, z: Math.sin(a2) * rr };
      const dist = Math.hypot(nxt.x - cur.x, nxt.z - cur.z);
      t += dist / 1.25; path.push({ t, ...nxt }); t += 0.8 + wr() * 1.2; path.push({ t, ...nxt }); cur = nxt;
    }
    walkers.push(new Actor(ch, { path, acts: [], phase: k, appear: { t: 17.5 + k * 0.5, dur: 0.5 } }));
  }

  // Liaisons hiérarchiques (rouges) HQ → directions ; coordination (cyan) entre directions voisines
  const hubTop = (ctx.hq ? ctx.hq.yTop : 19) + 0.2;
  const hierLinks = [], coordLinks = [];
  items.forEach((it) => {
    const roofY = it.tower.height + 0.18 + 1.0;
    const p = funcPos(it.i);
    const B = new THREE.Vector3(p.x, roofY + 1.2, p.z), A = new THREE.Vector3(0, hubTop - 1.5, 0);
    const mid = A.clone().lerp(B, 0.5); mid.y = Math.max(A.y, B.y) + 6.5;
    const curve = new THREE.CubicBezierCurve3(A, new THREE.Vector3(A.x + (B.x - A.x) * 0.2, A.y + 6, A.z + (B.z - A.z) * 0.2), new THREE.Vector3(B.x - (B.x - A.x) * 0.2, B.y + 5, B.z - (B.z - A.z) * 0.2), B);
    hierLinks.push(links.add({ curve, type: 'hierarchie', t0: it.t0 + 1.9, drawDur: 1.1, t1: 29.8, radius: 0.09, pulses: 3, speed: 0.4 }));
  });
  items.forEach((it, i) => {
    const j = (i + 1) % 7;
    const pa = funcPos(i), pb = funcPos(j);
    const ya = items[i].tower.height + 2.4, yb = items[j].tower.height + 2.4;
    const A = new THREE.Vector3(pa.x, ya, pa.z), B = new THREE.Vector3(pb.x, yb, pb.z);
    const mid = A.clone().add(B).multiplyScalar(0.5); mid.y += 5.5; mid.multiplyScalar(1); const c = mid.clone(); c.x *= 0.78; c.z *= 0.78;
    const curve = new THREE.QuadraticBezierCurve3(A, c, B);
    coordLinks.push(links.add({ curve, type: 'coordination', t0: 23.0 + i * 0.28, drawDur: 0.9, t1: 29.8, radius: 0.07, pulses: 2, speed: 0.55, dash: 0.9 }));
  });

  // Étiquettes
  const hub = new THREE.Vector3(0, 6, 0);
  items.forEach((it) => {
    const p = funcPos(it.i);
    labels.add({
      kind: 'card', title: it.f.label, sub: it.f.sub, color: it.f.accent === C.grey2 ? C.grey1 : it.f.accent,
      anchor: new THREE.Vector3(p.x, it.tower.height + 0.2, p.z), radial: { center: hub, len: 120, sy: 0.85, oy: -34 },
      t0: it.t0 + 1.4, t1: 29.0, align: 'center', scale: 0.82,
    });
  });

  function update(t) {
    const out = seg(t, 31.0, 32.4, (x) => x * x);
    const gs = Math.max(0.0001, 1 - out);
    platform.scale.set(gs, 1, gs); road.scale.set(gs, 1, gs); roadLine.scale.set(gs, 1, gs); paving.scale.set(gs, 1, gs);
    poles.scale.set(gs, 1, gs); heads.scale.set(gs, 1, gs);
    group.visible = out < 0.999;
    for (const it of items) {
      const collapse = 1 - seg(t, 29.6 + it.i * 0.16, 30.9 + it.i * 0.16, easeInOutCubic);
      const p = seg(t, it.t0, it.t0 + PL_T.buildDur, easeInOutCubic) * collapse;
      it.g.visible = p > 0.001;
      it.tower.build(p);
      const ip = easeOutBack(clamp((t - (it.t0 + PL_T.buildDur - 0.1)) / 0.6), 1.8);
      it.icon.group.scale.setScalar(Math.max(0.0001, ip * it.icon.big * collapse)); it.icon.group.visible = ip > 0.001; it.icon.update(t);
      const pp = easeOutBack(clamp((t - (it.t0 + 0.55)) / 0.6), 1.4);
      it.pod.scale.setScalar(Math.max(0.0001, pp * collapse)); it.pod.visible = pp * collapse > 0.001;
      for (const a of it.desks) a.update(t);
      const pl = easeOutCubic(clamp((t - it.t0 + 0.4) / 0.5));
      it.plinth.scale.set(Math.max(0.001, pl), 1, Math.max(0.001, pl)); it.edge.scale.set(Math.max(0.001, pl), 0.5, Math.max(0.001, pl));
    }
    for (const w of walkers) w.update(t);
    for (const c of cars) {
      const a = c.a0 + c.w * t;
      c.car.position.set(Math.cos(a) * c.r, 0.02, Math.sin(a) * c.r);
      const sg = Math.sign(c.w); c.car.rotation.y = Math.atan2(-sg * Math.cos(a), -sg * Math.sin(a));
    }
  }
  return { group, update, items };
}
