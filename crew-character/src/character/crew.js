/* Contrôleur du personnage : file d'animations (segments), fondus enchaînés, déplacement, transformation utilisateur
   (position / échelle / orientation) et ombres de contact. L'état à l'instant t est une fonction pure de t. */
import * as THREE from "three";
import { buildCrew } from "./rig.js";
import { applyPose } from "./pose.js";
import { ANIMS } from "./anims.js";
import { lerpDeep, sstep, clamp, wrapAngle } from "../core/util.js";
import { radialTexture } from "./materials.js";

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function blinkAt(t) {
  const k = Math.floor((t - 0.8) / 3.0);
  for (let j = k - 1; j <= k + 1; j++) { if (j < 0) continue; const t0 = 0.8 + j * 3.0 + 1.1 * hash(j + 3.3), u = (t - t0) / 0.17; if (u > 0 && u < 1) return Math.pow(Math.sin(Math.PI * u), 0.8); }
  return 0;
}

export class Crew {
  constructor(opts = {}) {
    const b = buildCrew(opts); this.J = b.J; this.M = b.M; this.object = b.group;
    this.segments = []; this.motion = null; this.lastPose = null; this.t = 0;
    const tex = radialTexture("rgba(30,20,10,0.5)", "rgba(30,20,10,0)");
    const mk = (r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; this.J.motion.add(m); return m; };
    this.blobs = [mk(0.22), mk(0.22), mk(0.5)];
  }

  /* ---- transformation utilisateur ---- */
  setPosition(x, y, z) { this.object.position.set(x, y, z); return this; }
  setScale(s) { this.object.scale.setScalar(s); return this; }
  setYaw(rad) { this.object.rotation.y = rad; return this; }
  get scale() { return this.object.scale.x; }

  /* ---- animations ---- */
  clear() { this.segments.length = 0; return this; }
  /* Ajoute un segment : { anim, start, speed, blend, opts }. Les segments doivent être ajoutés dans l'ordre. */
  play(anim, { at = 0, speed = 1, blend = 0.3, opts = {}, ...rest } = {}) {
    if (!ANIMS[anim]) throw new Error("animation inconnue : " + anim);
    const seg = { anim, start: at, speed, blend, opts, ...rest };
    this.segments.push(seg); this.segments.sort((a, b) => a.start - b.start); return seg;
  }
  segmentIndexAt(t) { let k = -1; for (let i = 0; i < this.segments.length; i++) if (this.segments[i].start <= t) k = i; return k; }
  segmentAt(t) { const k = this.segmentIndexAt(t); return k < 0 ? null : this.segments[k]; }
  evalSeg(seg, t) {
    const a = ANIMS[seg.anim]; let tau = Math.max(0, (t - seg.start) * seg.speed);
    if (a.loop === false && a.dur) tau = Math.min(tau, a.dur);
    return a.fn(tau, { opts: seg.opts, seg });
  }
  poseAt(t) {
    const k = this.segmentIndexAt(t);
    if (k < 0) return ANIMS.idle.fn(t);
    const seg = this.segments[k]; let pose = this.evalSeg(seg, t);
    if (k > 0 && t - seg.start < seg.blend) { const w = sstep((t - seg.start) / seg.blend); pose = lerpDeep(this.evalSeg(this.segments[k - 1], t), pose, w); }
    return pose;
  }

  /* ---- déplacement (espace scène) : fonction t → { x, z, yaw } ---- */
  setMotion(fn) { this.motion = fn; return this; }

  update(t) {
    this.t = t;
    const m = this.motion ? this.motion(t) : { x: 0, z: 0, yaw: 0 };
    this.J.motion.position.set(m.x, 0, m.z); this.J.motion.rotation.y = m.yaw;
    const pose = this.poseAt(t); this.lastPose = pose;
    this.object.updateMatrixWorld(true);
    applyPose(this.J, pose, blinkAt(t) * (1 - 0.8 * clamp(pose.face.squint, 0, 1)));
    // ombres de contact
    const v = new THREE.Vector3();
    this.J.leg.forEach((L, i) => { L.ankle.getWorldPosition(v); const h = v.y; this.J.motion.worldToLocal(v); const hh = Math.max(0, h / this.object.scale.x - 0.08); const b = this.blobs[i]; b.position.set(v.x, 0.006, v.z); b.material.opacity = 0.55 * (1 - clamp(hh / 0.28, 0, 1)); b.scale.setScalar(1 + hh * 1.2); b.rotation.z = 0; });
    const bb = this.blobs[2]; const lift = Math.max(0, pose.root.y + (pose.hipsY - 0.76)); bb.position.set(pose.root.x, 0.005, pose.root.z); bb.material.opacity = 0.38 * (1 - clamp(lift / 0.5, 0, 1)); bb.scale.setScalar(1 + lift * 0.8);
    return pose;
  }
  /* position monde de l'ancre « plateau » (centre du dessous du plateau) déduite de la pose */
  trayWorld(out = new THREE.Vector3(), quat = new THREE.Quaternion()) {
    const p = this.lastPose.prop.trayPos; this.J.torso.updateMatrixWorld(true);
    out.set(p[0], p[1], p[2]); this.J.torso.localToWorld(out);
    this.J.torso.getWorldQuaternion(quat); return out;
  }
  /* transformation « scène » (position + cap) du personnage à l'instant t : sert à poser les comptoirs devant lui */
  stageTransform(t) { const m = this.motion ? this.motion(t) : { x: 0, z: 0, yaw: 0 }; return m; }
}
