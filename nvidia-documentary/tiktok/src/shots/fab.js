// Plan 3 — la fonderie : salle blanche, bras robotisé qui manipule un wafer, gros plan du wafer balayé de
// lumière, pile de couches, plan de masse de la puce.
//
// Cinq séquences, toutes dans un même graphe de scène (les décors secondaires sont loin sur l'axe X, chacun
// avec sa caméra) ; elles sont calées sur les mots de la voix off (voir timing.js) :
//   A1 salle blanche large, le bras va chercher un wafer        « Des fonderies, comme TSMC… »
//   A2 le wafer en gros plan, balayé par un faisceau             « …transforment des plaques de silicium en puces, »
//   B  la pile de couches qui se construit                       « couche microscopique après couche. »
//   A3 recul dans la salle                                       « NVIDIA ne possède aucune usine de puces. »
//   C  plan de masse lumineux de la puce                         « Elle possède la conception. »
// Rien ici ne prétend représenter un procédé réel : formes génériques, aucune cote.

import * as THREE from 'three';
import { CameraRig, configureCamera } from '../../../engine/camera.js';
import { buildEnvironment } from '../../../engine/env.js';
import { pbr } from '../../../engine/materials.js';
import { patch, sharedTime, addHallAmbient, addFresnelMirror } from '../../../engine/shaders.js';
import { mulberry32, smoothstep, clamp } from '../../../engine/rng.js';
import { toTexture, makeChassisPanel } from '../../../engine/textures.js';
import { cue, S } from '../timing.js';
import { cvs, makeWaferTextures, makeFloorplan, makeRouting } from '../lib/draw.js';

const WHITE = 0xe9edf1;

// --- Bras robotisé (type SCARA) --------------------------------------------------------------------
const L1 = 0.38;          // épaule -> coude
const L2 = 0.38;          // coude -> poignet
const BLADE = 0.14;       // poignet -> centre du wafer porté
const L2E = L2 + BLADE;   // longueur efficace pour la cinématique inverse
const SHOULDER_Y = 1.0;
const FOUP_X = -0.78, CHAMBER_X = 0.72;

// Cinématique inverse plane (XZ) : angles absolus (θ1 de l'épaule, θ12 du dernier maillon), coude à signe fixe.
function ik(tx, tz) {
  const d = THREE.MathUtils.clamp(Math.hypot(tx, tz), 0.25, L1 + L2E - 1e-3);
  const psi = Math.atan2(tz, tx);
  const alpha = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2E * L2E) / (2 * L1 * d), -1, 1));
  const th1 = psi - alpha;
  const wx = L1 * Math.cos(th1), wz = L1 * Math.sin(th1);
  const th12 = Math.atan2(tz - wz, tx - wx);
  return { th1, th12 };
}

// Cycle du bras (période 9 s) : [t, x, z, lift, porte un wafer].
const CYCLE = 9;
const KEYS = [
  [0.0, 0.0, 0.46, 0.0, 0],
  [1.0, -0.50, 0.0, -0.012, 0],
  [2.0, FOUP_X, 0.0, -0.012, 0],
  [2.5, FOUP_X, 0.0, 0.012, 1],
  [3.5, -0.50, 0.0, 0.012, 1],
  [4.25, -0.30, 0.42, 0.012, 1],
  [5.0, 0.30, 0.42, 0.012, 1],
  [5.75, 0.50, 0.0, 0.012, 1],
  [6.5, CHAMBER_X, 0.0, 0.012, 1],
  [6.95, CHAMBER_X, 0.0, -0.012, 0],
  [7.7, 0.50, 0.0, -0.012, 0],
  [9.0, 0.0, 0.46, 0.0, 0],
];
function armAt(t) {
  const u = ((t % CYCLE) + CYCLE) % CYCLE;
  let i = 0;
  while (i < KEYS.length - 2 && u > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = THREE.MathUtils.clamp((u - a[0]) / (b[0] - a[0]), 0, 1);
  const s = k * k * (3 - 2 * k);
  const lerp = (p, q) => p + (q - p) * s;
  return { x: lerp(a[1], b[1]), z: lerp(a[2], b[2]), lift: lerp(a[3], b[3]), carry: u >= 2.0 && u < 6.95 ? 1 : 0 };
}

function slab(len, wid, thick) {
  const rr = wid / 2;
  const s = new THREE.Shape();
  s.absarc(len, 0, rr, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, rr);
  s.absarc(0, 0, rr, Math.PI / 2, (3 * Math.PI) / 2, false);
  s.lineTo(len, -rr);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thick / 2, 0);
  return g;
}

// --- Textures de la salle ---------------------------------------------------------------------------
function makeCleanFloor() {
  const px = 1024;
  const k = cvs(px);
  const g = k.getContext('2d');
  const rnd = mulberry32(61);
  g.fillStyle = '#3a4149';
  g.fillRect(0, 0, px, px);
  const half = px / 2;
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * half, y = Math.floor(i / 2) * half;
    g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rnd() * 0.035})`;
    g.fillRect(x, y, half, half);
  }
  // Dalle perforée.
  const pitch = px / 36;
  g.fillStyle = '#12161a';
  for (let y = pitch / 2; y < half; y += pitch) for (let x = pitch / 2 + half; x < px; x += pitch) { g.beginPath(); g.arc(x, y, pitch * 0.28, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#0b0e11';
  for (const p of [0, half, px]) { g.fillRect(p - 2, 0, 4, px); g.fillRect(0, p - 2, px, 4); }
  return toTexture(k, { srgb: true, repeat: [1, 1], aniso: 8 });
}

function makeWall() {
  const w = 1024, h = 512;
  const k = cvs(w, h);
  const g = k.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#222930');
  grad.addColorStop(1, '#343c45');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 2, 0, 4, h);
  g.fillStyle = 'rgba(160,175,190,0.12)';
  g.fillRect(0, h * 0.62, w, 3);
  return toTexture(k, { srgb: true, repeat: [1, 1], aniso: 4 });
}

// --- Cadre de la salle blanche -------------------------------------------------------------------------
// Sombre et réfléchissant comme la salle de données de la pilote : matériaux graphite, rampes de dalles
// lumineuses au plafond, ambiance « cuite » par zones sous chaque rangée de dalles, reflets au sol.
function buildRoom() {
  const g = new THREE.Group();
  const W = 6, H = 3.4, Z0 = 4, Z1 = -18;
  const len = Z0 - Z1, zc = (Z0 + Z1) / 2;
  const ffuZ0 = Z1 + 0.9, ffuStep = 1.3;
  const ambient = (m, a, sheen = 0) => addHallAmbient(m, { ambient: a, period: ffuStep, z0: ffuZ0, poolMin: 0.35, heightFull: 2.6, heightMin: 0.5, sheen });
  const flip = new THREE.Matrix4().makeScale(1, -1, 1);
  const mirrorOf = (im, mat) => {
    const m = new THREE.InstancedMesh(im.geometry, mat, im.count);
    const t = new THREE.Matrix4();
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, t); t.premultiply(flip); m.setMatrixAt(i, t); }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    g.add(m);
    return m;
  };
  // Sol : Lambert transparent à transparence de Fresnel ; les copies miroir sous le sol y apparaissent.
  const floorTex = makeCleanFloor();
  floorTex.repeat.set(W / 1.2, len / 1.2);
  const floorMat = new THREE.MeshLambertMaterial({
    color: 0xffffff, map: floorTex, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  ambient(floorMat, 4.2, 0.2);
  addFresnelMirror(floorMat, { strength: 1.0, roughness: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, len), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zc);
  g.add(floor);
  // Murs et plafond.
  const wallTex = makeWall();
  wallTex.repeat.set(len / 4.8, 1);
  for (const sx of [-1, 1]) {
    const wm = ambient(new THREE.MeshLambertMaterial({ map: wallTex, color: 0xffffff }), 3.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wm);
    m.rotation.y = -sx * Math.PI / 2;
    m.position.set(sx * W / 2, H / 2, zc);
    g.add(m);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ color: 0x1b2128, emissive: 0x0c1218 }));
  back.position.set(0, H / 2, Z1);
  g.add(back);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, len), new THREE.MeshBasicMaterial({ color: 0x07090b }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, zc);
  g.add(ceil);
  // Dalles d'éclairage au plafond (FFU) : émissives, en grille.
  const ffu = [];
  for (let z = ffuZ0; z < Z0; z += ffuStep) for (const x of [-2.1, -0.7, 0.7, 2.1]) ffu.push([x, z]);
  const ffuGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const ffuMesh = new THREE.InstancedMesh(ffuGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfeaff).multiplyScalar(2.1), toneMapped: false }), ffu.length);
  const m4 = new THREE.Matrix4();
  const rotX = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  ffu.forEach(([x, z], i) => { m4.compose(new THREE.Vector3(x, H - 0.01, z), rotX, new THREE.Vector3(1, 1, 1)); ffuMesh.setMatrixAt(i, m4); });
  g.add(ffuMesh);
  mirrorOf(ffuMesh, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfeaff).multiplyScalar(2.1), side: THREE.BackSide, toneMapped: false }));
  // Rangées d'outils : armoires titane avec baies vitrées sombres et liserés d'état.
  const rnd = mulberry32(17);
  const cab = [];
  for (let z = Z1 + 1; z < Z0 + 0.5; z += 1.7) for (const sx of [-1, 1]) cab.push([sx * (W / 2 - 0.65), z, rnd()]);
  const panel = makeChassisPanel({ px: 512, seed: 81 });
  const cabMat = ambient(new THREE.MeshLambertMaterial({ map: panel, color: 0xb9c2cc }), 3.0, 0.3);
  const cabMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 2.1, 1.45), cabMat, cab.length);
  const stripGeo = new THREE.BoxGeometry(0.02, 0.05, 1.1);
  const stripMesh = new THREE.InstancedMesh(stripGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), cab.length);
  const winMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.7, 0.9), new THREE.MeshBasicMaterial({ color: 0x05080b }), cab.length);
  const col = new THREE.Color();
  cab.forEach(([x, z, r], i) => {
    m4.makeTranslation(x, 1.05, z);
    cabMesh.setMatrixAt(i, m4);
    cabMesh.setColorAt(i, col.setHSL(0.58, 0.06, 0.62 + r * 0.2));
    const inner = x < 0 ? x + 0.61 : x - 0.61;
    m4.makeTranslation(inner, 1.55, z);
    stripMesh.setMatrixAt(i, m4);
    stripMesh.setColorAt(i, r > 0.82 ? col.set(0x3a8cff).multiplyScalar(4.5) : col.set(0x76b900).multiplyScalar(5));
    m4.makeTranslation(inner, 1.1, z);
    winMesh.setMatrixAt(i, m4);
  });
  g.add(cabMesh, stripMesh, winMesh);
  mirrorOf(stripMesh, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x76b900).multiplyScalar(4), side: THREE.BackSide, toneMapped: false }));
  return g;
}

// --- Cellule : bras, boîte de transport (FOUP), chambre -----------------------------------------------
function buildCell() {
  const g = new THREE.Group();
  const white = pbr({ color: WHITE, metalness: 0.15, roughness: 0.3 });
  const graphite = pbr({ color: 0x1b2026, metalness: 0.7, roughness: 0.35 });
  const steel = pbr({ color: 0xaab3be, metalness: 0.95, roughness: 0.22 });

  // Socle et colonne.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 48), graphite);
  base.position.y = 0.03;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, SHOULDER_Y - 0.06, 48), white);
  column.position.y = 0.06 + (SHOULDER_Y - 0.06) / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 48), steel);
  cap.position.y = SHOULDER_Y - 0.02;
  g.add(base, column, cap);

  // Maillons.
  const shoulder = new THREE.Group();
  shoulder.position.y = SHOULDER_Y;
  const link1 = new THREE.Mesh(slab(L1, 0.12, 0.05), white);
  link1.position.y = 0.025;
  shoulder.add(link1);
  const hub1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 32), graphite);
  hub1.position.y = 0.03;
  shoulder.add(hub1);
  const elbow = new THREE.Group();
  elbow.position.set(L1, 0.055, 0);
  link1.add(elbow);
  const link2 = new THREE.Mesh(slab(L2, 0.1, 0.04), white);
  link2.position.y = 0.02;
  elbow.add(link2);
  const hub2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 32), graphite);
  hub2.position.y = 0.03;
  elbow.add(hub2);
  const bladeMat = pbr({ color: 0x0f1317, metalness: 0.4, roughness: 0.3 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.006, 0.05), bladeMat);
  blade.position.set(L2 + 0.12, 0.05, 0);
  elbow.add(blade);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 24), steel);
  wrist.position.set(L2, 0.035, 0);
  elbow.add(wrist);
  g.add(shoulder);

  // Wafer porté (même matériau que le héros, sans iridescence coûteuse).
  const tex = makeWaferTextures({ px: 1024, seed: 7 });
  const waferMat = pbr({ color: 0xffffff, map: tex.map, orm: tex.orm, metalness: 1, roughness: 1 });
  const waferGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.0035, 64);
  const carried = new THREE.Mesh(waferGeo, waferMat);
  carried.position.set(L2 + BLADE, 0.0545, 0);
  elbow.add(carried);

  // FOUP : socle, boîte fumée, wafers empilés visibles à travers.
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.86, 0.46), graphite);
  stand.position.set(FOUP_X - 0.05, 0.43, 0);
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x76b900).multiplyScalar(5), toneMapped: false });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.3), ledMat);
  led.position.set(FOUP_X + 0.19, 0.78, 0);
  const foupMat = new THREE.MeshStandardMaterial({ color: 0x26303a, transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0.0, depthWrite: false });
  const foup = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.36), foupMat);
  foup.position.set(FOUP_X - 0.02, 1.195, 0);
  foup.renderOrder = 2;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.38), graphite);
  frame.position.set(FOUP_X - 0.02, 1.03, 0);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.38), graphite);
  lid.position.set(FOUP_X - 0.02, 1.36, 0);
  g.add(stand, led, foup, frame, lid);
  const slots = [];
  for (let i = 0; i < 13; i++) {
    const w = new THREE.Mesh(waferGeo, waferMat);
    w.position.set(FOUP_X, 1.0445 + i * 0.0225, 0);
    slots.push(w);
    g.add(w);
  }
  const PICK = 4;                          // le wafer pris par le bras (à la hauteur de la lame quand le bras est à lift = 0)

  // Chambre de procédé : bloc blanc avec fente lumineuse.
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.55, 1.1), white);
  chamber.position.set(CHAMBER_X + 0.5 + 0.0, 0.775, 0);
  const slotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x76b900).multiplyScalar(6), toneMapped: false });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.42), slotMat);
  slot.position.set(CHAMBER_X - 0.05, 1.1, 0);
  const panelDark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x0a0d11 }));
  panelDark.position.set(CHAMBER_X - 0.04, 1.1, 0);
  g.add(chamber, panelDark, slot);

  const state = { carried, slots, PICK, shoulder, link1, elbow };
  return { group: g, state };
}

function poseArm(state, t) {
  const a = armAt(t);
  const { th1, th12 } = ik(a.x, a.z);
  state.shoulder.position.y = SHOULDER_Y + a.lift;
  state.link1.rotation.y = -th1;
  state.elbow.rotation.y = -(th12 - th1);
  state.carried.visible = a.carry === 1;
  // Le wafer reste à la hauteur de la boîte (ou de la chambre) tant que la lame est plus basse que lui.
  state.carried.position.y = 0.0545 + Math.max(0, -a.lift);
  // Le wafer d'origine reste dans la boîte jusqu'à la prise, puis disparaît ; un nouveau le remplace après le cycle.
  const u = ((t % CYCLE) + CYCLE) % CYCLE;
  state.slots[state.PICK].visible = u < 2.0 || u >= 8.4;
}

// --- Gros plan du wafer ----------------------------------------------------------------------------------
function buildWaferStage(envTex) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 96), pbr({ color: 0x0b0e12, metalness: 0.85, roughness: 0.22 }));
  floor.position.y = -0.01;
  g.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.004, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x76b900).multiplyScalar(2.2), toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.002;
  g.add(ring);
  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.05, 64), pbr({ color: 0x8b95a1, metalness: 1, roughness: 0.3 }));
  chuck.position.y = 0.025;
  g.add(chuck);
  const tex = makeWaferTextures({ px: 2048, seed: 7 });
  tex.map.colorSpace = THREE.SRGBColorSpace;
  const waferMat = pbr({ color: 0xffffff, map: tex.map, orm: tex.orm, metalness: 1, roughness: 1, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 620], envMapIntensity: 1.5 });
  // Balayage : une barre lumineuse (fente de projection) parcourt le wafer.
  const scan = { value: -0.2 };
  patch(waferMat, 'waferscan', (shader) => {
    shader.uniforms.uScan = scan;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uScan;\nvarying vec3 vWObj;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float hfd = vWObj.x - uScan;
        float hfBand = exp(-hfd * hfd / 0.00004);
        float hfTail = exp(-max(-hfd, 0.0) * 14.0) * step(hfd, 0.0) * 0.0 + smoothstep(-0.05, 0.0, hfd) * (1.0 - step(0.0, hfd)) * 0.25;
        totalEmissiveRadiance += vec3(0.55, 1.0, 0.25) * (hfBand * 5.0 + hfTail);`);
  });
  const wafer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.0035, 128), waferMat);
  wafer.position.y = 0.0525;
  g.add(wafer);
  // Faisceau vertical : volume additif très léger, bords adoucis (Fresnel) pour éviter un cône à arêtes vives.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.03, 0.9, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: new THREE.Color(0.55, 0.75, 1.0) } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 c; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(c * 0.07 * f * pow(1.0 - vY, 1.4), 1.0); }',
    })
  );
  beam.position.y = 0.5;
  g.add(beam);
  return { group: g, wafer, scan };
}

// --- Pile de couches -----------------------------------------------------------------------------------------
// Vue éclatée d'une puce en coupe : diélectrique en verre, métallisations (cuivre, aluminium), puis une couche
// de liaisons actives en vert. Chaque couche se dépose à son tour (éclat à l'arrivée).
function buildLayerStage() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 96), pbr({ color: 0x0b0e12, metalness: 0.85, roughness: 0.25 }));
  base.position.y = -0.01;
  g.add(base);
  const SIZE = 0.2, TH = 0.006, PITCH = 0.021;
  const glassMat = (op) => new THREE.MeshStandardMaterial({ color: 0xb4c6e6, transparent: true, opacity: op, roughness: 0.08, metalness: 0.0, depthWrite: false, envMapIntensity: 1.3 });
  const defs = [
    { kind: 'si' },
    { kind: 'glass', op: 0.16 },
    { kind: 'lines', color: 0xd9894b, seed: 11 },   // cuivre
    { kind: 'glass', op: 0.14 },
    { kind: 'lines', color: 0xd7dde6, seed: 12 },   // aluminium
    { kind: 'glass', op: 0.13 },
    { kind: 'lines', color: 0xd9894b, seed: 13 },
    { kind: 'glass', op: 0.12 },
    { kind: 'glow', color: 0x76b900, seed: 14 },    // liaisons actives
    { kind: 'glass', op: 0.10 },
  ];
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0x9fc7ff).multiplyScalar(1.4), transparent: true, opacity: 0.55, toneMapped: false });
  const layers = [];
  defs.forEach((d, i) => {
    const grp = new THREE.Group();
    const geo = new THREE.BoxGeometry(SIZE, TH, SIZE);
    let mainMat;
    if (d.kind === 'si') mainMat = pbr({ color: 0x4b525d, metalness: 0.95, roughness: 0.32 });
    else if (d.kind === 'glass') mainMat = glassMat(d.op);
    else {
      mainMat = glassMat(0.07);
      // Les lignes de métallisation : plan supérieur à alphaMap (lignes opaques).
      const r = makeRouting({ px: 512, seed: d.seed, pitch: 16, density: 0.6, lineW: 4 });
      r.map.colorSpace = THREE.NoColorSpace;
      const lineMat = d.kind === 'glow'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(d.color).multiplyScalar(3.0), toneMapped: false, transparent: true, alphaMap: r.map, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color: d.color, metalness: 1, roughness: 0.25, transparent: true, alphaMap: r.map, depthWrite: false, envMapIntensity: 1.4 });
      const lines = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 0.98, SIZE * 0.98), lineMat);
      lines.rotation.x = -Math.PI / 2;
      lines.position.y = TH / 2 + 0.0004;
      lines.renderOrder = 6 + i;
      grp.add(lines);
      grp.userData.lineMat = lineMat;
    }
    const slab = new THREE.Mesh(geo, mainMat);
    slab.renderOrder = 3 + i;
    grp.add(slab);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    edges.renderOrder = 5 + i;
    grp.add(edges);
    grp.position.y = TH / 2 + i * PITCH;
    g.add(grp);
    layers.push({ grp, y: grp.position.y, i, mat: mainMat });
  });
  return { group: g, layers };
}

// --- Plan de masse ------------------------------------------------------------------------------------------------
function buildBlueprint() {
  const g = new THREE.Group();
  const fpOutline = makeFloorplan({ layer: 'outline' });
  const fpGrid = makeFloorplan({ layer: 'grid', seed: 4 });
  const prog = { value: 0 };
  const mk = (tex, y, gain) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.0 / tex.aspect),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { tMap: { value: tex.map }, uProg: prog, uGain: { value: gain }, uTime: sharedTime },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform sampler2D tMap; uniform float uProg; uniform float uGain; uniform float uTime; varying vec2 vUv;
          void main(){
            vec4 c = texture2D(tMap, vUv);
            float r = length((vUv - 0.5) * vec2(1.0, 0.8)) * 1.6;
            float inside = 1.0 - smoothstep(uProg - 0.02, uProg, r);
            float edge = exp(-pow((r - uProg) / 0.025, 2.0)) * step(0.001, uProg) * (1.0 - step(1.6, uProg));
            float scan = 0.5 + 0.5 * sin(vUv.y * 90.0 - uTime * 6.0);
            vec3 col = c.rgb * c.a * uGain * (inside * (0.75 + 0.5 * scan) + edge * 4.0);
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    g.add(m);
    return m;
  };
  mk(fpOutline, 0.0, 2.4);
  mk(fpGrid, 0.035, 2.0);
  return { group: g, prog };
}

// --- Monde ---------------------------------------------------------------------------------------------------------------
export function createFab({ pipe, width, height }) {
  const renderer = pipe.renderer;
  const aspect = width / height;
  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer, 'studio');
  scene.environmentIntensity = 0.7;
  scene.fog = new THREE.FogExp2(0x0b1016, 0.016);
  const camera = new THREE.PerspectiveCamera();

  const room = buildRoom();
  scene.add(room);
  const cell = buildCell();
  scene.add(cell.group);

  const waferStage = buildWaferStage();
  waferStage.group.position.set(20, 0, 0);
  scene.add(waferStage.group);
  const layerStage = buildLayerStage();
  layerStage.group.position.set(40, 0, 0);
  scene.add(layerStage.group);
  const blueprint = buildBlueprint();
  blueprint.group.position.set(60, 0, 0);
  scene.add(blueprint.group);

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a323b, 0.55));
  const key = new THREE.DirectionalLight(0xf0f5ff, 1.6);
  key.position.set(1.5, 4, 2);
  scene.add(key);
  const stageKey = new THREE.SpotLight(0xdfe9ff, 30, 8, 0.7, 0.9, 2);
  scene.add(stageKey, stageKey.target);

  // Instants de coupe (voir timing.js).
  const T = { a1: S.foundry, a2: cue('foundry.wafers'), b: cue('foundry.layers'), a3: cue('foundry.nofactory'), c: cue('foundry.design'), end: S.systems };
  const k = (t, pos, target, o = {}) => ({ t, pos, target, focal: 30, fstop: 8, near: 0.03, far: 80, ease: 'inOut', ...o });
  const segs = [
    { id: 'A1', t0: T.a1, t1: T.a2, rig: new CameraRig([
      k(T.a1, [-0.1, 1.45, 2.8], [-0.35, 0.95, 0.0], { focal: 34 }),
      k(T.a2, [-0.5, 1.5, 1.7], [-0.3, 1.0, 0.0], { focal: 34 }),
    ]) },
    { id: 'A2', t0: T.a2, t1: T.b, rig: new CameraRig([
      k(T.a2, [20.58, 0.20, 0.55], [20.0, 0.06, 0.0], { focal: 55, fstop: 8, near: 0.02, far: 6 }),
      k(T.b, [19.55, 0.33, 0.52], [20.0, 0.055, 0.0], { focal: 55, fstop: 8, near: 0.02, far: 6 }),
    ]) },
    { id: 'B', t0: T.b, t1: T.a3, rig: new CameraRig([
      k(T.b, [40.40, 0.16, 0.62], [40.0, 0.095, 0.0], { focal: 50, fstop: 8, near: 0.02, far: 6 }),
      k(T.a3, [39.72, 0.26, 0.66], [40.0, 0.105, 0.0], { focal: 50, fstop: 8, near: 0.02, far: 6 }),
    ]) },
    { id: 'A3', t0: T.a3, t1: T.c, rig: new CameraRig([
      k(T.a3, [1.1, 1.5, 2.8], [0.0, 1.1, -1.0], { focal: 26 }),
      k(T.c, [0.25, 2.4, 7.2], [0.0, 1.3, -8.0], { focal: 24 }),
    ]) },
    { id: 'C', t0: T.c, t1: T.end + 1, rig: new CameraRig([
      k(T.c, [60.0, 1.3, 0.0], [60.0, 0.0, 0.0], { focal: 35, up: [1, 0, 0], near: 0.05, far: 10 }),
      k(T.end, [60.0, 0.95, 0.0], [60.0, 0.0, 0.0], { focal: 35, up: [1, 0, 0], near: 0.05, far: 10 }),
      k(T.end + 1, [60.0, 0.9, 0.0], [60.0, 0.0, 0.0], { focal: 35, up: [1, 0, 0], near: 0.05, far: 10 }),
    ]) },
  ];
  const segAt = (t) => segs.find((s) => t < s.t1) || segs[segs.length - 1];

  function placeCamera(cam, t) {
    const s = segAt(t);
    const c = s.rig.sample(t);
    return configureCamera(cam, { pos: c.pos, target: c.target, focal: c.focal, fstop: c.fstop, focus: c.focus, aspect, near: c.near, far: c.far, roll: c.roll, up: c.up });
  }

  const grades = {
    A1: { exposure: 0.95, bloom: 0.12 }, A2: { exposure: 1.2, bloom: 0.16 }, B: { exposure: 1.25, bloom: 0.16 },
    A3: { exposure: 1.0, bloom: 0.12 }, C: { exposure: 1.2, bloom: 0.22 },
  };

  function evaluate(t) {
    sharedTime.value = t;
    const s = segAt(t);
    const id = s.id;
    const inCell = id === 'A1' || id === 'A3';
    room.visible = inCell;
    cell.group.visible = inCell;
    waferStage.group.visible = id === 'A2';
    layerStage.group.visible = id === 'B';
    blueprint.group.visible = id === 'C';
    stageKey.visible = id === 'A2' || id === 'B';
    key.visible = inCell;

    if (inCell) poseArm(cell.state, t - T.a1 + 0.9); // à l'entrée du plan, le bras est déjà en route vers la boîte
    if (id === 'A2') {
      const u = t - T.a2;
      waferStage.wafer.rotation.y = u * 0.55;
      waferStage.scan.value = -0.2 + (u / (T.b - T.a2)) * 0.45;     // la barre traverse le wafer
      stageKey.intensity = 22;
      stageKey.position.set(20.2, 0.9, 0.5);
      stageKey.target.position.set(20, 0.05, 0);
    }
    if (id === 'B') {
      const u = t - T.b;
      // Les couches se déposent l'une après l'autre.
      const n = layerStage.layers.length;
      const span = (T.a3 - T.b) * 0.8;
      layerStage.layers.forEach((L, i) => {
        const t0 = (i / n) * span;
        const k = clamp((u - t0) / 0.22, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        L.grp.visible = k > 0;
        L.grp.position.y = L.y + (1 - e) * 0.08;
        L.grp.rotation.y = (1 - e) * 0.35;
        L.grp.scale.set(1, 1, 1);
        if (L.grp.userData.lineMat && L.grp.userData.lineMat.color) { const f = 1 + 2.5 * Math.exp(-Math.max(0, u - t0 - 0.2) * 4) * (k >= 1 ? 1 : 0); L.grp.userData.lineMat.opacity = 1; L.grp.userData.lineMat.color.multiplyScalar(1); L.grp.scale.set(1, 1, 1); L.grp.userData.f = f; }
      });
      layerStage.group.rotation.y = u * 0.25;
      stageKey.intensity = 9;
      stageKey.position.set(40.3, 0.6, 0.45);
      stageKey.target.position.set(40, 0.1, 0);
    }
    if (id === 'C') {
      const u = t - T.c;
      blueprint.prog.value = clamp(u / 1.35, 0, 1.7);
    }

    const g = grades[id];
    pipe.grade.exposure = g.exposure;
    pipe.grade.bloomStrength = g.bloom;
    const lens = placeCamera(camera, t);
    return { scene, camera, lens };
  }

  return {
    evaluate,
    placeCamera,
    shutterFrac: () => 0.5,
    sampleFactor: (t) => (segAt(t).id === 'A2' || segAt(t).id === 'B' ? 1.0 : 0.8),
    scene,
  };
}
