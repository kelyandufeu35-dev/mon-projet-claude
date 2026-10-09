import * as THREE from 'three';
import { DEG } from '../util/math.js';
import { CameraRig } from './camera.js';

import { W, H } from '../format.js';
export { W, H };

/** Scène, rendu, éclairage « studio miniature » et sol à grille. */
export function createStage() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const rig = new CameraRig(W, H);

  // Éclairage : hémisphérique + clé chaude + remplissage froid + rim.
  const hemi = new THREE.HemisphereLight(0xe4ecff, 0x3b3f4a, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xa9c4ff, 0.75);
  scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xffd7a8, 0.6);
  scene.add(rim, rim.target);

  // Sol : grille fine qui s'estompe, ancrée au monde.
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uCenter: { value: new THREE.Vector2() }, uRadius: { value: 90 }, uColor: { value: new THREE.Color(0x5a6070) }, uStep: { value: 4 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      varying vec3 vW; uniform vec2 uCenter; uniform float uRadius; uniform vec3 uColor; uniform float uStep;
      float line(float x, float step){ float g = abs(fract(x/step-0.5)-0.5)/fwidth(x/step); return 1.0-min(g,1.0); }
      void main(){
        float l = max(line(vW.x,uStep), line(vW.z,uStep));
        float L = max(line(vW.x,uStep*5.), line(vW.z,uStep*5.));
        float d = distance(vW.xz, uCenter)/uRadius;
        float fade = 1.0 - smoothstep(0.35, 1.0, d);
        float a = (l*0.10 + L*0.16)*fade;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), gridMat);
  grid.position.y = -0.9;
  grid.renderOrder = -10;
  scene.add(grid);

  /** Place lumières, ombres et grille selon la caméra courante. */
  function updateForCamera(s) {
    const a = s.az * DEG;
    const rot = (x, z, ang) => [x * Math.cos(ang) + z * Math.sin(ang), -x * Math.sin(ang) + z * Math.cos(ang)];
    const tgt = new THREE.Vector3(s.tx, s.ty, s.tz);
    // Offsets exprimés dans le repère « caméra à az = 0 » puis tournés.
    const [kx, kz] = rot(-9, 24, a - 0); // clé : avant-gauche
    sun.position.set(tgt.x + kx, tgt.y + 34, tgt.z + kz);
    sun.target.position.copy(tgt);
    const half = Math.max(s.H * 1.05, 14);
    const sc = sun.shadow.camera;
    sc.left = -half * 1.25; sc.right = half * 1.25; sc.top = half * 1.25; sc.bottom = -half * 1.25;
    sc.near = 1; sc.far = 220 + half;
    sc.updateProjectionMatrix();
    const [fx, fz] = rot(30, 6, a);
    fill.position.set(tgt.x + fx, tgt.y + 14, tgt.z + fz); fill.target.position.copy(tgt);
    const [rx, rz] = rot(8, -30, a);
    rim.position.set(tgt.x + rx, tgt.y + 20, tgt.z + rz); rim.target.position.copy(tgt);
    gridMat.uniforms.uCenter.value.set(s.tx, s.tz);
    gridMat.uniforms.uRadius.value = Math.max(70, s.H * 2.4);
    gridMat.uniforms.uStep.value = s.H > 90 ? 20 : s.H > 30 ? 4 : 2;
    grid.position.x = s.tx; grid.position.z = s.tz;
  }

  return { renderer, scene, rig, hemi, sun, fill, rim, grid, updateForCamera };
}
