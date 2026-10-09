import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { M, std } from '../engine/materials.js';
import { rbox, cyl, makeChair, makeTable, makeDesk, makePlant } from '../components/furniture.js';
import { makeTower, makeArches } from '../components/building.js';
import { makeCharacter, Actor, OUTFIT } from '../components/character.js';
import { seg, smooth, smoother, easeOutCubic, easeInOutCubic, clamp, lerp, window01 } from '../util/math.js';

/* =========================================================================
 * SIÈGE MONDIAL — tour, étage de direction, toit qui s'ouvre, salle du conseil.
 * ========================================================================= */
export const HQ_T = {
  build0: 0.2, build1: 3.0,        // la tour se construit
  roof0: 5.9, roof1: 8.2,          // le toit s'ouvre
  seat0: 7.2,                      // les personnages apparaissent (jusqu'à ~8.6)
  close0: 15.2, close1: 17.0,      // le toit se referme (début scène 2)
};

export function buildHQ(ctx) {
  const { scene, links, labels } = ctx;
  const group = new THREE.Group(); group.name = 'hq'; scene.add(group);

  const tower = makeTower({
    w: 9, d: 9, floors: 13, fh: 1.35, wall: C.white, glass: C.glass, seed: 5, fins: C.red,
    bands: { at: [4, 8], color: C.red }, base: { w: 15, d: 15, h: 1.5, color: C.white },
  });
  group.add(tower.group);
  const yTop = tower.height;                     // sol de l'étage de direction
  const EXEC_H = 3.3;
  const exec = new THREE.Group(); exec.position.y = yTop; group.add(exec);

  // Dalle + plancher de la salle
  const slab = rbox(9.4, 0.22, 9.4, M.paper(), { r: 0.06 }); exec.add(slab);
  const floor = rbox(8.7, 0.08, 8.7, std(0x8a8d95, { rough: 0.6 }), { r: 0.02 }); floor.position.y = 0.22; exec.add(floor);
  const carpet = rbox(5.6, 0.02, 3.2, std(C.grey4, { rough: 0.95 }), { r: 0.01 }); carpet.position.set(0, 0.3, 0.9); exec.add(carpet);

  // Parois vitrées (4). Les deux parois avant s'abaissent à l'ouverture.
  const wallH = EXEC_H, wallT = 0.22, half = 4.5;
  const mkWall = (len) => {
    const g = new THREE.Group();
    const low = rbox(len, 0.9, wallT, M.white(), { r: 0.04 }); g.add(low);
    const glass = rbox(len - 0.1, wallH - 0.95, wallT * 0.5, M.glass(), { r: 0.03 }); glass.position.y = 0.95; g.add(glass);
    const post = (x) => { const p = rbox(0.2, wallH, 0.26, M.white(), { r: 0.04 }); p.position.x = x; g.add(p); };
    post(-len / 2 + 0.1); post(len / 2 - 0.1); post(0);
    const top = rbox(len, 0.12, 0.3, M.red(), { r: 0.03 }); top.position.y = wallH - 0.06; g.add(top);
    return g;
  };
  const wBack = mkWall(9.2); wBack.position.set(0, 0.22, -half + 0.1); exec.add(wBack);
  const wLeft = mkWall(9.2); wLeft.rotation.y = Math.PI / 2; wLeft.position.set(-half + 0.1, 0.22, 0); exec.add(wLeft);
  const wFront = mkWall(9.2); wFront.position.set(0, 0.22, half - 0.1); exec.add(wFront);
  const wRight = mkWall(9.2); wRight.rotation.y = Math.PI / 2; wRight.position.set(half - 0.1, 0.22, 0); exec.add(wRight);

  // Toit en deux moitiés
  const roofA = new THREE.Group(), roofB = new THREE.Group();
  for (const [r, sx] of [[roofA, -1], [roofB, 1]]) {
    const slabR = rbox(4.75, 0.34, 9.6, M.white(), { r: 0.08 }); slabR.position.x = sx * 2.4; r.add(slabR);
    const edge = rbox(4.78, 0.1, 9.64, M.red(), { r: 0.03 });
    edge.scale.set(0.98, 1, 0.98); edge.position.set(sx * 2.4, 0.3, 0); r.add(edge);
    const eq = rbox(1.2, 0.5, 1.0, M.grey1(), { r: 0.06 }); eq.position.set(sx * 2.4, 0.34, sx * 1.8); r.add(eq);
    r.position.y = EXEC_H + 0.22; exec.add(r);
  }
  const pistons = [];
  for (const [x, z] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) {
    const p = cyl(0.09, 0.09, 1, M.grey2(), 8); p.position.set(x, 0.22, z); p.scale.y = EXEC_H; exec.add(p); pistons.push(p);
  }

  // Arches dorées sur le podium (repère de marque), côté caméra
  const arches = makeArches({ size: 3.1 }); arches.position.set(5.2, 1.5, 6.4); arches.rotation.y = 0.0; group.add(arches);
  const archPlinth = rbox(5.2, 0.18, 1.1, M.white(), { r: 0.05 }); archPlinth.position.set(5.2, 1.5, 6.4); group.add(archPlinth);
  arches.position.y = 1.68;

  // Fond de salle : écran + plantes
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x15161a, emissive: C.red, emissiveIntensity: 0.55 }));
  screen.position.set(0, 2.15, -half + 0.28); exec.add(screen);
  const sArch = makeArches({ size: 0.9 }); sArch.position.set(0, 1.6, -half + 0.32); sArch.scale.z = 0.3; exec.add(sArch);
  const plantA = makePlant(1.6); plantA.position.set(-3.9, 0.3, 3.6); exec.add(plantA);
  const plantB = makePlant(1.6); plantB.position.set(3.9, 0.3, -3.6); exec.add(plantB);

  // Mobilier : estrade du conseil, bureau, table de direction
  const dais = rbox(8.4, 0.3, 2.0, std(C.grey3, { rough: 0.7 }), { r: 0.06 }); dais.position.set(0, 0.3, -3.35); exec.add(dais);
  const bench = rbox(7.6, 0.2, 0.6, M.white(), { r: 0.05 }); bench.position.set(0, 0.6, -2.75); exec.add(bench);
  const benchLeg = rbox(7.4, 0.3, 0.5, M.grey3(), { r: 0.04 }); benchLeg.position.set(0, 0.3, -2.75); exec.add(benchLeg);
  const table = makeTable({ w: 4.8, d: 2.0, h: 0.55, round: true }); table.position.set(0, 0.3, 0.9); exec.add(table);

  // Personnages
  const seatY = (y) => y + 0.3; // hauteur des sols locaux
  const actors = [];
  const addSeated = (spec, x, z, heading, y, act, appearT, phase, tag) => {
    const chair = makeChair(spec.scale > 1.05 ? C.red : C.grey3, 0.17);
    chair.position.set(x - Math.sin(heading) * 0.06, y, z - Math.cos(heading) * 0.06); chair.rotation.y = heading; exec.add(chair);
    const ch = makeCharacter(spec);
    exec.add(ch.root);
    const a = new Actor(ch, {
      path: [{ t: 0, x, z, y }], face: [{ t: 0, a: heading }],
      acts: [{ t0: 0, t1: 999, act }], appear: { t: appearT, dur: 0.6 }, phase, tags: { tag },
    });
    // les acteurs vivent dans le repère « exec » : on suit leur transform
    actors.push(a);
    ch.root.userData.tag = tag;
    return a;
  };
  const S0 = HQ_T.seat0;
  const board = [], execs = [];
  [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0].forEach((x, i) => {
    board.push(addSeated(OUTFIT.board(i), x, -3.55, 0, 0.3, i % 2 ? 'sitListen' : 'sitTalk', S0 + i * 0.09, i * 1.3, 'board'));
  });
  const ceo = addSeated(OUTFIT.ceo(), 0, -0.45, 0, 0.3, 'sitTalk', S0 + 0.7, 0.4, 'ceo');
  execs.push(ceo);
  [[-1.65, -0.35, 0], [1.65, -0.35, 0], [-0.9, 2.2, Math.PI], [1.0, 2.2, Math.PI], [3.35, 0.9, -Math.PI / 2]].forEach(([x, z, h], i) => {
    execs.push(addSeated(OUTFIT.exec(i), x, z, h, 0.3, i % 2 ? 'sitListen' : 'sitTalk', S0 + 0.8 + i * 0.1, 2 + i * 0.9, 'exec'));
  });
  // documents sur la table (petits rectangles)
  for (let i = 0; i < 5; i++) {
    const doc = rbox(0.34, 0.012, 0.24, M.paper(), { r: 0.004 }); doc.position.set(-1.6 + i * 0.8, 0.86, 0.9 + (i % 2 ? 0.35 : -0.35)); doc.rotation.y = i * 0.5; exec.add(doc);
  }

  // Étiquettes 3D (noms de FONCTIONS uniquement)
  const boardAnchor = (t, v) => v.set(0, yTop + 0.3 + 1.5, -3.55);
  const ceoAnchor = (t, v) => v.set(0, yTop + 0.3 + 1.55, -0.45);
  const execAnchor = (t, v) => v.set(2.6, yTop + 0.3 + 1.3, 1.4);
  ctx.hq = { group, tower, exec, yTop, actors, board, execs, ceo, arches };

  // Liens de gouvernance / hiérarchie
  const A = new THREE.Vector3(0, yTop + 2.2, -3.55), B = new THREE.Vector3(0, yTop + 2.0, -0.45);
  const curveGov = new THREE.QuadraticBezierCurve3(A, new THREE.Vector3(1.2, yTop + 3.2, -2.0), B);
  links.add({ curve: curveGov, type: 'gouvernance', t0: 9.2, drawDur: 1.0, t1: 16.2, radius: 0.03, pulses: 2, speed: 0.4 });
  const execPts = [[-1.65, -0.35], [1.65, -0.35], [-0.9, 2.2], [1.0, 2.2], [3.35, 0.9]];
  execPts.forEach(([x, z], i) => {
    const E = new THREE.Vector3(x, yTop + 1.75, z);
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, yTop + 2.0, -0.45), new THREE.Vector3((x) / 2, yTop + 2.9, (z - 0.45) / 2), E);
    links.add({ curve: c, type: 'hierarchie', t0: 11.0 + i * 0.12, drawDur: 0.8, t1: 16.2, radius: 0.028, pulses: 2, speed: 0.5 });
  });

  const tags = ctx.labels;
  tags.add({ kind: 'card', title: 'Conseil d’administration', sub: 'Supervise la gouvernance', color: 0xffffff, anchor: boardAnchor, dx: -300, dy: -110, t0: 8.9, t1: 14.6, align: 'right' });
  tags.add({ kind: 'card', title: 'Directeur général (PDG)', sub: 'Pilote l’entreprise', color: C.red, anchor: ceoAnchor, dx: 270, dy: -150, t0: 10.6, t1: 14.6, align: 'left' });
  tags.add({ kind: 'card', title: 'Équipe de direction générale', sub: 'Dirigeants exécutifs · pilotent l’activité', color: C.yellow, anchor: execAnchor, dx: 230, dy: 90, t0: 12.0, t1: 14.6, align: 'left' });

  function update(t) {
    // — construction de la tour
    tower.build(seg(t, HQ_T.build0, HQ_T.build1, easeInOutCubic));
    const built = t > HQ_T.build0 + 0.01;
    exec.visible = tower.group.visible = built;
    const ep = seg(t, HQ_T.build1 - 0.5, HQ_T.build1 + 0.4, easeOutCubic);
    exec.scale.y = Math.max(0.001, ep); exec.visible = ep > 0.001;
    arches.scale.setScalar(Math.max(0.001, seg(t, 1.8, 3.2, (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2))));

    // — ouverture : toit (lever puis glisser), parois avant s'abaissent
    const open = seg(t, HQ_T.roof0, HQ_T.roof1, smoother);
    const close = seg(t, HQ_T.close0, HQ_T.close1, smoother);
    const o = open * (1 - close);
    const lift = smooth(clamp(o / 0.4)), slide = smooth(clamp((o - 0.3) / 0.7));
    // le toit se soulève sur ses vérins, s'écarte puis s'envole hors champ
    const fly = smooth(clamp((o - 0.45) / 0.55));
    const ry = EXEC_H + 0.22 + lift * 1.4 + fly * 34;
    roofA.position.set(-slide * 3.2 - fly * 4, ry, 0); roofB.position.set(slide * 3.2 + fly * 4, ry, 0);
    roofA.rotation.z = slide * 0.14; roofB.rotation.z = -slide * 0.14;
    pistons.forEach((p) => { p.scale.y = Math.max(0.01, EXEC_H + lift * 1.4); p.visible = o < 0.55; });
    const drop = smooth(clamp((o - 0.15) / 0.6));
    wFront.scale.y = wRight.scale.y = lerp(1, 0.1, drop);
    // ouverture : on masque aussi les montants hauts pour ne rien cacher
    const sy = 0.0;
    exec.children.forEach(() => {});
    for (const a of actors) a.update(t);
    // l'estrade/plateau restent solides
    screen.material.emissiveIntensity = 0.4 + Math.sin(t * 1.6) * 0.12;
    sArch.rotation.y = Math.sin(t * 0.9) * 0.2;
    arches.rotation.y = Math.sin(t * 0.7) * 0.18;
  }
  return { group, update, actors };
}
