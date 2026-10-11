// Plan 7 — le réseau mondial : la caméra frôle la surface nocturne de la Terre (lumières des villes), puis
// s'éloigne pour révéler tout le globe relié par un réseau de centres de données. Le mot « NVIDIA » est ajouté
// en surimpression (hud.js) sur la fin.
//
// Données : contours des terres et villes de Natural Earth (domaine public), voir tools/make-earth-data.mjs.
// Le réseau est schématique : les nœuds sont les plus grandes agglomérations, pas des sites réels de centres de
// données ; aucune carte de sites n'est suggérée.

import * as THREE from 'three';
import { CameraRig, configureCamera } from '../../../engine/camera.js';
import { sharedTime } from '../../../engine/shaders.js';
import { mulberry32, clamp } from '../../../engine/rng.js';
import { cue, S, DURATION } from '../timing.js';
import { makeFlows, arcBetween } from '../lib/flows.js';
import { LAND_W, LAND_H, LAND_B64, CITIES } from '../lib/earth-data.js';

const DEG = Math.PI / 180;
const P = (lon, lat, r = 1) => new THREE.Vector3(r * Math.cos(lat * DEG) * Math.sin(lon * DEG), r * Math.sin(lat * DEG), r * Math.cos(lat * DEG) * Math.cos(lon * DEG));

function decodeLand() {
  const bin = atob(LAND_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return (lon, lat) => {
    const x = Math.min(LAND_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * LAND_W)));
    const y = Math.min(LAND_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * LAND_H)));
    const i = y * LAND_W + x;
    return (bytes[i >> 3] & (0x80 >> (i & 7))) !== 0;
  };
}

const POINT_VERT = `
  attribute float aSize; attribute float aSeed;
  uniform float uScale; uniform float uMaxPx; uniform float uMinPx;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uScale / max(-mv.z, 0.01);
    gl_PointSize = clamp(px, uMinPx, uMaxPx);
    gl_Position = projectionMatrix * mv;
  }`;
const POINT_FRAG = `
  uniform vec3 uColor; uniform float uGain; uniform float uTime; uniform float uTwinkle;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.15, d);
    float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.0 + 3.0 * vSeed) + vSeed * 40.0));
    gl_FragColor = vec4(uColor * a * uGain * tw, 1.0);
  }`;

function pointsMaterial(color, gain, { maxPx = 6, minPx = 1.2, twinkle = 0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uGain: { value: gain }, uTime: sharedTime, uScale: { value: 1000 }, uMaxPx: { value: maxPx }, uMinPx: { value: minPx }, uTwinkle: { value: twinkle } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
  });
}

export function createGlobe({ pipe, width, height }) {
  const aspect = width / height;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const T0 = S.close;
  const T_ENGINE = cue('close.engine');
  const T_SELLS = cue('close.sells');
  const TEND = DURATION;
  const isLand = decodeLand();
  const rnd = mulberry32(2026);

  const globe = new THREE.Group();
  scene.add(globe);

  // Noyau sombre (cache l'autre hémisphère) et atmosphère.
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.994, 96, 64), new THREE.MeshBasicMaterial({ color: 0x04070b }));
  globe.add(core);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { c: { value: new THREE.Color(0.25, 0.55, 1.0) }, uGain: { value: 1.0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 c; uniform float uGain; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 6.0); gl_FragColor = vec4(c * f * 1.1 * uGain, 1.0); }',
    })
  );
  scene.add(atmo);

  // Terres : points sur une sphère de Fibonacci, gardés quand ils tombent sur une terre.
  const N = 110000;
  const landPts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    const lat = Math.asin(y) / DEG;
    const lon = Math.atan2(x, z) / DEG;
    if (isLand(lon, lat)) landPts.push(x, y, z);
  }
  const landGeo = new THREE.BufferGeometry();
  landGeo.setAttribute('position', new THREE.Float32BufferAttribute(landPts, 3));
  const nLand = landPts.length / 3;
  landGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(nLand).fill(0.0062), 1));
  landGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(Float32Array.from({ length: nLand }, () => rnd()), 1));
  const landMat = pointsMaterial(0x8fb8e8, 1.1, { maxPx: 4.5, minPx: 1.6 });
  const land = new THREE.Points(landGeo, landMat);
  globe.add(land);

  // Lumières des villes : un point par ville + un semis autour (déterministe), plus dense près des grandes villes.
  const cityPts = [], citySize = [], citySeed = [];
  const hubs = CITIES.slice(0, 16);
  CITIES.forEach(([lon, lat, pop], ci) => {
    const base = 0.010 + Math.min(0.02, Math.log10(Math.max(pop, 50)) * 0.0055);
    const v = P(lon, lat, 1.0015);
    cityPts.push(v.x, v.y, v.z); citySize.push(base * 1.6); citySeed.push(rnd());
    const n = Math.min(26, 4 + Math.floor(Math.log10(Math.max(pop, 50)) * 6));
    for (let j = 0; j < n; j++) {
      const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 1.6) * (0.6 + Math.log10(Math.max(pop, 50)) * 0.55);
      const lo = lon + Math.cos(a) * d / Math.max(0.2, Math.cos(lat * DEG)), la = lat + Math.sin(a) * d;
      if (!isLand(lo, la)) continue;
      const w = P(lo, la, 1.0015);
      cityPts.push(w.x, w.y, w.z); citySize.push(base * (0.35 + rnd() * 0.5)); citySeed.push(rnd());
    }
  });
  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPts, 3));
  cityGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(citySize, 1));
  cityGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(citySeed, 1));
  const cityMat = pointsMaterial(0xe6f6c8, 1.1, { maxPx: 6, minPx: 1.4, twinkle: 0.25 });
  const cities = new THREE.Points(cityGeo, cityMat);
  globe.add(cities);

  // Réseau : nœuds (les plus grandes agglomérations) et arcs lumineux entre voisins + quelques liaisons longues.
  const hubPts = [], hubSize = [], hubSeed = [];
  hubs.forEach(([lon, lat], i) => { const v = P(lon, lat, 1.004); hubPts.push(v.x, v.y, v.z); hubSize.push(0.032); hubSeed.push(i / hubs.length); });
  const hubGeo = new THREE.BufferGeometry();
  hubGeo.setAttribute('position', new THREE.Float32BufferAttribute(hubPts, 3));
  hubGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(hubSize, 1));
  hubGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(hubSeed, 1));
  const hubMat = pointsMaterial(0x76b900, 4.0, { maxPx: 22, minPx: 5, twinkle: 0.3 });
  const hubMesh = new THREE.Points(hubGeo, hubMat);
  globe.add(hubMesh);

  const pairs = new Set();
  const vec = hubs.map(([lon, lat]) => P(lon, lat));
  hubs.forEach((_, i) => {
    const d = vec.map((v, j) => [j, v.angleTo(vec[i])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
    for (const [j] of d.slice(0, 2)) pairs.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  });
  [[0, 7], [2, 11], [4, 13], [1, 9], [5, 14], [3, 12]].forEach(([a, b]) => pairs.add(a < b ? `${a}-${b}` : `${b}-${a}`));
  const curves = [...pairs].map((p) => {
    const [a, b] = p.split('-').map(Number);
    return arcBetween(vec[a], vec[b], 1.005, 0.32, 64);
  });
  const flows = makeFlows(curves, { radius: 0.0032, color: 0x76b900, base: 0.35, peak: 9, speed: 0.35, pulses: 2, segments: 64, radial: 4 });
  globe.add(flows.mesh);

  // Étoiles.
  const starPts = [], starSize = [], starSeed = [];
  for (let i = 0; i < 900; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    starPts.push(Math.cos(th) * r * 40, u * 40, Math.sin(th) * r * 40); starSize.push(0.06 + rnd() * 0.1); starSeed.push(rnd());
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(starSize, 1));
  starGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(starSeed, 1));
  const starMat = pointsMaterial(0xcfe0ff, 0.5, { maxPx: 2.2, minPx: 1.0, twinkle: 0.5 });
  scene.add(new THREE.Points(starGeo, starMat));

  // --- Caméra : on frôle la surface, puis on s'éloigne et on contourne ----------------------------------------------------
  const k = (t, pos, target, o = {}) => ({ t, pos: pos.toArray(), target: target.toArray(), focal: 30, fstop: 11, near: 0.02, far: 100, ease: 'inOut', ...o });
  const rig = new CameraRig([
    k(T0, P(-36, 30, 1.42), P(-8, 40, 0.95)),
    k(T0 + 2.2, P(-32, 33, 2.05), P(-4, 32, 0.9)),
    k(T_ENGINE, P(-22, 28, 2.9), new THREE.Vector3(0, 0, 0)),
    k(T_SELLS, P(-4, 26, 3.1), new THREE.Vector3(0, 0, 0)),
    k(TEND, P(18, 24, 3.4), new THREE.Vector3(0, 0, 0)),
  ]);

  function placeCamera(cam, t) {
    const c = rig.sample(t);
    return configureCamera(cam, { pos: c.pos, target: c.target, focal: c.focal, fstop: c.fstop, focus: c.focus, aspect, near: c.near, far: c.far, roll: c.roll, up: c.up });
  }

  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  function evaluate(t) {
    sharedTime.value = t;
    const lens = placeCamera(camera, t);
    const scale = height / (2 * Math.tan((camera.fov * DEG) / 2));
    for (const m of [landMat, cityMat, hubMat, starMat]) m.uniforms.uScale.value = scale;
    const u = t - T0;
    globe.rotation.y = u * 0.05;
    flows.material.uniforms.uGain.value = easeOut((u - 1.2) / 1.6);
    flows.material.uniforms.uSpeed.value = 0.35 + 0.5 * easeOut((t - T_SELLS) / 1.0);
    hubMat.uniforms.uGain.value = 3.0 + 2.0 * easeOut((t - T_ENGINE) / 1.0);
    const g = pipe.grade;
    g.exposure = 1.3;
    g.bloomStrength = 0.24;
    g.vignette = 0.62;
    return { scene, camera, lens };
  }

  return { evaluate, placeCamera, shutterFrac: () => 0.5, sampleFactor: () => 1.4, scene };
}
