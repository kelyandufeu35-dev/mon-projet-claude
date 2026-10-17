import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const SCENE = q.get('scene') || 'main';
const BG = { main: '#fbf6ef', kibbles: '#ffc23a', size: '#ffffff', top: '#ff9fc0' }[SCENE];
const SIZE = 1600;

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

/* ------------------------------------------------ Faceted ball */
// Rings of vertices between the poles, every other ring offset by half a
// step: the triangles between rings form the diamond pattern of the toy.
function facetedBall(radius, rings, perRing, raise) {
  const pos = [];
  const ring = [];
  const offs = [];
  for (let k = 0; k < rings; k++) {
    const lat = -Math.PI / 2 + ((k + 1) * Math.PI) / (rings + 1);
    const off = (k % 2) * 0.5;
    offs.push(off);
    const r = [];
    for (let i = 0; i < perRing; i++) {
      const lon = ((i + off) / perRing) * Math.PI * 2;
      r.push(new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).multiplyScalar(radius));
    }
    ring.push(r);
  }
  const south = new THREE.Vector3(0, -radius * 0.96, 0);
  const north = new THREE.Vector3(0, radius * 0.96, 0);
  // Vertex of ring k±1 lying between vertices i and i+1 of ring k.
  const between = (k, i, dk) => {
    const n = k + dk;
    if (n < 0) return south;
    if (n >= rings) return north;
    const j = i + offs[k] + 0.5 - offs[n];
    return ring[n][((Math.round(j) % perRing) + perRing) % perRing];
  };
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  // Each diamond: left/right on ring k, top/bottom on rings k+1/k-1, and a
  // raised centre, so every stud is a small four-sided pyramid.
  for (let k = 0; k < rings; k++) {
    for (let i = 0; i < perRing; i++) {
      const L = ring[k][i];
      const Rr = ring[k][(i + 1) % perRing];
      const T = between(k, i, 1);
      const B = between(k, i, -1);
      const C = new THREE.Vector3().addVectors(L, Rr).add(T).add(B).normalize().multiplyScalar(radius * raise);
      tri(C, L, T);
      tri(C, T, Rr);
      tri(C, Rr, B);
      tri(C, B, L);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const ballMat = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#e0322b'),
  roughness: 0.6,
  clearcoat: 0.2,
  clearcoatRoughness: 0.45,
  sheen: 0.3,
  sheenColor: new THREE.Color('#ff8a7a'),
  flatShading: true,
});
const ball = new THREE.Mesh(facetedBall(1, 9, 16, 1.02), ballMat);
ball.position.y = 1;
ball.rotation.set(0.08, 0.35, -0.05);
ball.castShadow = true;
scene.add(ball);

/* ------------------------------------------------------- Kibbles */
function kibble(seed) {
  const g = new THREE.SphereGeometry(1, 18, 12);
  const p = g.attributes.position;
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = 1 + 0.12 * Math.sin(v.x * 3 + ph[0]) * Math.sin(v.y * 4 + ph[1]) + 0.08 * Math.sin(v.z * 5 + ph[2]);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y * 0.62, v.z * 0.9);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.07, 0.7, 0.09 + rnd() * 0.04), roughness: 0.9 }));
  m.castShadow = true;
  return m;
}
if (SCENE === 'kibbles') {
  const spots = [
    [-1.3, 1.0, 0.13, 0.4], [-0.95, 1.6, 0.12, 1.2], [-1.6, 1.55, 0.125, 2.1], [-0.55, 2.0, 0.115, 2.4],
    [1.25, 1.1, 0.13, 0.8], [1.55, 0.6, 0.12, 2.6], [0.85, 1.75, 0.125, 1.7], [0.3, 2.1, 0.12, 0.3],
    [1.45, 1.75, 0.115, 2.9],
  ];
  spots.forEach(([x, z, s, r], i) => {
    const k = kibble(17 + i * 31);
    k.scale.setScalar(s);
    k.position.set(x, s * 0.62, z);
    k.rotation.y = r;
    scene.add(k);
  });
}

/* ------------------------------------------------- Ground & light */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Soft contact shadow under the ball.
const cs = document.createElement('canvas');
cs.width = cs.height = 256;
const cx = cs.getContext('2d');
const grad = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
grad.addColorStop(0, 'rgba(20,22,43,0.55)');
grad.addColorStop(0.45, 'rgba(20,22,43,0.18)');
grad.addColorStop(1, 'rgba(20,22,43,0)');
cx.fillStyle = grad;
cx.fillRect(0, 0, 256, 256);
const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cs), transparent: true, depthWrite: false }));
contact.rotation.x = -Math.PI / 2;
contact.position.y = 0.002;
scene.add(contact);

const key = new THREE.DirectionalLight('#fff4ea', 2.4);
key.position.set(-3, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 8;
key.shadow.camera.left = key.shadow.camera.bottom = -4;
key.shadow.camera.right = key.shadow.camera.top = 4;
scene.add(key);
const rim = new THREE.DirectionalLight('#ffd9c9', 1.2);
rim.position.set(4, 3, -4);
scene.add(rim);
scene.add(new THREE.HemisphereLight('#ffffff', BG, 0.6));

/* -------------------------------------------------------- Camera */
const camera = new THREE.PerspectiveCamera(SCENE === 'top' ? 34 : 26, 1, 0.1, 100);
if (SCENE === 'top') {
  camera.position.set(0, 7.5, 4.2);
  camera.lookAt(0, 0.6, 0.35);
} else if (SCENE === 'size') {
  camera.position.set(0, 1.35, 8.2);
  camera.lookAt(0, 0.82, 0);
  document.querySelector('.dim').style.display = 'flex';
} else {
  camera.position.set(0, 1.7, 7.6);
  camera.lookAt(0, 0.9, 0.2);
}

if (SCENE === 'size') {
  // The ruler spans exactly the ball's projected width (8 cm).
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const toPx = (x) => ((new THREE.Vector3(x, 1, 0).project(camera).x + 1) / 2) * SIZE;
  const line = document.querySelector('.dim .line');
  line.style.width = `${toPx(1.02) - toPx(-1.02)}px`;
}
renderer.render(scene, camera);
window.__done = true;
