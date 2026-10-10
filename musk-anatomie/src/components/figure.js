// Personnages miniatures articulés (stylisés, non réalistes). Hauteur ≈ 3 unités à l'échelle 1.
// Tout est piloté par pose(t) : aucune horloge, aucun état caché.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mat, colored } from "../core/palette.js";
import { lerp, clamp, DEG } from "../core/util.js";

const colCache = new Map();
const cmat = (hex) => {
  if (typeof hex !== "number") return mat(hex);
  if (!colCache.has(hex)) colCache.set(hex, colored(hex));
  return colCache.get(hex);
};

const G = {
  torso: new RoundedBoxGeometry(0.82, 1.0, 0.46, 3, 0.14),
  head: new THREE.SphereGeometry(0.42, 20, 16),
  hairCap: new THREE.SphereGeometry(0.445, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  hand: new THREE.SphereGeometry(0.14, 10, 8),
  foot: new RoundedBoxGeometry(0.32, 0.16, 0.56, 2, 0.06),
  neck: new THREE.CylinderGeometry(0.13, 0.15, 0.16, 10),
  pelvis: new RoundedBoxGeometry(0.78, 0.3, 0.44, 2, 0.1),
  hardhat: new THREE.SphereGeometry(0.47, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  brim: new THREE.CylinderGeometry(0.5, 0.5, 0.05, 18),
};
const limb = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
const UPPER_ARM = limb(0.13, 0.4);
const FORE_ARM = limb(0.115, 0.36);
const THIGH = limb(0.175, 0.44);
const SHIN = limb(0.15, 0.44);

export const POSE_ZERO = {
  shL: 0, shLz: 0.08, elL: 0, shR: 0, shRz: 0.08, elR: 0, // épaules (x avant/arrière, z écart), coudes
  hipL: 0, kneeL: 0, hipR: 0, kneeR: 0,
  lean: 0, twist: 0, headYaw: 0, headPitch: 0, bob: 0, crouch: 0,
};

export class Figure {
  /**
   * @param {object} o  { scale, shirt, pants, skin, hair, vest, hardhat, tie, jacket, hairStyle }
   */
  constructor(o = {}) {
    const { scale = 1, shirt = 0x1a1d24, pants = 0x20242e, skin = "skin", hair = "hair", jacket = null, tie = null, hardhat = null, vest = null, hairStyle = "short", shoe = 0x0b0d12 } = o;
    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);
    this.hips = new THREE.Group();
    this.hips.position.y = 1.24;
    this.root.add(this.hips);

    const skinM = cmat(skin), shirtM = cmat(shirt), pantsM = cmat(pants), hairM = cmat(hair);

    const mesh = (geo, m, shadow = true) => {
      const me = new THREE.Mesh(geo, m);
      me.castShadow = shadow;
      me.receiveShadow = false;
      return me;
    };

    // bassin
    const pelvis = mesh(G.pelvis, pantsM);
    pelvis.position.y = 0.05;
    this.hips.add(pelvis);

    // torse + tête (pivotent ensemble)
    this.torso = new THREE.Group();
    this.torso.position.y = 0.12;
    this.hips.add(this.torso);
    const chest = mesh(G.torso, jacket != null ? cmat(jacket) : shirtM);
    chest.position.y = 0.52;
    this.torso.add(chest);
    if (vest != null) {
      const v = mesh(new RoundedBoxGeometry(0.86, 0.72, 0.5, 2, 0.1), cmat(vest));
      v.position.y = 0.55;
      this.torso.add(v);
    }
    if (tie != null) {
      const t = mesh(new THREE.BoxGeometry(0.11, 0.5, 0.04), cmat(tie), false);
      t.position.set(0, 0.55, 0.245);
      this.torso.add(t);
    }
    const neck = mesh(G.neck, skinM, false);
    neck.position.y = 1.08;
    this.torso.add(neck);
    this.head = new THREE.Group();
    this.head.position.y = 1.5;
    this.torso.add(this.head);
    const headM = mesh(G.head, skinM);
    this.head.add(headM);
    if (hardhat != null) {
      const hh = mesh(G.hardhat, cmat(hardhat));
      hh.position.y = 0.08;
      const brim = mesh(G.brim, cmat(hardhat), false);
      brim.position.set(0, 0.07, 0.04);
      this.head.add(hh, brim);
    } else if (hairStyle !== "none") {
      const cap = mesh(G.hairCap, hairM);
      cap.position.y = 0.04;
      cap.rotation.x = -0.12;
      this.head.add(cap);
    }
    // visage minimal : deux yeux
    const eyeM = cmat(0x10131a);
    for (const sx of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM, false);
      e.position.set(sx * 0.15, 0.04, 0.385);
      this.head.add(e);
    }

    // bras
    const makeArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.54, 0.98, 0);
      const up = mesh(UPPER_ARM, jacket != null ? cmat(jacket) : shirtM);
      up.position.y = -0.3;
      sh.add(up);
      const el = new THREE.Group();
      el.position.y = -0.58;
      sh.add(el);
      const fore = mesh(FORE_ARM, skinM);
      fore.position.y = -0.27;
      el.add(fore);
      const hand = mesh(G.hand, skinM, false);
      hand.position.y = -0.56;
      el.add(hand);
      this.torso.add(sh);
      return { sh, el };
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // jambes
    const makeLeg = (side) => {
      const hp = new THREE.Group();
      hp.position.set(side * 0.22, 0.0, 0);
      const th = mesh(THIGH, pantsM);
      th.position.y = -0.36;
      hp.add(th);
      const kn = new THREE.Group();
      kn.position.y = -0.7;
      hp.add(kn);
      const sh = mesh(SHIN, pantsM);
      sh.position.y = -0.36;
      kn.add(sh);
      const ft = mesh(G.foot, cmat(shoe));
      ft.position.set(0, -0.76, 0.1);
      kn.add(ft);
      this.hips.add(hp);
      return { hp, kn };
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);

    this.p = { ...POSE_ZERO };
    this.apply(this.p);
  }

  /** applique une pose (angles en radians) */
  apply(p) {
    const q = { ...POSE_ZERO, ...p };
    this.p = q;
    this.hips.position.y = 1.24 - q.crouch * 0.3 + q.bob;
    this.torso.rotation.set(q.lean, q.twist, 0);
    this.head.rotation.set(q.headPitch, q.headYaw, 0);
    this.armL.sh.rotation.set(q.shL, 0, -q.shLz);
    this.armL.el.rotation.set(q.elL, 0, 0);
    this.armR.sh.rotation.set(q.shR, 0, q.shRz);
    this.armR.el.rotation.set(q.elR, 0, 0);
    this.legL.hp.rotation.set(q.hipL - q.crouch * 0.9, 0, 0);
    this.legL.kn.rotation.set(q.kneeL + q.crouch * 1.5, 0, 0);
    this.legR.hp.rotation.set(q.hipR - q.crouch * 0.9, 0, 0);
    this.legR.kn.rotation.set(q.kneeR + q.crouch * 1.5, 0, 0);
  }

  place(x, y, z, ry = 0) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = ry;
    return this;
  }
}

// ---------------------------------------------------------------------------
// Bibliothèque de poses / animations (retournent des poses partielles)
// ---------------------------------------------------------------------------
const S = Math.sin;
const R = (deg) => deg * DEG;

export const POSES = {
  stand: {},
  /** bras ouverts, tête levée : « la fortune apparaît » */
  awe: { shLz: R(78), shRz: R(78), shL: R(-10), shR: R(-10), elL: R(-25), elR: R(-25), headPitch: -0.38, lean: -0.08 },
  hips: { shLz: R(35), shRz: R(35), elL: R(-95), elR: R(-95), shL: R(8), shR: R(8) },
  point: { shR: R(-95), shRz: R(8), elR: R(-8), twist: -0.18, headYaw: -0.18 },
  presenting: { shR: R(-55), shRz: R(40), elR: R(-45), shL: R(-10), shLz: R(30), elL: R(-30), twist: -0.12 },
  shrug: { shLz: R(34), shRz: R(34), elL: R(-95), elR: R(-95), shL: R(-20), shR: R(-20), headPitch: R(5) },
  cheer: { shL: R(-170), shR: R(-170), shLz: R(18), shRz: R(18), elL: R(-12), elR: R(-12), lean: -0.05 },
  crossed: { shL: R(-45), shR: R(-45), shLz: R(-8), shRz: R(-8), elL: R(-125), elR: R(-125) },
  lookUp: { headPitch: R(-24) },
};

export function blend(a, b, k) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) out[key] = lerp(a[key] ?? POSE_ZERO[key] ?? 0, b[key] ?? POSE_ZERO[key] ?? 0, k);
  return out;
}

/** respiration + léger balancement */
export function idle(t, phase = 0) {
  const s = S(t * 1.8 + phase);
  return { bob: s * 0.012, lean: s * 0.012, shLz: 0.1 + s * 0.02, shRz: 0.1 - s * 0.02, headYaw: S(t * 0.7 + phase) * 0.08 };
}

/** marche : t en secondes, vitesse de pas en cycles/s */
export function walk(t, cps = 1.4, phase = 0) {
  const a = t * cps * Math.PI * 2 + phase;
  const sw = S(a), sw2 = S(a + Math.PI);
  return {
    hipL: sw * 0.62, hipR: sw2 * 0.62,
    kneeL: Math.max(0, S(a + 1.2)) * 0.8, kneeR: Math.max(0, S(a + 1.2 + Math.PI)) * 0.8,
    shL: sw2 * 0.5, shR: sw * 0.5, elL: -0.25, elR: -0.25,
    bob: Math.abs(S(a)) * 0.07 - 0.03, lean: 0.06,
  };
}

/** saluer de la main */
export function wave(t, phase = 0) {
  const w = S(t * 9 + phase);
  return { shR: R(-165), shRz: R(30), elR: R(-30) + w * 0.5, headYaw: 0.1 };
}

/** trader qui s'agite (bras qui gesticulent) */
export function frantic(t, phase = 0) {
  const a = S(t * 6 + phase), b = S(t * 7.3 + phase + 1);
  return { shL: R(-120) + a * 0.5, shR: R(-120) + b * 0.5, shLz: R(20) + b * 0.2, shRz: R(20) + a * 0.2, elL: R(-40) + b * 0.4, elR: R(-40) + a * 0.4, bob: Math.abs(a) * 0.06 };
}

/** pousser / porter une charge devant soi */
export function carry(t, phase = 0) {
  const w = walk(t, 1.2, phase);
  return { ...w, shL: R(-70), shR: R(-70), elL: R(-60), elR: R(-60), shLz: R(-10), shRz: R(-10), lean: 0.1 };
}
