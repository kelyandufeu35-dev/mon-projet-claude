// Effets visuels réutilisables : flux lumineux, pièces qui circulent, morphing de voxels, éclats, fumée.
// Tous déterministes : état = f(t) uniquement (graines fixes, pas d'horloge).
import * as THREE from "three";
import { rng, clamp, lerp, ease, inv, TAU } from "../core/util.js";
import { mat, colored } from "../core/palette.js";

// ---------------------------------------------------------------------------
// FlowLine : tube lumineux avec impulsions qui courent le long de la courbe.
// ---------------------------------------------------------------------------
const FLOW_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FLOW_FS = /* glsl */ `
varying vec2 vUv;
uniform float uTime, uSpeed, uPulses, uProg, uAlpha, uBase, uHeadGlow;
uniform vec3 uColor;
void main(){
  if (vUv.x > uProg) discard;
  float s = fract(vUv.x * uPulses - uTime * uSpeed * uPulses);
  float pulse = pow(1.0 - s, 5.0);
  float head = smoothstep(uProg - 0.06, uProg, vUv.x) * uHeadGlow;       // tête de ligne qui avance
  float k = uBase + pulse * 2.4 + head * 2.0;
  gl_FragColor = vec4(uColor * k, uAlpha * clamp(0.35 + pulse * 0.65 + head, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class FlowLine {
  constructor(points, { color = 0x39e0ff, radius = 0.28, speed = 0.22, pulses = 4, base = 0.55, tension = "centripetal", segments = 120 } = {}) {
    this.curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p))), false, tension);
    const geo = new THREE.TubeGeometry(this.curve, segments, radius, 6, false);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uSpeed: { value: speed }, uPulses: { value: pulses }, uProg: { value: 1 },
        uAlpha: { value: 1 }, uBase: { value: base }, uHeadGlow: { value: 0 }, uColor: { value: new THREE.Color(color) },
      },
      vertexShader: FLOW_VS, fragmentShader: FLOW_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }
  /** progress : 0..1 (tracé progressif), alpha : opacité globale */
  update(t, progress = 1, alpha = 1, headGlow = 0) {
    const u = this.mat.uniforms;
    u.uTime.value = t; u.uProg.value = progress; u.uAlpha.value = alpha; u.uHeadGlow.value = headGlow;
    this.mesh.visible = progress > 0.001 && alpha > 0.001;
  }
  pointAt(u) { return this.curve.getPointAt(clamp(u)); }
}

// ---------------------------------------------------------------------------
// FlowCoins : petites pièces/billets qui voyagent le long d'une courbe.
// ---------------------------------------------------------------------------
export class FlowCoins {
  constructor(curve, { count = 14, size = 0.7, color = 0xffb81c, speed = 0.12, lift = 0.6, shape = "coin" } = {}) {
    this.curve = curve;
    this.count = count;
    this.speed = speed;
    this.lift = lift;
    const geo = shape === "coin" ? new THREE.CylinderGeometry(size, size, size * 0.22, 14) : new THREE.BoxGeometry(size * 1.6, size * 0.12, size * 0.9);
    const m = shape === "coin" ? mat("gold") : colored(color);
    this.mesh = new THREE.InstancedMesh(geo, m, count);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this._d = new THREE.Object3D();
  }
  update(t, { alpha = 1, from = 0, to = 1, reverse = false } = {}) {
    const d = this._d;
    for (let i = 0; i < this.count; i++) {
      let u = (i / this.count + t * this.speed) % 1;
      if (reverse) u = 1 - u;
      const uu = lerp(from, to, u);
      const p = this.curve.getPointAt(clamp(uu));
      d.position.copy(p);
      d.position.y += this.lift + Math.sin(t * 5 + i) * 0.15;
      d.rotation.set(Math.PI / 2 * 0.0, t * 3 + i, t * 2 + i * 0.7);
      d.scale.setScalar(alpha);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = alpha > 0.01;
  }
}

// ---------------------------------------------------------------------------
// VoxelMorph : N cubes qui passent d'une forme à une autre (morphing « LEGO »).
// ---------------------------------------------------------------------------
export class VoxelMorph {
  /**
   * @param {number} count nombre de cubes
   * @param {Array<Array<{x,y,z,c,s?}>>} formations liste de formes ; chaque forme = voxels (≤ count)
   */
  constructor(count, formations, { seed = 3, arc = 6, spin = 3, material = null } = {}) {
    this.count = count;
    this.R = rng(seed);
    this.arc = arc;
    this.spin = spin;
    const m = material || new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m, count);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.delay = new Float32Array(count);
    this.axis = [];
    for (let i = 0; i < count; i++) {
      this.delay[i] = this.R();
      this.axis.push(new THREE.Vector3(this.R() - 0.5, this.R() - 0.5, this.R() - 0.5).normalize());
    }
    this.setFormations(formations);
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
  }

  setFormations(formations) {
    const n = this.count;
    this.F = formations.map((vox) => {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sc = new Float32Array(n), sx = new Float32Array(n * 3);
      // ordonne les voxels de façon stable (par hauteur puis angle) pour que chaque cube garde un rôle cohérent
      const list = vox.slice(0, n);
      for (let i = 0; i < n; i++) {
        const v = list[i % Math.max(1, list.length)];
        const present = i < list.length;
        pos[i * 3] = v ? v.x : 0; pos[i * 3 + 1] = v ? v.y : 0; pos[i * 3 + 2] = v ? v.z : 0;
        const c = new THREE.Color(v ? v.c : 0xffffff);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        sc[i] = present ? (v.s ?? 1) : 0;
        sx[i * 3] = v.sx ?? 1; sx[i * 3 + 1] = v.sy ?? 1; sx[i * 3 + 2] = v.sz ?? 1;
      }
      return { pos, col, sc, sx };
    });
  }

  /** m : indice continu de formation (0 → 1ère forme, 1 → 2e…) ; origin : décalage monde */
  update(m, origin = [0, 0, 0], globalScale = 1, t = 0, tumble = 0) {
    const d = this._d, c = this._c, F = this.F;
    const qa = this._qa || (this._qa = new THREE.Quaternion()), qb = this._qb || (this._qb = new THREE.Quaternion()), qi = this._qi || (this._qi = new THREE.Quaternion());
    const k = clamp(Math.floor(m), 0, F.length - 1);
    const k2 = Math.min(k + 1, F.length - 1);
    const f = k === k2 ? 0 : m - k;
    const A = F[k], B = F[k2];
    for (let i = 0; i < this.count; i++) {
      const lf = clamp((f - this.delay[i] * 0.45) / 0.55);
      const e = ease.io3(lf);
      const x = lerp(A.pos[i * 3], B.pos[i * 3], e);
      let y = lerp(A.pos[i * 3 + 1], B.pos[i * 3 + 1], e);
      const z = lerp(A.pos[i * 3 + 2], B.pos[i * 3 + 2], e);
      const flight = Math.sin(e * Math.PI);
      y += flight * this.arc * (0.4 + this.delay[i]);
      const s = lerp(A.sc[i], B.sc[i], e) * globalScale;
      d.position.set(origin[0] + x, origin[1] + y, origin[2] + z);
      qa.setFromAxisAngle(this.axis[i], flight * this.spin * (1 + this.delay[i]));
      const tw = tumble * clamp(1 - m);
      if (tw > 0.001) {
        qb.setFromAxisAngle(this.axis[i], t * (0.8 + this.delay[i] * 1.6) + this.delay[i] * 20);
        qi.identity().slerp(qb, tw);
        qa.multiply(qi);
      }
      d.quaternion.copy(qa);
      const sA = A.sx, sB = B.sx, ss = Math.max(1e-4, s);
      d.scale.set(ss * lerp(sA[i * 3], sB[i * 3], e), ss * lerp(sA[i * 3 + 1], sB[i * 3 + 1], e), ss * lerp(sA[i * 3 + 2], sB[i * 3 + 2], e));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      c.setRGB(lerp(A.col[i * 3], B.col[i * 3], e), lerp(A.col[i * 3 + 1], B.col[i * 3 + 1], e), lerp(A.col[i * 3 + 2], B.col[i * 3 + 2], e));
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// --- générateurs de formes en voxels (coordonnées locales, y = haut) -------
const hex = (r, g, b) => (r << 16) | (g << 8) | b;
export const Shapes = {
  /** disque de pièces en spirale (billets/pièces qui tournent autour de soi) */
  coinSwirl(n, { radius = 9, height = 10, size = 1, color = 0xffb81c, seed = 5 } = {}) {
    const R = rng(seed);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963 + R() * 0.4, r = radius * (0.35 + 0.65 * Math.sqrt(R()));
      const bill = R() < 0.72;
      out.push(bill
        ? { x: Math.cos(a) * r, y: 1.5 + (i / n) * height + R() * 1.2, z: Math.sin(a) * r, c: R() < 0.5 ? 0x6fd89a : 0x9be8b8, s: size * (0.8 + R() * 0.35), sx: 1.9, sy: 0.12, sz: 1.0 }
        : { x: Math.cos(a) * r, y: 1.5 + (i / n) * height + R() * 1.2, z: Math.sin(a) * r, c: R() < 0.3 ? 0xfff0b0 : color, s: size * (0.75 + R() * 0.4), sx: 1, sy: 0.2, sz: 1 });
    }
    return out;
  },
  /** boîte pleine voxelisée */
  box(w, h, d, vs, { color = 0xffffff, accent = null, accentEvery = 5, center = [0, 0, 0] } = {}) {
    const out = [];
    const nx = Math.round(w / vs), ny = Math.round(h / vs), nz = Math.round(d / vs);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        for (let z = 0; z < nz; z++) {
          const edge = x === 0 || y === 0 || z === 0 || x === nx - 1 || y === ny - 1 || z === nz - 1;
          if (!edge && !(accent != null)) continue;
          out.push({ x: center[0] + (x - (nx - 1) / 2) * vs, y: center[1] + y * vs + vs / 2, z: center[2] + (z - (nz - 1) / 2) * vs, c: accent != null && (x + y + z) % accentEvery === 0 ? accent : color, s: vs * 0.94 });
        }
    return out;
  },
  /** fusée voxel (corps cylindrique + ogive + ailerons) */
  rocket(vs, { radius = 2.2, height = 18, base = [0, 0, 0], body = 0xdfe5ee, nose = 0xaab4c4, fin = 0x1c212b, flame = null } = {}) {
    const out = [];
    const rN = Math.ceil(radius / vs);
    const nH = Math.round(height / vs);
    for (let y = 0; y < nH; y++) {
      const yy = y * vs;
      const noseStart = nH * 0.74;
      const rr = y < noseStart ? radius : radius * Math.max(0.05, Math.sqrt(1 - Math.pow((y - noseStart) / (nH - noseStart), 2)));
      for (let x = -rN; x <= rN; x++)
        for (let z = -rN; z <= rN; z++) {
          const dist = Math.hypot(x * vs, z * vs);
          if (dist <= rr && dist > rr - vs * 1.1) {
            const c = y < noseStart ? ((y % 7 === 0 || y === nH - 1) ? 0x3b82f6 : body) : nose;
            out.push({ x: base[0] + x * vs, y: base[1] + yy + vs / 2, z: base[2] + z * vs, c, s: vs * 0.95 });
          }
        }
    }
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      for (let k = 0; k < 4; k++)
        for (let j = 0; j < 4 - k; j++)
          out.push({ x: base[0] + fx * (radius + (k + 0.5) * vs * 0.8), y: base[1] + j * vs + vs / 2, z: base[2] + fz * (radius + (k + 0.5) * vs * 0.8), c: fin, s: vs * 0.9 });
    return out;
  },
  /** immeuble/ville voxel */
  tower(vs, { w = 6, d = 6, h = 14, base = [0, 0, 0], color = 0xe8edf5, window = 0x58b4ff } = {}) {
    const out = [];
    const nx = Math.round(w / vs), nz = Math.round(d / vs), ny = Math.round(h / vs);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        for (let z = 0; z < nz; z++) {
          const edge = x === 0 || z === 0 || x === nx - 1 || z === nz - 1 || y === ny - 1;
          if (!edge) continue;
          const win = y % 2 === 1 && ((x + z) % 2 === 0) && y < ny - 1;
          out.push({ x: base[0] + (x - (nx - 1) / 2) * vs, y: base[1] + y * vs + vs / 2, z: base[2] + (z - (nz - 1) / 2) * vs, c: win ? window : color, s: vs * 0.94 });
        }
    return out;
  },
  /** usine à toit en dents de scie */
  factory(vs, { w = 18, d = 9, h = 5, base = [0, 0, 0], wall = 0xe8edf5, roof = 0x8e99aa, glow = 0x58b4ff } = {}) {
    const out = [];
    const nx = Math.round(w / vs), nz = Math.round(d / vs), ny = Math.round(h / vs);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        for (let z = 0; z < nz; z++) {
          const edge = x === 0 || z === 0 || x === nx - 1 || z === nz - 1;
          if (!edge && y < ny - 1) continue;
          out.push({ x: base[0] + (x - (nx - 1) / 2) * vs, y: base[1] + y * vs + vs / 2, z: base[2] + (z - (nz - 1) / 2) * vs, c: y === ny - 1 ? roof : wall, s: vs * 0.94 });
        }
    const teeth = Math.floor(nx / 3);
    for (let tIdx = 0; tIdx < teeth; tIdx++)
      for (let z = 0; z < nz; z++)
        for (let k = 0; k < 2; k++)
          out.push({ x: base[0] + (tIdx * 3 + 1 - (nx - 1) / 2) * vs, y: base[1] + (ny + k) * vs + vs / 2, z: base[2] + (z - (nz - 1) / 2) * vs, c: k === 1 ? glow : roof, s: vs * 0.94 });
    return out;
  },
  /** certificat d'action : dalle fine à bordure dorée */
  share(vs, { w = 10, h = 6, base = [0, 0, 0], face = 0x10244f, border = 0xffb81c, accent = 0x58b4ff } = {}) {
    const out = [];
    const nx = Math.round(w / vs), ny = Math.round(h / vs);
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const edge = x === 0 || y === 0 || x === nx - 1 || y === ny - 1;
        const mid = Math.abs(x - (nx - 1) / 2) < 1.2 && y > 1 && y < ny - 2;
        out.push({ x: base[0] + (x - (nx - 1) / 2) * vs, y: base[1] + y * vs + vs / 2, z: base[2], c: edge ? border : mid ? accent : face, s: vs * 0.94 });
      }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Burst : éclats de particules (étincelles, pièces, confettis) déterministes.
// ---------------------------------------------------------------------------
export class Burst {
  constructor(count = 60, { size = 0.35, color = 0xffd978, gravity = 18, speed = 12, life = 1.4, seed = 9, spread = 1, up = 0.7, glow = true } = {}) {
    this.count = count; this.life = life; this.gravity = gravity;
    const R = rng(seed);
    this.v = []; this.delay = [];
    for (let i = 0; i < count; i++) {
      const a = R() * TAU, e = (R() * 0.8 + 0.2) * spread, s = speed * (0.4 + R() * 0.8);
      this.v.push(new THREE.Vector3(Math.cos(a) * e * s, up * s * (0.5 + R()), Math.sin(a) * e * s));
      this.delay.push(R() * 0.15);
    }
    const m = glow ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8) }) : colored(color);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), m, count);
    this.mesh.frustumCulled = false;
    this._d = new THREE.Object3D();
  }
  /** t0 : instant d'émission ; origin : position monde */
  update(t, t0, origin) {
    const age0 = t - t0;
    const d = this._d;
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const age = age0 - this.delay[i];
      if (age < 0 || age > this.life) { d.scale.setScalar(1e-4); d.position.set(0, -50, 0); }
      else {
        any = true;
        const v = this.v[i];
        d.position.set(origin[0] + v.x * age, origin[1] + v.y * age - 0.5 * this.gravity * age * age, origin[2] + v.z * age);
        d.rotation.set(age * 6 + i, age * 5, age * 4);
        d.scale.setScalar(Math.max(1e-4, 1 - age / this.life));
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = any;
  }
}

// ---------------------------------------------------------------------------
// SmokeTrail : panache reconstruit à partir de la trajectoire déterministe P(t).
// ---------------------------------------------------------------------------
export class SmokeTrail {
  constructor(count = 46, { color = 0xcfd8e8, size = 1.6, dt = 0.06, rise = 2.2, spread = 1.2, seed = 4 } = {}) {
    this.count = count; this.dt = dt; this.rise = rise; this.spread = spread; this.size = size;
    const R = rng(seed);
    this.off = Array.from({ length: count }, () => new THREE.Vector3((R() - 0.5), R() * 0.6, (R() - 0.5)));
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }), count);
    this.mesh.frustumCulled = false;
    this._d = new THREE.Object3D();
  }
  /** pathFn(t) -> THREE.Vector3 ; active(t) -> 0..1 (intensité d'émission) */
  update(t, pathFn, active = (tt) => 1) {
    const d = this._d;
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const tt = t - i * this.dt;
      const act = active(tt);
      if (act <= 0.001 || tt < 0) { d.scale.setScalar(1e-4); d.position.set(0, -50, 0); }
      else {
        any = true;
        const age = i * this.dt;
        const p = pathFn(tt);
        const o = this.off[i];
        d.position.set(p.x + o.x * this.spread * age * 2.5, p.y + o.y + age * this.rise * 0.2, p.z + o.z * this.spread * age * 2.5);
        const grow = Math.min(1, age * 3) * (1 - Math.pow(i / this.count, 1.6));
        d.scale.setScalar(Math.max(1e-4, this.size * (0.5 + age * 1.4) * grow * act));
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = any;
  }
}

/** champ d'étoiles/poussières lumineuses pour l'ambiance (statique, très léger) */
export function makeDust(count = 260, { radius = 140, height = 70, seed = 21, color = 0x7fb2ff, size = 0.28 } = {}) {
  const R = rng(seed);
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.8 }), count);
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    d.position.set((R() - 0.5) * radius * 2, 4 + R() * height, (R() - 0.5) * radius * 2);
    d.scale.setScalar(0.5 + R());
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  }
  m.frustumCulled = false;
  return m;
}

/** déplace/oriente une liste de voxels : rotation ry autour de Y puis translation */
Shapes.place = function place(vox, [px = 0, py = 0, pz = 0] = [], ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return vox.map((v) => ({ ...v, x: px + v.x * c + v.z * s, y: py + v.y, z: pz - v.x * s + v.z * c }));
};
