// Plan 6 — l'économie : vue aérienne de nuit. Les grands acteurs du cloud (gros campus), les laboratoires d'IA
// (bâtiments moyens) et les entreprises (petits bâtiments) envoient des flux lumineux vers un cœur central
// (NVIDIA). À « l'essentiel du chiffre d'affaires », un anneau autour du cœur se remplit presque entièrement
// (proportion sans chiffre). Formes génériques ; aucune donnée financière affichée.

import * as THREE from 'three';
import { CameraRig, configureCamera } from '../../../engine/camera.js';
import { sharedTime } from '../../../engine/shaders.js';
import { mulberry32, clamp } from '../../../engine/rng.js';
import { cue, S } from '../timing.js';
import { cvs } from '../lib/draw.js';
import { makeFlows } from '../lib/flows.js';

const GREEN = new THREE.Color(0x76b900);

function makeWindows() {
  const w = 256, h = 64;
  const k = cvs(w, h);
  const g = k.getContext('2d');
  const rnd = mulberry32(5);
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  for (let row = 0; row < 5; row++) {
    for (let x = 0; x < w; x += 6) {
      if (rnd() < 0.62) {
        g.fillStyle = rnd() < 0.1 ? '#76b900' : '#c9dcff';
        g.fillRect(x + 1, 6 + row * 11, 4, 5);
      }
    }
  }
  const t = new THREE.CanvasTexture(k);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function makeGround() {
  const px = 1024;
  const k = cvs(px);
  const g = k.getContext('2d');
  g.fillStyle = '#05070a';
  g.fillRect(0, 0, px, px);
  g.strokeStyle = 'rgba(80,120,150,0.20)';
  g.lineWidth = 2;
  const n = 8;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo((i * px) / n, 0); g.lineTo((i * px) / n, px); g.stroke(); g.beginPath(); g.moveTo(0, (i * px) / n); g.lineTo(px, (i * px) / n); g.stroke(); }
  g.strokeStyle = 'rgba(80,120,150,0.08)';
  g.lineWidth = 1;
  for (let i = 0; i <= n * 4; i++) { g.beginPath(); g.moveTo((i * px) / (n * 4), 0); g.lineTo((i * px) / (n * 4), px); g.stroke(); g.beginPath(); g.moveTo(0, (i * px) / (n * 4)); g.lineTo(px, (i * px) / (n * 4)); g.stroke(); }
  const t = new THREE.CanvasTexture(k);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function createCampus({ pipe, width, height }) {
  const aspect = width / height;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060a, 0.011);
  const camera = new THREE.PerspectiveCamera();

  const T0 = S.economy;
  const T_CLOUD = cue('economy.cloud');
  const T_LABS = cue('economy.labs');
  const T_RACE = cue('economy.race');
  const T_REV = cue('economy.revenue');
  const T1 = S.close;

  scene.add(new THREE.HemisphereLight(0x9fb6d8, 0x0a0d12, 0.7));
  const moon = new THREE.DirectionalLight(0xb8cfff, 0.9);
  moon.position.set(-10, 20, 8);
  scene.add(moon);

  // Sol.
  const gt = makeGround();
  gt.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // --- Bâtiments ---------------------------------------------------------------------------------------------------
  const rnd = mulberry32(77);
  const blds = []; // { x, z, ang, L, W, H, group }
  const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  // Grands acteurs du cloud : 4 campus de 2x3 bâtiments.
  for (let c = 0; c < 4; c++) {
    const a0 = THREE.MathUtils.degToRad(35 + c * 90);
    const [cx, cz] = polar(21, a0);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      const ox = (i - 0.5) * 3.4, oz = (j - 1) * 8.6;
      const rot = a0 + Math.PI / 2;
      const x = cx + ox * Math.cos(rot) - oz * Math.sin(rot);
      const z = cz + ox * Math.sin(rot) + oz * Math.cos(rot);
      blds.push({ x, z, ang: -rot, L: 7.4, W: 2.2, H: 0.9, g: 'cloud' });
    }
  }
  // Laboratoires.
  for (let i = 0; i < 7; i++) {
    const a = THREE.MathUtils.degToRad(15 + i * (360 / 7));
    const [x, z] = polar(12 + (i % 2) * 2.2, a);
    blds.push({ x, z, ang: -a, L: 3.6, W: 1.5, H: 0.7, g: 'labs' });
  }
  // Entreprises.
  for (let i = 0; i < 30; i++) {
    const a = rnd() * Math.PI * 2, r = 8 + rnd() * 20;
    const [x, z] = polar(r, a);
    blds.push({ x, z, ang: -a + (rnd() - 0.5) * 0.4, L: 1.3, W: 1.0, H: 0.5, g: 'ent' });
  }
  const winTex = makeWindows();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a434e, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.0 });
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bodyMat, blds.length);
  const trimMat = new THREE.MeshBasicMaterial({ color: GREEN.clone().multiplyScalar(4), toneMapped: false });
  const trims = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trimMat, blds.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  blds.forEach((b, i) => {
    q.setFromAxisAngle(up, b.ang);
    m4.compose(pos.set(b.x, b.H / 2, b.z), q, sc.set(b.L, b.H, b.W));
    bodies.setMatrixAt(i, m4);
    m4.compose(pos.set(b.x, b.H + 0.02, b.z), q, sc.set(b.L * 0.96, 0.05, 0.08));
    trims.setMatrixAt(i, m4);
  });
  scene.add(bodies, trims);

  // --- Cœur central --------------------------------------------------------------------------------------------------------
  const hub = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0e12, metalness: 0.8, roughness: 0.3 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.3, 96), darkMat);
  disc.position.y = 0.15;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.7, 0.45, 96),
    [
      new THREE.MeshBasicMaterial({ color: GREEN.clone().multiplyScalar(1.2), toneMapped: false }),
      new THREE.ShaderMaterial({
        toneMapped: false,
        uniforms: { uTime: sharedTime, c: { value: GREEN.clone() } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'uniform float uTime; uniform vec3 c; varying vec2 vP; void main(){ float r = length(vP) / 1.5; float rings = 0.55 + 0.45 * sin(r * 34.0 - uTime * 2.5); float core = smoothstep(1.0, 0.0, r); vec3 col = mix(c * 0.55, vec3(0.85, 1.0, 0.55) * 2.2, core * core) * rings; gl_FragColor = vec4(col, 1.0); }',
      }),
      new THREE.MeshBasicMaterial({ color: GREEN.clone().multiplyScalar(0.6), toneMapped: false }),
    ]
  );
  core.position.y = 0.4;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.05, 8, 128), new THREE.MeshBasicMaterial({ color: GREEN.clone().multiplyScalar(4), toneMapped: false }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.31;
  hub.add(disc, core, rim);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.6, 14, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: GREEN.clone() }, uGain: { value: 1 } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 c; uniform float uGain; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); gl_FragColor = vec4(c * 0.55 * uGain * f * pow(1.0 - vY, 2.0), 1.0); }',
    })
  );
  column.position.y = 7.2;
  hub.add(column);
  scene.add(hub);

  // Anneau de proportion : l'arc rempli croît de 0 à 92 % (sans chiffre affiché).
  const gauge = new THREE.Mesh(
    new THREE.TorusGeometry(3.7, 0.13, 8, 192),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uFill: { value: 0 }, uC: { value: GREEN.clone().multiplyScalar(5) }, uShow: { value: 0 } },
      vertexShader: 'varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uFill; uniform vec3 uC; uniform float uShow; varying float vU; void main(){ float on = step(vU, uFill); vec3 col = mix(uC * 0.12, uC, on); float edge = exp(-pow((vU - uFill) / 0.012, 2.0)) * step(0.001, uFill); gl_FragColor = vec4((col + vec3(1.0, 1.0, 0.8) * edge * 3.0) * uShow, 1.0); }',
    })
  );
  gauge.rotation.x = Math.PI / 2;
  gauge.position.y = 0.34;
  scene.add(gauge);

  // --- Flux : du bâtiment vers le cœur ----------------------------------------------------------------------------------------
  const mkFlows = (group, radius, peak) => {
    const list = blds.filter((b) => b.g === group);
    const curves = list.map((b, i) => {
      const a = Math.atan2(b.z, b.x) + (rnd() - 0.5) * 0.6;
      const end = new THREE.Vector3(Math.cos(a) * 2.3, 0.6, Math.sin(a) * 2.3);
      const start = new THREE.Vector3(b.x, b.H + 0.1, b.z);
      const d = start.distanceTo(end);
      const mid = start.clone().lerp(end, 0.5);
      mid.y = d * (group === 'cloud' ? 0.32 : 0.26);
      return new THREE.QuadraticBezierCurve3(start, mid, end);
    });
    const f = makeFlows(curves, { radius, color: group === 'ent' ? 0xcfe6ff : 0x76b900, base: 0.10, peak, speed: 0.5, pulses: group === 'cloud' ? 5 : 3, segments: 48, radial: 4 });
    scene.add(f.mesh);
    return f;
  };
  const flowsCloud = mkFlows('cloud', 0.075, 6.5);
  const flowsLabs = mkFlows('labs', 0.05, 6);
  const flowsEnt = mkFlows('ent', 0.03, 5);

  // --- Caméra ---------------------------------------------------------------------------------------------------------------------------
  const k = (t, pos, target, o = {}) => ({ t, pos, target, focal: 30, fstop: 11, near: 0.2, far: 300, ease: 'inOut', ...o });
  const A = THREE.MathUtils.degToRad(35 + 0 * 90);
  const cloudDir = [Math.cos(A), Math.sin(A)];
  const rig = new CameraRig([
    // Survol bas d'un campus du cloud, regard vers le cœur.
    k(T0, [cloudDir[0] * 31, 2.4, cloudDir[1] * 31 + 3], [cloudDir[0] * 18, 0.6, cloudDir[1] * 18], { focal: 30 }),
    k(T_CLOUD + 0.6, [cloudDir[0] * 25, 3.2, cloudDir[1] * 25 + 5], [cloudDir[0] * 11, 0.8, cloudDir[1] * 11], { focal: 30 }),
    // Les laboratoires : on monte et on contourne.
    k(T_LABS + 0.4, [10, 9, 16], [-1, 0.5, 2], { focal: 30 }),
    // La course : vue large.
    k(T_RACE + 0.6, [-14, 22, 18], [0, 0.0, 0], { focal: 32 }),
    // Le cœur : vue de dessus, l'anneau se remplit.
    k(T_REV + 0.2, [2, 15, 2.5], [0, 0, 0], { focal: 28, up: [0, 0, -1] }),
    k(T1, [0.5, 21, 0.5], [0, 0, 0], { focal: 28, up: [0, 0, -1] }),
  ]);

  function placeCamera(cam, t) {
    const c = rig.sample(t);
    return configureCamera(cam, { pos: c.pos, target: c.target, focal: c.focal, fstop: c.fstop, focus: c.focus, aspect, near: c.near, far: c.far, roll: c.roll, up: c.up });
  }

  function evaluate(t) {
    sharedTime.value = t;
    // Les flux s'activent au fil de la phrase : cloud, puis laboratoires et entreprises, puis course.
    const on = (t0, d = 0.5) => clamp((t - t0) / d, 0, 1);
    flowsCloud.material.uniforms.uGain.value = on(T0 + 0.2);
    flowsLabs.material.uniforms.uGain.value = on(T_LABS - 0.2);
    flowsEnt.material.uniforms.uGain.value = on(T_LABS + 0.8);
    const race = on(T_RACE, 1.0);
    for (const f of [flowsCloud, flowsLabs, flowsEnt]) f.material.uniforms.uSpeed.value = 0.5 + 0.9 * race;
    // Anneau.
    const fill = clamp((t - (T_REV + 0.15)) / 1.6, 0, 1);
    const e = 1 - Math.pow(1 - fill, 3);
    gauge.material.uniforms.uFill.value = e * 0.92;
    gauge.material.uniforms.uShow.value = on(T_REV - 0.2, 0.4);
    column.material.uniforms.uGain.value = 0.6 + 0.9 * on(T_REV, 1.2);
    const g = pipe.grade;
    g.exposure = 1.25;
    g.bloomStrength = 0.2;
    g.vignette = 0.6;
    const lens = placeCamera(camera, t);
    return { scene, camera, lens };
  }

  return { evaluate, placeCamera, shutterFrac: () => 0.5, sampleFactor: () => 1.4, scene };
}
