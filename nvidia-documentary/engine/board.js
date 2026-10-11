// Plateau serveur GPU : châssis tôlé, carte de base, huit modules (sept sous radiateur, un nu),
// zones d'alimentation (inductances, condensateurs), mur de ventilateurs, câbles.
//
// Repère local : +Z = face avant du châssis (côté allée), +X = largeur, +Y = haut, sol du châssis à y = 0.
// Générique : ce n'est la reproduction d'aucun produit précis.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr } from './materials.js';
import { addHallAmbient } from './shaders.js';
import { makeBoard, makeBrushedMetal, makeChassisPanel } from './textures.js';
import { buildGPUPackage } from './gpu.js';
import { mulberry32 } from './rng.js';

const mm = 0.001;
const rbox = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-6, h / 2 - 1e-6, d / 2 - 1e-6));

export const TRAY = {
  width: 0.44,
  depth: 0.86,
  height: 0.175,
  boardTop: 0.022,
  modX: [-0.147, -0.049, 0.049, 0.147],
  modZ: [-0.09, 0.065],
  heroIndex: { col: 1, row: 1 },
  modSize: 0.09,
  socketH: 0.007,
};

function fanRotorGeometry() {
  // 7 pales courbées autour d'un moyeu ; axe du ventilateur = Z.
  const blades = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Shape();
    s.moveTo(0.012, -0.004);
    s.bezierCurveTo(0.02, -0.011, 0.031, -0.012, 0.0355, -0.003);
    s.bezierCurveTo(0.033, 0.006, 0.024, 0.011, 0.012, 0.007);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0012, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -0.0006);
    g.rotateX(0.55); // pas de pale
    g.rotateZ((i * Math.PI * 2) / n);
    blades.push(g);
  }
  const hub = new THREE.CylinderGeometry(0.0135, 0.0135, 0.016, 28);
  hub.rotateX(Math.PI / 2);
  blades.push(hub.toNonIndexed());
  return mergeGeometries(blades, false);
}

function fanFrameGeometry() {
  const s = new THREE.Shape();
  const o = 0.04;
  s.moveTo(-o, -o); s.lineTo(o, -o); s.lineTo(o, o); s.lineTo(-o, o); s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0365, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 32 });
  g.translate(0, 0, -0.012);
  return g;
}

function heatsinkParts(brushed) {
  const finMat = pbr({ color: 0xb4bac2, orm: brushed.orm, normal: null, metalness: 1, roughness: 1.1 });
  addHallAmbient(finMat, { ambient: 0.5, poolMin: 0.55, heightMin: 0.7 });
  const baseMat = pbr({ color: 0xb87333, metalness: 1, roughness: 0.3 });
  const pipeMat = pbr({ color: 0xc9824f, metalness: 1, roughness: 0.26 });
  const fin = new THREE.BoxGeometry(0.0009, 0.052, 0.088);
  const pipe = new THREE.CylinderGeometry(0.003, 0.003, 0.086, 14);
  pipe.rotateZ(Math.PI / 2);
  return { finMat, baseMat, pipeMat, fin, pipe };
}

/**
 * @returns {{group:THREE.Group, update:(t:number)=>void, hero:THREE.Group, heroLocal:THREE.Vector3}}
 */
export function buildTray({ seed = 101 } = {}) {
  const rnd = mulberry32(seed);
  const T = TRAY;
  const g = new THREE.Group();
  g.name = 'gpu-tray';
  const brushedMetal = makeBrushedMetal({ px: 1024, seed: 7, base: 110, spread: 40 });
  const brushedAlu = makeBrushedMetal({ px: 1024, seed: 19, base: 100, spread: 55 });

  // --- Châssis (tôle galvanisée) --------------------------------------------------------
  const ambient = (m, a = 0.5) => addHallAmbient(m, { ambient: a, poolMin: 0.55, heightMin: 0.7 });
  const steel = ambient(pbr({ color: 0x8a9097, orm: brushedMetal.orm, normal: brushedMetal.normal, normalScale: 0.5, metalness: 1, roughness: 0.9 }), 0.55);
  const floor = new THREE.Mesh(rbox(T.width, 0.0016, T.depth, 0.0006, 1), steel);
  floor.position.set(0, 0.0008, 0);
  floor.receiveShadow = true;
  g.add(floor);
  const wallH = T.height;
  const panelTex = makeChassisPanel();
  const steelPanel = ambient(pbr({ color: 0xffffff, map: panelTex, orm: brushedMetal.orm, normal: brushedMetal.normal, normalScale: 0.4, metalness: 1, roughness: 0.9 }), 0.55);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(rbox(0.0016, wallH, T.depth, 0.0006, 1), steelPanel);
    w.position.set(sx * (T.width / 2 - 0.0008), wallH / 2, 0);
    w.castShadow = true;
    w.receiveShadow = true;
    g.add(w);
    // Rebord replié en haut des parois.
    const lip = new THREE.Mesh(rbox(0.012, 0.0016, T.depth, 0.0006, 1), steel);
    lip.position.set(sx * (T.width / 2 - 0.006), wallH, 0);
    lip.castShadow = true;
    g.add(lip);
  }
  const rear = new THREE.Mesh(rbox(T.width, wallH, 0.0016, 0.0006, 1), steel);
  rear.position.set(0, wallH / 2, -T.depth / 2);
  g.add(rear);

  // --- Carte de base ---------------------------------------------------------------------
  const zones = [];
  for (const x of T.modX) for (const z of T.modZ) zones.push({ x: x / mm, z: -z / mm * -1, r: 62 });
  const board = makeBoard({ wMM: 400, dMM: 330, px: 2048, seed: 41, zones: zones.map((q) => ({ x: q.x, z: q.z, r: q.r })) });
  const boardMat = pbr({ color: 0xffffff, map: board.map, orm: board.orm, normal: board.normal, normalScale: 0.8, metalness: 1, roughness: 1 });
  const boardMesh = new THREE.Mesh(rbox(0.4, 0.0018, 0.33, 0.0005, 1), boardMat);
  boardMesh.position.set(0, T.boardTop - 0.0009, -0.01);
  boardMesh.receiveShadow = true;
  g.add(boardMesh);
  // Entretoises sous la carte.
  const standoffGeo = new THREE.CylinderGeometry(0.0035, 0.0035, T.boardTop - 0.0016, 10);
  const standoffMat = pbr({ color: 0xbfc4c9, metalness: 1, roughness: 0.35 });
  const standoffs = new THREE.InstancedMesh(standoffGeo, standoffMat, 6);
  const m4 = new THREE.Matrix4();
  [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.13], [0.18, 0.13], [0, -0.15], [0, 0.13]].forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.0016 + (T.boardTop - 0.0016) / 2, z);
    standoffs.setMatrixAt(i, m4);
  });
  g.add(standoffs);

  // --- Modules -------------------------------------------------------------------------------
  const carrierMat = pbr({ color: 0x23272b, orm: brushedMetal.orm, normal: brushedMetal.normal, normalScale: 0.4, metalness: 1, roughness: 0.9 });
  const carrierGeo = rbox(T.modSize, T.socketH, T.modSize, 0.0012, 2);
  const screwGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.0026, 18);
  const screwMat = pbr({ color: 0xaeb3b9, metalness: 1, roughness: 0.34 });
  const hs = heatsinkParts(brushedAlu);
  const heroPkg = buildGPUPackage();
  let hero = null;
  const nMods = T.modX.length * T.modZ.length;
  const carriers = new THREE.InstancedMesh(carrierGeo, carrierMat, nMods);
  const screws = new THREE.InstancedMesh(screwGeo, screwMat, nMods * 4);
  const finsPer = 42;
  const finMesh = new THREE.InstancedMesh(hs.fin, hs.finMat, (nMods - 1) * finsPer);
  const baseMesh = new THREE.InstancedMesh(rbox(0.078, 0.006, 0.078, 0.001, 1), hs.baseMat, nMods - 1);
  const coreMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.081, 0.05, 0.086), pbr({ color: 0x070809, roughness: 0.9, metalness: 0.0 }), nMods - 1);
  let ki = 0;
  const pipeMesh = new THREE.InstancedMesh(hs.pipe, hs.pipeMat, (nMods - 1) * 4);
  let mi = 0, fi = 0, bi = 0, pi = 0, si = 0;
  const q0 = new THREE.Quaternion();
  const ones = new THREE.Vector3(1, 1, 1);
  const pkgScale = 0.92; // le package (76 mm) tient dans le module (90 mm)
  const pkgPositions = [];
  for (let r = 0; r < T.modZ.length; r++) {
    for (let c = 0; c < T.modX.length; c++) {
      const x = T.modX[c], z = T.modZ[r];
      const yBase = T.boardTop;
      m4.compose(new THREE.Vector3(x, yBase + T.socketH / 2, z), q0, ones);
      carriers.setMatrixAt(mi++, m4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        m4.compose(new THREE.Vector3(x + sx * 0.0405, yBase + T.socketH + 0.0012, z + sz * 0.0405), q0, ones);
        screws.setMatrixAt(si++, m4);
      }
      const isHero = c === T.heroIndex.col && r === T.heroIndex.row;
      if (isHero) {
        hero = heroPkg;
        hero.position.set(x, yBase + T.socketH, z);
        g.add(hero);
      } else {
        // Package simplifié sous radiateur (le radiateur le cache presque entièrement).
        const topY = yBase + T.socketH + 0.0009;
        // Plaque de base cuivre.
        m4.compose(new THREE.Vector3(x, topY + 0.003, z), q0, ones);
        baseMesh.setMatrixAt(bi++, m4);
        m4.compose(new THREE.Vector3(x, topY + 0.006 + 0.026, z), q0, ones);
        coreMesh.setMatrixAt(ki++, m4);
        // Ailettes : empilement régulier le long de X.
        for (let f = 0; f < finsPer; f++) {
          const fx = x - 0.041 + (f / (finsPer - 1)) * 0.082;
          m4.compose(new THREE.Vector3(fx, topY + 0.006 + 0.026, z), q0, ones);
          finMesh.setMatrixAt(fi++, m4);
        }
        // Caloducs traversant les ailettes.
        for (let p = 0; p < 4; p++) {
          const pz = z - 0.03 + p * 0.02;
          m4.compose(new THREE.Vector3(x, topY + 0.006 + 0.012, pz), q0, ones);
          pipeMesh.setMatrixAt(pi++, m4);
        }
        pkgPositions.push([x, z]);
      }
    }
  }
  for (const im of [carriers, screws, finMesh, baseMesh, coreMesh, pipeMesh, standoffs]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // --- Alimentation : inductances, condensateurs électrolytiques, connecteurs ------------------
  const inductorMat = pbr({ color: 0x1a1c1f, metalness: 0.6, roughness: 0.42 });
  const inductorTop = pbr({ color: 0x8b9096, metalness: 1, roughness: 0.4 });
  const capCanMat = pbr({ color: 0xc8ccd0, metalness: 1, roughness: 0.3 });
  const capBandMat = pbr({ color: 0x1c3a8c, metalness: 0.2, roughness: 0.5 });
  const nInd = nMods * 22;
  const inductors = new THREE.InstancedMesh(rbox(0.0075, 0.0045, 0.0075, 0.0009, 1), inductorMat, nInd);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0085, 16), capCanMat, nMods * 10);
  const capBands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.00325, 0.00325, 0.0015, 16), capBandMat, nMods * 10);
  let ii = 0, ci = 0;
  for (let r = 0; r < T.modZ.length; r++) for (let c = 0; c < T.modX.length; c++) {
    const x = T.modX[c], z = T.modZ[r];
    // Inductances : deux rangées de part et d'autre du module (axe X).
    for (let k = 0; k < 11; k++) {
      for (const sz of [-1, 1]) {
        const px_ = x - 0.04 + (k / 10) * 0.08;
        const pz_ = z + sz * (T.modSize / 2 + 0.006);
        if (Math.abs(pz_) > 0.16) continue;
        m4.compose(new THREE.Vector3(px_, T.boardTop + 0.0023, pz_), q0, ones);
        if (ii < nInd) inductors.setMatrixAt(ii++, m4);
      }
    }
    for (let k = 0; k < 10; k++) {
      const px_ = x - 0.036 + (k / 9) * 0.072;
      const pz_ = z + (r === 0 ? -1 : 1) * (T.modSize / 2 + 0.017);
      m4.compose(new THREE.Vector3(px_, T.boardTop + 0.00425, pz_), q0, ones);
      if (ci < nMods * 10) {
        caps.setMatrixAt(ci, m4);
        m4.compose(new THREE.Vector3(px_, T.boardTop + 0.0075, pz_), q0, ones);
        capBands.setMatrixAt(ci, m4);
        ci++;
      }
    }
  }
  inductors.count = ii;
  caps.count = ci;
  capBands.count = ci;
  for (const im of [inductors, caps, capBands]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // --- Mur de ventilateurs (face avant du châssis) ----------------------------------------------
  const fanFrame = fanFrameGeometry();
  const fanRotor = fanRotorGeometry();
  const fanFrameMat = pbr({ color: 0x15171a, roughness: 0.55, metalness: 0.0 });
  const fanRotorMat = pbr({ color: 0x0c0d0f, roughness: 0.3, metalness: 0.1 });
  const fans = [];
  const nFan = 5;
  const fanZ = T.depth / 2 - 0.055;
  for (let i = 0; i < nFan; i++) {
    const fx = -0.176 + i * 0.088;
    const frame = new THREE.Mesh(fanFrame, fanFrameMat);
    frame.position.set(fx, T.boardTop + 0.045, fanZ);
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);
    const rotor = new THREE.Mesh(fanRotor, fanRotorMat);
    rotor.position.copy(frame.position);
    rotor.castShadow = true;
    rotor.userData.phase = i * 0.7;
    g.add(rotor);
    fans.push(rotor);
  }

  // Liseré LED vert sur le rebord avant (accent discret).
  {
    const led = new THREE.Mesh(new THREE.BoxGeometry(T.width - 0.03, 0.004, 0.003), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x76b900).multiplyScalar(3.5), toneMapped: false }));
    led.position.set(0, T.height - 0.014, T.depth / 2 + 0.0016);
    g.add(led);
  }

  // --- Câbles ---------------------------------------------------------------------------------------
  const cableMat = pbr({ color: 0x1a1b1d, roughness: 0.8, metalness: 0.0 });
  const cableGroup = new THREE.Group();
  for (let b = 0; b < 3; b++) {
    const bx = -0.19 + b * 0.012;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, T.boardTop + 0.004, -0.17),
      new THREE.Vector3(bx + 0.004, T.boardTop + 0.03, -0.1),
      new THREE.Vector3(bx - 0.003, T.boardTop + 0.034, 0.0),
      new THREE.Vector3(bx + 0.002, T.boardTop + 0.028, 0.1),
      new THREE.Vector3(bx, T.boardTop + 0.006, 0.17),
    ]);
    for (let k = 0; k < 4; k++) {
      const off = new THREE.Vector3((k % 2) * 0.0052 - 0.0026, Math.floor(k / 2) * 0.0052, 0);
      const pts = curve.getPoints(40).map((p) => p.clone().add(off));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0025, 10, false), cableMat);
      tube.castShadow = true;
      cableGroup.add(tube);
    }
  }
  g.add(cableGroup);

  const update = (t, rpm = 900) => {
    const w = (rpm / 60) * Math.PI * 2;
    for (const f of fans) f.rotation.z = f.userData.phase + w * t;
  };

  g.userData.heroLocal = new THREE.Vector3(T.modX[T.heroIndex.col], T.boardTop + T.socketH, T.modZ[T.heroIndex.row]);
  return { group: g, update, hero, heroLocal: g.userData.heroLocal };
}
