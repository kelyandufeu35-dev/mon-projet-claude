// Monde 3D : rendu WebGL déterministe (fonction du temps seulement), caméra orthographique isométrique,
// lumières, sol, environnement procédural. Aucun asset distant.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { C } from "./palette.js";
import { DEG, rng, track, ease, wobble } from "./util.js";

export const W = 1920;
export const H = 1080;
const BASE_HALF_H = 40; // demi-hauteur visible (unités monde) à zoom = 1

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    // Réglages de dev (benchmark) via l'URL ; valeurs par défaut = qualité de rendu finale.
    const q = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    this.flags = {
      aa: q.get("aa") !== "0",
      shadow: q.get("shadow") !== "0",
      shadowType: q.get("st") || "pcfsoft",
      shadowSize: +(q.get("ss") || 2048),
    };
    const r = new THREE.WebGLRenderer({ canvas, antialias: this.flags.aa, powerPreference: "high-performance", preserveDrawingBuffer: false });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = this.flags.shadow;
    r.shadowMap.type = { pcfsoft: THREE.PCFSoftShadowMap, pcf: THREE.PCFShadowMap, basic: THREE.BasicShadowMap }[this.flags.shadowType];
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.void);
    this.scene.fog = new THREE.Fog(C.void, 330, 640);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pm.dispose();

    // Caméra orthographique (rig cinématographique)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1200);
    this.camState = { x: 0, y: 0, z: 0, az: 45, el: 35.264, zoom: 1, roll: 0, dist: 420 };

    // Lumières
    this.hemi = new THREE.HemisphereLight(0x8fb4ff, 0x0a0f1a, 0.55);
    this.key = new THREE.DirectionalLight(0xfff0dc, 2.6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(this.flags.shadowSize, this.flags.shadowSize);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.35;
    this.rim = new THREE.DirectionalLight(0x3a7bff, 1.2);
    this.fillGold = new THREE.PointLight(C.gold, 0, 220, 1.6);
    this.fillBlue = new THREE.PointLight(C.blue, 0, 260, 1.6);
    this.scene.add(this.hemi, this.key, this.key.target, this.rim, this.rim.target, this.fillGold, this.fillBlue);

    this.floor = this._makeFloor();
    this.scene.add(this.floor);

    /** scènes enregistrées : { id, windows:[[t0,t1],…], pad, root, update(t) } */
    this.scenes = [];
    /** ambiance globale (pilotée par main.js) */
    this.mood = { hemi: 0.55, key: 2.6, rim: 1.2, exposure: 1.05, fillGold: 0, fillBlue: 0 };
    this._v = new THREE.Vector3();
  }

  _makeFloor() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1024;
    const g = cv.getContext("2d");
    const R = rng(11);
    g.fillStyle = "#0a101b";
    g.fillRect(0, 0, 1024, 1024);
    const tiles = 8;
    const ts = 1024 / tiles;
    for (let i = 0; i < tiles; i++)
      for (let j = 0; j < tiles; j++) {
        const v = 14 + Math.floor(R() * 10);
        g.fillStyle = `rgb(${v},${v + 6},${v + 18})`;
        g.fillRect(i * ts + 3, j * ts + 3, ts - 6, ts - 6);
      }
    g.strokeStyle = "rgba(60,140,255,0.55)";
    g.lineWidth = 3;
    for (let i = 0; i <= tiles; i++) {
      g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, 1024); g.stroke();
      g.beginPath(); g.moveTo(0, i * ts); g.lineTo(1024, i * ts); g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    const SIZE = 1600;
    tex.repeat.set(SIZE / 64, SIZE / 64);
    const m = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x0a1426, emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.02;
    mesh.receiveShadow = true;
    return mesh;
  }

  add(obj) {
    this.scene.add(obj);
    return obj;
  }

  /** enregistre un module de scène (visible seulement dans sa fenêtre temporelle ± pad) */
  register(sceneModule) {
    const m = { pad: 1.0, ...sceneModule };
    if (!m.windows) m.windows = [[m.t0, m.t1]];
    this.scenes.push(m);
  }

  /** projette un point monde vers des coordonnées écran (px, repère 1920×1080) */
  toScreen(v3) {
    this._v.copy(v3).project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * W, y: (-this._v.y * 0.5 + 0.5) * H, z: this._v.z };
  }

  _applyCamera() {
    const s = this.camState;
    const cam = this.camera;
    const halfH = BASE_HALF_H / s.zoom;
    const halfW = halfH * (W / H);
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    cam.near = 1; cam.far = 1400;
    cam.updateProjectionMatrix();
    const az = s.az * DEG, el = s.el * DEG;
    cam.position.set(
      s.x + Math.sin(az) * Math.cos(el) * s.dist,
      s.y + Math.sin(el) * s.dist,
      s.z + Math.cos(az) * Math.cos(el) * s.dist
    );
    cam.up.set(Math.sin(s.roll * DEG), Math.cos(s.roll * DEG), 0);
    cam.lookAt(s.x, s.y, s.z);

    // lumière principale qui suit le point regardé, ombre cadrée sur la zone visible
    const k = this.key;
    k.target.position.set(s.x, 0, s.z);
    k.position.set(s.x - 90, 150, s.z + 70);
    const ext = Math.max(40, halfH * 1.6);
    const sc = k.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 20; sc.far = 420;
    sc.updateProjectionMatrix();
    this.rim.position.set(s.x + 120, 90, s.z - 140);
    this.rim.target.position.set(s.x, 0, s.z);
    this.fillBlue.position.set(s.x + 30, 40, s.z + 30);
    this.fillGold.position.set(s.x - 20, 30, s.z - 10);
  }

  /** rend l'image au temps t (secondes) */
  render(t) {
    for (const s of this.scenes) {
      const vis = s.windows.some(([a, b]) => t >= a - s.pad && t <= b + s.pad);
      if (s.root) s.root.visible = vis;
      if (vis && s.update) s.update(t);
    }
    const m = this.mood;
    this.hemi.intensity = m.hemi;
    this.key.intensity = m.key;
    this.rim.intensity = m.rim;
    this.fillGold.intensity = m.fillGold;
    this.fillBlue.intensity = m.fillBlue;
    this.renderer.toneMappingExposure = m.exposure;
    this._applyCamera();
    this.renderer.render(this.scene, this.camera);
  }
}

/** Définit un chemin de caméra à partir de clés { t, x,y,z, az, el, zoom, roll, e } (e = easing du segment suivant) */
export function cameraPath(keys, { shake = 0.0 } = {}) {
  const props = ["x", "y", "z", "az", "el", "zoom", "roll"];
  const defaults = { x: 0, y: 0, z: 0, az: 45, el: 35.264, zoom: 1, roll: 0 };
  const filled = [];
  let prev = { ...defaults };
  for (const k of keys) {
    prev = { ...prev, ...k };
    filled.push(prev);
  }
  const fns = {};
  for (const p of props) fns[p] = track(filled.map((k) => [k.t, k[p], ease[k.e] || ease.io3]));
  return (t) => {
    const out = {};
    for (const p of props) out[p] = fns[p](t);
    // zoom interpolé en espace logarithmique pour des travellings homogènes
    if (shake) {
      out.x += wobble(t, 1) * shake;
      out.z += wobble(t, 2) * shake;
      out.roll += wobble(t, 3) * shake * 0.12;
    }
    return out;
  };
}

/** texture d'enseigne dessinée en canvas (police déjà chargée) */
export function labelTexture(text, { w = 1024, h = 256, font = '700 120px "Space Grotesk"', color = "#ffffff", bg = null, glow = null, align = "center" } = {}) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = font;
  g.textBaseline = "middle";
  g.textAlign = align;
  if (glow) { g.shadowColor = glow; g.shadowBlur = 28; }
  g.fillStyle = color;
  g.fillText(text, align === "center" ? w / 2 : align === "left" ? 24 : w - 24, h / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData = { canvas: cv, ctx: g };
  return tex;
}
