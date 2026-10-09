/* Visage expressif : yeux 3D (iris, pupille, reflets, paupières), sourcils, nez, oreilles, joues,
   bouche dynamique (sourire / bouche ouverte avec dents et langue) plaquée sur le crâne. */
import * as THREE from "three";
import { sphere, tube, mesh, V3 } from "./builders.js";
import { clamp, lerp } from "../core/util.js";
import { radialTexture } from "./materials.js";

export const HEAD = { ax: 0.27, ay: 0.254, az: 0.262 };
/* profondeur z de la surface du crâne (ellipsoïde) pour un point (x, y) */
export const surfaceZ = (x, y) => HEAD.az * Math.sqrt(Math.max(0, 1 - (x / HEAD.ax) ** 2 - (y / HEAD.ay) ** 2));
const surfaceNormal = (x, y) => { const z = surfaceZ(x, y); return V3(x / HEAD.ax ** 2, y / HEAD.ay ** 2, z / HEAD.az ** 2).normalize(); };

const _o = new THREE.Object3D();
function placeSurf(obj, x, y, off = 0) {
  const z = surfaceZ(x, y), n = surfaceNormal(x, y);
  obj.position.set(x + n.x * off, y + n.y * off, z + n.z * off);
  _o.position.copy(obj.position); _o.up.set(0, 1, 0); _o.lookAt(obj.position.clone().add(n)); obj.quaternion.copy(_o.quaternion);
}

export class Face {
  constructor(head, M) {
    this.M = M; this.head = head;
    this.eyes = [1, -1].map((s) => this.buildEye(s));
    this.brows = [1, -1].map((s) => this.buildBrow(s));
    head.add(sphere(0.031, M.skin, { pos: [0, -0.04, surfaceZ(0, -0.04) + 0.008], scale: [1, 0.86, 0.95] }));
    head.add(sphere(0.008, M.skinDark, { pos: [0, -0.064, surfaceZ(0, -0.06) + 0.012], scale: [2.2, 0.8, 0.6], cast: false }));
    [1, -1].forEach((s) => {
      head.add(sphere(0.052, M.skin, { pos: [s * 0.262, -0.012, -0.012], scale: [0.5, 1, 0.78] }));
      head.add(sphere(0.03, M.skinDark, { pos: [s * 0.269, -0.012, -0.004], scale: [0.35, 0.9, 0.7], cast: false }));
    });
    const tex = radialTexture("rgba(255,96,96,0.85)", "rgba(255,96,96,0)");
    this.cheeks = [1, -1].map((s) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.4, polygonOffset: true, polygonOffsetFactor: -2 })); placeSurf(m, s * 0.158, -0.062, 0.002); head.add(m); return m; });
    this.mouth = new THREE.Group(); head.add(this.mouth); this.mouthKey = "";
  }

  buildEye(s) {
    const M = this.M, g = new THREE.Group(); g.position.set(s * 0.098, 0.03, 0.212); g.scale.setScalar(1.16); this.head.add(g);
    const k = [1, 1.12, 0.7];
    g.add(sphere(0.05, M.sclera, { scale: k, cast: false }));
    const look = new THREE.Group(); g.add(look);
    look.add(sphere(0.038, M.iris, { pos: [0, 0, 0.02], scale: [1, 1, 0.45], cast: false }));
    look.add(sphere(0.02, M.pupil, { pos: [0, 0, 0.0325], scale: [1, 1, 0.4], cast: false }));
    look.add(sphere(0.0098, M.glint, { pos: [0.0125, 0.0145, 0.0385], scale: [1, 1, 0.5], cast: false }));
    look.add(sphere(0.0042, M.glint, { pos: [-0.0095, -0.011, 0.0375], scale: [1, 1, 0.5], cast: false }));
    const half = (flip) => { const geo = new THREE.SphereGeometry(0.0535, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); if (flip) geo.rotateX(Math.PI); const m = new THREE.Mesh(geo, M.skin); m.scale.set(...k); m.castShadow = false; return m; };
    const upper = half(false), lower = half(true); g.add(upper); g.add(lower);
    return { g, look, upper, lower, s };
  }

  buildBrow(s) {
    const M = this.M, g = new THREE.Group(); this.head.add(g);
    const pts = [[-0.05, -0.006, 0], [-0.018, 0.01, 0], [0.02, 0.0125, 0], [0.052, -0.004, 0]].map((p) => [p[0] * s, p[1], p[2]]);
    g.add(tube(pts, 0.0105, M.hair, { seg: 24, radial: 8 }));
    return { g, s };
  }

  /* p : { brow, browTilt, lid, squint, lookX, lookY, smile, open, wide, cheek, tongue, blink } */
  update(p) {
    const lid = clamp(p.lid * (1 - p.blink), 0, 1), sq = clamp(p.squint, 0, 1);
    this.eyes.forEach((e) => {
      e.look.rotation.set(-p.lookY * 0.3, p.lookX * 0.34, 0);
      e.upper.rotation.x = lerp(1.5, -1.12, lid);
      e.lower.rotation.x = lerp(1.55, 0.55, sq) - (1 - clamp(lid * 2, 0, 1)) * 1.0;
    });
    this.brows.forEach((b) => {
      placeSurf(b.g, b.s * 0.1, 0.122 + p.brow * 0.022, 0.004);
      b.g.rotateZ(-b.s * p.browTilt * 0.38 - b.s * 0.04);
    });
    this.cheeks.forEach((c) => { c.material.opacity = 0.3 + 0.5 * clamp(p.cheek, 0, 1); const sc = 1 + 0.35 * p.cheek; c.scale.set(sc, sc, 1); });
    const key = [p.smile, p.open, p.wide, p.tongue].map((v) => v.toFixed(3)).join("|");
    if (key !== this.mouthKey) { this.mouthKey = key; this.rebuildMouth(p); }
  }

  rebuildMouth(p) {
    const M = this.M, grp = this.mouth;
    while (grp.children.length) { const c = grp.children.pop(); c.geometry.dispose(); }
    const smile = clamp(p.smile, 0, 1), open = clamp(p.open, 0, 1), wide = clamp(p.wide, 0, 1);
    const w = 0.058 + 0.018 * smile + 0.02 * wide - 0.008 * open * (1 - wide);
    const cy = -0.122, lift = 0.006 + 0.04 * smile + 0.014 * wide, N = 18, t0 = 0.0075;
    const xs = Array.from({ length: N + 1 }, (_, i) => -w + (2 * w * i) / N);
    const top = (x) => cy + lift * Math.pow(Math.abs(x) / w, 2) * (1 - 0.35 * open);
    const depth = (x) => open * 0.082 * Math.pow(Math.max(0, 1 - (x / w) ** 2), 0.75);
    const shapeFrom = (up, down, widen = 0) => {
      const sh = new THREE.Shape(), k = 1 + widen;
      sh.moveTo(xs[0] * k, top(xs[0]) + up);
      for (let i = 1; i <= N; i++) sh.lineTo(xs[i] * k, top(xs[i]) + up);
      for (let i = N; i >= 0; i--) sh.lineTo(xs[i] * k, top(xs[i]) - t0 * Math.pow(Math.max(0, 1 - (xs[i] / w) ** 2), 0.5) - depth(xs[i]) - down);
      return sh;
    };
    const wrap = (geo, off) => { const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, surfaceZ(pos.getX(i), pos.getY(i)) + off + pos.getZ(i)); geo.computeVertexNormals(); return geo; };
    const lips = new THREE.ExtrudeGeometry(shapeFrom(0.0045, 0.0045, 0.06), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 6 });
    grp.add(mesh(wrap(lips, 0.0005), M.lipOuter, { cast: false }));
    if (open > 0.05) {
      grp.add(mesh(wrap(new THREE.ShapeGeometry(shapeFrom(-0.0008, -0.0008), 6), 0.0092), M.mouthIn, { cast: false }));
      const tg = clamp(p.tongue + 0.35, 0, 1), sh = new THREE.Shape();
      sh.moveTo(xs[2] * 0.75, top(xs[2]) - depth(xs[2]) - t0 * 0.6);
      for (let i = 2; i <= N - 2; i++) sh.lineTo(xs[i] * 0.78, top(xs[i]) - depth(xs[i]) - t0 * 0.6 + depth(xs[i]) * 0.5 * tg);
      for (let i = N - 2; i >= 2; i--) sh.lineTo(xs[i] * 0.75, top(xs[i]) - depth(xs[i]) - t0 * 0.6);
      grp.add(mesh(wrap(new THREE.ShapeGeometry(sh, 6), 0.0098), M.tongue, { cast: false }));
      if (open > 0.18) {
        const th = new THREE.Shape(), hgt = (x) => Math.min(depth(x) * 0.5 + 0.004, 0.02);
        th.moveTo(xs[1] * 0.92, top(xs[1]) - 0.0015); for (let i = 1; i <= N - 1; i++) th.lineTo(xs[i] * 0.92, top(xs[i]) - 0.0015);
        for (let i = N - 1; i >= 1; i--) th.lineTo(xs[i] * 0.92, top(xs[i]) - 0.0015 - hgt(xs[i]));
        grp.add(mesh(wrap(new THREE.ShapeGeometry(th, 6), 0.0108), M.teeth, { cast: false }));
      }
    }
  }
}
