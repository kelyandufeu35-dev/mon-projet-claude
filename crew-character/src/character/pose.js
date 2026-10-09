/* Représentation d'une pose + application sur le squelette.
   – Les poses sont de simples structures de nombres : on peut les mélanger (fondus entre animations).
   – Bras : directions du bras et de l'avant-bras (espace du torse) ou cibles IK ; jambes : angles (IK planaire disponible). */
import * as THREE from "three";
import { DIM } from "./rig.js";
import { clamp } from "../core/util.js";

const S = (v) => v; // lisibilité

/* direction du bras : fwd = élévation vers l'avant (rad), abd = écart latéral (rad) */
export function armDir(side, fwd, abd = 0) {
  const x = side * Math.sin(abd), y = -Math.cos(fwd) * Math.cos(abd), z = Math.sin(fwd) * Math.cos(abd);
  const l = Math.hypot(x, y, z); return [x / l, y / l, z / l];
}
export const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function armRest(side) {
  return {
    u: armDir(side, 0.05, 0.17), f: armDir(side, 0.55, 0.12), palm: norm3([-side, 0.06, 0.28]), wrist: 0.05,
    curl: 0.3, spread: 0.12, thumb: 0.22,
    ikS: { w: 0, t: [side * 0.3, 0.98, 0.45], pole: [side * 0.6, -0.5, -0.4], palm: [0, 1, 0] },   // cible en espace « scène »
    ikT: { w: 0, t: [side * 0.25, 0.14, 0.38], pole: [side * 0.6, -0.5, -0.4], palm: [0, 1, 0] },  // cible en espace « torse »
  };
}

export function neutralPose() {
  return {
    root: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    hipsY: DIM.hipY, hips: [0, 0, 0], spine: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
    legs: [{ flex: 0, abd: 0.035, knee: 0.03, toe: 0 }, { flex: 0, abd: 0.035, knee: 0.03, toe: 0 }],
    arms: [armRest(1), armRest(-1)],
    face: { brow: 0, browTilt: 0, lid: 1.0, squint: 0, lookX: 0, lookY: 0, smile: 0.4, open: 0, wide: 0, cheek: 0.1, tongue: 0 },
    prop: { tray: 0, trayPos: [0, 0.17, 0.38], trayLift: 0 },
  };
}

/* ---------- jambes ---------- */
export function legIK(z, y) { // pied (cheville) en (z avant, y négatif) relatif à la hanche → flexion hanche + genou
  const L1 = DIM.thigh, L2 = DIM.shin;
  let d = Math.hypot(z, y); d = clamp(d, 0.12, L1 + L2 - 1e-4);
  const a = Math.atan2(z, -y), b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), g = Math.acos(clamp((L2 * L2 + d * d - L1 * L1) / (2 * L2 * d), -1, 1));
  return { flex: a + b, knee: b + g };
}
export function groundHips(legs) { // hauteur du bassin pour que le pied le plus « étendu » touche le sol
  let m = 0; legs.forEach((l) => { m = Math.max(m, DIM.thigh * Math.cos(l.flex) + DIM.shin * Math.cos(l.flex - l.knee) + DIM.ankleH); });
  return m + DIM.hipDrop;
}

/* ---------- bras ---------- */
const _v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const _qC = new THREE.Quaternion(), _qT = new THREE.Quaternion(), _qU = new THREE.Quaternion(), _qE = new THREE.Quaternion(), _qH = new THREE.Quaternion(), _m = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0), Z = new THREE.Vector3(0, 0, 1);

function ik2(Sp, T, pole, L1, L2) {
  const v = T.clone().sub(Sp); let d = v.length(); const dir = v.clone().divideScalar(d || 1);
  d = clamp(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  let q = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (q.lengthSq() < 1e-6) q.set(0, -1, 0).sub(dir.clone().multiplyScalar(dir.y * -1)); q.normalize();
  const E = Sp.clone().add(dir.clone().multiplyScalar(a)).add(q.multiplyScalar(h)), Tc = Sp.clone().add(dir.clone().multiplyScalar(d));
  return { u: E.clone().sub(Sp).divideScalar(L1), f: Tc.clone().sub(E).divideScalar(L2), hand: Tc };
}
const nlerp = (a, b, w) => a.clone().multiplyScalar(1 - w).add(b.clone().multiplyScalar(w)).normalize();

function setArmJoints(arm, u, f, palmT, wrist) {
  _qC.setFromUnitVectors(DOWN, u);
  const cosb = clamp(u.dot(f), -1, 1), beta = Math.acos(cosb);
  let tw = 0;
  if (beta > 1e-3) {
    const zc = Z.clone().applyQuaternion(_qC);
    const zT = f.clone().sub(u.clone().multiplyScalar(cosb)).normalize();
    tw = Math.atan2(u.dot(zc.clone().cross(zT)), zc.dot(zT));
  }
  _qT.setFromAxisAngle(u, tw);
  _qU.copy(_qT).multiply(_qC);
  arm.sh.quaternion.copy(_qU);
  arm.el.rotation.set(-beta, 0, 0);
  // orientation de la main : doigts le long de l'avant-bras (+ flexion du poignet), paume vers « palmT »
  _qE.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -beta); const qF = _qU.clone().multiply(_qE);
  const n = palmT.clone().sub(f.clone().multiplyScalar(palmT.dot(f))); if (n.lengthSq() < 1e-6) n.set(0, 0, 1); n.normalize();
  const fp = f.clone().multiplyScalar(Math.cos(wrist)).add(n.clone().multiplyScalar(Math.sin(wrist)));
  const nn = n.clone().multiplyScalar(Math.cos(wrist)).sub(f.clone().multiplyScalar(Math.sin(wrist)));
  const yh = fp.clone().negate(), zh = nn, xh = yh.clone().cross(zh);
  _m.makeBasis(xh, yh, zh); _qH.setFromRotationMatrix(_m);
  arm.wr.quaternion.copy(qF.invert().multiply(_qH));
}

/* ---------- application complète ---------- */
export function applyPose(J, pose, blink = 0) {
  const r = pose.root;
  J.body.position.set(r.x, r.y, r.z); J.body.rotation.set(r.pitch, r.yaw, r.roll);
  J.hips.position.y = pose.hipsY; J.hips.rotation.set(...pose.hips);
  J.spine.rotation.set(...pose.spine); J.neck.rotation.set(...pose.neck); J.head.rotation.set(...pose.head);
  J.leg.forEach((L, i) => {
    const p = pose.legs[i];
    L.hip.rotation.set(-p.flex, 0, L.side * p.abd); L.knee.rotation.x = p.knee; L.ankle.rotation.x = p.flex - p.knee - p.toe - pose.hips[0];
  });
  J.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4();
  J.arm.forEach((A, i) => {
    const p = pose.arms[i];
    let u = _v(p.u).normalize(), f = _v(p.f).normalize(), palm = _v(p.palm).normalize();
    const Sp = A.sh.position;
    const solve = (ch, toTorso) => {
      if (ch.w <= 1e-4) return;
      let T = _v(ch.t), pole = _v(ch.pole), pn = _v(ch.palm);
      if (toTorso) { // espace scène → espace torse
        T = J.torso.worldToLocal(J.motion.localToWorld(T));
        inv.copy(J.torso.matrixWorld).invert(); const m3 = new THREE.Matrix3().setFromMatrix4(inv); const m0 = new THREE.Matrix3().setFromMatrix4(J.motion.matrixWorld);
        pole.applyMatrix3(m0).applyMatrix3(m3).normalize(); pn.applyMatrix3(m0).applyMatrix3(m3).normalize();
      }
      const s = ik2(Sp, T, pole, DIM.upperArm, DIM.foreArm);
      u = nlerp(u, s.u, ch.w); f = nlerp(f, s.f, ch.w); palm = nlerp(palm, pn, ch.w);
      A.reach = s.hand;
    };
    solve(p.ikS, true); solve(p.ikT, false);
    setArmJoints(A, u, f, palm, p.wrist);
    A.hand.set(p.curl, p.spread, p.thumb);
  });
  J.face.update({ ...pose.face, blink });
  J.root.updateMatrixWorld(true);
}
