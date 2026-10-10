// Bâtiments et décors miniatures. Convention : façade principale vers +z (visible depuis la caméra iso à az = 45°),
// coordonnées locales centrées au sol. Chaque bâtiment est un Group avec des couches ("rise" / "drop") pour l'animation
// de construction (applyBuild), sauf mention contraire.
import * as THREE from "three";
import { Builder } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { labelTexture } from "../core/world.js";
import { rng, clamp, lerp, ease, TAU } from "../core/util.js";

// ---------------------------------------------------------------------------
// Socle de district : dalle sombre + liseré lumineux dont l'intensité s'anime (power-on)
// ---------------------------------------------------------------------------
export class Platform {
  constructor(w, d, { accent = C.blue, label = null, height = 1.4 } = {}) {
    this.group = new THREE.Group();
    this.accent = new THREE.Color(accent);
    const b = new Builder();
    b.setLayer(0, "static");
    b.box(w + 3, height, d + 3, 0, -height, 0, "dark");
    b.box(w, 0.3, d, 0, 0, 0, colored(0x0e1626));
    this.group.add(b.build());
    this.edgeMat = new THREE.MeshBasicMaterial({ color: this.accent.clone() });
    const edge = new THREE.Group();
    const t = 0.35, y = 0.0;
    for (const [sx, sz, ex, ez] of [[0, 1, w + 3, t], [0, -1, w + 3, t], [1, 0, t, d + 3], [-1, 0, t, d + 3]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ex, 0.3, ez), this.edgeMat);
      m.position.set(sx * ((w + 3) / 2), y, sz * ((d + 3) / 2));
      edge.add(m);
    }
    this.group.add(edge);
    this.w = w; this.d = d;
  }
  setPower(k) {
    this.edgeMat.color.copy(this.accent).multiplyScalar(0.12 + 1.7 * clamp(k));
  }
}

// ---------------------------------------------------------------------------
// Gigafactory Tesla (50 × 28), façade +z
// ---------------------------------------------------------------------------
export function makeGigafactory({ label = "TESLA" } = {}) {
  const b = new Builder();
  b.setLayer(0, "rise").box(56, 0.8, 34, 0, 0, 0, "concrete");
  b.setLayer(1, "rise");
  b.box(48, 10, 26, 0, 0.8, 0, "white");
  b.box(48.5, 1.5, 26.5, 0, 0.8, 0, "dark");
  for (let i = 0; i < 10; i++) b.box(3.4, 1.5, 0.15, -21.6 + i * 4.8, 6.2, 13.05, "window");
  for (let j = 0; j < 5; j++) b.box(0.15, 1.5, 3.4, 24.05, 6.2, -10.4 + j * 5.2, "window");
  for (let i = 0; i < 6; i++) {
    b.box(4.2, 4.2, 0.2, -18 + i * 7.2, 0.8, 13.05, "dark");
    b.box(4.2, 0.14, 0.24, -18 + i * 7.2, 5.1, 13.07, "blueGlow");
  }
  // toit en dents de scie
  b.setLayer(2, "drop");
  const tooth = new THREE.Shape();
  tooth.moveTo(0, 0); tooth.lineTo(6, 2.4); tooth.lineTo(6, 0); tooth.closePath();
  const toothG = new THREE.ExtrudeGeometry(tooth, { depth: 26, bevelEnabled: false });
  for (let t = 0; t < 8; t++) {
    b.add(toothG, "metalDark", -24 + t * 6, 10.8, -13);
    b.box(0.12, 2.3, 25.6, -24 + t * 6 + 6.0, 10.8, 0, "blueGlow");
  }
  // équipements de toit, annexe, réservoirs
  b.setLayer(3, "drop");
  for (let i = 0; i < 6; i++) b.box(2.4, 1.3, 2.4, -20 + i * 8, 13.2, -6 + (i % 2) * 8, "offwhite");
  b.box(10, 7.5, 8, -31, 0.8, 18, "white");
  b.box(10.2, 0.6, 8.2, -31, 8.3, 18, "dark");
  b.box(9.6, 5.2, 0.15, -31, 1.4, 22.05, "glass");
  for (let i = 0; i < 3; i++) b.cyl(3.0, 3.0, 7.5, 30 - i * 7.4, 0.8, -19.5, "offwhite", 24);
  for (let i = 0; i < 3; i++) b.cyl(3.05, 3.05, 0.5, 30 - i * 7.4, 8.3, -19.5, "blueGlow", 24);
  const g = b.build();
  // enseigne (couche 3)
  const tex = labelTexture(label, { w: 1024, h: 256, font: '700 168px "Space Grotesk"', color: "#ffffff", bg: "#0a1426", glow: "#58b4ff" });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.2), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(-8, 7.8, 13.2);
  sign.userData.layer = 3;
  g.add(sign);
  g.userData.layerCount = 4;
  return g;
}

/** auvent solaire + bornes de recharge (parking) */
export function makeSolarCanopy(rows = 3, cols = 6) {
  const b = new Builder();
  b.setLayer(0, "rise");
  const panel = colored(0x0f2a66, { metal: 0.7, rough: 0.2 });
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      b.box(0.3, 3.2, 0.3, -cols * 2.5 + i * 5, 0, r * 7, "metalDark");
    }
    for (let i = 0; i < cols; i++) b.add(new THREE.BoxGeometry(4.6, 0.18, 5.6), panel, -cols * 2.5 + i * 5 + 0.3, 3.4, r * 7, 0.12, 0, 0);
  }
  b.setLayer(1, "drop");
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) b.box(0.5, 1.9, 0.5, -cols * 2.5 + i * 5 + 2.2, 0, r * 7 + 3.2, "white"), b.box(0.52, 0.2, 0.52, -cols * 2.5 + i * 5 + 2.2, 1.5, r * 7 + 3.2, "redGlow");
  return b.build();
}

// ---------------------------------------------------------------------------
// Rampe de lancement SpaceX : tour treillis + bras, plateforme, réservoirs
// ---------------------------------------------------------------------------
export function makeLaunchTower({ height = 44 } = {}) {
  const b = new Builder();
  b.setLayer(0, "rise");
  b.cyl(11, 11.6, 1.6, 0, 0, 0, "concrete", 40);
  b.cyl(6.2, 6.2, 0.4, 0, 1.6, 0, "metalDark", 32);
  b.cyl(4.6, 4.6, 0.3, 0, 2.0, 0, "black", 24);
  b.setLayer(1, "rise");
  const tx = 13.5;
  const leg = 0.5;
  const m = "white";
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(leg, height, leg, tx + x * 1.5, 0, z * 1.5, m);
  for (let y = 1.2; y < height; y += 2.4) {
    b.box(3.4, 0.22, 0.22, tx, y, -1.5, m); b.box(3.4, 0.22, 0.22, tx, y, 1.5, m);
    b.box(0.22, 0.22, 3.4, tx - 1.5, y, 0, m); b.box(0.22, 0.22, 3.4, tx + 1.5, y, 0, m);
    b.add(new THREE.BoxGeometry(0.16, 3.0, 0.16), m, tx, y + 1.2, -1.5, 0, 0, 0.8);
    b.add(new THREE.BoxGeometry(0.16, 3.0, 0.16), m, tx, y + 1.2, 1.5, 0, 0, -0.8);
  }
  b.setLayer(2, "drop");
  b.box(4.2, 1.0, 4.2, tx, height, 0, "metal");
  b.cyl(0.18, 0.18, 6, tx, height + 1.0, 0, "red", 8);
  b.sphere(0.5, tx, height + 7.0, 0, "redGlow", 10);
  // réservoirs
  b.setLayer(3, "drop");
  for (let i = 0; i < 3; i++) b.sphere(2.6, -9 + i * 6.2, 0, 14, "offwhite", 20);
  b.cyl(1.8, 1.8, 8, 14, 0, 12, "offwhite", 20);
  b.cyl(1.8, 1.8, 8, 14, 0, 16.5, "offwhite", 20);
  const g = b.build();
  g.userData.towerX = tx;
  g.userData.height = height;
  return g;
}

/** bras de capture de la tour (2 pinces articulées) */
export function makeChopsticks(towerX, y) {
  const grp = new THREE.Group();
  grp.position.set(towerX, y, 0);
  const arms = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group();
    pv.position.set(-1.6, 0, s * 1.8);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(11, 1.1, 0.8), mat("metalDark"));
    arm.position.x = -5.5;
    arm.castShadow = true;
    pv.add(arm);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.0), mat("goldGlow"));
    tip.position.x = -11;
    pv.add(tip);
    grp.add(pv);
    arms.push({ pv, s });
  }
  grp.userData.arms = arms;
  return grp;
}

export function makeHangar({ len = 26, r = 8 } = {}) {
  const b = new Builder();
  b.setLayer(0, "rise").box(len + 2, 0.6, r * 2 + 2, 0, 0, 0, "concrete");
  b.setLayer(1, "rise");
  const arch = new THREE.CylinderGeometry(r, r, len, 28, 1, false, 0, Math.PI);
  b.add(arch, "offwhite", 0, 0.6, 0, 0, 0, Math.PI / 2, 1, 1, 1);
  b.setLayer(2, "drop");
  for (let i = 0; i < 6; i++) {
    const x = -len / 2 + 1 + i * ((len - 2) / 5);
    b.add(new THREE.TorusGeometry(r + 0.1, 0.22, 6, 24, Math.PI), "metal", x, 0.6, 0, 0, Math.PI / 2, 0);
  }
  b.box(0.2, r * 1.3, r * 1.5, len / 2 + 0.05, 0.6, 0, "blueGlow");
  const g = b.build();
  g.rotation.y = 0;
  return g;
}

export function makeLab({ w = 10, d = 8, h = 8, glowRows = 4 } = {}) {
  const b = new Builder();
  b.setLayer(0, "rise").box(w + 1.2, 0.5, d + 1.2, 0, 0, 0, "concrete");
  b.setLayer(1, "rise").box(w, h, d, 0, 0.5, 0, "white");
  for (let r = 0; r < glowRows; r++) {
    b.box(w * 0.82, 0.8, 0.12, 0, 1.5 + r * (h / glowRows), d / 2 + 0.03, "window");
    b.box(0.12, 0.8, d * 0.82, w / 2 + 0.03, 1.5 + r * (h / glowRows), 0, "window");
  }
  b.setLayer(2, "drop").box(w + 0.6, 0.5, d + 0.6, 0, h + 0.5, 0, "metalDark");
  b.box(w * 0.4, 1.0, d * 0.4, w * 0.15, h + 1.0, -d * 0.1, "offwhite");
  return b.build();
}

export function makeDish(scale = 1) {
  const g = new THREE.Group();
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 8, 0, Math.PI * 2, 0, 0.75), new THREE.MeshStandardMaterial({ color: 0xeef2f8, roughness: 0.3, metalness: 0.4, side: THREE.DoubleSide }));
  dish.rotation.x = Math.PI + 0.9;
  dish.position.y = 2.4;
  dish.castShadow = true;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 8), mat("metalDark"));
  post.position.y = 1.2;
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat("cyanGlow"));
  feed.position.set(0, 3.6, 1.0);
  g.add(post, dish, feed);
  g.scale.setScalar(scale);
  g.userData.dish = dish;
  return g;
}

// ---------------------------------------------------------------------------
// Centre de données IA : baies de serveurs avec LED animées, ventilateurs de toit
// ---------------------------------------------------------------------------
export class DataCenter {
  constructor() {
    this.group = new THREE.Group();
    const b = new Builder();
    b.setLayer(0, "rise").box(32, 0.6, 20, 0, 0, 0, "concrete");
    b.setLayer(1, "rise");
    b.box(28, 9, 16, 0, 0.6, 0, "dark");
    b.box(28.2, 1.0, 16.2, 0, 0.6, 0, "black");
    // piliers de façade (entre les vitres)
    for (let i = 0; i <= 7; i++) b.box(0.4, 7.4, 0.4, -14 + i * 4, 1.6, 8.05, "metalDark");
    b.box(28.1, 0.5, 0.5, 0, 9.0, 8.05, "cyanGlow");
    b.setLayer(2, "drop");
    b.box(28.6, 0.6, 16.6, 0, 9.6, 0, "metalDark");
    for (let i = 0; i < 5; i++) b.cyl(1.9, 1.9, 0.6, -10.5 + i * 5.2, 10.2, -2 + (i % 2) * 4, "black", 20);
    b.box(10, 1.2, 1.0, 0, 10.2, 5.5, "blueGlow");
    this.shell = b.build();
    this.group.add(this.shell);
    // ventilateurs (pales qui tournent)
    this.fans = [];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Group();
      f.position.set(-10.5 + i * 5.2, 10.9, -2 + (i % 2) * 4);
      for (let k = 0; k < 3; k++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.55), mat("steel"));
        bl.rotation.y = (k / 3) * Math.PI;
        f.add(bl);
      }
      this.group.add(f);
      this.fans.push(f);
    }
    // baies de serveurs visibles derrière la vitre
    const racks = 3 * 12;
    this.racks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat("black"), racks);
    const d = new THREE.Object3D();
    let i = 0;
    for (let row = 0; row < 3; row++)
      for (let c = 0; c < 12; c++) {
        d.position.set(-12.2 + c * 2.2, 0.6 + 2.2, 6.2 - row * 4.6);
        d.scale.set(1.5, 4.4, 1.9);
        d.updateMatrix();
        this.racks.setMatrixAt(i++, d.matrix);
      }
    this.racks.castShadow = false;
    this.group.add(this.racks);
    // LED : 6 par baie, devant les baies de la première rangée visibles + deuxième
    this.ledCount = 2 * 12 * 6;
    this.leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.16, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.ledCount);
    this.leds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.ledCount * 3), 3);
    this.leds.frustumCulled = false;
    this.group.add(this.leds);
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
    this.R = rng(77);
    this.seed = Array.from({ length: this.ledCount }, () => [this.R() * 10, 2 + this.R() * 5]);
    this.ledPos = [];
    for (let row = 0; row < 2; row++)
      for (let c = 0; c < 12; c++)
        for (let k = 0; k < 6; k++) this.ledPos.push([-12.2 + c * 2.2, 1.4 + k * 0.62, 6.2 - row * 4.6 + 1.0]);
    // glass : vitre de façade
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(27, 7.4), mat("glass"));
    glass.position.set(0, 1.6 + 3.7, 8.04);
    this.group.add(glass);
  }
  update(t, buildP = 1) {
    // construction : réutilise applyBuild côté appelant
    const d = this._d, c = this._c;
    for (let i = 0; i < this.ledCount; i++) {
      const [ph, sp] = this.seed[i];
      const v = Math.sin(t * sp + ph);
      const on = v > -0.2;
      const kind = Math.sin(ph * 3.1 + Math.floor(t * 0.7)) > 0.3 ? 0 : 1;
      const col = on ? (kind ? [0.25, 1.0, 0.55] : [0.3, 0.75, 1.0]) : [0.04, 0.07, 0.12];
      c.setRGB(col[0] * 1.5, col[1] * 1.5, col[2] * 1.5);
      this.leds.setColorAt(i, c);
      const p = this.ledPos[i];
      d.position.set(p[0], p[1], p[2]);
      d.scale.setScalar(clamp(buildP * 3 - 1.4));
      d.updateMatrix();
      this.leds.setMatrixAt(i, d.matrix);
    }
    this.leds.instanceMatrix.needsUpdate = true;
    this.leds.instanceColor.needsUpdate = true;
    this.fans.forEach((f, i) => (f.rotation.y = t * 7 + i));
    this.racks.visible = buildP > 0.45;
  }
}

// ---------------------------------------------------------------------------
// Réseau de neurones hologramme (IA) : nœuds + arêtes + impulsions
// ---------------------------------------------------------------------------
export class NeuralNet {
  constructor({ layers = [4, 6, 6, 3], spacing = 4.2, gap = 2.2, color = 0x39e0ff } = {}) {
    this.group = new THREE.Group();
    const nodes = [];
    layers.forEach((n, li) => {
      for (let i = 0; i < n; i++) nodes.push(new THREE.Vector3((li - (layers.length - 1) / 2) * spacing, (i - (n - 1) / 2) * gap, 0));
    });
    this.nodeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.7) }), nodes.length);
    const d = new THREE.Object3D();
    nodes.forEach((p, i) => { d.position.copy(p); d.scale.setScalar(1); d.updateMatrix(); this.nodeMesh.setMatrixAt(i, d.matrix); });
    this.group.add(this.nodeMesh);
    // arêtes
    const edges = [];
    let off = 0;
    for (let li = 0; li < layers.length - 1; li++) {
      for (let i = 0; i < layers[li]; i++)
        for (let j = 0; j < layers[li + 1]; j++) edges.push([nodes[off + i], nodes[off + layers[li] + j]]);
      off += layers[li];
    }
    const pts = [];
    edges.forEach(([a, b]) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.edges = edges;
    this.pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 40);
    this.pulses.frustumCulled = false;
    this.group.add(this.pulses);
    this.R = rng(5);
    this.pe = Array.from({ length: 40 }, () => [Math.floor(this.R() * edges.length), this.R()]);
    this._d = d;
  }
  update(t, alpha = 1) {
    const d = this._d;
    this.pe.forEach(([ei, ph], i) => {
      const u = (t * 0.55 + ph) % 1;
      const [a, b] = this.edges[ei];
      d.position.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u));
      d.scale.setScalar(Math.max(1e-4, alpha));
      d.updateMatrix();
      this.pulses.setMatrixAt(i, d.matrix);
    });
    this.pulses.instanceMatrix.needsUpdate = true;
    this.group.visible = alpha > 0.01;
  }
}

// ---------------------------------------------------------------------------
// Globe numérique + constellation de satellites en orbite
// ---------------------------------------------------------------------------
export class Constellation {
  constructor({ radius = 6, rings = 2, perRing = 8, orbit = 12.5, satScale = 0.55 } = {}) {
    this.group = new THREE.Group();
    this.orbit = orbit;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 24), new THREE.MeshLambertMaterial({ color: 0x0b2a66 }));
    const grid = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.01, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x39e0ff).multiplyScalar(1.2), wireframe: true, transparent: true, opacity: 0.35 }));
    this.group.add(globe, grid);
    this.sats = [];
    this.rings = rings; this.perRing = perRing;
    const proto = (() => {
      const bld = new Builder();
      bld.setLayer(0, "static");
      bld.box(1.2, 0.12, 0.8, 0, 0, 0, "white");
      for (const s of [-1, 1]) bld.box(2.0, 0.05, 0.8, s * 1.6, 0.03, 0, colored(0x0f2a66, { metal: 0.6, rough: 0.25 }));
      return bld.build({ shadow: false });
    })();
    for (let r = 0; r < rings; r++)
      for (let i = 0; i < perRing; i++) {
        const s = proto.clone();
        s.scale.setScalar(satScale);
        this.group.add(s);
        this.sats.push({ s, r, i });
      }
    // anneaux d'orbite
    for (let r = 0; r < rings; r++) {
      const ringG = new THREE.RingGeometry(orbit - 0.06, orbit + 0.06, 90);
      const m = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x58b4ff).multiplyScalar(1.0), transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
      m.rotation.set(Math.PI / 2 + (r === 0 ? 0.5 : -0.55), 0, r === 0 ? 0.2 : 1.1);
      this.group.add(m);
    }
    this.globe = globe; this.grid = grid;
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this.beams = [];
  }
  /** retourne positions monde (locales) des satellites pour tracer des faisceaux */
  update(t, alpha = 1) {
    this.globe.rotation.y = t * 0.15;
    this.grid.rotation.y = t * 0.15;
    for (const { s, r, i } of this.sats) {
      const a = (i / this.perRing) * TAU + t * (r === 0 ? 0.45 : -0.38);
      const tilt = r === 0 ? 0.5 : -0.55;
      const x = Math.cos(a) * this.orbit, z = Math.sin(a) * this.orbit;
      // inclinaison de l'orbite
      const y = z * Math.sin(tilt), zz = z * Math.cos(tilt);
      s.position.set(x, y, zz);
      s.rotation.set(0, -a, 0);
      s.scale.setScalar(Math.max(1e-4, 0.55 * alpha));
    }
    this.group.visible = alpha > 0.01;
  }
  satPosition(i) {
    return this.sats[i % this.sats.length].s.position;
  }
}

// ---------------------------------------------------------------------------
// Bourse : colonnade, fronton, ticker, marches
// ---------------------------------------------------------------------------
export function makeExchange({ label = "BOURSE" } = {}) {
  const b = new Builder();
  b.setLayer(0, "rise");
  b.box(46, 0.6, 32, 0, 0, 0, "marble");
  b.box(42, 0.6, 30, 0, 0.6, 0, "marble");
  b.box(38, 0.6, 28, 0, 1.2, 0, "marble");
  b.setLayer(1, "rise");
  b.box(32, 12, 20, 0, 1.8, -2, "white");
  for (let i = 0; i < 8; i++) {
    b.cyl(1.05, 1.05, 11.4, -14 + i * 4, 1.8, 9.6, "marble", 18);
    b.cyl(1.4, 1.4, 0.5, -14 + i * 4, 1.8, 9.6, "marble", 18);
    b.cyl(1.4, 1.4, 0.5, -14 + i * 4, 12.7, 9.6, "marble", 18);
  }
  b.box(2.8, 7, 0.3, 0, 1.8, 8.05, "dark");
  b.setLayer(2, "drop");
  b.box(34, 1.5, 24, 0, 13.4, -0.6, "marble");
  const gable = new THREE.Shape();
  gable.moveTo(-17, 0); gable.lineTo(17, 0); gable.lineTo(0, 5.2); gable.closePath();
  b.add(new THREE.ExtrudeGeometry(gable, { depth: 23, bevelEnabled: false }), "offwhite", 0, 14.9, -12);
  b.box(30, 0.2, 0.3, 0, 14.4, 11.7, "goldGlow");
  const g = b.build();
  const tex = labelTexture(label, { w: 1024, h: 160, font: '700 110px "Space Grotesk"', color: "#ffd978", bg: "#0a1426", glow: "#ffb81c" });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.8), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 14.2, 11.9);
  sign.userData.layer = 2;
  g.add(sign);
  g.userData.layerCount = 3;
  return g;
}

// ---------------------------------------------------------------------------
// Banque : colonnade, dôme doré, coque démontable (applyBuild inversé) ; intérieur séparé
// ---------------------------------------------------------------------------
export function makeBankShell({ label = "BANQUE" } = {}) {
  const b = new Builder();
  b.setLayer(0, "rise");
  b.box(44, 0.6, 32, 0, 0, 0, "marble");
  b.box(40, 0.6, 30, 0, 0.6, 0, "marble");
  b.setLayer(1, "rise");
  // murs extérieurs (évidés : intérieur visible une fois la coque retirée)
  b.box(36, 12, 1, 0, 1.2, -13, "white");
  b.box(1, 12, 26, -17.5, 1.2, 0, "white");
  b.box(1, 12, 26, 17.5, 1.2, 0, "white");
  b.box(36, 12, 1, 0, 1.2, 13, "white");
  for (let i = 0; i < 6; i++) {
    b.cyl(1.0, 1.0, 11.6, -15 + i * 6, 1.2, 14.4, "marble", 18);
  }
  b.setLayer(2, "drop");
  b.box(38, 1.4, 30, 0, 13.2, 0, "marble");
  const gable = new THREE.Shape();
  gable.moveTo(-19, 0); gable.lineTo(19, 0); gable.lineTo(0, 4.6); gable.closePath();
  b.add(new THREE.ExtrudeGeometry(gable, { depth: 4, bevelEnabled: false }), "offwhite", 0, 14.6, 10);
  b.cyl(5.6, 6.2, 1.4, 0, 14.6, -4, "marble", 28);
  b.add(new THREE.SphereGeometry(5.4, 28, 14, 0, TAU, 0, Math.PI / 2), "gold", 0, 16.0, -4);
  b.cyl(0.4, 0.4, 3, 0, 21.4, -4, "gold", 10);
  b.sphere(0.6, 0, 24.4, -4, "goldGlow", 10);
  const g = b.build();
  const tex = labelTexture(label, { w: 1024, h: 160, font: '700 110px "Space Grotesk"', color: "#ffd978", bg: "#0a1426", glow: "#ffb81c" });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.6), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 14.4, 15.05);
  sign.userData.layer = 2;
  g.add(sign);
  g.userData.layerCount = 3;
  return g;
}

/** intérieur de la banque : sol, comptoirs, mur du coffre (la porte est un composant séparé) */
export function makeBankInterior() {
  const b = new Builder();
  b.setLayer(0, "static");
  b.box(36, 0.3, 26, 0, 1.2, 0, colored(0x232f52));
  // damier doré
  for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2 === 0) b.box(4, 0.04, 4, -16 + i * 4, 1.5, -10 + j * 4, colored(0x33437a));
  b.box(36, 12, 0.8, 0, 1.5, -12.6, colored(0x2a3a64)); // mur du fond (coffre)
  b.box(0.8, 12, 25, -17.4, 1.5, 0, colored(0x2a3a64));
  b.box(36, 0.3, 0.3, 0, 7.2, -12.1, "goldGlow");
  // guichets
  for (let i = 0; i < 3; i++) {
    b.box(7, 3.2, 1.6, 6 + i * 0, 1.5, 4 - i * 5.2, "marble");
    b.box(7.2, 0.3, 1.8, 6, 4.7 - i * 0, 4 - i * 5.2, "gold");
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Pièce sombre d'ouverture (hub) : sol, deux murs, podium, panneau compteur
// ---------------------------------------------------------------------------
export function makeHubRoom() {
  const b = new Builder();
  b.setLayer(0, "static");
  b.box(52, 0.5, 52, 0, -0.5, 0, colored(0x1b2438));
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) if ((i + j) % 2 === 0) b.box(4, 0.05, 4, -24 + i * 4, 0, -24 + j * 4, colored(0x222d45));
  b.setLayer(1, "rise");
  b.box(52, 24, 1.2, 0, 0, -26, colored(0x16203a));
  b.box(1.2, 24, 52, -26, 0, 0, colored(0x16203a));
  // nervures + lisères lumineux verticaux
  for (let i = -3; i <= 3; i++) {
    b.box(0.8, 24, 0.9, i * 7.4, 0, -25.2, colored(0x1f2c4c));
    b.box(0.9, 24, 0.8, -25.2, 0, i * 7.4, colored(0x1f2c4c));
    b.box(0.18, 24, 0.2, i * 7.4 + 3.7, 0, -25.3, "blueGlow");
    b.box(0.2, 24, 0.18, -25.3, 0, i * 7.4 + 3.7, "blueGlow");
  }
  b.box(52, 0.5, 0.6, 0, 23.2, -25.2, "blueGlow");
  b.box(0.6, 0.5, 52, -25.2, 23.2, 0, "blueGlow");
  b.box(52, 0.5, 0.6, 0, 0.1, -25.2, "blueGlow");
  b.box(0.6, 0.5, 52, -25.2, 0.1, 0, "blueGlow");
  const g = b.build();
  return g;
}

export function makePodium(r = 6.5) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.6, 1.0, 48), mat("metalDark"));
  base.position.y = 0.5;
  base.castShadow = base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.4, r - 0.4, 0.2, 48), colored(0x27324f));
  top.position.y = 1.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.2, 0.14, 8, 64), mat("goldGlow"));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.18;
  g.add(base, top, ring);
  g.userData.ring = ring;
  return g;
}

// ---------------------------------------------------------------------------
// Skyline de fond (instancié, très léger) pour habiller les plans larges
// ---------------------------------------------------------------------------
export function makeSkyline({ count = 220, inner = 150, outer = 330, seed = 13 } = {}) {
  const R = rng(seed);
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x1e2a44 }), count);
  const wins = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4aa3ff).multiplyScalar(1.5) }), count * 2);
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = R() * TAU, r = inner + Math.sqrt(R()) * (outer - inner);
    const w = 5 + R() * 9, h = 8 + Math.pow(R(), 2.2) * 70, dd = 5 + R() * 9;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    d.position.set(x, h / 2, z);
    d.scale.set(w, h, dd);
    d.updateMatrix();
    towers.setMatrixAt(i, d.matrix);
    for (let k = 0; k < 2; k++) {
      d.position.set(x + (R() - 0.5) * w * 0.5, 2 + R() * (h - 4), z + dd / 2 + 0.05);
      d.scale.set(w * 0.5, 0.5, 0.2);
      d.updateMatrix();
      wins.setMatrixAt(i * 2 + k, d.matrix);
    }
  }
  const g = new THREE.Group();
  g.add(towers, wins);
  return g;
}
