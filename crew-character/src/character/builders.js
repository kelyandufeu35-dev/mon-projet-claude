/* Constructeurs de géométries arrondies réutilisables (aucun modèle importé : tout est procédural). */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function mesh(geo, mat, { pos, rot, scale, cast = true, receive = false, name } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
}
export const sphere = (r, mat, o = {}) => mesh(new THREE.SphereGeometry(r, 36, 24), mat, o);
export const rbox = (w, h, d, r, mat, o = {}) => mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)), mat, o);
export const cyl = (rt, rb, h, mat, o = {}, seg = 36) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1), mat, o);

/* Membre effilé à bouts arrondis : part de y=0 (articulation) et descend jusqu'à y=-len. */
export function limbGeometry(r0, r1, len, seg = 28) {
  const pts = [], N = 8;
  for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * (i / N); pts.push(new THREE.Vector2(Math.max(r1 * Math.cos(a), 1e-4), -len + r1 * Math.sin(a))); }
  for (let i = 1; i <= N; i++) { const a = (Math.PI / 2) * (i / N); pts.push(new THREE.Vector2(Math.max(r0 * Math.cos(a), 1e-4), r0 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, seg);
}
export const limb = (r0, r1, len, mat, o = {}) => mesh(limbGeometry(r0, r1, len), mat, o);

/* Révolution d'un profil [[rayon, y], ...] */
export function lathe(profile, mat, o = {}, seg = 40) { return mesh(new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(Math.max(p[0], 1e-4), p[1])), seg), mat, o); }

/* Tube lissé le long de points 3D, avec bouts arrondis. */
export function tube(points, radius, mat, { seg = 40, radial = 10, caps = true, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed, "centripetal");
  const g = new THREE.Group();
  g.add(mesh(new THREE.TubeGeometry(curve, seg, radius, radial, closed), mat));
  if (caps && !closed) for (const t of [0, 1]) { const p = curve.getPoint(t); g.add(sphere(radius, mat, { pos: [p.x, p.y, p.z] })); }
  return g;
}

/* « M » stylisé à deux arches (version non officielle, simple clin d'œil de marque). */
export function archesMark(mat, width = 1, tubeR = 0.115) {
  const g = new THREE.Group();
  const arch = (cx) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) { const a = Math.PI - (Math.PI * i) / 28; const c = Math.cos(a), s = Math.sin(a); pts.push([cx + 0.54 * Math.sign(c) * Math.pow(Math.abs(c), 0.82), 0.95 * Math.pow(Math.abs(s), 0.72), 0]); }
    return tube(pts, tubeR, mat, { seg: 56, radial: 12 });
  };
  g.add(arch(-0.5)); g.add(arch(0.5)); g.scale.setScalar(width / 2.2); return g;
}

/* Transformation locale pour poser un objet sur une surface sphérique/ellipsoïdale (orienté selon la normale). */
const _o = new THREE.Object3D();
export function placeOnSurface(obj, dir, radius, offset = 0, up = V3(0, 1, 0)) {
  const d = dir.clone().normalize();
  obj.position.copy(d.clone().multiplyScalar(radius + offset));
  _o.position.set(0, 0, 0); _o.up.copy(up); _o.lookAt(d); obj.quaternion.copy(_o.quaternion);
}
