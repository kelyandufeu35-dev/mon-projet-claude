import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { makeCharacter, Actor, OUTFIT } from '../components/character.js';
import { makeChair, rbox } from '../components/furniture.js';
import { REST } from '../components/restaurant.js';
import { R0, CITY_POS } from './city.js';

/* =========================================================================
 * INTÉRIEUR DU RESTAURANT — scène 5 : cinq niveaux de rôles, déplacements, lignes de supervision.
 * Les rôles et couleurs sont des illustrations (l'organisation exacte varie selon le pays et le restaurant).
 * ========================================================================= */
export const I_T = {
  crew: 62.2, f: 63.4, m: 65.5, a: 67.5, s: 69.4, e: 70.9,
  lf: 64.2, lm: 66.1, la: 68.0, ls: 69.9, note: 72.3, end: 74.6,
};
const Y = REST.FLOOR;

export function buildInterior(ctx, cityCtx) {
  const { links, labels } = ctx;
  const parent = cityCtx.group;
  const P = (x, z) => ({ x: R0.x + x, z: R0.z + z });           // local restaurant -> repère ville
  const mk = (spec) => makeCharacter(spec);
  const actors = {};
  const make = (key, spec, path, extra = {}) => {
    const ch = mk(spec); parent.add(ch.root);
    const a = new Actor(ch, { path: path.map((p) => ({ ...p, y: p.y ?? Y })), vanish: { t: 74.6, dur: 0.5 }, ...extra });
    actors[key] = a; return a;
  };
  const stat = (x, z, act, h = 0, appear = I_T.crew, phase = 0, spec) => (spec, [{ t: 0, ...P(x, z) }, { t: 120, ...P(x, z) }]);

  // — Équipiers polyvalents (7)
  const crewDefs = [
    ['c1', -5.2, -1.75, 'serve'], ['c2', -3.6, -1.75, 'serve'], ['c3', -2.0, -1.75, 'typeStand'],
    ['k1', -4.7, -3.75, 'stir'], ['k2', -2.4, -3.75, 'stir'], ['k3', 0.1, -3.75, 'typeStand'],
  ];
  crewDefs.forEach(([key, x, z, act], i) => {
    make(key, OUTFIT.crew(i + 1), [{ t: 0, ...P(x, z) }, { t: 120, ...P(x, z) }], {
      face: [{ t: 0, a: 0 }], acts: [{ t0: 0, t1: 999, act }], appear: { t: I_T.crew + 0.5 + i * 0.12, dur: 0.5 }, phase: i * 1.3,
    });
  });
  // coéquipier qui apporte un plateau en salle (marche en boucle)
  {
    const A = P(0.4, -0.2), B = P(-1.2, 1.2), D = P(-2.0, 1.0);
    const path = [{ t: 0, ...A }];
    let t = 62.6;
    path.push({ t, ...A });
    for (let k = 0; k < 6; k++) {
      path.push({ t: t + 2.6, ...B }); path.push({ t: t + 3.6, ...B });
      path.push({ t: t + 6.2, ...A }); path.push({ t: t + 7.2, ...A }); t += 7.2;
    }
    make('r1', OUTFIT.crew(8), path, { face: [{ t: 0, a: 0 }], acts: [{ t0: 62, t1: 999, act: 'carry' }], appear: { t: I_T.crew + 1.3, dur: 0.5 }, phase: 0.9 });
  }
  // — Managers de quart
  make('s1', OUTFIT.shift(0), (() => {
    const pts = [[-6.0, 0.35], [-4.0, 0.35], [-2.0, 0.35], [-0.4, 0.35]]; const p = []; let t = 62.4;
    p.push({ t: 0, ...P(...pts[0]) }); p.push({ t, ...P(...pts[0]) });
    for (let k = 0; k < 7; k++) { const a = pts[k % 2 ? 3 : 0], b = pts[k % 2 ? 0 : 3]; p.push({ t: t + 4.2, ...P(...b) }); p.push({ t: t + 5.4, ...P(...b) }); t += 5.4; }
    return p; })(), { face: [{ t: 0, a: 0 }], acts: Array.from({ length: 8 }, (_, k) => ({ t0: 66.6 + k * 5.4, t1: 67.8 + k * 5.4, act: 'point' })), appear: { t: I_T.s, dur: 0.5 }, phase: 0.6 });
  make('s2', OUTFIT.shift(2), (() => {
    const p = [{ t: 0, ...P(1.2, -1.95) }, { t: 62.4, ...P(1.2, -1.95) }]; let t = 62.4;
    const loop = [[2.7, -1.95], [2.7, -4.35], [-5.8, -4.4], [2.7, -4.35], [2.7, -1.95], [1.2, -1.95]];
    for (let r = 0; r < 3; r++) for (const [x, z] of loop) { const d = Math.hypot(x - (p[p.length - 1].x - R0.x), z - (p[p.length - 1].z - R0.z)); t += d / 1.2; p.push({ t, ...P(x, z) }); t += 0.3; p.push({ t, ...P(x, z) }); }
    return p; })(), { face: [{ t: 0, a: 0 }], acts: [], appear: { t: I_T.s + 0.2, dur: 0.5 }, phase: 1.9 });
  // — Responsables adjoints
  make('a1', OUTFIT.assistant(0), [{ t: 0, ...P(1.4, -1.75) }, { t: 120, ...P(1.4, -1.75) }], { face: [{ t: 0, a: 0 }], acts: [{ t0: 0, t1: 999, act: 'typeStand' }], appear: { t: I_T.a, dur: 0.5 }, phase: 0.2 });
  make('a2', OUTFIT.assistant(1), [{ t: 0, ...P(-6.1, -3.75) }, { t: 120, ...P(-6.1, -3.75) }], { face: [{ t: 0, a: 0 }], acts: [{ t0: 0, t1: 999, act: 'point' }], appear: { t: I_T.a + 0.2, dur: 0.5 }, phase: 1.1 });
  // — Clients (décor)
  [[-5.0, 1.25, 0, 'sitTalk', 0], [-5.0, 2.95, Math.PI, 'sitListen', 1], [0.15, 2.1, Math.PI / 2, 'sitTalk', 2], [-1.2, 3.1, Math.PI, 'sitListen', 3]].forEach(([x, z, h, act, i]) => {
    const chair = makeChair(i % 2 ? C.red : C.grey3); chair.position.set(R0.x + x - Math.sin(h) * 0.02, Y, R0.z + z - Math.cos(h) * 0.02); chair.rotation.y = h; parent.add(chair);
    make('v' + i, OUTFIT.visitor(i + 3), [{ t: 0, ...P(x, z) }, { t: 120, ...P(x, z) }], { face: [{ t: 0, a: h }], acts: [{ t0: 0, t1: 999, act }], appear: { t: I_T.crew + 0.2 + i * 0.1, dur: 0.5 }, phase: i * 2.3 });
  });

  // ---- lignes de supervision (suivent les personnages) ----
  const pos = (key, h = 1.35) => (t, out) => actors[key].anchor(out, h).add(CITY_POS);
  const fAct = cityCtx.franchisee, mAct = cityCtx.manager;
  const posA = (a, h = 1.35) => (t, out) => a.anchor(out, h).add(CITY_POS);
  const tF = (t, out) => fAct.anchor(out, 1.4).add(CITY_POS);
  const tM = (t, out) => mAct.anchor(out, 1.4).add(CITY_POS);
  const dyn = (a, b, t0) => links.addDynamic({ a, b, type: 'hierarchie', t0, drawDur: 0.7, t1: I_T.end + 0.8, radius: 0.016, pulses: 2, lift: 0.25 });
  dyn(tF, tM, I_T.lf);
  dyn(tM, pos('a1'), I_T.lm); dyn(tM, pos('a2'), I_T.lm + 0.15);
  dyn(pos('a1'), pos('s1'), I_T.la); dyn(pos('a2'), pos('s2'), I_T.la + 0.15);
  ['c1', 'c2', 'c3', 'r1'].forEach((k, i) => dyn(pos('s1'), pos(k), I_T.ls + i * 0.12));
  ['k1', 'k2', 'k3'].forEach((k, i) => dyn(pos('s2'), pos(k), I_T.ls + 0.1 + i * 0.12));

  // ---- étiquettes de rôles ----
  const lab = (title, sub, color, anchorFn, dx, dy, t0, align, num) => labels.add({ kind: 'card', title, sub, color, scale: 0.8, anchor: anchorFn, dx, dy, t0, t1: I_T.end, align, num });
  lab('Exploitant ou franchisé', 'Propriétaire indépendant', C.yellow, (t, v) => { fAct.anchor(v, 1.55).add(CITY_POS); return v; }, 150, -70, I_T.f, 'left', 'NIVEAU 1');
  lab('Responsable de restaurant', 'Dirige le restaurant au quotidien', C.red, (t, v) => { mAct.anchor(v, 1.55).add(CITY_POS); return v; }, 60, 150, I_T.m, 'left', 'NIVEAU 2');
  lab('Responsables adjoints', 'Selon l’organisation locale', 0xffffff, (t, v) => { actors.a1.anchor(v, 1.5).add(CITY_POS); return v; }, 180, -40, I_T.a, 'left', 'NIVEAU 3');
  lab('Managers de quart', 'Encadrent l’équipe en service', C.yellow, (t, v) => { actors.s1.anchor(v, 1.5).add(CITY_POS); return v; }, -170, 130, I_T.s, 'right', 'NIVEAU 4');
  lab('Équipiers polyvalents', 'Accueil, cuisine, salle', C.red, (t, v) => { actors.c2.anchor(v, 1.5).add(CITY_POS); return v; }, -200, -110, I_T.e, 'right', 'NIVEAU 5');

  function update(t) {
    if (t < 59) return;
    for (const k in actors) actors[k].update(t);
  }
  return { update, actors };
}
