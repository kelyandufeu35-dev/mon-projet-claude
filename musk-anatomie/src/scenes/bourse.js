// SCÈNE 4 — Pourquoi sa fortune varie : la Bourse, graphiques géants, blocs d'actions qui montent et descendent.
// Exemple chiffré HYPOTHÉTIQUE : 100 M d'actions × 100 $ = 10 Md$ ; ±10 % => ±1 Md$.
import * as THREE from "three";
import { applyBuild } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { labelTexture } from "../core/world.js";
import { Platform, makeExchange } from "../components/buildings.js";
import { LineRibbon, TickerBoard, BarChart3D } from "../components/finance.js";
import { Figure, POSES, blend, idle, walk, frantic } from "../components/figure.js";
import { Burst } from "../components/fx.js";
import { ease, inv, clamp, lerp, track, fmt, TAU, rng } from "../core/util.js";
import { SC, when } from "../timing.js";
import { POS } from "../layout.js";

export const T4 = {
  t0: SC.s4.t0,
  t1: SC.s4.t1,
  build0: SC.s4.t0 + 1.0,
  build1: SC.s4.t0 + 3.2,
  example: when("s4b", "Exemple") - 0.1,
  settle: when("s4b", "cent millions") - 0.5,
  up: when("s4b", "Plus dix") - 0.25,
  down: when("s4b", "moins dix") - 0.25,
  none: when("s4c", "Sans rien") - 0.1,
  end: SC.s4.t1,
};

// prix hypothétique (indice base 100) : agité au début, puis exactement 100, +10 %, −10 %
const noise = (t) => Math.sin(t * 2.3) * 3.4 + Math.sin(t * 5.1 + 1) * 2.0 + Math.sin(t * 9.7 + 2) * 0.9;
const calm = track([[T4.t0, 1], [T4.settle - 0.3, 1], [T4.settle + 0.8, 0, ease.io3]]);
const level = track([[T4.t0, 100], [T4.up, 100], [T4.up + 1.5, 110, ease.io3], [T4.down, 110], [T4.down + 1.9, 90, ease.io3], [T4.end + 6, 90]]);
export const price = (t) => level(t) + noise(t) * calm(t) * (1 + 0.5 * Math.sin(t * 0.7));

export function buildBourse(ctx) {
  const { world, hud } = ctx;
  const root = new THREE.Group();
  root.position.copy(POS.bourse);
  world.add(root);

  const platform = new Platform(66, 66, { accent: C.gold });
  root.add(platform.group);

  const exch = makeExchange({ label: "BOURSE" });
  exch.position.set(0, 0.3, -17);
  root.add(exch);

  // bandeau défilant au pied des marches
  const ticker = new TickerBoard(38, 2.4, { px: 1792, py: 112 });
  ticker.mesh.position.set(0, 2.2, -17 + 16.3);
  root.add(ticker.mesh);

  // --- graphique géant (panneau vertical qui fait face à la caméra) ---------------------------------------------
  const board = new THREE.Group();
  board.rotation.y = Math.PI / 4;
  board.position.set(-8, 21, 8);
  root.add(board);
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), new THREE.MeshBasicMaterial({ color: 0x050b18, transparent: true, opacity: 0.78 }));
  backing.position.z = -0.8;
  board.add(backing);
  const frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(1.2) });
  for (const [w, h, x, y] of [[60.6, 0.4, 0, 13], [60.6, 0.4, 0, -13], [0.4, 26.4, 30, 0], [0.4, 26.4, -30, 0]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), frameMat);
    f.position.set(x, y, -0.6);
    board.add(f);
  }
  for (let i = -2; i <= 2; i++) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(58, 0.1), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x6a86b8 : 0x22304f }));
    gl.position.set(0, i * 5, -0.7);
    board.add(gl);
  }
  const ribbon = new LineRibbon(110, { width: 56, depth: 1.4, thick: 0.6, color: C.cyan, fill: C.blue, fillOpacity: 0.18 });
  ribbon.group.position.set(-28 + 28, 0, 0); // coordonnées locales : le ruban est centré, largeur 56
  ribbon.group.position.set(0, 0, 0);
  board.add(ribbon.group);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2) }));
  board.add(marker);
  const baseLine = new THREE.Mesh(new THREE.PlaneGeometry(58, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(1.1), transparent: true, opacity: 0.8 }));
  baseLine.position.set(0, 0, -0.6);
  board.add(baseLine);

  // --- bougies japonaises au sol (derrière les blocs) -------------------------------------------------------------------
  const NC = 16;
  const candleBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), NC);
  candleBody.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NC * 3), 3);
  const candleWick = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xaab4c4 }), NC);
  candleBody.castShadow = true;
  const candles = new THREE.Group();
  candles.add(candleBody, candleWick);
  candles.position.set(-26, 0.3, -4);
  candles.rotation.y = Math.PI / 4;
  root.add(candles);

  // --- blocs d'actions (hauteur = prix) ------------------------------------------------------------------------------------------
  const mkBlock = (label, color, x) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 7), new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 }));
    body.castShadow = true;
    g.add(body);
    const mk = (rotY, px, pz) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.1), new THREE.MeshBasicMaterial({ map: labelTexture(label, { w: 1024, h: 512, font: '700 190px "Space Grotesk"', color: "#ffffff", bg: null, glow: "#58b4ff" }), transparent: true }));
      p.rotation.y = rotY;
      p.position.set(px, 0, pz);
      g.add(p);
      return p;
    };
    const f1 = mk(0, 0, 3.53), f2 = mk(Math.PI / 2, 3.53, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.5, 7.2), mat("goldGlow"));
    g.add(top);
    g.position.set(x, 0.3, 22);
    root.add(g);
    return { g, body, f1, f2, top };
  };
  const blkT = mkBlock("TESLA", 0x1d3f8a, -9);
  const blkS = mkBlock("SPACEX", 0x14606e, 9);
  const heightOf = (p, k) => 3 + (p - 70) * 0.5 * k; // 100 -> 18, 110 -> 23, 90 -> 13

  // --- traders et Musk ------------------------------------------------------------------------------------------------------------------
  const R = rng(23);
  const traders = [];
  for (let i = 0; i < 12; i++) {
    const f = new Figure({ scale: 1.05, shirt: [0xeef2f8, 0x2b7bff, 0x8e99aa][i % 3], jacket: i % 2 ? 0x1a2236 : null, pants: 0x1f2535, tie: 0xffb81c });
    const a = (i / 12) * TAU, r = 10 + R() * 8;
    f.root.position.set(Math.cos(a) * r, 0.3, 22 + Math.sin(a) * r * 0.55 + 6);
    f.root.rotation.y = a + Math.PI;
    root.add(f.root);
    traders.push({ f, ph: R() * 10, walk: i % 3 === 0, cx: f.root.position.x, cz: f.root.position.z });
  }
  const musk = new Figure({ scale: 2.2, shirt: 0x14161c, jacket: 0x0d0f14, pants: 0x1b2030, shoe: 0x090a0e });
  musk.place(0, 0.3, 30, Math.PI / 4);
  root.add(musk.root);

  const burstUp = new Burst(60, { size: 0.5, color: 0xffd978, gravity: 12, speed: 11, life: 1.6, seed: 5 });
  const burstDn = new Burst(60, { size: 0.5, color: 0xff4d5e, gravity: 4, speed: 8, life: 1.6, seed: 6, up: 0.2, spread: 1.2 });
  root.add(burstUp.mesh, burstDn.mesh);

  // --- caméra --------------------------------------------------------------------------------------------------------------------------------
  const bx = POS.bourse.x, bz = POS.bourse.z;
  const cam = [
    { t: T4.t0, x: POS.spacex.x + 3 - 1.4, y: 52, z: POS.spacex.z + 1.4, az: 36, el: 33, zoom: 1.22, e: "io3" },
    { t: T4.t0 + 0.9, x: (POS.spacex.x + bx) / 2, y: 26, z: (POS.spacex.z + bz) / 2, az: 42, el: 32, zoom: 0.5, e: "io3" },
    { t: T4.t0 + 2.4, x: bx + 3, y: 14, z: bz + 6, az: 45, el: 33, zoom: 1.0, e: "io3" },
    { t: T4.example, x: bx + 3, y: 15, z: bz + 6, az: 47, el: 33, zoom: 1.02, e: "io3" },
    { t: T4.up, x: bx + 1, y: 15, z: bz + 8, az: 49, el: 33, zoom: 1.12, e: "io3" },
    { t: T4.down, x: bx + 1, y: 15, z: bz + 8, az: 52, el: 33, zoom: 1.12, e: "io3" },
    { t: T4.none, x: bx + 1, y: 12, z: bz + 12, az: 48, el: 31, zoom: 1.22, e: "io3" },
    { t: T4.end, x: bx + 1, y: 12, z: bz + 12, az: 46, el: 31, zoom: 1.26, e: "io3" },
  ];

  // --- HUD ---------------------------------------------------------------------------------------------------------------------------------------
  hud.card({
    id: "s4-real", cls: "tag green", t0: T4.t0 + 0.9, t1: T4.example, x: 56, y: 300, align: "left", enter: "right",
    html: `<b>Mesure réelle</b> · Forbes, 2 oct. 2026<br><span>+61 Md$ de fortune estimée en une seule séance —<br>sans qu'il ait vendu quoi que ce soit</span>`,
  });
  hud.card({
    id: "s4-counter", cls: "bigcount", t0: T4.example, t1: T4.end - 0.1, x: 960, y: 176, enter: "down",
    html: `<div class="lbl">EXEMPLE HYPOTHÉTIQUE · chiffres inventés</div><div class="eq"><span class="n1">100 000 000</span> actions × <span class="px">100,00</span> $</div><div class="val"><span class="v">10,0</span> <small>Md$</small><span class="dlt"></span></div>`,
    dyn: (t, el) => {
      const p = price(t);
      const settled = t >= T4.settle;
      const value = (p * 100000000) / 1e9; // en Md$
      el.querySelector(".px").textContent = fmt.dec(p, 2);
      el.querySelector(".v").textContent = fmt.dec(value, 1);
      const d = value - 10;
      const dl = el.querySelector(".dlt");
      dl.textContent = settled && Math.abs(d) > 0.05 ? (d > 0 ? "▲ +" : "▼ −") + fmt.dec(Math.abs(d), 1) + " Md$" : "";
      dl.style.color = d > 0 ? "#2bd67b" : "#ff4d5e";
      el.querySelector(".v").style.color = settled ? (d > 0.04 ? "#2bd67b" : d < -0.04 ? "#ff4d5e" : "#ffd978") : "#ffd978";
    },
  });
  hud.card({
    id: "s4-up", cls: "arrow up", t0: T4.up + 0.3, t1: T4.down - 0.15, x: 1620, y: 330, enter: "scale",
    html: `+10 %<br><span>le cours monte</span>`,
  });
  hud.card({
    id: "s4-down", cls: "arrow down", t0: T4.down + 0.3, t1: T4.down + 2.8, x: 1620, y: 330, enter: "scale",
    html: `−10 %<br><span>le cours baisse</span>`,
  });
  hud.card({
    id: "s4-none", cls: "tag gold", t0: T4.none, t1: T4.end - 0.2, enter: "up",
    anchor: () => new THREE.Vector3(bx, 9, bz + 30), offset: [0, -50],
    html: `<b>Aucune vente, aucun achat</b><br><span>seul le prix change → la valeur estimée change</span>`,
  });

  // --- mise à jour ---------------------------------------------------------------------------------------------------------------------------------
  const prevCol = new THREE.Color();
  const update = (t) => {
    const inRange = t < T4.end + 1.2;
    platform.setPower(ease.out2(inv(T4.t0, T4.t0 + 1.5, t)));
    const bp = ease.io2(inv(T4.build0, T4.build1, t));
    applyBuild(exch, bp, { overlap: 0.35, dropHeight: 40 });
    const p = price(t);
    const up = p >= 100;

    // ticker
    ticker.mesh.visible = bp > 0.6;
    ticker.update(t, [
      { text: "TSLA", dir: Math.sin(t * 1.1) > 0 ? 1 : -1 },
      { text: "SPCX", dir: Math.sin(t * 0.9 + 1) > 0 ? 1 : -1 },
      { text: "NDX", dir: 1 },
      { text: "SPX", dir: -1 },
      { text: "VIX", dir: 1 },
    ], 220);

    // graphique : fenêtre glissante de 14 s
    const W = 14, vis = ease.out2(inv(T4.t0 + 1.0, T4.t0 + 2.4, t));
    board.visible = vis > 0.01;
    board.scale.setScalar(Math.max(1e-3, vis));
    ribbon.update((u) => (price(t - (1 - u) * W) - 100) * 0.95, 1);
    const yNow = (p - 100) * 0.95;
    marker.position.set(28, yNow, 0.2);
    marker.scale.setScalar(1 + 0.25 * Math.sin(t * 8));
    ribbon.ribbon.material.color.setRGB(...(up ? [0.25, 1.9, 1.3] : [2.0, 0.35, 0.45]));

    // bougies
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < NC; i++) {
      const tc = t - (NC - 1 - i) * 0.55;
      const o = price(tc - 0.5), c = price(tc), hi = Math.max(o, c) + 1.2 + Math.abs(Math.sin(i * 3.1)) * 1.6, lo = Math.min(o, c) - 1.2 - Math.abs(Math.cos(i * 2.3)) * 1.6;
      const base = 62;
      const y0 = (Math.min(o, c) - base) * 0.35, h = Math.max(0.35, Math.abs(c - o) * 0.35);
      dummy.position.set(i * 1.9, y0 + h / 2, 0);
      dummy.scale.set(1.15, h, 1.15);
      dummy.updateMatrix();
      candleBody.setMatrixAt(i, dummy.matrix);
      col.set(c >= o ? 0x2bd67b : 0xff4d5e);
      candleBody.setColorAt(i, col);
      dummy.position.set(i * 1.9, ((lo + hi) / 2 - base) * 0.35, 0);
      dummy.scale.set(0.16, (hi - lo) * 0.35, 0.16);
      dummy.updateMatrix();
      candleWick.setMatrixAt(i, dummy.matrix);
    }
    candleBody.instanceMatrix.needsUpdate = candleBody.instanceColor.needsUpdate = candleWick.instanceMatrix.needsUpdate = true;
    candles.visible = bp > 0.3;

    // blocs
    const bk = ease.outBack(clamp((t - T4.t0 - 1.4) * 1.3), 1.2);
    for (const [blk, off] of [[blkT, 0], [blkS, 1.7]]) {
      const pp = price(t + off * 0.0) + (off ? Math.sin(t * 1.9) * 2 * calm(t) - 0 : 0);
      const h = Math.max(0.5, heightOf(pp, 1) * bk);
      blk.body.scale.y = h;
      blk.body.position.y = h / 2;
      blk.f1.position.y = h / 2; blk.f1.scale.setScalar(0.4 + 0.6 * clamp(h / 14));
      blk.f2.position.y = h / 2; blk.f2.scale.setScalar(0.4 + 0.6 * clamp(h / 14));
      blk.top.position.y = h + 0.1;
      blk.top.material = pp >= 100 ? mat("goldGlow") : mat("redGlow");
      blk.g.visible = bk > 0.01;
    }

    // éclats lors des variations
    burstUp.update(t, T4.up + 0.6, [-9, 24, 22]);
    burstDn.update(t, T4.down + 0.8, [-9, 22, 22]);

    // personnages
    traders.forEach(({ f, ph, walk: wk, cx, cz }, i) => {
      const pose = wk ? walk(t + ph, 1.1) : frantic(t, ph);
      f.apply(pose);
      if (wk) { f.root.position.x = cx + Math.sin(t * 0.4 + ph) * 4; f.root.rotation.y = Math.cos(t * 0.4 + ph) > 0 ? Math.PI / 2 : -Math.PI / 2; }
      f.root.visible = bk > 0.2;
      f.root.scale.setScalar(1.05 * clamp((t - T4.t0 - 1.8 - i * 0.05) * 3));
    });
    const calmPose = blend(POSES.stand, POSES.crossed, ease.io3(inv(T4.up - 1, T4.up, t)));
    musk.apply({ ...calmPose, bob: idle(t).bob });
    musk.root.visible = bk > 0.05;
  };

  world.register({ id: "bourse", windows: [[T4.t0 - 0.2, T4.end + 1.2], [SC.s7.t0, SC.s7.t1]], pad: 1.2, root, update });
  return { cam, T: T4 };
}
