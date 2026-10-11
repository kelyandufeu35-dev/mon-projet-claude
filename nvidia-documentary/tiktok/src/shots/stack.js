// Plan 5 — la couche logicielle : une pile de plans de verre au-dessus de la puce. Le matériel en bas, puis des
// couches de plus en plus abstraites ; la troisième (CUDA) s'illumine quand la voix la nomme, des liaisons
// verticales montent à travers toute la pile, puis des milliers de points s'allument sur la dernière couche
// (les développeurs). Visuel abstrait, sans texte : le mot « CUDA » est ajouté en surimpression (hud.js).

import * as THREE from 'three';
import { CameraRig, configureCamera } from '../../../engine/camera.js';
import { buildEnvironment } from '../../../engine/env.js';
import { pbr } from '../../../engine/materials.js';
import { sharedTime } from '../../../engine/shaders.js';
import { mulberry32, clamp } from '../../../engine/rng.js';
import { cue, S } from '../timing.js';
import { makeFloorplan, makeRouting, makePattern } from '../lib/draw.js';
import { makeFlows } from '../lib/flows.js';

const SIZE = 0.62, TH = 0.012, PITCH = 0.25;
const GREEN = new THREE.Color(0x76b900);

export function createStack({ pipe, width, height }) {
  const renderer = pipe.renderer;
  const aspect = width / height;
  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer, 'studio');
  scene.environmentIntensity = 0.8;
  scene.fog = new THREE.FogExp2(0x05080c, 0.12);
  const camera = new THREE.PerspectiveCamera();

  const T0 = S.software, T1 = S.economy;
  const T_CUDA = cue('software.cuda');
  const T_DEV = cue('software.dev');
  const T_WHY = cue('software.why');

  // --- Couches ---------------------------------------------------------------------------------------
  const glassMat = () => new THREE.MeshStandardMaterial({ color: 0xb4c6e6, transparent: true, opacity: 0.13, roughness: 0.08, metalness: 0.0, depthWrite: false, envMapIntensity: 1.3 });
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0x9fc7ff).multiplyScalar(1.5), transparent: true, opacity: 0.6, toneMapped: false });
  const slabGeo = new THREE.BoxGeometry(SIZE, TH, SIZE);
  const edgeGeo = new THREE.EdgesGeometry(slabGeo);

  const fpOut = makeFloorplan({ layer: 'outline' });
  const fpGrid = makeFloorplan({ layer: 'grid', seed: 4 });
  const patterns = [
    null, // couche 0 : le plan de masse de la puce (matériel)
    { tex: makePattern('rings', { seed: 3 }).map, color: 0x9ec8ff, gain: 2.0 },
    { tex: makeRouting({ px: 1024, seed: 21, pitch: 14, density: 0.7, lineW: 4 }).map, color: 0x76b900, gain: 2.4 },  // CUDA
    { tex: makePattern('tiles', { seed: 5 }).map, color: 0xdbe7ff, gain: 1.8 },
    { tex: makePattern('dots', { seed: 8 }).map, color: 0xdbe7ff, gain: 1.6 },
  ];
  patterns.forEach((p) => p && (p.tex.colorSpace = THREE.NoColorSpace));

  const layers = patterns.map((p, i) => {
    const grp = new THREE.Group();
    const slabMat = glassMat();
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.renderOrder = 3 + i;
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.renderOrder = 4 + i;
    grp.add(slab, edges);
    let glow;
    if (p) {
      glow = new THREE.Mesh(
        new THREE.PlaneGeometry(SIZE * 0.97, SIZE * 0.97),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.gain), alphaMap: p.tex, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = TH / 2 + 0.0005;
      glow.renderOrder = 8 + i;
      glow.userData = { base: new THREE.Color(p.color).multiplyScalar(p.gain) };
      grp.add(glow);
    } else {
      // Matériel : plan de masse lumineux (contours + grille de calcul).
      const mk = (fp, y, gain) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(SIZE * 0.97, (SIZE * 0.97) / fp.aspect),
          new THREE.MeshBasicMaterial({ map: fp.map, color: new THREE.Color(1, 1, 1).multiplyScalar(gain), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        m.renderOrder = 8;
        grp.add(m);
        return m;
      };
      mk(fpOut, TH / 2 + 0.0005, 2.2);
      glow = mk(fpGrid, TH / 2 + 0.003, 1.8);
      glow.userData = { base: new THREE.Color(1, 1, 1).multiplyScalar(1.8) };
    }
    grp.position.y = i * PITCH;
    scene.add(grp);
    return { grp, slabMat, glow, i, y: i * PITCH };
  });

  // --- Liaisons verticales à travers la pile ---------------------------------------------------------------------
  const rnd = mulberry32(31);
  const curves = [];
  for (let i = 0; i < 30; i++) {
    const x = (rnd() - 0.5) * SIZE * 0.86, z = (rnd() - 0.5) * SIZE * 0.86;
    curves.push(new THREE.LineCurve3(new THREE.Vector3(x, 0.02, z), new THREE.Vector3(x, 4 * PITCH - 0.01, z)));
  }
  const beams = makeFlows(curves, { radius: 0.0022, color: 0x76b900, base: 0.18, peak: 9, speed: 0.55, pulses: 2, segments: 8, radial: 4 });
  scene.add(beams.mesh);

  // --- Onde de choc quand CUDA est nommé ------------------------------------------------------------------------------
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.004, 8, 128), new THREE.MeshBasicMaterial({ color: GREEN.clone().multiplyScalar(5), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2 * PITCH + TH;
  scene.add(ring);

  // --- Les développeurs : points qui s'allument sur la dernière couche ----------------------------------------------------------
  const N = 320;
  const devGeo = new THREE.SphereGeometry(0.0065, 10, 8);
  const devMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe4f3c0).multiplyScalar(4), toneMapped: false });
  const devs = new THREE.InstancedMesh(devGeo, devMat, N);
  const devPos = [];
  const order = [];
  for (let i = 0; i < N; i++) {
    devPos.push([(rnd() - 0.5) * SIZE * 0.92, (rnd() - 0.5) * SIZE * 0.92]);
    order.push(rnd());
  }
  scene.add(devs);
  const m4 = new THREE.Matrix4();

  // --- Caméra --------------------------------------------------------------------------------------------------------------------------------------
  const k = (t, pos, target, o = {}) => ({ t, pos, target, focal: 32, fstop: 8, near: 0.05, far: 20, ease: 'inOut', ...o });
  const rig = new CameraRig([
    k(T0, [0.9, 0.3, 1.0], [0.0, 0.45, 0.0], { focal: 30 }),
    k(T_CUDA, [0.95, 0.55, 0.95], [0.0, 0.52, 0.0], { focal: 30 }),
    k(T_WHY, [0.75, 0.95, 0.85], [0.0, 0.68, 0.0], { focal: 30 }),
    k(T1, [0.2, 1.7, 0.45], [0.0, 0.9, 0.0], { focal: 30 }),
  ]);

  function placeCamera(cam, t) {
    const c = rig.sample(t);
    return configureCamera(cam, { pos: c.pos, target: c.target, focal: c.focal, fstop: c.fstop, focus: c.focus, aspect, near: c.near, far: c.far, roll: c.roll, up: c.up });
  }

  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  function evaluate(t) {
    sharedTime.value = t;
    const u = t - T0;
    // Arrivée des couches, du bas vers le haut.
    layers.forEach((L) => {
      const a = easeOut((u - (0.15 + L.i * 0.3)) / 0.55);
      L.grp.visible = a > 0.001;
      L.grp.position.y = L.y - (1 - a) * 0.35;
      L.slabMat.opacity = 0.13 * a;
      if (L.glow) {
        let boost = 1;
        if (L.i === 2) boost += 3.2 * Math.exp(-Math.max(0, t - T_CUDA) * 1.6) * (t >= T_CUDA ? 1 : 0) + (t >= T_CUDA ? 0.8 : 0);
        L.glow.material.color.copy(L.glow.userData.base).multiplyScalar(a * boost);
      }
    });
    beams.material.uniforms.uGain.value = easeOut((u - 1.9) / 0.8);
    // Onde de choc.
    const r = clamp((t - T_CUDA) / 1.1, 0, 1);
    ring.visible = t >= T_CUDA && r < 1;
    const sc = 0.3 + r * 2.0;
    ring.scale.set(sc / 0.3, sc / 0.3, 1);
    ring.material.opacity = (1 - r) * 0.9;
    // Les développeurs.
    const topY = 4 * PITCH + TH / 2 + 0.004;
    const span = Math.max(0.5, T1 - T_WHY - 0.6);
    for (let i = 0; i < N; i++) {
      const a = easeOut((t - (T_WHY + order[i] * span)) / 0.35);
      const s = a * (1 + 0.25 * Math.sin(t * 3 + i));
      m4.makeScale(s, s, s);
      m4.setPosition(devPos[i][0], topY + 0.004, devPos[i][1]);
      devs.setMatrixAt(i, m4);
    }
    devs.instanceMatrix.needsUpdate = true;
    devs.visible = layers[4].grp.visible;
    devs.position.y = layers[4].grp.position.y - 4 * PITCH;
    const g = pipe.grade;
    g.exposure = 1.15;
    g.bloomStrength = 0.2;
    g.vignette = 0.6;
    const lens = placeCamera(camera, t);
    return { scene, camera, lens };
  }

  // Point d'ancrage pour l'étiquette « CUDA » (bord de la troisième couche).
  const anchors = { cuda: new THREE.Vector3(SIZE * 0.5, 2 * PITCH, 0) };

  return { evaluate, placeCamera, shutterFrac: () => 0.5, sampleFactor: () => 1.6, scene, camera, anchors };
}
