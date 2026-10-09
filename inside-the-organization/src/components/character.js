import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C } from '../engine/palette.js';
import { M } from '../engine/materials.js';
import { clamp, lerp, smooth, pop, seg } from '../util/math.js';

/* =========================================================================
 * Personnages 3D stylisés et articulés.
 * Hiérarchie : root > hips > torsoPivot > { head, shoulderL/R > elbowL/R }, hips > hipL/R > knee L/R.
 * Chaque segment est un maillage unique à couleurs de sommets => ~10 draw calls / personnage.
 * ========================================================================= */

export const HIP_Y = 0.4;
const geoCache = new Map();

function colorize(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
/** Applique une transformation puis colore. */
function P(geo, hex, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  geo.applyMatrix4(m);
  return colorize(geo, hex);
}
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 10);
const sph = (r, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d, 1, 1, 1);

function merged(parts) {
  const g = mergeGeometries(parts.map((p) => (p.index ? p : p.toNonIndexed())), false);
  g.computeBoundingSphere();
  return g;
}

function buildHead(sp) {
  const parts = [];
  parts.push(P(sph(0.19), sp.skin, { p: [0, 0.15, 0] }));
  // yeux + sourire
  parts.push(P(sph(0.026, 10, 8), C.ink, { p: [-0.07, 0.17, 0.168], s: [1, 1.25, 0.6] }));
  parts.push(P(sph(0.026, 10, 8), C.ink, { p: [0.07, 0.17, 0.168], s: [1, 1.25, 0.6] }));
  parts.push(P(new THREE.TorusGeometry(0.052, 0.01, 6, 14, Math.PI), 0x7a3b2e, { p: [0, 0.095, 0.172], r: [0, 0, Math.PI], s: [1, 0.8, 0.7] }));
  parts.push(P(sph(0.018, 8, 6), 0xe38a7a, { p: [-0.115, 0.115, 0.145], s: [1, 0.7, 0.5] })); // joues
  parts.push(P(sph(0.018, 8, 6), 0xe38a7a, { p: [0.115, 0.115, 0.145], s: [1, 0.7, 0.5] }));
  const hairHex = sp.hair;
  const style = sp.hairStyle || 'short';
  const dome = (r, tl, rotX) => new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, tl).rotateX(rotX);
  if (style !== 'bald' && style !== 'cap') {
    parts.push(P(dome(0.202, Math.PI * 0.56, -0.28), hairHex, { p: [0, 0.155, -0.012] }));
  }
  if (style === 'long') parts.push(P(cap(0.15, 0.14), hairHex, { p: [0, 0.03, -0.095], s: [1, 1, 0.75] }));
  if (style === 'bun') parts.push(P(sph(0.075), hairHex, { p: [0, 0.3, -0.12] }));
  if (style === 'ponytail') parts.push(P(cap(0.045, 0.14), hairHex, { p: [0, 0.1, -0.2], r: [0.5, 0, 0] }));
  if (style === 'curly') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(P(sph(0.07, 8, 6), hairHex, { p: [Math.sin(a) * 0.15, 0.25 + (i % 2) * 0.02, Math.cos(a) * 0.12 - 0.03] }));
    }
  }
  if (sp.cap) {
    // casquette : dôme + visière
    parts.push(P(new THREE.SphereGeometry(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5).rotateX(-0.15), sp.cap, { p: [0, 0.17, 0] }));
    parts.push(P(new THREE.CylinderGeometry(0.2, 0.2, 0.018, 20, 1, false, -Math.PI * 0.5, Math.PI), sp.cap, { p: [0, 0.2, 0.1], s: [1, 1, 0.95], r: [-0.12, 0, 0] }));
    parts.push(P(sph(0.034, 8, 6), C.yellow, { p: [0, 0.27, 0.185], s: [1, 0.8, 0.4] })); // petit emblème jaune
  }
  if (sp.headset) {
    parts.push(P(new THREE.TorusGeometry(0.2, 0.012, 6, 24, Math.PI), C.charcoal, { p: [0, 0.17, 0], r: [0, Math.PI / 2, 0] }));
    parts.push(P(sph(0.04, 8, 6), C.charcoal, { p: [-0.2, 0.15, 0], s: [0.7, 1, 1] }));
    parts.push(P(cap(0.008, 0.07), C.charcoal, { p: [0.17, 0.08, 0.1], r: [0.4, 0, 0.8] }));
  }
  if (sp.glasses) {
    parts.push(P(new THREE.TorusGeometry(0.04, 0.007, 6, 16), C.ink, { p: [-0.07, 0.17, 0.178] }));
    parts.push(P(new THREE.TorusGeometry(0.04, 0.007, 6, 16), C.ink, { p: [0.07, 0.17, 0.178] }));
  }
  return merged(parts);
}

function buildTorso(sp) {
  const parts = [];
  const body = sp.jacket ?? sp.shirt;
  parts.push(P(cap(0.125, 0.15), body, { p: [0, 0.2, 0], s: [1, 1, 0.78] }));
  parts.push(P(cap(0.118, 0.04), sp.pants, { p: [0, 0.01, 0], s: [1, 1, 0.8] })); // bassin
  if (sp.jacket) {
    parts.push(P(box(0.07, 0.2, 0.012), sp.shirt, { p: [0, 0.27, 0.1], r: [0, 0, 0] })); // chemise visible
    parts.push(P(box(0.016, 0.2, 0.014), sp.jacket, { p: [-0.045, 0.27, 0.103], r: [0, 0, -0.22] })); // revers
    parts.push(P(box(0.016, 0.2, 0.014), sp.jacket, { p: [0.045, 0.27, 0.103], r: [0, 0, 0.22] }));
  }
  if (sp.tie) {
    parts.push(P(box(0.034, 0.17, 0.012), sp.tie, { p: [0, 0.25, 0.108] }));
    parts.push(P(box(0.044, 0.04, 0.014), sp.tie, { p: [0, 0.34, 0.105] }));
  }
  if (sp.apron) parts.push(P(box(0.2, 0.2, 0.012), sp.apron, { p: [0, 0.1, 0.1] }));
  if (sp.badge) parts.push(P(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 12).rotateX(Math.PI / 2), sp.badge, { p: [0.07, 0.3, 0.105] }));
  if (sp.collar) parts.push(P(new THREE.TorusGeometry(0.075, 0.016, 6, 14), sp.collar, { p: [0, 0.405, 0.012], r: [Math.PI / 2, 0, 0], s: [1, 1, 1] }));
  return merged(parts);
}

function buildArm(sp, kind) {
  const sleeve = sp.jacket ?? sp.shirt;
  if (kind === 'upper') {
    return merged([
      P(sph(0.05), sleeve, { p: [0, 0, 0] }),
      P(cap(0.04, 0.1), sleeve, { p: [0, -0.095, 0] }),
    ]);
  }
  const longSleeve = !!sp.jacket || sp.longSleeve;
  return merged([
    P(cap(0.035, 0.09), longSleeve ? sleeve : sp.skin, { p: [0, -0.085, 0] }),
    P(sph(0.046, 10, 8), sp.skin, { p: [0, -0.195, 0.004] }),
  ]);
}

function buildLeg(sp, kind) {
  if (kind === 'thigh') {
    return merged([P(cap(0.057, 0.09), sp.pants, { p: [0, -0.095, 0] })]);
  }
  return merged([
    P(cap(0.05, 0.09), sp.pants, { p: [0, -0.095, 0] }),
    P(new THREE.CapsuleGeometry(0.052, 0.07, 3, 8).rotateX(Math.PI / 2), sp.shoes ?? C.ink, { p: [0, -0.185, 0.04], s: [1, 0.85, 1] }),
  ]);
}

function mesh(geo, name) {
  const m = new THREE.Mesh(geo, M.vc());
  m.castShadow = true; m.receiveShadow = false; m.name = name;
  return m;
}

export function makeCharacter(spec = {}) {
  const sp = {
    skin: C.skin[0], hair: C.hair[0], hairStyle: 'short', shirt: C.white, pants: C.charcoal, shoes: C.ink,
    jacket: null, tie: null, apron: null, cap: null, badge: null, headset: false, glasses: false, collar: null,
    scale: 1, ...spec,
  };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = HIP_Y; root.add(hips);
  const torsoPivot = new THREE.Group(); hips.add(torsoPivot);
  torsoPivot.add(mesh(buildTorso(sp), 'torso'));
  const head = new THREE.Group(); head.position.y = 0.4; torsoPivot.add(head);
  head.add(mesh(buildHead(sp), 'head'));

  const mkArm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.165, 0.31, 0); torsoPivot.add(sh);
    sh.add(mesh(buildArm(sp, 'upper'), 'upper'));
    const el = new THREE.Group(); el.position.y = -0.19; sh.add(el);
    el.add(mesh(buildArm(sp, 'fore'), 'fore'));
    return { sh, el };
  };
  const mkLeg = (sx) => {
    const hp = new THREE.Group(); hp.position.set(sx * 0.07, 0, 0); hips.add(hp);
    hp.add(mesh(buildLeg(sp, 'thigh'), 'thigh'));
    const kn = new THREE.Group(); kn.position.y = -0.19; hp.add(kn);
    kn.add(mesh(buildLeg(sp, 'shin'), 'shin'));
    return { hp, kn };
  };
  const aL = mkArm(1), aR = mkArm(-1), lL = mkLeg(1), lR = mkLeg(-1); // +x = gauche du personnage (il regarde vers +z)

  root.scale.setScalar(sp.scale);
  root.userData.spec = sp;
  return { root, hips, torsoPivot, head, aL, aR, lL, lR, spec: sp };
}

/* ------------------------------ Poses (angles de joints) ------------------------------ */
const J0 = () => ({
  hipY: HIP_Y, lean: 0, twist: 0, torsoRz: 0, hx: 0, hy: 0,
  shLx: 0, shLz: 0, shRx: 0, shRz: 0, elL: 0, elR: 0, hpL: 0, hpR: 0, knL: 0, knR: 0,
});

const ACTS = {
  idle(t, ph) {
    const j = J0();
    j.hipY += Math.sin(t * 2.1 + ph) * 0.004;
    j.shLx = Math.sin(t * 1.3 + ph) * 0.05; j.shRx = -Math.sin(t * 1.3 + ph) * 0.05;
    j.shLz = 0.06; j.shRz = -0.06; j.elL = -0.18; j.elR = -0.18;
    j.hy = Math.sin(t * 0.6 + ph) * 0.12; j.hx = Math.sin(t * 0.9 + ph) * 0.03;
    return j;
  },
  walk(t, ph, o) {
    const j = J0();
    const f = o.phase;                       // phase de marche (rad)
    const A = 0.62 * o.amp;
    const th = Math.sin(f) * A;              // angle jambe (+ = vers l'avant)
    j.hpL = -th; j.hpR = th;
    j.knL = 1.0 * Math.max(0, Math.cos(f)) * o.amp + 0.05; j.knR = 1.0 * Math.max(0, -Math.cos(f)) * o.amp + 0.05;
    j.shLx = th * 0.9; j.shRx = -th * 0.9;   // bras opposés aux jambes
    j.elL = -0.35 - Math.max(0, -th) * 0.5; j.elR = -0.35 - Math.max(0, th) * 0.5;
    j.shLz = 0.05; j.shRz = -0.05;
    j.hipY = HIP_Y - 0.018 + Math.abs(Math.cos(f)) * 0.022 * o.amp;
    j.twist = Math.sin(f) * 0.12 * o.amp; j.lean = -0.06;
    j.hy = -j.twist * 0.8;
    return j;
  },
  sit(t, ph) {
    const j = ACTS.idle(t, ph);
    j.hipY = 0.215;
    j.hpL = -1.5; j.hpR = -1.5; j.knL = 1.5; j.knR = 1.5;
    j.shLz = 0.1; j.shRz = -0.1;
    return j;
  },
  sitTalk(t, ph) {
    const j = ACTS.sit(t, ph);
    j.shRx = -0.9 + Math.sin(t * 3.1 + ph) * 0.25; j.elR = -1.0 + Math.sin(t * 2.3 + ph) * 0.3; j.shRz = -0.25;
    j.hx = Math.sin(t * 2.4 + ph) * 0.07; j.hy = Math.sin(t * 0.9 + ph) * 0.2;
    return j;
  },
  sitListen(t, ph) {
    const j = ACTS.sit(t, ph);
    j.shLx = -0.55; j.shRx = -0.55; j.elL = -1.0; j.elR = -1.0; j.shLz = 0.15; j.shRz = -0.15;
    j.hx = 0.04 + Math.max(0, Math.sin(t * 1.1 + ph)) * 0.1; j.hy = Math.sin(t * 0.5 + ph) * 0.15;
    return j;
  },
  talk(t, ph) {
    const j = ACTS.idle(t, ph);
    j.shRx = -0.9 + Math.sin(t * 3.1 + ph) * 0.3; j.elR = -1.05 + Math.sin(t * 2.3 + ph) * 0.35; j.shRz = -0.3;
    j.shLx = -0.4 + Math.sin(t * 2.7 + ph) * 0.2; j.elL = -0.9; j.shLz = 0.25;
    j.hx = Math.sin(t * 2.4 + ph) * 0.06; j.hy = Math.sin(t * 0.8 + ph) * 0.2;
    return j;
  },
  type(t, ph) {
    const j = ACTS.sit(t, ph);
    const k = Math.sin(t * 16 + ph) * 0.08, k2 = Math.sin(t * 13 + ph * 2) * 0.08;
    j.shLx = -0.85 + k; j.shRx = -0.85 + k2; j.elL = -0.95 + k2; j.elR = -0.95 + k;
    j.hx = 0.18; j.lean = 0.08; j.shLz = 0.05; j.shRz = -0.05;
    return j;
  },
  typeStand(t, ph) {
    const j = ACTS.idle(t, ph);
    const k = Math.sin(t * 16 + ph) * 0.08;
    j.shLx = -0.8 + k; j.shRx = -0.8 - k; j.elL = -1.0; j.elR = -1.0; j.hx = 0.2;
    return j;
  },
  point(t, ph) {
    const j = ACTS.idle(t, ph);
    j.shRx = -1.5; j.shRz = -0.15; j.elR = -0.08; j.twist = -0.15; j.hy = 0.2;
    j.shLx = -0.35; j.elL = -1.0;
    return j;
  },
  present(t, ph) {
    const j = ACTS.idle(t, ph);
    j.shRx = -1.75 + Math.sin(t * 2 + ph) * 0.06; j.shRz = -0.4; j.elR = -0.2;
    j.shLx = -0.6; j.shLz = 0.3; j.elL = -0.8; j.hy = -0.25;
    return j;
  },
  wave(t, ph) {
    const j = ACTS.idle(t, ph);
    j.shRz = -2.55; j.shRx = -0.2; j.elR = -0.45 + Math.sin(t * 9 + ph) * 0.5;
    j.hy = -0.1;
    return j;
  },
  shake(t, ph) {
    const j = ACTS.idle(t, ph);
    j.shRx = -1.25; j.shRz = -0.18; j.elR = -0.45 + Math.sin(t * 11 + ph) * 0.22;
    j.shLx = -0.1; j.hx = 0.05;
    return j;
  },
  carry(t, ph, o) {
    const j = ACTS.walk(t, ph, o);
    j.shLx = -0.85; j.shRx = -0.85; j.elL = -1.25; j.elR = -1.25; j.shLz = -0.12; j.shRz = 0.12;
    return j;
  },
  cheer(t, ph) {
    const j = ACTS.idle(t, ph);
    const b = Math.abs(Math.sin(t * 5 + ph));
    j.shLz = 2.7 + b * 0.15; j.shRz = -2.7 - b * 0.15; j.shLx = -0.2; j.shRx = -0.2; j.elL = -0.3; j.elR = -0.3;
    j.hipY += b * 0.05;
    return j;
  },
  serve(t, ph) {
    const j = ACTS.idle(t, ph);
    const s = Math.sin(t * 2.2 + ph);
    j.shLx = -0.9 + s * 0.1; j.shRx = -0.9 - s * 0.1; j.elL = -1.1; j.elR = -1.1; j.hx = 0.1; j.lean = 0.06; j.hy = s * 0.15;
    return j;
  },
  stir(t, ph) {
    const j = ACTS.idle(t, ph);
    const s = Math.sin(t * 6 + ph), c = Math.cos(t * 6 + ph);
    j.shRx = -0.95 + c * 0.2; j.shRz = -0.2 + s * 0.1; j.elR = -1.0 + s * 0.2;
    j.shLx = -0.5; j.elL = -1.1; j.hx = 0.2; j.lean = 0.1;
    return j;
  },
};

function applyPose(ch, j) {
  ch.hips.position.y = j.hipY;
  ch.torsoPivot.rotation.set(j.lean, j.twist, j.torsoRz);
  ch.head.rotation.set(j.hx, j.hy, 0);
  ch.aL.sh.rotation.set(j.shLx, 0, j.shLz); ch.aL.el.rotation.x = j.elL;
  ch.aR.sh.rotation.set(j.shRx, 0, j.shRz); ch.aR.el.rotation.x = j.elR;
  ch.lL.hp.rotation.x = j.hpL; ch.lL.kn.rotation.x = j.knL;
  ch.lR.hp.rotation.x = j.hpR; ch.lR.kn.rotation.x = j.knR;
}

function mixPoses(list) {
  // list : [{j, w}] => moyenne pondérée
  let sw = 0; for (const e of list) sw += e.w;
  const out = J0(); for (const k in out) out[k] = 0;
  for (const e of list) for (const k in out) out[k] += e.j[k] * (e.w / sw);
  return out;
}

/* ------------------------------ Acteur : chemin + actes ------------------------------ */
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

/**
 * Acteur : position, cap et acte sont des fonctions pures du temps.
 *  path : [{t, x, z, y?}]  — déplacement linéaire entre deux clés (marche si distance > 0)
 *  acts : [{t0, t1, act}]   — actes imposés à l'arrêt (sinon idle)
 *  face : [{t, a}]          — caps (radians) à l'arrêt ; sinon le cap suit la marche
 *  appear/vanish : {t, dur} — apparition en « pop »
 */
export class Actor {
  constructor(ch, { path, acts = [], face = [], appear = null, vanish = null, phase = 0, yOffset = 0, tags = {} }) {
    this.ch = ch; this.path = path; this.acts = acts; this.face = face; this.appear = appear; this.vanish = vanish;
    this.phase = phase; this.yOffset = yOffset;
    this.root = ch.root;
    this.tags = tags;
    // Pré-calcule vitesses/phases cumulées pour une marche continue.
    this.segs = [];
    let cum = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), dt = Math.max(1e-3, b.t - a.t);
      const v = dist / dt;
      const walking = v > 0.12;
      const cad = walking ? clamp(v / 0.95, 0.7, 2.2) : 0;
      this.segs.push({ a, b, dist, dt, v, walking, cad, head: Math.atan2(dx, dz), ph0: cum });
      if (walking) cum += cad * dt * Math.PI * 2;
    }
    this.stateAt = null;
  }
  update(t) {
    const { path, segs, ch } = this;
    // visibilité
    let vis = 1;
    if (this.appear) vis *= pop(seg(t, this.appear.t, this.appear.t + (this.appear.dur ?? 0.55), (x) => x));
    if (this.vanish) vis *= 1 - smooth((t - this.vanish.t) / (this.vanish.dur ?? 0.4));
    this.root.visible = vis > 0.002;
    if (!this.root.visible) return;
    const sc = this.ch.spec.scale * Math.max(0.0001, vis);
    this.root.scale.set(sc, sc, sc);

    // position
    let x, z, y = 0, moving = false, cad = 0, phaseWalk = 0, heading = 0, amp = 1;
    if (t <= path[0].t) { x = path[0].x; z = path[0].z; y = path[0].y ?? 0; heading = this.faceAt(t, segs[0]?.head ?? 0); }
    else if (t >= path[path.length - 1].t) {
      const L = path[path.length - 1]; x = L.x; z = L.z; y = L.y ?? 0;
      heading = this.faceAt(t, segs.length ? segs[segs.length - 1].head : 0);
    } else {
      let i = 0; while (t > path[i + 1].t) i++;
      const s = segs[i], u = (t - s.a.t) / s.dt;
      x = lerp(s.a.x, s.b.x, u); z = lerp(s.a.z, s.b.z, u); y = lerp(s.a.y ?? 0, s.b.y ?? 0, smooth(u));
      if (s.walking) {
        moving = true; cad = s.cad;
        phaseWalk = s.ph0 + s.cad * (t - s.a.t) * Math.PI * 2;
        heading = s.head;
        // virage doux à l'entrée / à la sortie du segment
        const prev = i > 0 ? segs[i - 1] : null;
        if (prev && prev.walking) heading = lerpAngle(prev.head, s.head, smooth((t - s.a.t) / 0.3));
        else heading = lerpAngle(this.faceAt(s.a.t, s.head), s.head, smooth((t - s.a.t) / 0.3));
        const nxt = segs[i + 1];
        const tEnd = s.b.t;
        if (nxt && !nxt.walking) heading = lerpAngle(heading, this.faceAt(tEnd, s.head), smooth((t - (tEnd - 0.35)) / 0.35));
        else if (!nxt) heading = lerpAngle(heading, this.faceAt(tEnd, s.head), smooth((t - (tEnd - 0.35)) / 0.35));
        // amortit la marche en début/fin de segment
        amp = clamp(Math.min((t - s.a.t) / 0.25, (s.b.t - t) / 0.25) + 0.35, 0.35, 1);
      } else {
        heading = this.faceAt(t, s.head);
      }
    }
    this.root.position.set(x, y + this.yOffset, z);
    this.root.rotation.y = heading;

    // acte
    const ph = this.phase;
    let act = null;
    for (const a of this.acts) if (t >= a.t0 && t < a.t1) act = a;
    const entries = [];
    const wMove = moving ? 1 : 0;
    if (moving) {
      const walkName = act && act.act === 'carry' ? 'carry' : 'walk';
      entries.push({ j: ACTS[walkName](t, ph, { phase: phaseWalk + ph, amp }), w: 1 });
    } else {
      if (act) {
        // fondu d'entrée/sortie de l'acte (0.3 s)
        const wIn = smooth((t - act.t0) / 0.3) * (1 - smooth((t - (act.t1 - 0.3)) / 0.3));
        entries.push({ j: ACTS.idle(t, ph), w: Math.max(0.0001, 1 - wIn) });
        entries.push({ j: ACTS[act.act](t, ph, { phase: 0, amp: 1 }), w: Math.max(0.0001, wIn) });
      } else entries.push({ j: ACTS.idle(t, ph), w: 1 });
    }
    applyPose(ch, entries.length === 1 ? entries[0].j : mixPoses(entries));
  }
  faceAt(t, fallback) {
    const f = this.face;
    if (!f.length) return fallback;
    if (t <= f[0].t) return f[0].a;
    for (let i = 1; i < f.length; i++) {
      if (t <= f[i].t) return lerpAngle(f[i - 1].a, f[i].a, smooth((t - f[i - 1].t) / Math.max(0.01, f[i].t - f[i - 1].t) * 1.0));
    }
    return f[f.length - 1].a;
  }
  /** Position monde d'ancrage (au-dessus de la tête) pour étiquettes. */
  anchor(out = new THREE.Vector3(), h = 1.45) {
    out.set(this.root.position.x, this.root.position.y + h * this.ch.spec.scale, this.root.position.z);
    return out;
  }
}

/* ------------------------------ Tenues par rôle (illustratives) ------------------------------ */
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
export const OUTFIT = {
  board: (i) => ({ skin: pick(C.skin, i), hair: pick(C.hair, i + 2), hairStyle: pick(['short', 'short', 'long', 'bald', 'bun', 'short'], i), jacket: pick([C.grey3, C.grey4, C.charcoal, C.grey2], i), shirt: C.white, tie: pick([C.grey1, C.white, C.grey2], i), pants: C.charcoal, glasses: i % 3 === 0 }),
  ceo: () => ({ skin: C.skin[1], hair: C.hair[4], hairStyle: 'short', jacket: C.charcoal, shirt: C.white, tie: C.red, pants: C.ink, badge: C.yellow, glasses: true, scale: 1.08 }),
  exec: (i) => ({ skin: pick(C.skin, i + 1), hair: pick(C.hair, i + 1), hairStyle: pick(['short', 'long', 'ponytail', 'short', 'bun', 'curly'], i), jacket: pick([C.charcoal, C.grey4, C.ink], i), shirt: pick([C.white, C.grey1], i), tie: pick([C.red, C.yellow, C.redDeep], i), pants: C.ink, glasses: i % 4 === 1 }),
  worker: (i) => ({ skin: pick(C.skin, i + 3), hair: pick(C.hair, i), hairStyle: pick(['short', 'ponytail', 'long', 'curly', 'bun', 'short'], i), shirt: pick([C.white, C.grey1, C.paper], i), pants: pick([C.grey4, C.charcoal], i), collar: pick([C.red, C.yellow, C.grey3], i), badge: i % 3 === 0 ? C.yellow : null, headset: i % 5 === 2 }),
  franchisee: () => ({ skin: C.skin[2], hair: C.hair[1], hairStyle: 'short', jacket: C.grey4, shirt: C.white, tie: C.yellow, pants: C.charcoal, badge: C.gold, scale: 1.05, glasses: false }),
  manager: () => ({ skin: C.skin[0], hair: C.hair[3], hairStyle: 'ponytail', shirt: C.white, jacket: C.charcoal, tie: C.red, pants: C.ink, headset: true, badge: C.yellow }),
  assistant: (i) => ({ skin: pick(C.skin, i + 4), hair: pick(C.hair, i + 3), hairStyle: pick(['bun', 'short', 'long'], i), shirt: C.white, pants: C.charcoal, tie: C.grey1, jacket: null, longSleeve: true, collar: C.grey1, headset: true, badge: C.yellow }),
  shift: (i) => ({ skin: pick(C.skin, i + 1), hair: pick(C.hair, i + 4), hairStyle: pick(['short', 'curly', 'long'], i), shirt: C.yellow, pants: C.grey4, cap: null, collar: C.charcoal, headset: true }),
  crew: (i) => ({ skin: pick(C.skin, i), hair: pick(C.hair, i + 1), hairStyle: pick(['short', 'ponytail', 'curly', 'long'], i), shirt: C.red, pants: C.charcoal, cap: i % 2 === 0 ? C.red : null, collar: C.redDeep, apron: i % 3 === 1 ? C.charcoal : null }),
  visitor: (i) => ({ skin: pick(C.skin, i + 2), hair: pick(C.hair, i + 5), hairStyle: pick(['short', 'long', 'curly', 'bun'], i), shirt: pick([C.grey1, C.white, C.grey2, C.yellowSoft], i), pants: pick([C.grey4, C.charcoal, C.grey3], i) }),
};
