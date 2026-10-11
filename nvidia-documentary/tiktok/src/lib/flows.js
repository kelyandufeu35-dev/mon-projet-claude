// Flux lumineux : courbes 3D (tubes très fins) parcourues par des impulsions. Un seul maillage fusionné et un
// seul matériau additif pour toutes les courbes ; tout est une fonction pure du temps (`uTime`).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sharedTime } from '../../../engine/shaders.js';

/**
 * @param {THREE.Curve[]} curves
 * @param {object} o
 * @param {number|number[]} o.radius      rayon du tube (m), un par courbe ou commun
 * @param {THREE.ColorRepresentation} [o.color]
 * @param {number} [o.base]    lueur permanente du fil
 * @param {number} [o.peak]    intensité de la tête d'impulsion
 * @param {number} [o.speed]   cycles par seconde
 * @param {number} [o.pulses]  nombre d'impulsions par courbe
 * @param {number[]} [o.seeds] phases (0..1) par courbe
 */
export function makeFlows(curves, { radius = 0.01, color = 0x76b900, base = 0.12, peak = 6, speed = 0.45, pulses = 3, seeds = null, segments = 64, radial = 4 } = {}) {
  const geos = curves.map((c, i) => {
    const r = Array.isArray(radius) ? radius[i] : radius;
    const g = new THREE.TubeGeometry(c, segments, r, radial, false);
    const n = g.attributes.position.count;
    const along = new Float32Array(n);
    const seed = new Float32Array(n);
    const uv = g.attributes.uv;
    const s = seeds ? seeds[i] : ((i * 0.6180339) % 1);
    for (let v = 0; v < n; v++) { along[v] = uv.getX(v); seed[v] = s; }
    g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  });
  const geo = mergeGeometries(geos, false);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {
      uTime: sharedTime,
      uColor: { value: new THREE.Color(color) },
      uBase: { value: base },
      uPeak: { value: peak },
      uSpeed: { value: speed },
      uPulses: { value: pulses },
      uGain: { value: 1 },
    },
    vertexShader: 'attribute float aAlong; attribute float aSeed; varying float vAlong; varying float vSeed; void main(){ vAlong = aAlong; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uBase, uPeak, uSpeed, uPulses, uGain; uniform vec3 uColor; varying float vAlong; varying float vSeed;
      void main(){
        float ph = fract(vAlong * uPulses - uTime * uSpeed * (0.7 + 0.6 * vSeed) + vSeed * 7.0);
        float head = smoothstep(0.0, 0.03, ph) * (1.0 - smoothstep(0.03, 0.32, ph));
        float ends = smoothstep(0.0, 0.04, vAlong) * (1.0 - smoothstep(0.96, 1.0, vAlong));
        gl_FragColor = vec4(uColor * (uBase + uPeak * head) * ends * uGain, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, material: mat };
}

/** Arc de grand cercle entre deux points d'une sphère (rayon r), surélevé de `lift` au milieu. */
export function arcBetween(a, b, r, lift = 0.25, steps = 48) {
  const pts = [];
  const va = a.clone().normalize(), vb = b.clone().normalize();
  const ang = va.angleTo(vb);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = va.clone().multiplyScalar(Math.sin((1 - u) * ang)).add(vb.clone().multiplyScalar(Math.sin(u * ang))).divideScalar(Math.sin(ang) || 1).normalize();
    p.multiplyScalar(r * (1 + lift * Math.sin(Math.PI * u) * Math.min(1, ang / 1.2)));
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}
