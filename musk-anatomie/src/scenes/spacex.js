// SCÈNE 3 — SpaceX et l'intelligence artificielle : l'action Tesla devient une fusée, vol jusqu'à SpaceX,
// fusion avec xAI (2 fév. 2026), IPO (12 juin 2026), puis trois notions de valeur à ne pas confondre.
import * as THREE from "three";
import { applyBuild } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { Platform, makeLaunchTower, makeChopsticks, makeHangar, makeLab, makeDish, DataCenter, NeuralNet, Constellation } from "../components/buildings.js";
import { Rocket, makeFlame } from "../components/vehicles.js";
import { VoxelMorph, Shapes, Burst, SmokeTrail } from "../components/fx.js";
import { Figure, walk, idle } from "../components/figure.js";
import { makeShareBlock } from "../components/finance.js";
import { ease, inv, clamp, lerp, TAU } from "../core/util.js";
import { SC, when } from "../timing.js";
import { POS } from "../layout.js";
import { T2 } from "./tesla.js";

export const T3 = {
  t0: SC.s3.t0,
  t1: SC.s3.t1,
  morph: SC.s3.t0 + 0.15,
  ignite: SC.s3.t0 + 0.95,
  fly0: SC.s3.t0 + 1.25,
  fly1: SC.s3.t0 + 3.05,
  merge: when("s3b", "absorbé") - 0.6,
  ipo: when("s3b", "entrée en Bourse") - 0.2,
  liftoff: when("s3b", "entrée en Bourse") + 0.2,
  once: when("s3b", "Participation") - 0.1,
  ev: when("s3c", "Valeur d'entreprise") - 0.1,
  cap: when("s3c", "capitalisation") - 0.1,
  share: when("s3c", "part personnelle") - 0.2,
  end: SC.s3.t1,
};

export function buildSpacex(ctx) {
  const { world, hud } = ctx;
  const root = new THREE.Group();
  root.position.copy(POS.spacex);
  world.add(root);

  const platform = new Platform(66, 66, { accent: C.cyan });
  root.add(platform.group);

  // --- complexe de lancement ------------------------------------------------------------------------
  const PAD = new THREE.Vector3(-14, 0.3, 8);
  const tower = makeLaunchTower({ height: 44 });
  tower.position.copy(PAD);
  root.add(tower);
  const chop = makeChopsticks(PAD.x + tower.userData.towerX, PAD.y + 30);
  root.add(chop);
  const padTop = new THREE.Vector3(PAD.x, PAD.y + 2.3, PAD.z);

  // --- bâtiments ----------------------------------------------------------------------------------------
  const hangar = makeHangar({ len: 26, r: 8 });
  hangar.position.set(14, 0.3, 24);
  root.add(hangar);
  const labs = [makeLab({ w: 10, d: 8, h: 8 }), makeLab({ w: 9, d: 8, h: 11 })];
  labs[0].position.set(-24, 0.3, -13);
  labs[1].position.set(-24, 0.3, -25);
  labs.forEach((l) => root.add(l));
  const dc = new DataCenter();
  dc.group.position.set(6, 0.3, -18);
  root.add(dc.group);
  const dishes = [];
  for (let i = 0; i < 4; i++) {
    const d = makeDish(1.0);
    d.position.set(22 + (i % 2) * 5, 0.3, -4 - Math.floor(i / 2) * 7);
    d.rotation.y = -0.8 + i * 0.2;
    root.add(d);
    dishes.push(d);
  }

  // --- constellation + réseau neuronal -----------------------------------------------------------------------
  const constel = new Constellation({ radius: 5.2, orbit: 12.5, perRing: 8 });
  constel.group.position.set(8, 38, 2);
  root.add(constel.group);
  const brain = new NeuralNet({ layers: [4, 6, 6, 3], spacing: 4, gap: 2.1 });
  brain.group.position.set(6, 21, -18);
  brain.group.scale.setScalar(1.15);
  brain.group.rotation.y = 0.78;
  root.add(brain.group);
  const brainLabel = new THREE.Mesh(
    new THREE.CircleGeometry(0.01, 4), new THREE.MeshBasicMaterial({ visible: false })
  );
  root.add(brainLabel);

  // --- vraie fusée sur le pas de tir ----------------------------------------------------------------------------
  const rocket = new Rocket({ scale: 1.15 });
  rocket.group.position.copy(padTop);
  root.add(rocket.group);

  // --- fusée voxel (morph action -> fusée) + vol ---------------------------------------------------------------
  const heroLocal = new THREE.Vector3(0, 21, 17).add(POS.tesla).sub(POS.spacex); // position de l'action de la scène 2, en local SpaceX
  const vs = 0.62;
  const shareVox = Shapes.place(Shapes.share(vs, { w: 9.2, h: 5.6, face: 0x10244f }), [0, -2.8, 0], 0);
  const rocketVox = Shapes.place(Shapes.rocket(1.0, { radius: 2.3, height: 29, base: [0, 0, 0] }), [0, -2.8, 0], 0);
  const N = 700;
  const vox = new VoxelMorph(N, [shareVox, rocketVox], { seed: 8, arc: 4, spin: 2.0, material: new THREE.MeshLambertMaterial({ color: 0xffffff }) });
  const voxGroup = new THREE.Group();
  voxGroup.add(vox.mesh);
  const flame = makeFlame(0.75);
  voxGroup.add(flame);
  world.add(voxGroup);
  const burst = new Burst(80, { size: 0.55, color: 0xffd978, gravity: 14, speed: 16, life: 1.4, seed: 3 });
  root.add(burst.mesh);

  // trajectoire : horizontale lissée, verticale en arc, nez toujours vers le haut aux extrémités
  const S = heroLocal.clone().add(POS.spacex);
  S.y = 21;
  const E = padTop.clone().add(POS.spacex);
  E.y += 2.8; // origine du groupe voxel = milieu de l'action ; la base de la fusée est 2,8 plus bas
  const flight = (t) => {
    const u = clamp((t - T3.fly0) / (T3.fly1 - T3.fly0));
    const h = ease.smoother(u);
    const x = lerp(S.x, E.x, h), z = lerp(S.z, E.z, h);
    const y = lerp(S.y, E.y, ease.io2(u)) + 62 * Math.pow(Math.sin(Math.PI * u), 0.85);
    const tilt = 0.95 * Math.sin(Math.PI * u);
    return { pos: new THREE.Vector3(x, y, z), tilt, dirx: Math.sign(E.x - S.x), dirz: Math.sign(E.z - S.z) };
  };
  const rocketPos = (t) => {
    if (t < T3.fly0) return S;
    if (t <= T3.fly1) return flight(t).pos;
    return E;
  };
  const smokeFly = new SmokeTrail(70, { size: 0.95, dt: 0.03, spread: 0.7, seed: 6 });
  world.add(smokeFly.mesh);
  const liftPos = (t) => new THREE.Vector3(E.x, E.y + Math.max(0, (t - T3.liftoff)) * Math.max(0, (t - T3.liftoff)) * 14, E.z);
  const smokeLift = new SmokeTrail(70, { size: 1.15, dt: 0.045, spread: 0.9, seed: 7 });
  world.add(smokeLift.mesh);

  // --- xAI : action qui fusionne dans SpaceX ---------------------------------------------------------------------
  const xai = makeShareBlock("xAI", { accent: "#39e0ff", scale: 0.9 });
  root.add(xai);
  const xaiFrom = new THREE.Vector3(-30, 28, 22), xaiTo = new THREE.Vector3(6, 24, -18);

  // --- trois boîtes imbriquées (valeur d'entreprise / capitalisation / part de Musk) ------------------------------------
  const nest = new THREE.Group();
  const bx = (w, h, d, col, op) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.2), transparent: true, opacity: op, depthWrite: false }));
  const evBox = bx(24, 16, 24, C.blue, 0.16);
  const capBox = bx(17.5, 11.5, 17.5, C.cyan, 0.22);
  const myBox = bx(8.5, 11.5, 8.5, C.gold, 0.55);
  myBox.position.set(-4.5, 0, -4.5);
  capBox.position.y = -2.2; evBox.position.y = 0;
  const edge = (m, col) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.8) })); e.position.copy(m.position); return e; };
  nest.add(evBox, capBox, myBox, edge(evBox, C.blueHi), edge(capBox, C.cyan), edge(myBox, C.gold));
  nest.position.set(2, 58, 0);
  root.add(nest);

  // --- ouvriers / ingénieurs ---------------------------------------------------------------------------------------
  const eng = [];
  for (let i = 0; i < 4; i++) {
    const f = new Figure({ scale: 1.0, shirt: 0xeef2f8, pants: 0x232b3d, hardhat: 0xffffff, vest: 0x39e0ff });
    f.root.position.set(14 + i * 4 - 8, 0.3, 14);
    root.add(f.root);
    eng.push(f);
  }

  // --- caméra --------------------------------------------------------------------------------------------------------------
  const sx = POS.spacex.x, sz = POS.spacex.z;
  const cam = [];
  const tx = POS.tesla.x, tz = POS.tesla.z;
  cam.push({ t: T3.t0, x: tx + 2, y: 21, z: tz + 8, az: 46, el: 30, zoom: 1.4, e: "io3" });
  cam.push({ t: T3.ignite, x: S.x, y: 14, z: S.z, az: 42, el: 28, zoom: 1.9, e: "io3" });
  for (let t = T3.fly0 + 0.15; t <= T3.fly1 + 0.01; t += 0.12) {
    const f = flight(t);
    cam.push({ t, x: f.pos.x, y: f.pos.y - 4, z: f.pos.z, az: 44 + (t - T3.fly0) * 2, el: 30, zoom: lerp(1.5, 0.95, ease.io2(inv(T3.fly0, T3.fly1, t))), e: "lin" });
  }
  const L = (d) => [-d * 0.7071, d * 0.7071]; // décale la cible vers la gauche de l'écran => la scène passe à droite
  const at = (x, z, d) => ({ x: x + L(d)[0], z: z + L(d)[1] });
  cam.push({ t: T3.fly1 + 0.9, ...at(sx - 6, sz + 7, 8), y: 16, az: 48, el: 32, zoom: 1.05, e: "io3" });
  cam.push({ t: T3.merge, ...at(sx + 2, sz - 6, 16), y: 16, az: 40, el: 34, zoom: 1.12, e: "io3" });
  cam.push({ t: T3.ipo, ...at(sx - 4, sz + 4, 16), y: 22, az: 50, el: 32, zoom: 0.95, e: "io3" });
  cam.push({ t: T3.liftoff + 1.0, ...at(sx - 8, sz + 6, 10), y: 36, az: 54, el: 28, zoom: 0.75, e: "io3" });
  cam.push({ t: T3.ev - 0.1, ...at(sx + 2, sz, 4), y: 44, az: 45, el: 34, zoom: 1.0, e: "io3" });
  cam.push({ t: T3.share + 1.5, ...at(sx + 2, sz, 2), y: 52, az: 38, el: 34, zoom: 1.3, e: "io3" });
  cam.push({ t: T3.end, ...at(sx + 3, sz, 2), y: 52, az: 36, el: 33, zoom: 1.22, e: "io3" });

  // --- HUD ---------------------------------------------------------------------------------------------------------------------
  hud.card({
    id: "s3-merge", cls: "pill card-left merge", t0: T3.merge, t1: T3.once + 2.4, x: 56, y: 262, align: "left", enter: "right",
    html: `<b>2 fév. 2026</b> · SpaceX absorbe <b>xAI</b><br><span>échange 100 % en actions (0,1433 action SpaceX par action xAI) ;<br>xAI devient une filiale détenue à 100 % — puis « SpaceXAI » (juil. 2026, source unique)</span>`,
  });
  hud.card({
    id: "s3-ipo", cls: "pill card-left ipo", t0: T3.ipo, t1: T3.once + 2.4, x: 56, y: 430, align: "left", enter: "right",
    html: `<b>12 juin 2026</b> · cotation <b>Nasdaq : SPCX</b><br><span>introduction à 135 $ l'action ≈ 75 Md$ levés (presse, S-1/A)</span>`,
  });
  hud.card({
    id: "s3-once", cls: "pill once", t0: T3.once, t1: T3.ev - 0.1, x: 960, y: 200, enter: "down",
    html: `<b>xAI ⊂ SpaceX</b> → une seule ligne dans le patrimoine<br><span>pas de double comptage de la même participation économique</span>`,
  });
  hud.card({
    id: "s3-ev", cls: "tag", t0: T3.ev, t1: T3.end - 0.3, enter: "left",
    anchor: () => new THREE.Vector3(sx + 2 + 12, 58 + 6, sz + 12), offset: [160, -70],
    html: `<b>Valeur d'entreprise</b><br><span>= capitalisation + dettes − trésorerie</span>`,
  });
  hud.card({
    id: "s3-cap", cls: "tag cyan", t0: T3.cap, t1: T3.end - 0.3, enter: "left",
    anchor: () => new THREE.Vector3(sx + 2 + 8.75, 58 - 2, sz + 8.75), offset: [200, 20],
    html: `<b>Capitalisation boursière</b><br><span>= nombre d'actions × prix</span>`,
  });
  hud.card({
    id: "s3-share", cls: "tag gold", t0: T3.share, t1: T3.end - 0.3, enter: "right",
    anchor: () => new THREE.Vector3(sx + 2 - 4.5, 58 + 3, sz - 4.5 + 4.25), offset: [-220, 80],
    html: `<b>Part de Musk ≈ 38 à 42 %</b><br><span>de la capitalisation (estimations) ·<br>≈ 82 % des voix : contrôle ≠ propriété</span>`,
  });

  // --- mise à jour ---------------------------------------------------------------------------------------------------------------
  const update = (t) => {
    const inRange = t < T3.end + 1.2;
    platform.setPower(ease.out2(inv(T3.t0 + 1.2, T3.t0 + 2.6, t)));
    const bp = ease.io2(inv(T3.fly1 - 0.2, T3.fly1 + 2.6, t));
    for (const g of [tower, hangar, ...labs]) applyBuild(g, bp, { overlap: 0.4, dropHeight: 40 });
    applyBuild(dc.shell, bp, { overlap: 0.4, dropHeight: 40 });
    dc.update(t, bp);
    dc.racks.visible = bp > 0.55;
    dishes.forEach((d, i) => { const k = ease.outBack(clamp((bp - 0.5 - i * 0.07) * 3)); d.scale.setScalar(Math.max(1e-3, k)); d.visible = k > 0.01; d.userData.dish.rotation.z = Math.sin(t * 0.6 + i) * 0.2; });
    const conK = ease.out3(inv(T3.fly1 + 1.2, T3.fly1 + 2.4, t));
    constel.update(t, conK);
    // IA
    const aiK = ease.out3(inv(T3.merge + 1.2, T3.merge + 2.2, t));
    brain.update(t, aiK);
    brain.group.rotation.y = 0.78 + t * 0.25;
    // chopsticks
    const open = 1 - ease.io3(inv(T3.fly1 - 0.15, T3.fly1 + 0.6, t)) + ease.io3(inv(T3.liftoff - 0.6, T3.liftoff, t));
    chop.userData.arms.forEach(({ pv, s }) => { pv.rotation.y = s * 0.0 + (-s) * clamp(open) * 0.8; });
    chop.visible = bp > 0.2;

    // fusée voxel : morph action -> fusée puis vol
    const morphK = ease.io3(inv(T3.morph, T3.morph + 1.2, t));
    const landed = t >= T3.fly1;
    const flying = t >= T3.t0 && t <= T3.fly1 + 0.05;
    voxGroup.visible = inRange && flying;
    if (voxGroup.visible) {
      const f = t < T3.fly0 ? { pos: S, tilt: 0, dirx: 1, dirz: -1 } : flight(t);
      voxGroup.position.copy(f.pos);
      // inclinaison du nez dans le sens du déplacement (axe horizontal perpendiculaire)
      const ax = new THREE.Vector3(f.dirz * 1, 0, -f.dirx * 1).normalize();
      voxGroup.quaternion.setFromAxisAngle(ax, -f.tilt);
      vox.update(morphK, [0, 0, 0], 1, t, 0);
      flame.position.set(0, -2.8, 0);
      flame.userData.set(ease.out2(inv(T3.ignite, T3.ignite + 0.4, t)), t);
    }
    smokeFly.mesh.visible = inRange && t >= T3.ignite && t <= T3.fly1 + 3;
    smokeFly.update(t, (tt) => (tt < T3.fly0 ? S : tt > T3.fly1 ? E : flight(tt).pos), (tt) => (tt > T3.ignite && tt < T3.fly1 ? 1 : 0));

    // atterrissage : étincelles + vraie fusée
    const land = clamp((t - T3.fly1) * 2.2);
    const idleRocket = t >= SC.s7.t0 - 0.2;
    rocket.group.visible = (inRange && land > 0.01 && t < T3.liftoff + 3.5) || idleRocket;
    const lift = idleRocket ? 0 : Math.max(0, t - T3.liftoff);
    const lp = new THREE.Vector3(padTop.x, padTop.y + lift * lift * 14, padTop.z);
    rocket.group.position.copy(lp);
    rocket.group.scale.setScalar(Math.max(1e-3, idleRocket ? 1 : ease.outBack(land, 1.3)));
    rocket.setFlame(!idleRocket && t >= T3.liftoff ? ease.out2(inv(T3.liftoff, T3.liftoff + 0.5, t)) : 0, t);
    burst.update(t, T3.fly1, [padTop.x, padTop.y + 2, padTop.z]);
    smokeLift.mesh.visible = inRange && t >= T3.liftoff && t < T3.liftoff + 3.4;
    smokeLift.update(t, (tt) => new THREE.Vector3(E.x, E.y - 2.8 + Math.max(0, tt - T3.liftoff) ** 2 * 14, E.z), (tt) => (tt >= T3.liftoff ? 1 : 0));

    // xAI : vol vers le centre de données
    const xk = inv(T3.merge, T3.merge + 1.6, t);
    xai.visible = inRange && xk > 0 && xk < 1;
    const xe = ease.io3(xk);
    xai.position.set(lerp(xaiFrom.x, xaiTo.x, xe), lerp(xaiFrom.y, xaiTo.y, xe) + Math.sin(xe * Math.PI) * 6, lerp(xaiFrom.z, xaiTo.z, xe));
    xai.rotation.y = xe * 1.6;
    xai.scale.setScalar(0.9 * (1 - 0.3 * xe));

    // boîtes imbriquées
    const nk = ease.outBack(clamp((t - T3.ev) * 1.8), 1.2);
    nest.visible = inRange && nk > 0.01;
    nest.scale.setScalar(Math.max(1e-3, nk));
    nest.rotation.y = Math.sin(t * 0.5) * 0.25;
    capBox.visible = t >= T3.cap - 0.2;
    myBox.visible = t >= T3.share - 0.2;

    eng.forEach((f, i) => { f.apply({ ...walk(t + i * 0.6, 1.0), bob: idle(t).bob }); f.root.position.x = 6 + Math.sin(t * 0.3 + i * 1.7) * 6; f.root.rotation.y = Math.cos(t * 0.3 + i * 1.7) > 0 ? Math.PI / 2 : -Math.PI / 2; f.root.visible = bp > 0.8; });
  };

  world.register({ id: "spacex", windows: [[T3.t0 - 0.2, T3.end + 1.2], [SC.s7.t0, SC.s7.t1]], pad: 1.2, root, update });
  return { cam, T: T3, padWorld: padTop.clone().add(POS.spacex) };
}
