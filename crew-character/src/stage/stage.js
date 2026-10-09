/* Scène 3D : rendu, caméra isométrique orthographique, éclairage doux, diorama « miniature ». */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { radialTexture } from "../character/materials.js";

export const ISO_ELEV = Math.atan(1 / Math.SQRT2); // 35,264° : projection isométrique vraie

function gradientTexture(top = "#F6F4EF", bottom = "#D8D4CB") {
  const c = document.createElement("canvas"); c.width = 16; c.height = 512; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function gridTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  g.fillStyle = "#F5F1E9"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(190,178,156,0.55)"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 509, 509);
  g.fillStyle = "rgba(190,178,156,0.55)"; for (const [x, y] of [[0, 0], [512, 0], [0, 512], [512, 512]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function createStage({ canvas, width = 1920, height = 1080, pixelRatio = 1, platform = [7.6, 6.0] }) {
  const GFX = Object.assign({ shadow: 2048, aa: true }, window.__GFX || {});
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: GFX.aa, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene(); scene.background = gradientTexture();

  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;

  // éclairage : clé chaude douce (ombres), remplissage hémisphérique, contre-jour pour détacher la silhouette
  const key = new THREE.DirectionalLight("#FFF1E0", 2.5); key.position.set(3.5, 9, 7); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(GFX.shadow, GFX.shadow); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 5;
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); key.shadow.camera.updateProjectionMatrix();
  scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight("#FFF6EA", "#CFC2AE", 0.85); scene.add(hemi);
  const rim = new THREE.DirectionalLight("#DCE9FF", 1.25); rim.position.set(-7, 5, -6); scene.add(rim);

  // plateau diorama
  const [pw, pd] = platform, world = new THREE.Group(); scene.add(world);
  const tex = gridTexture(); tex.repeat.set(pw, pd);
  const top = new THREE.Mesh(new RoundedBoxGeometry(pw, 0.32, pd, 5, 0.12), new THREE.MeshLambertMaterial({ color: "#FFFFFF", map: tex }));
  top.position.y = -0.16; top.receiveShadow = true; world.add(top);
  // le plan texturé couvre la face supérieure : on remplace la répétition UV par un plan dédié (RoundedBox ne répète pas la texture)
  top.material.map = null; top.material.color.set("#F5F1E9");
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.2, pd - 0.2), new THREE.MeshLambertMaterial({ map: tex })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true; window.__floor = floor; world.add(floor);
  const stripe = new THREE.Mesh(new RoundedBoxGeometry(pw + 0.06, 0.07, pd + 0.06, 3, 0.03), new THREE.MeshLambertMaterial({ color: "#FFC72C" })); stripe.position.y = -0.2; stripe.castShadow = true; world.add(stripe);
  const base = new THREE.Mesh(new RoundedBoxGeometry(pw + 0.16, 0.2, pd + 0.16, 4, 0.08), new THREE.MeshLambertMaterial({ color: "#DA291C" })); base.position.y = -0.4; base.castShadow = true; base.receiveShadow = true; world.add(base);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.95, pd * 0.95), new THREE.MeshBasicMaterial({ map: radialTexture("rgba(255,255,255,0.65)", "rgba(255,255,255,0)"), transparent: true, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004; world.add(pool);
  // ombre portée au sol de l'ensemble
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.0 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; scene.add(ground);

  /* thème clair / sombre : fond, sol et lumières */
  const bgLight = scene.background, bgDark = gradientTexture("#38332D", "#12100E");
  function setTheme(mode) {
    const d = mode === "dark";
    scene.background = d ? bgDark : bgLight;
    floor.material.color.set(d ? "#8C857A" : "#FFFFFF"); top.material.color.set(d ? "#5A554D" : "#F5F1E9");
    pool.material.opacity = d ? 0.3 : 1; hemi.intensity = d ? 0.62 : 0.85; key.intensity = d ? 2.2 : 2.5; scene.environmentIntensity = d ? 0.38 : 0.55;
  }
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -60, 120);
  const view = { target: [0, 0.8, 0], half: 3.3, yaw: 45 };
  function setCamera(v = {}) {
    Object.assign(view, v);
    const a = width / height, h = view.half, yaw = (view.yaw * Math.PI) / 180, D = 30;
    camera.left = -h * a; camera.right = h * a; camera.top = h; camera.bottom = -h; camera.updateProjectionMatrix();
    camera.position.set(view.target[0] + D * Math.cos(ISO_ELEV) * Math.sin(yaw), view.target[1] + D * Math.sin(ISO_ELEV), view.target[2] + D * Math.cos(ISO_ELEV) * Math.cos(yaw));
    camera.lookAt(view.target[0], view.target[1], view.target[2]); camera.updateMatrixWorld(true);
  }
  setCamera();
  function resize(w, h, pr = pixelRatio) { width = w; height = h; renderer.setPixelRatio(pr); renderer.setSize(w, h, false); setCamera(); }
  const render = () => renderer.render(scene, camera);
  return { renderer, scene, camera, world, key, rim, setCamera, setTheme, resize, render, view, platform: { w: pw, d: pd } };
}
