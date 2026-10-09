import * as THREE from 'three';
import { LINK } from './palette.js';
import { seg, easeInOutCubic, smooth, clamp } from '../util/math.js';

/* =========================================================================
 * Liaisons lumineuses : tube + halo additif, tracé progressif, impulsions qui circulent.
 * Un Link est une fonction pure de t : progression, disparition, flux.
 * ========================================================================= */

const VERT = `
  varying vec2 vUv; varying float vN;
  uniform float uGrow;
  void main(){
    vUv = uv;
    vec3 p = position + normal * uGrow;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG = `
  varying vec2 vUv;
  uniform vec3 uColor; uniform float uProg; uniform float uTail; uniform float uTime; uniform float uAlpha;
  uniform float uPulseN; uniform float uSpeed; uniform float uDash; uniform float uHalo; uniform float uLen;
  void main(){
    float u = vUv.x;
    if (u > uProg || u < uTail) discard;
    float lead = smoothstep(uProg - 0.05, uProg, u);        // tête lumineuse pendant le tracé
    float pulse = pow(0.5 + 0.5 * sin((u * uPulseN - uTime * uSpeed) * 6.2831853), 8.0);
    float dash = 1.0;
    if (uDash > 0.0) dash = step(0.42, fract(u * uLen * uDash - uTime * uSpeed * 3.0));
    float base = 0.9 + pulse * 1.4 + lead * 1.8;
    vec3 col = uColor * base;
    float a = uAlpha * mix(1.0, 0.0, uHalo) + uAlpha * uHalo * (0.22 + pulse * 0.25 + lead * 0.4);
    a *= mix(1.0, dash, step(0.0001, uDash));
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function mat(color, { halo = false, pulseN = 3, speed = 0.35, dash = 0, len = 10 }) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false,
    blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uProg: { value: 0 }, uTail: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 },
      uPulseN: { value: pulseN }, uSpeed: { value: speed }, uDash: { value: dash }, uHalo: { value: halo ? 1 : 0 },
      uGrow: { value: halo ? 0.1 : 0 }, uLen: { value: len },
    },
  });
}

/** Chemin à angles arrondis (polyligne). */
export function roundedPath(points, radius = 0.6) {
  const path = new THREE.CurvePath();
  if (points.length < 3) { path.add(new THREE.LineCurve3(points[0], points[points.length - 1])); return path; }
  let prev = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const l1 = b.distanceTo(a), l2 = c.distanceTo(b);
    const r = Math.min(radius, l1 * 0.5, l2 * 0.5);
    const p1 = b.clone().sub(a).normalize().multiplyScalar(-r).add(b);
    const p2 = c.clone().sub(b).normalize().multiplyScalar(r).add(b);
    if (prev.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, points[points.length - 1].clone()));
  return path;
}
/** Arc de liaison entre deux points (bombé vers le haut). */
export function arcPath(a, b, lift = 0.3, side = 0) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const d = a.distanceTo(b);
  mid.y += d * lift;
  if (side) { const dir = b.clone().sub(a); mid.add(new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(d * side)); }
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}

export class LinkSystem {
  constructor(parent) { this.group = new THREE.Group(); this.group.name = 'links'; parent.add(this.group); this.links = []; }

  /**
   * add({ curve, type, t0, drawDur, t1, outDur, radius, pulses, speed, dash })
   * type : 'gouvernance' | 'hierarchie' | 'contrat' | 'coordination'
   */
  add({ curve, type = 'hierarchie', color, t0 = 0, drawDur = 1, t1 = Infinity, outDur = 0.6, radius = 0.075, pulses = 3, speed = 0.35, dash = 0, tubular, parent = this.group, alpha = 1 }) {
    const col = color ?? LINK[type].color;
    const segs = tubular ?? Math.max(24, Math.min(160, Math.round(curve.getLength() * 6)));
    const geo = new THREE.TubeGeometry(curve, segs, radius, 8, false);
    const len = curve.getLength();
    const core = new THREE.Mesh(geo, mat(col, { pulseN: pulses, speed, dash, len }));
    const halo = new THREE.Mesh(geo, mat(col, { halo: true, pulseN: pulses, speed, dash, len }));
    halo.material.uniforms.uGrow.value = radius * 2.2;
    core.renderOrder = 5; halo.renderOrder = 6;
    core.frustumCulled = halo.frustumCulled = false;
    const g = new THREE.Group(); g.add(core, halo); parent.add(g);
    const L = { g, core, halo, curve, t0, drawDur, t1, outDur, alpha, len, type };
    this.links.push(L);
    return L;
  }
  update(t) {
    for (const L of this.links) {
      const prog = seg(t, L.t0, L.t0 + L.drawDur, easeInOutCubic);
      const out = L.t1 === Infinity ? 0 : seg(t, L.t1, L.t1 + L.outDur, smooth);
      const vis = prog > 0 && out < 1;
      L.g.visible = vis;
      if (!vis) continue;
      if (L.dyn) {
        // orienter/étirer le segment unité entre a(t) et b(t)
        L.a(t, L._a); L.b(t, L._b);
        if (L.lift) { L._a.y += L.lift; L._b.y += L.lift; }
        L._d.subVectors(L._b, L._a); const len = Math.max(1e-3, L._d.length());
        L.g.position.copy(L._a);
        L.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L._d.multiplyScalar(1 / len));
        L.g.scale.set(1, len, 1);
        L.core.material.uniforms.uLen.value = L.halo.material.uniforms.uLen.value = len;
      }
      for (const m of [L.core.material, L.halo.material]) {
        m.uniforms.uProg.value = prog >= 1 ? 1.001 : prog;
        m.uniforms.uTail.value = out; // la liaison se « retire » depuis son origine
        m.uniforms.uTime.value = t;
        m.uniforms.uAlpha.value = L.alpha;
      }
    }
  }
  /**
   * Liaison dynamique (segment droit entre deux points mobiles) : suit des personnages qui marchent.
   * a, b : fonctions (t, out) => Vector3 monde.
   */
  addDynamic({ a, b, type = 'hierarchie', color, t0 = 0, drawDur = 0.8, t1 = Infinity, outDur = 0.5, radius = 0.05, pulses = 2, speed = 0.45, dash = 0, lift = 0, parent = this.group }) {
    const col = color ?? LINK[type].color;
    const curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    const geo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
    const core = new THREE.Mesh(geo, mat(col, { pulseN: pulses, speed, dash, len: 1 }));
    const halo = new THREE.Mesh(geo, mat(col, { halo: true, pulseN: pulses, speed, dash, len: 1 }));
    halo.material.uniforms.uGrow.value = radius * 2.4;
    core.renderOrder = 5; halo.renderOrder = 6; core.frustumCulled = halo.frustumCulled = false;
    const g = new THREE.Group(); g.add(core, halo); parent.add(g);
    const L = { g, core, halo, dyn: true, a, b, t0, drawDur, t1, outDur, alpha: 1, lift, type, _a: new THREE.Vector3(), _b: new THREE.Vector3(), _d: new THREE.Vector3() };
    this.links.push(L);
    return L;
  }
  /** Point sur une liaison (0..1) — pour accrocher des paquets mobiles. */
  pointAt(L, u, out = new THREE.Vector3()) { return L.curve.getPointAt(clamp(u), out); }
}
