// Salle de données : sol technique, deux rangées de baies face à face (allée froide), plafond avec
// rampes LED, chemins de câbles, baie « héros » ouverte pour le plateau serveur.
//
// Repère : l'allée suit l'axe Z (de +8 vers -72), x = 0 au centre de l'allée, y = 0 au sol.
// Les baies de gauche (x < 0) regardent vers +X, celles de droite vers -X.

import * as THREE from 'three';
import { pbr, emissive } from './materials.js';
import { makeRackFront, makeRaisedFloor } from './textures.js';
import { addBlink, addBlinkBasic, addHallAmbient, addFresnelMirror, addWirePulse } from './shaders.js';
import { hash1 } from './rng.js';

export const HALL = {
  aisleHalf: 1.3,
  rackW: 0.6,
  rackH: 2.2,
  rackD: 1.2,
  zNear: 8,
  zFar: -72,
  ceilH: 4.2,
};

function instanced(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

// Plan de façade partiel : seule une tranche verticale [v0, v1] de la texture est utilisée.
function frontSlice(w, h, v0, v1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  return g;
}

export function buildHall() {
  const DBG = (typeof window !== 'undefined' && window.__extra && window.__extra.dbg) || {};
  const g = new THREE.Group();
  g.name = 'data-hall';
  const H = HALL;
  const nRacks = Math.ceil((H.zNear - H.zFar) / H.rackW);
  const zOf = (k) => H.zNear - H.rackW * (k + 0.5);
  const heroK = Math.round((H.zNear - 0) / H.rackW - 0.5); // baie centrée sur z ≈ 0

  // --- Sol technique ---------------------------------------------------------------
  const fl = makeRaisedFloor({ px: 1024, seed: 61 });
  for (const t of [fl.map, fl.orm, fl.normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60 / 1.2, 100 / 1.2);
  }
  // Sol en Lambert : pas d'IBL (coûteux). Les reflets viennent des copies miroir de sources placées sous
  // le sol, révélées par la transparence de Fresnel.
  const floorMat = new THREE.MeshLambertMaterial({
    color: 0xffffff, map: fl.map, normalMap: fl.normal, normalScale: new THREE.Vector2(0.45, 0.45),
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  if (!DBG.noFloorPatch) {
    addHallAmbient(floorMat, { ambient: 7.5, poolMin: 0.3, heightMin: 1.0, sheen: 0.25 });
    addFresnelMirror(floorMat, { strength: 1.0, roughness: 0.3 });
  }
  if (DBG.opaqueFloor) { floorMat.transparent = false; floorMat.blending = THREE.NormalBlending; floorMat.depthWrite = true; }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 100), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -32);
  floor.receiveShadow = true;
  floor.layers.set(1); // transparent : hors pré-passage de profondeur
  g.add(floor);

  // Copies miroir (sous le sol) des sources lumineuses : elles apparaissent par transparence du sol.
  const flip = new THREE.Matrix4().makeScale(1, -1, 1);
  const mirrorOf = (im, mat) => {
    if (DBG.noMirror) return null;
    const m = new THREE.InstancedMesh(im.geometry, mat, im.count);
    const t = new THREE.Matrix4();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, t);
      t.premultiply(flip);
      m.setMatrixAt(i, t);
    }
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = false;
    g.add(m);
    return m;
  };

  // --- Baies : corps + façades -------------------------------------------------------
  const bodyMat0 = new THREE.MeshLambertMaterial({ color: 0x14171a });
  const bodyMat = DBG.noAmbient ? bodyMat0 : addHallAmbient(bodyMat0, { ambient: 3, poolMin: 0.3, heightMin: 0.3 });
  const bodyGeo = new THREE.BoxGeometry(H.rackW - 0.004, H.rackH, H.rackD - 0.02);
  const variants = [51, 52, 53].map((s) => makeRackFront({ px: 768, seed: s }));
  const frontMats = variants.map((v) => {
    const m = new THREE.MeshLambertMaterial({
      map: v.map, emissiveMap: v.emissive, emissive: 0xffffff, emissiveIntensity: 4.5,
    });
    // Ordre important : ambiance d'abord, clignotement ensuite (voir shaders.js).
    if (!DBG.noAmbient) addHallAmbient(m, { ambient: 5.5, poolMin: 0.3, heightMin: 0.3, sheen: 0.35 });
    return addBlink(m, { cells: [128, 470], baseLevel: 0.1, steadyFraction: 0.5 });
  });
  const frontGeo = new THREE.PlaneGeometry(0.58, 2.16);
  const sides = [-1, 1];
  const perVariant = sides.map(() => [[], [], []]);
  const bodies = sides.map(() => []);
  for (let s = 0; s < 2; s++) {
    for (let k = 0; k < nRacks; k++) {
      if (s === 0 && k === heroK) continue;
      bodies[s].push(k);
      perVariant[s][Math.floor(hash1(k * 3.1 + s * 17.7) * 3) % 3].push(k);
    }
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  sides.forEach((sx, s) => {
    const body = instanced(bodyGeo, bodyMat, bodies[s].length);
    bodies[s].forEach((k, i) => {
      m4.compose(new THREE.Vector3(sx * (H.aisleHalf + H.rackD / 2), H.rackH / 2, zOf(k)), q.identity(), one);
      body.setMatrixAt(i, m4);
    });
    body.instanceMatrix.needsUpdate = true;
    g.add(body);
    for (let v = 0; v < 3; v++) {
      const list = perVariant[s][v];
      const im = instanced(frontGeo, frontMats[v], list.length);
      q.setFromAxisAngle(up, sx < 0 ? Math.PI / 2 : -Math.PI / 2);
      list.forEach((k, i) => {
        m4.compose(new THREE.Vector3(sx * (H.aisleHalf - 0.003), 0.01 + 1.08, zOf(k)), q, one);
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
      // Reflet de LED dans le sol : copie miroir, émissif seul (clignotement identique).
      const mm_ = new THREE.MeshBasicMaterial({ map: variants[v].emissive, color: new THREE.Color(1, 1, 1).multiplyScalar(2.8), side: THREE.BackSide, toneMapped: false });
      addBlinkBasic(mm_, { cells: [128, 470], baseLevel: 0.1, steadyFraction: 0.5 });
      mirrorOf(im, mm_);
    }
  });

  // Liserés d'accent vert en haut de chaque baie (source lumineuse discrète, bloom léger).
  const accentMat = emissive(0x76b900, 3.2);
  const accentGeo = new THREE.BoxGeometry(0.012, 0.012, H.rackW - 0.02);
  const accents = instanced(accentGeo, accentMat, nRacks * 2);
  let ai = 0;
  for (const sx of sides) for (let k = 0; k < nRacks; k++) {
    m4.compose(new THREE.Vector3(sx * (H.aisleHalf - 0.004), H.rackH + 0.006, zOf(k)), q.identity(), one);
    accents.setMatrixAt(ai++, m4);
  }
  accents.instanceMatrix.needsUpdate = true;
  g.add(accents);
  mirrorOf(accents, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x76b900).multiplyScalar(3.2), side: THREE.BackSide, toneMapped: false }));

  // --- Plafond, rampes LED, chemins de câbles ----------------------------------------------
  const ceilMat = pbr({ color: 0x0b0c0e, metalness: 0.3, roughness: 0.8 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 100), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H.ceilH, -32);
  g.add(ceil);

  const barGeo = new THREE.BoxGeometry(0.14, 0.05, 3.2);
  const barMat = emissive(0xe8f1ff, 7.0);
  const nBars = Math.ceil((H.zNear - H.zFar) / 3.8);
  const bars = instanced(barGeo, barMat, nBars * 2);
  let bi = 0;
  for (const bx of [-1.0, 1.0]) for (let i = 0; i < nBars; i++) {
    m4.compose(new THREE.Vector3(bx, H.ceilH - 0.03, H.zNear - i * 3.8 - 1.6), q.identity(), one);
    bars.setMatrixAt(bi++, m4);
  }
  bars.instanceMatrix.needsUpdate = true;
  g.add(bars);
  mirrorOf(bars, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8f1ff).multiplyScalar(7.0), side: THREE.BackSide, toneMapped: false }));

  const trayMat = pbr({ color: 0x6c7279, metalness: 1, roughness: 0.42 });
  const railGeo = new THREE.BoxGeometry(0.03, 0.1, H.zNear - H.zFar);
  const rungGeo = new THREE.BoxGeometry(0.6, 0.016, 0.028);
  const cableMat = pbr({ color: 0x0a0a0b, metalness: 0, roughness: 0.85 });
  const cableGeo = new THREE.BoxGeometry(0.46, 0.06, H.zNear - H.zFar);
  const nRung = Math.floor((H.zNear - H.zFar) / 0.4);
  const rungs = instanced(rungGeo, trayMat, nRung * 2);
  let ri = 0;
  for (const sx of sides) {
    const cx = sx * (H.aisleHalf + 0.6);
    for (const dx of [-0.3, 0.3]) {
      const rail = new THREE.Mesh(railGeo, trayMat);
      rail.position.set(cx + dx, 2.78, (H.zNear + H.zFar) / 2);
      g.add(rail);
    }
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(cx, 2.78, (H.zNear + H.zFar) / 2);
    g.add(cable);
    for (let i = 0; i < nRung; i++) {
      m4.compose(new THREE.Vector3(cx, 2.735, H.zNear - i * 0.4), q.identity(), one);
      rungs.setMatrixAt(ri++, m4);
    }
  }
  rungs.instanceMatrix.needsUpdate = true;
  g.add(rungs);

  // Fibres de données : fines lignes au-dessus des chemins de câbles, avec impulsions vertes qui filent
  // vers le fond de l'allée (le motif défile en fonction du temps : déterministe).
  {
    const fiberMat = new THREE.MeshStandardMaterial({ color: 0x050607, metalness: 0.3, roughness: 0.6, emissive: 0x000000 });
    addWirePulse(fiberMat, { base: 0.18, peak: 7.5, speed: 0.9 });
    const fiberLen = H.zNear - H.zFar;
    const fibers = [];
    for (const sx of sides) for (const dx of [-0.2, 0, 0.2]) fibers.push([sx * (H.aisleHalf + 0.6) + dx, 2.86]);
    const fiberGeo = new THREE.BoxGeometry(1, 0.012, 0.012);
    const fm = new THREE.InstancedMesh(fiberGeo, fiberMat, fibers.length);
    const seeds = new Float32Array(fibers.length);
    const lens = new Float32Array(fibers.length);
    const rot = new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2);
    fibers.forEach(([fx, fy], i) => {
      m4.compose(new THREE.Vector3(fx, fy, (H.zNear + H.zFar) / 2), rot, new THREE.Vector3(fiberLen, 1, 1));
      fm.setMatrixAt(i, m4);
      seeds[i] = hash1(i * 3.7 + 1.1);
      lens[i] = 7 + Math.floor(hash1(i * 5.3) * 6);
    });
    fiberGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    fiberGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(lens, 1));
    fm.instanceMatrix.needsUpdate = true;
    fm.frustumCulled = false;
    g.add(fm);
  }

  // --- Murs latéraux et mur de fond ----------------------------------------------------------
  const wallMat = pbr({ color: 0x0a0c0e, metalness: 0.2, roughness: 0.9 });
  for (const sx of sides) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(100, H.ceilH), wallMat);
    w.rotation.y = -sx * Math.PI / 2;
    w.position.set(sx * 9, H.ceilH / 2, -32);
    g.add(w);
  }
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(40, H.ceilH), wallMat);
  endWall.position.set(0, H.ceilH / 2, H.zFar - 1);
  g.add(endWall);
  // Repère lumineux vert au point de fuite de l'allée (deux montants verticaux + traverse basse).
  const endGlow = emissive(0x76b900, 4.2);
  for (const dx of [-1.15, 1.15]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.04), endGlow);
    bar.position.set(dx, 1.5, H.zFar - 0.9);
    g.add(bar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.06, 0.04), endGlow);
  lintel.position.set(0, 2.8, H.zFar - 0.9);
  g.add(lintel);

  // --- Baie « héros » (ouverte, accueille le plateau) --------------------------------------------
  const hero = new THREE.Group();
  hero.name = 'hero-rack';
  const cz = zOf(heroK);
  const cx = -(H.aisleHalf + H.rackD / 2);
  const frameMat = pbr({ color: 0x0d0f11, metalness: 0.8, roughness: 0.45 });
  const addBox = (w, h, d, x, y, z, mat = frameMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    hero.add(m);
    return m;
  };
  for (const dz of [-0.275, 0.275]) {
    addBox(0.04, H.rackH, 0.035, -H.aisleHalf - 0.02, H.rackH / 2, cz + dz);
    addBox(0.04, H.rackH, 0.035, -H.aisleHalf - H.rackD + 0.02, H.rackH / 2, cz + dz);
  }
  addBox(H.rackD, H.rackH, 0.01, cx, H.rackH / 2, cz - 0.295);
  addBox(H.rackD, H.rackH, 0.01, cx, H.rackH / 2, cz + 0.295);
  addBox(0.01, H.rackH, 0.58, -H.aisleHalf - H.rackD + 0.005, H.rackH / 2, cz);
  addBox(H.rackD, 0.02, 0.6, cx, H.rackH - 0.01, cz);
  addBox(H.rackD, 0.02, 0.6, cx, 0.02, cz);
  // Façades au-dessus et au-dessous de la baie du plateau (tranches de la même texture).
  const slotLo = 1.03, slotHi = 1.23;
  const lo = new THREE.Mesh(frontSlice(0.58, slotLo - 0.01, 0, (slotLo - 0.01) / 2.16), frontMats[1]);
  const hi = new THREE.Mesh(frontSlice(0.58, 2.19 - slotHi, (slotHi - 0.01) / 2.16, 1), frontMats[2]);
  for (const [mesh, y0, y1] of [[lo, 0.01, slotLo], [hi, slotHi, 2.19]]) {
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(-H.aisleHalf + 0.001, (y0 + y1) / 2, cz);
    hero.add(mesh);
  }
  // Rails de coulissement du plateau.
  const railM = pbr({ color: 0x8b9199, metalness: 1, roughness: 0.38 });
  for (const dz of [-0.232, 0.232]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.014, 0.022), railM);
    r.position.set(-H.aisleHalf - 0.4 + 0.45 - 0.2, slotLo + 0.012, cz + dz);
    r.castShadow = true;
    hero.add(r);
  }
  g.add(hero);

  g.userData.heroRack = { z: cz, front: -H.aisleHalf, slotLo, slotHi };
  return { group: g, heroRack: g.userData.heroRack };
}
