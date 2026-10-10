// SCÈNE 2 — Tesla : posséder une partie d'une entreprise.
import * as THREE from "three";
import { applyBuild } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { Platform, makeGigafactory } from "../components/buildings.js";
import { CarFleet, RobotArm, Crane } from "../components/vehicles.js";
import { Figure, POSES, blend, idle, walk, frantic } from "../components/figure.js";
import { Mosaic, makeShareBlock, makePadlock } from "../components/finance.js";
import { ease, inv, clamp, lerp, track, TAU, rng } from "../core/util.js";
import { seg, SC, when, whenEnd } from "../timing.js";
import { POS } from "../layout.js";

export const T2 = {
  t0: SC.s2.t0,
  t1: SC.s2.t1,
  build0: SC.s2.t0 + 0.1,
  build1: SC.s2.t0 + 2.3,
  grid: when("s2a", "petite part") - 0.1,
  cap: when("s2a", "capitalisation") - 0.15,
  eleven: when("s2b", "onze pour cent") - 0.3,
  formula: when("s2b", "Sa participation") - 0.2,
  up: when("s2b", "le cours monte") - 0.1,
  down: when("s2b", "il baisse") - 0.15,
  restr: when("s2c", "restreintes") - 0.35,
  opts: when("s2c", "options") - 0.4,
  hero: when("s2c", "options") + 0.4,
  end: SC.s2.t1,
};

export function buildTesla(ctx) {
  const { world, hud, facts } = ctx;
  const root = new THREE.Group();
  root.position.copy(POS.tesla);
  world.add(root);

  const platform = new Platform(66, 66, { accent: C.blue });
  root.add(platform.group);

  // --- usine ---------------------------------------------------------------
  const factory = makeGigafactory({ label: "TESLA" });
  factory.position.set(0, 0.3, -6);
  root.add(factory);

  const cranes = [new Crane({ height: 30, jib: 20 }).place(-31, 0.3, -20), new Crane({ height: 26, jib: 17 }).place(30, 0.3, -22)];
  cranes.forEach((c, i) => { c.group.rotation.y = i ? 2.4 : 0.4; root.add(c.group); });

  // --- robots (chaîne d'assemblage devant les portes) ------------------------
  const arms = [];
  for (let i = 0; i < 6; i++) {
    const a = new RobotArm({ scale: 0.95 }).place(-18 + i * 7.2, 0.3, 17.6, Math.PI);
    root.add(a.group);
    arms.push(a);
  }

  // --- voitures : route en boucle + parking ------------------------------------
  const loop = new THREE.CatmullRomCurve3(
    [[-26, 0.3, 24], [26, 0.3, 24], [33, 0.3, 28.5], [26, 0.3, 33], [-26, 0.3, 33], [-33, 0.3, 28.5]].map((p) => new THREE.Vector3(...p)),
    true, "centripetal", 0.4
  );
  const fleet = new CarFleet(10, { colors: [0xf2f5fa, 0xd9202f, 0x1d5fe0, 0x14171d, 0xcfd6e2], seed: 5 });
  root.add(fleet.group);
  const parked = new CarFleet(14, { colors: [0xf2f5fa, 0x14171d, 0x1d5fe0, 0xd9202f], seed: 9 });
  root.add(parked.group);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(76, 13), new THREE.MeshLambertMaterial({ color: 0x151b28 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.34, 28.5);
  root.add(road);
  for (let i = 0; i < 12; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.blueHi).multiplyScalar(0.9) }));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-33 + i * 6, 0.36, 28.5);
    root.add(dash);
  }

  // --- ouvriers ---------------------------------------------------------------------
  const workers = [];
  for (let i = 0; i < 7; i++) {
    const w = new Figure({ scale: 1.0, shirt: i % 2 ? 0xffb81c : 0xeef2f8, pants: 0x232b3d, hardhat: i % 2 ? 0xffffff : 0xffb81c, vest: 0xff8a3d });
    w.root.position.set(-22 + i * 7, 0.3, 21.2);
    root.add(w.root);
    workers.push(w);
  }

  // --- Musk (mini) --------------------------------------------------------------------
  const musk = new Figure({ scale: 1.9, shirt: 0x14161c, jacket: 0x0d0f14, pants: 0x1b2030, shoe: 0x090a0e });
  musk.place(20, 0.3, 14.5, -0.6);
  root.add(musk.root);

  // --- mosaïque de 100 actions (flotte au-dessus de l'usine) ---------------------------
  const GRID_Y = 27;
  const CELL = 2.3;
  const mosaic = new Mosaic(10, 10, { cell: CELL, size: 1.95, material: new THREE.MeshLambertMaterial({ color: 0xffffff }) });
  mosaic.mesh.position.set(0, GRID_Y, -6);
  root.add(mosaic.mesh);
  // dalle lumineuse sous la mosaïque
  const pad = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.35, 24.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.blue).multiplyScalar(0.8), transparent: true, opacity: 0.35 }));
  pad.position.set(0, GRID_Y - 0.4, -6);
  root.add(pad);
  // faisceau entre l'usine et la mosaïque
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(11, 15, GRID_Y - 12, 4, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.blue).multiplyScalar(0.7), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(0, 12 + (GRID_Y - 12) / 2, -6);
  beam.rotation.y = Math.PI / 4;
  root.add(beam);

  const R = rng(17);
  const order = Array.from({ length: 100 }, (_, i) => i).sort(() => R() - 0.5);
  const rank = new Array(100);
  order.forEach((idx, r) => (rank[idx] = r));
  // 11 blocs de Musk : bloc de 4×3 moins 1 (coin bas gauche)
  const mine = new Set();
  [[0, 7], [1, 7], [2, 7], [0, 8], [1, 8], [2, 8], [3, 8], [0, 9], [1, 9], [2, 9], [3, 9]].forEach(([c, r]) => mine.add(r * 10 + c));
  const blue = [0x24467f, 0x2c5aa6, 0x3669bd, 0x2a4f93];
  const price = track([[T2.t0, 1], [T2.up, 1], [T2.up + 1.5, 1.55, ease.io3], [T2.down - 0.1, 1.55], [T2.down + 1.5, 0.55, ease.io3], [T2.restr - 0.1, 0.55], [T2.restr + 1.2, 1, ease.io3]]);

  // --- actions restreintes (cadenas) et options (filaires) -------------------------------
  const restr = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(0.9), transparent: true, opacity: 0.4 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(1.6) }));
    const lock = makePadlock(0.55);
    lock.position.set(0, 0, 0.9);
    g.add(cube, edges, lock);
    g.position.set(19 + (i % 2) * 2.8, GRID_Y + 1.0 + Math.floor(i / 2) * 2.8, -6 - 5);
    root.add(g);
    restr.push(g);
  }
  const opts = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.8) }));
    const ghost = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(0.5), transparent: true, opacity: 0.12 }));
    g.add(edges, ghost);
    g.position.set(19 + i * 2.8, GRID_Y + 1.0, -6 + 5);
    root.add(g);
    opts.push(g);
  }

  // --- action « héros » qui deviendra une fusée à la scène 3 ------------------------------------
  const hero = makeShareBlock("TESLA", { accent: "#58b4ff", scale: 1.5 });
  hero.position.set(0, 21, 17);
  root.add(hero);

  // --- caméra --------------------------------------------------------------------------------------
  const cx = POS.tesla.x, cz = POS.tesla.z;
  const cam = [
    { t: T2.t0 + 0.0, x: cx + 4, y: 11, z: cz - 8, az: 44, el: 33, zoom: 7.5, e: "io3" },
    { t: T2.t0 + 1.4, x: cx, y: 12, z: cz + 1, az: 46, el: 34, zoom: 1.12, e: "io3" },
    { t: T2.grid + 1.8, x: cx, y: 17, z: cz - 3, az: 46, el: 36, zoom: 1.0, e: "io3" },
    { t: T2.eleven - 0.3, x: cx, y: 18, z: cz - 3, az: 48, el: 36, zoom: 1.0, e: "io3" },
    { t: T2.eleven + 1.2, x: cx - 5, y: 22, z: cz + 1, az: 40, el: 37, zoom: 1.32, e: "io3" },
    { t: T2.formula + 0.6, x: cx - 1, y: 20, z: cz - 2, az: 44, el: 37, zoom: 1.12, e: "io3" },
    { t: T2.restr - 0.2, x: cx + 3, y: 21, z: cz - 3, az: 50, el: 36, zoom: 1.12, e: "io3" },
    { t: T2.restr + 1.6, x: cx + 9, y: 24, z: cz - 3, az: 58, el: 35, zoom: 1.38, e: "io3" },
    { t: T2.hero - 0.2, x: cx + 5, y: 21, z: cz + 3, az: 52, el: 33, zoom: 1.25, e: "io3" },
    { t: T2.end, x: cx + 2, y: 21, z: cz + 8, az: 46, el: 30, zoom: 1.4, e: "io3" },
  ];

  // --- HUD ----------------------------------------------------------------------------------------------
  const gridAnchor = () => new THREE.Vector3(POS.tesla.x, GRID_Y + 3, POS.tesla.z - 6);
  hud.card({
    id: "s2-grid", cls: "tag", t0: T2.grid + 0.6, t1: T2.formula + 0.4, enter: "up",
    anchor: () => new THREE.Vector3(POS.tesla.x + 4.5 * CELL, GRID_Y + 1.5, POS.tesla.z - 6 - 4.5 * CELL), offset: [190, -10],
    html: `<b>100 blocs</b> = 100 % des actions<br><span>(illustration)</span>`,
  });
  hud.card({
    id: "s2-cap", cls: "formula small", t0: T2.cap, t1: T2.formula + 0.2, x: 56, y: 270, align: "left", enter: "right",
    html: `<em>Capitalisation boursière</em><br>= Nombre total d'actions × Prix de l'action`,
  });
  hud.card({
    id: "s2-eleven", cls: "tag gold", t0: T2.eleven, t1: T2.opts - 0.3, enter: "scale",
    anchor: () => new THREE.Vector3(POS.tesla.x - 3 * CELL, GRID_Y + 3.4, POS.tesla.z - 6 + 3.5 * CELL), offset: [-240, -40],
    html: `<b>Elon Musk ≈ 11 %</b><br><span>11 blocs sur 100 · estimation Forbes (oct. 2026)</span>`,
  });
  hud.card({
    id: "s2-formula", cls: "formula", t0: T2.formula, t1: T2.restr + 0.6, x: 960, y: 178, enter: "down",
    html: `<em>Valeur théorique de la participation</em><br><strong>= Nombre d'actions <i>×</i> Prix de l'action</strong>`,
  });
  hud.card({
    id: "s2-up", cls: "arrow up", t0: T2.up + 0.2, t1: T2.down - 0.2, x: 1560, y: 400, enter: "scale",
    html: `▲ cours<br><span>participation ▲</span>`,
  });
  hud.card({
    id: "s2-down", cls: "arrow down", t0: T2.down + 0.1, t1: T2.down + 2.2, x: 1560, y: 400, enter: "scale",
    html: `▼ cours<br><span>participation ▼</span>`,
  });
  hud.card({
    id: "s2-held", cls: "tag gold", t0: T2.restr - 0.6, t1: T2.end - 0.6, enter: "right",
    anchor: () => new THREE.Vector3(POS.tesla.x - 3 * CELL, GRID_Y + 1.0, POS.tesla.z - 6 + 3.5 * CELL), offset: [-240, 62],
    html: `<b>Détenues</b><br><span>actions que Musk possède</span>`,
  });
  hud.card({
    id: "s2-restr", cls: "tag amber", t0: T2.restr, t1: T2.end - 0.5, enter: "left",
    anchor: () => new THREE.Vector3(POS.tesla.x + 20, GRID_Y + 3, POS.tesla.z - 11), offset: [210, -40],
    html: `<b>🔒 Restreintes</b><br><span>423,7 M d'actions du plan 2025, sous accord de vote : ni libre cession, ni vote</span>`,
  });
  hud.card({
    id: "s2-opts", cls: "tag cyan", t0: T2.opts, t1: T2.end - 0.5, enter: "left",
    anchor: () => new THREE.Vector3(POS.tesla.x + 20, GRID_Y + 1, POS.tesla.z - 1), offset: [200, 70],
    html: `<b>Options</b><br><span>plan 2018 : 303,96 M, exercées à 23,34 $ en juin 2026</span>`,
  });

  // --- mise à jour ------------------------------------------------------------------------------------------
  const update = (t) => {
    const inRange = t < T2.end + 1.0;
    const heroOn = t < T2.end - 0.05;
    const pw = ease.out2(inv(T2.t0, T2.t0 + 1.5, t));
    platform.setPower(pw);
    const bp = ease.io2(inv(T2.build0, T2.build1, t));
    applyBuild(factory, bp, { overlap: 0.4, dropHeight: 40 });
    cranes.forEach((c, i) => {
      c.group.visible = true;
      c.update(t, i * 2, bp < 0.98 ? 1 : 0);
      c.group.scale.y = Math.max(0.001, ease.out3(inv(T2.t0 - 1, T2.t0 + 1.4 + i * 0.4, t)));
    });
    arms.forEach((a, i) => {
      a.group.visible = bp > 0.75;
      a.update(t, i * 1.3, 1.2);
    });
    const carVis = ease.out2(inv(T2.build1 - 0.6, T2.build1 + 0.8, t));
    fleet.update((i) => {
      const u = ((i / fleet.n) + t * 0.035) % 1;
      const p = loop.getPointAt(u), tg = loop.getTangentAt(u);
      return { x: p.x, y: p.y, z: p.z, ry: Math.atan2(-tg.z, tg.x), dist: t * 0.035 * loop.getLength(), vis: carVis * clamp((t - T2.build1 - i * 0.12) * 3) };
    });
    parked.update((i) => ({ x: -30 + (i % 14) * 4.6, y: 0.3, z: 38.5 + (i % 2) * 0.2, ry: Math.PI / 2 + (i % 3 === 0 ? 0.05 : 0), dist: 0, vis: carVis * clamp((t - T2.build1 - 0.4 - i * 0.05) * 3) }));

    workers.forEach((w, i) => {
      const A = 6.5, cxw = -20 + i * 6.6, sp = 0.28 + (i % 3) * 0.05;
      const ph = t * sp + i * 1.7;
      const dir = Math.cos(ph * TAU) >= 0 ? 1 : -1;
      const x = cxw + Math.sin(ph * TAU) * A * 0.5;
      w.root.position.x = x;
      w.root.position.z = 21.4 + (i % 2) * 0.6;
      w.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      w.apply(walk(t + i, 1.1));
      w.root.visible = bp > 0.85;
      w.root.scale.setScalar(1.0 * clamp((t - T2.build1 + 0.5) * 2));
    });

    // Musk
    const pointUp = ease.io3(inv(T2.eleven - 0.3, T2.eleven + 0.7, t)) * (1 - ease.io3(inv(T2.formula + 1.5, T2.formula + 2.5, t)));
    const pres = ease.io3(inv(T2.formula + 1.5, T2.formula + 2.4, t));
    let pose = blend(blend(POSES.stand, { ...POSES.point, shR: -2.3, shRz: 0.1, elR: -0.1 }, pointUp), POSES.presenting, pres * 0.6);
    pose = { ...pose, bob: idle(t).bob };
    musk.apply(pose);
    musk.root.visible = inRange && t > T2.build1 - 0.8;
    musk.root.scale.setScalar(1.9 * ease.outBack(clamp((t - (T2.build1 - 0.8)) * 1.6)));

    // mosaïque
    const gridK = inv(T2.grid, T2.grid + 1.6, t);
    const capGlow = ease.smooth(inv(T2.cap, T2.cap + 0.5, t)) * (1 - ease.smooth(inv(T2.cap + 1.8, T2.cap + 2.6, t)));
    const elevenK = ease.io3(inv(T2.eleven, T2.eleven + 0.9, t));
    const pr = price(t);
    const showGrid = inRange && gridK > 0;
    mosaic.mesh.visible = pad.visible = beam.visible = showGrid;
    pad.material.opacity = 0.35 * ease.out2(gridK);
    beam.material.opacity = 0.07 * ease.out2(gridK);
    mosaic.update((i, c, r) => {
      const k = ease.outBack(clamp((gridK * 1.6 - rank[i] / 100 * 0.6) / 1.0), 1.4);
      const mineK = mine.has(i) ? elevenK : 0;
      const col = new THREE.Color(blue[(c + r) % 4]);
      const gold = new THREE.Color(C.gold);
      col.lerp(gold, mineK);
      col.lerp(new THREE.Color(0xcfe6ff), capGlow * 0.6);
      const growth = mine.has(i) ? 1 + (pr - 1) * 1.15 : 1 + (pr - 1) * 0.65;
      return { s: k, sy: lerp(0.5, 1, 1) * Math.max(0.25, growth) * (1 + mineK * 0.9), y: mineK * 1.0, color: col.getHex() };
    });
    // restreintes & options
    restr.forEach((g, i) => {
      const k = ease.outBack(clamp((t - T2.restr - i * 0.12) * 2.4));
      g.visible = inRange && k > 0.01;
      g.scale.setScalar(Math.max(1e-3, k));
      g.rotation.y = t * 0.4 + i;
    });
    opts.forEach((g, i) => {
      const k = ease.outBack(clamp((t - T2.opts - i * 0.12) * 2.4));
      g.visible = inRange && k > 0.01;
      g.scale.setScalar(Math.max(1e-3, k));
      g.rotation.y = -t * 0.5 + i;
    });

    // action héros
    const hk = ease.outBack(clamp((t - T2.hero) * 1.6));
    hero.visible = heroOn && hk > 0.01;
    hero.scale.setScalar(Math.max(1e-3, 1.5 * hk));
    hero.rotation.y = Math.sin(t * 1.2) * 0.25 - 0.3;
    hero.position.y = 21 + Math.sin(t * 2) * 0.5;
  };

  world.register({ id: "tesla", windows: [[T2.t0, T2.end + 1.2], [SC.s7.t0, SC.s7.t1]], pad: 1.2, root, update });
  return { cam, T: T2, heroPos: new THREE.Vector3(0, 21, 17).add(POS.tesla) };
}
