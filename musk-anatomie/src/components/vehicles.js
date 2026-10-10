// Véhicules et machines : voitures (flotte instanciée), fusée, satellites, robots industriels, grues.
import * as THREE from "three";
import { Builder } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { clamp, lerp, ease, TAU, rng } from "../core/util.js";
import { Burst } from "./fx.js";

// ---------------------------------------------------------------------------
// Voiture berline (profil extrudé) — flotte instanciée
// ---------------------------------------------------------------------------
function carGeometries() {
  const body = new THREE.Shape();
  const P = [[2.3, 0.38], [2.34, 0.72], [1.35, 0.9], [0.95, 0.92], [0.25, 1.38], [-0.95, 1.4], [-1.85, 0.98], [-2.3, 0.92], [-2.34, 0.4]];
  body.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) body.lineTo(P[i][0], P[i][1]);
  body.closePath();
  const bodyG = new THREE.ExtrudeGeometry(body, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.17, bevelSize: 0.14, bevelSegments: 2, curveSegments: 4 });
  bodyG.translate(0, 0, -0.75);
  const glass = new THREE.Shape();
  const Q = [[0.9, 0.93], [0.22, 1.33], [-0.9, 1.35], [-1.7, 1.0]];
  glass.moveTo(Q[0][0], Q[0][1]);
  for (let i = 1; i < Q.length; i++) glass.lineTo(Q[i][0], Q[i][1]);
  glass.closePath();
  const glassG = new THREE.ExtrudeGeometry(glass, { depth: 1.52, bevelEnabled: false });
  glassG.translate(0, 0.02, -0.76);
  const wheel = new THREE.CylinderGeometry(0.44, 0.44, 0.3, 14);
  wheel.rotateX(Math.PI / 2);
  const front = new THREE.BoxGeometry(0.1, 0.12, 1.3);
  front.translate(2.38, 0.68, 0);
  const rear = new THREE.BoxGeometry(0.1, 0.12, 1.3);
  rear.translate(-2.4, 0.78, 0);
  return { bodyG, glassG, wheel, front, rear };
}

export class CarFleet {
  constructor(count, { colors = [0xf2f5fa, 0xd9202f, 0x1d5fe0, 0x14171d, 0xaab4c4], scale = 1, seed = 8 } = {}) {
    this.n = count;
    this.scale = scale;
    const g = carGeometries();
    const R = rng(seed);
    this.body = new THREE.InstancedMesh(g.bodyG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.45 }), count);
    this.glass = new THREE.InstancedMesh(g.glassG, new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.08, metalness: 0.6 }), count);
    this.wheels = new THREE.InstancedMesh(g.wheel, mat("rubber"), count * 4);
    this.front = new THREE.InstancedMesh(g.front, mat("whiteGlow"), count);
    this.rear = new THREE.InstancedMesh(g.rear, mat("redGlow"), count);
    this.group = new THREE.Group();
    for (const m of [this.body, this.glass, this.wheels, this.front, this.rear]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.body.castShadow = true;
    this.glass.castShadow = true;
    this.wheels.castShadow = true;
    this.body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.set(colors[Math.floor(R() * colors.length)]);
      this.body.setColorAt(i, c);
    }
    this._o = new THREE.Object3D();
    this._w = new THREE.Object3D();
    this._m = new THREE.Matrix4();
  }

  /** fn(i) -> {x,y,z,ry,dist,vis} ; vis = 0 masque la voiture */
  update(fn) {
    const o = this._o, w = this._w, s = this.scale;
    const wheelOff = [[1.5, 0.44, 0.85], [1.5, 0.44, -0.85], [-1.5, 0.44, 0.85], [-1.5, 0.44, -0.85]];
    for (let i = 0; i < this.n; i++) {
      const st = fn(i);
      const vis = (st.vis ?? 1) * s;
      o.position.set(st.x, st.y ?? 0, st.z);
      o.rotation.set(0, st.ry ?? 0, 0);
      o.scale.setScalar(Math.max(1e-4, vis));
      o.updateMatrix();
      this.body.setMatrixAt(i, o.matrix);
      this.glass.setMatrixAt(i, o.matrix);
      this.front.setMatrixAt(i, o.matrix);
      this.rear.setMatrixAt(i, o.matrix);
      for (let k = 0; k < 4; k++) {
        w.position.set(wheelOff[k][0], wheelOff[k][1], wheelOff[k][2]);
        w.rotation.set(0, 0, -(st.dist ?? 0) / 0.44);
        w.scale.setScalar(1);
        w.updateMatrix();
        this._m.multiplyMatrices(o.matrix, w.matrix);
        this.wheels.setMatrixAt(i * 4 + k, this._m);
      }
    }
    for (const m of [this.body, this.glass, this.front, this.rear, this.wheels]) m.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Fusée (Super Heavy + Starship) — base à l'origine, pointe vers +Y
// ---------------------------------------------------------------------------
export class Rocket {
  constructor({ scale = 1, withBooster = true, shipOnly = false } = {}) {
    this.group = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(scale);
    this.group.add(inner);

    const steel = mat("steel");
    const prof = (r, h, noseH = 0) => {
      const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(r, 0)];
      const bodyH = h - noseH;
      pts.push(new THREE.Vector2(r, bodyH));
      for (let i = 1; i <= 10; i++) {
        const k = i / 10;
        pts.push(new THREE.Vector2(r * Math.sqrt(Math.max(0.0004, 1 - k * k)) * (1 - 0.12 * k), bodyH + noseH * k));
      }
      return pts;
    };
    const mk = (geo, m, x, y, z) => {
      const me = new THREE.Mesh(geo, m);
      me.position.set(x, y, z);
      me.castShadow = true;
      inner.add(me);
      return me;
    };
    const shipBase = withBooster && !shipOnly ? 12.4 : 0;
    // étage supérieur
    mk(new THREE.LatheGeometry(prof(2.15, 13.6, 4.6), 32), steel, 0, shipBase, 0);
    // bouclier thermique (demi-coque sombre)
    mk(new THREE.CylinderGeometry(2.18, 2.18, 8.8, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat("black"), 0, shipBase + 0.4, 0).rotation.y = 0.0;
    // ailerons
    const flap = new THREE.BoxGeometry(0.2, 3.0, 1.5);
    const fl = [[1, 1, 1], [-1, 1, 1], [1, -1, -1], [-1, -1, -1]];
    for (const [sx, , ] of fl) {
      mk(flap, mat("black"), sx * 2.5, shipBase + 10.8, 0.0).rotation.z = sx * 0.18;
      const rf = new THREE.BoxGeometry(0.22, 3.8, 2.2);
      mk(rf, mat("black"), sx * 2.55, shipBase + 2.4, 0.0).rotation.z = -sx * 0.12;
    }
    // moteurs du vaisseau
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      mk(new THREE.ConeGeometry(0.46, 0.9, 12, 1, true), mat("metalDark"), Math.cos(a) * 0.9, shipBase - 0.35, Math.sin(a) * 0.9).rotation.x = Math.PI;
    }
    if (withBooster && !shipOnly) {
      mk(new THREE.LatheGeometry(prof(2.15, 12.4, 0), 32), steel, 0, 0, 0);
      mk(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24), mat("black"), 0, 12.0, 0); // anneau d'interétage
      const gridFin = new THREE.BoxGeometry(1.5, 0.12, 1.2);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        mk(gridFin, mat("metalDark"), Math.cos(a) * 2.6, 11.2, Math.sin(a) * 2.6).rotation.y = -a;
      }
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const r = i === 0 ? 0 : 1.15;
        mk(new THREE.ConeGeometry(0.34, 0.8, 10, 1, true), mat("metalDark"), Math.cos(a) * r, -0.3, Math.sin(a) * r).rotation.x = Math.PI;
      }
    }
    // flamme (additive) : 2 cônes imbriqués
    this.flameOuter = new THREE.Mesh(new THREE.ConeGeometry(1.7, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3d).multiplyScalar(1.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const f of [this.flameOuter, this.flameInner]) {
      f.rotation.x = Math.PI;
      f.frustumCulled = false;
      inner.add(f);
    }
    this.flameOuter.position.y = -4.4;
    this.flameInner.position.y = -3.2;
    this.height = shipBase + 13.6 + 0;
    this.scaleF = scale;
  }
  /** k : intensité de poussée 0..1 ; t : temps (scintillement) */
  setFlame(k, t) {
    const fl = 0.9 + Math.sin(t * 60) * 0.06 + Math.sin(t * 37) * 0.05;
    const s = Math.max(1e-4, k * fl);
    this.flameOuter.scale.set(s, s * (0.9 + k * 0.5), s);
    this.flameInner.scale.set(s, s * (0.9 + k * 0.5), s);
    this.flameOuter.visible = this.flameInner.visible = k > 0.01;
  }
}

// ---------------------------------------------------------------------------
// Flamme de propulsion autonome (pour fusées voxel ou modèles) : base à l'origine, jet vers -Y
// ---------------------------------------------------------------------------
export function makeFlame(scale = 1) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(1.9, 10, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3d).multiplyScalar(1.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(1.0, 6.5, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const f of [outer, inner]) { f.rotation.x = Math.PI; f.frustumCulled = false; g.add(f); }
  outer.position.y = -5;
  inner.position.y = -3.25;
  g.scale.setScalar(scale);
  g.userData.set = (k, t) => {
    const fl = 0.9 + Math.sin(t * 60) * 0.06 + Math.sin(t * 37) * 0.05;
    const s2 = Math.max(1e-4, k * fl);
    outer.scale.set(s2, s2 * (0.9 + k * 0.5), s2);
    inner.scale.set(s2, s2 * (0.9 + k * 0.5), s2);
    g.visible = k > 0.01;
  };
  return g;
}

// ---------------------------------------------------------------------------
// Satellite Starlink (panneau solaire + châssis plat)
// ---------------------------------------------------------------------------
export function makeSatellite(scale = 1) {
  const b = new Builder();
  b.setLayer(0, "static");
  b.box(1.6, 0.14, 1.0, 0, 0, 0, "white");
  b.box(0.5, 0.18, 0.5, 0, 0.02, 0.0, "blueGlow");
  for (const s of [-1, 1]) {
    b.box(2.6, 0.06, 1.0, s * 2.2, 0.04, 0, colored(0x0f2a66, { metal: 0.6, rough: 0.2 }));
    b.box(2.6, 0.07, 0.04, s * 2.2, 0.04, 0, "metal");
  }
  const g = b.build({ shadow: false });
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------------------
// Bras robotisé industriel — angles pilotés par t
// ---------------------------------------------------------------------------
export class RobotArm {
  constructor({ scale = 1, color = "white", accent = "blueGlow" } = {}) {
    this.root = new THREE.Group();
    const s = scale;
    const mk = (geo, m) => { const me = new THREE.Mesh(geo, mat(m)); me.castShadow = true; return me; };
    const base = mk(new THREE.CylinderGeometry(0.9 * s, 1.1 * s, 0.7 * s, 16), "metalDark");
    base.position.y = 0.35 * s;
    this.root.add(base);
    this.turret = new THREE.Group(); // lacet
    this.turret.position.y = 0.7 * s;
    this.root.add(this.turret);
    const col = mk(new THREE.CylinderGeometry(0.7 * s, 0.7 * s, 0.6 * s, 16), color);
    col.position.y = 0.3 * s;
    this.turret.add(col);
    this.shoulder = new THREE.Group();
    this.shoulder.position.y = 0.7 * s;
    this.turret.add(this.shoulder);
    const j1 = mk(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 1.1 * s, 14), accent);
    j1.rotation.z = Math.PI / 2;
    this.shoulder.add(j1);
    const l1 = mk(new THREE.BoxGeometry(0.5 * s, 2.6 * s, 0.6 * s), color);
    l1.position.y = 1.3 * s;
    this.shoulder.add(l1);
    this.elbow = new THREE.Group();
    this.elbow.position.y = 2.6 * s;
    this.shoulder.add(this.elbow);
    const j2 = mk(new THREE.CylinderGeometry(0.34 * s, 0.34 * s, 0.9 * s, 14), accent);
    j2.rotation.z = Math.PI / 2;
    this.elbow.add(j2);
    const l2 = mk(new THREE.BoxGeometry(0.4 * s, 2.3 * s, 0.5 * s), color);
    l2.position.y = 1.15 * s;
    this.elbow.add(l2);
    this.wrist = new THREE.Group();
    this.wrist.position.y = 2.3 * s;
    this.elbow.add(this.wrist);
    const tool = mk(new THREE.CylinderGeometry(0.14 * s, 0.26 * s, 0.8 * s, 10), "metal");
    tool.position.y = 0.4 * s;
    this.wrist.add(tool);
    this.tip = new THREE.Object3D();
    this.tip.position.y = 0.85 * s;
    this.wrist.add(this.tip);
    this.sparks = new Burst(14, { size: 0.12 * s, color: 0xffe08a, gravity: 14, speed: 5, life: 0.5, seed: 31 });
    this.group = new THREE.Group();
    this.group.add(this.root, this.sparks.mesh);
    this._tipW = new THREE.Vector3();
  }
  place(x, y, z, ry = 0) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = ry;
    return this;
  }
  /** animation de soudure/assemblage */
  update(t, phase = 0, rate = 1) {
    const a = t * rate + phase;
    this.turret.rotation.y = Math.sin(a * 0.9) * 0.9;
    this.shoulder.rotation.x = 0.35 + Math.sin(a * 1.3) * 0.35;
    this.elbow.rotation.x = -1.1 + Math.sin(a * 1.9 + 1) * 0.5;
    this.wrist.rotation.x = 0.6 + Math.sin(a * 2.7) * 0.4;
    this.root.updateWorldMatrix(true, true);
    this.tip.getWorldPosition(this._tipW);
    const tt = (t * rate + phase) % 0.7;
    this.sparks.update(tt, 0, [this._tipW.x, this._tipW.y, this._tipW.z]);
  }
}

// ---------------------------------------------------------------------------
// Grue à tour (chantier) : flèche qui tourne, chariot qui coulisse, charge suspendue
// ---------------------------------------------------------------------------
export class Crane {
  constructor({ height = 26, jib = 18, scale = 1 } = {}) {
    this.group = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(scale);
    this.group.add(inner);
    const b = new Builder();
    b.setLayer(0, "static");
    const m = "metalDark";
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) b.box(0.18, height, 0.18, x, 0, z, m);
    for (let y = 1; y < height; y += 1.6) {
      b.box(1.5, 0.1, 0.1, 0, y, -0.7, m); b.box(1.5, 0.1, 0.1, 0, y, 0.7, m);
      b.box(0.1, 0.1, 1.5, -0.7, y, 0, m); b.box(0.1, 0.1, 1.5, 0.7, y, 0, m);
    }
    b.box(2.2, 0.5, 2.2, 0, height, 0, "white");
    inner.add(b.build());
    this.jibG = new THREE.Group();
    this.jibG.position.y = height + 0.5;
    inner.add(this.jibG);
    const jb = new Builder();
    jb.setLayer(0, "static");
    jb.box(jib, 0.5, 0.6, jib * 0.35, 0, 0, "metal");
    jb.box(5, 0.5, 0.8, -3.5, 0, 0, "metal");
    jb.box(1.8, 1.8, 1.4, -5, -1.5, 0, "concrete");
    jb.box(0.6, 1.6, 0.6, 0, 0.5, 0, "white");
    jb.box(jib * 0.7, 0.14, 0.14, jib * 0.15, 1.8, 0, "metalDark");
    this.jibG.add(jb.build());
    this.trolley = new THREE.Group();
    this.jibG.add(this.trolley);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), mat("blueGlow"));
    this.trolley.add(tr);
    this.cable = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), mat("black"));
    this.trolley.add(this.cable);
    this.load = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), mat("goldGlow"));
    this.trolley.add(this.load);
    this.height = height;
    this.jib = jib;
  }
  place(x, y, z) { this.group.position.set(x, y, z); return this; }
  update(t, phase = 0, loadVisible = 1) {
    this.jibG.rotation.y = Math.sin(t * 0.35 + phase) * 1.0 + 0.6;
    const reach = this.jib * (0.5 + 0.35 * Math.sin(t * 0.55 + phase));
    this.trolley.position.set(reach, -0.1, 0);
    const drop = 6 + 5 * (0.5 + 0.5 * Math.sin(t * 0.8 + phase));
    this.cable.scale.y = drop;
    this.cable.position.y = -drop / 2;
    this.load.position.y = -drop - 0.5;
    this.load.visible = loadVisible > 0.5;
  }
}
