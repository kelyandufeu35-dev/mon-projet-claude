// Architecture de calcul interne de la puce : tuiles de calcul, sous-blocs, bus de données, fils
// à impulsions lumineuses. Visualisation artistique : elle représente le principe d'un calcul
// massivement parallèle, pas le plan réel d'une puce.
//
// Repère : celui du package GPU. L'architecture occupe le volume de la puce (y de 0 à 0,78 mm
// au-dessus de l'interposeur) ; elle est masquée par la face supérieure opaque tant que
// l'ouverture (addReveal) est fermée.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { pbr } from './materials.js';
import { makeArchFloor } from './textures.js';
import { addWirePulse, addReveal } from './shaders.js';
import { hash1 } from './rng.js';

const mm = 0.001;

export function buildArchitecture({ baseY = 0.85 * mm, reveal = null } = {}) {
  const g = new THREE.Group();
  g.name = 'die-architecture';
  g.position.y = baseY;

  const NX = 10, NZ = 12;
  const tileW = 2.1 * mm, tileD = 1.9 * mm;
  const gap = 0.32 * mm;
  const pitchX = tileW + gap, pitchZ = tileD + gap;
  const stripZ = 2.2 * mm; // bande centrale (bus + cache)
  const x0 = -((NX - 1) / 2) * pitchX;
  // Rangées symétriques de part et d'autre de la bande centrale (bus + cache).
  const zRow = (j) => (j < NZ / 2
    ? -(stripZ / 2 + tileD / 2 + (NZ / 2 - 1 - j) * pitchZ)
    : stripZ / 2 + tileD / 2 + (j - NZ / 2) * pitchZ);

  // Plancher.
  const fl = makeArchFloor({ px: 2048, wMM: 27, dMM: 31, seed: 71 });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: fl.map, emissiveMap: fl.emissive, emissive: 0xffffff, emissiveIntensity: 1.1, metalness: 0.85, roughness: 0.28,
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26.8 * mm, 0.05 * mm, 30.8 * mm), floorMat);
  floor.position.y = 0.025 * mm;
  floor.receiveShadow = true;
  g.add(floor);

  // Tuiles.
  const tileMat = pbr({ color: 0x0d1411, metalness: 0.85, roughness: 0.2 });
  const tileGeo = new RoundedBoxGeometry(tileW, 0.2 * mm, tileD, 2, 0.03 * mm);
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, NX * NZ);
  const subMat = pbr({ color: 0xffffff, metalness: 0.8, roughness: 0.3 });
  const subGeo = new RoundedBoxGeometry(0.4 * mm, 0.06 * mm, 0.42 * mm, 1, 0.012 * mm);
  const subs = new THREE.InstancedMesh(subGeo, subMat, NX * NZ * 12);
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  let ti = 0, si = 0;
  const tileCenters = [];
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const cx = x0 + i * pitchX;
      const cz = zRow(j);
      const h = 0.2 * mm * (0.85 + 0.3 * hash1(i * 7.3 + j * 13.1));
      m4.compose(new THREE.Vector3(cx, 0.05 * mm + h / 2 - 0.1 * mm + 0.1 * mm, cz), q, new THREE.Vector3(1, h / (0.2 * mm), 1));
      tiles.setMatrixAt(ti++, m4);
      tileCenters.push([cx, cz, h]);
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 3; b++) {
          const sh = 0.04 * mm + hash1(i * 3.7 + j * 5.9 + a * 1.3 + b * 2.9) * 0.07 * mm;
          m4.compose(
            new THREE.Vector3(cx - tileW / 2 + 0.28 * mm + a * 0.49 * mm, 0.05 * mm + h + sh / 2, cz - tileD / 2 + 0.3 * mm + b * 0.6 * mm),
            q, new THREE.Vector3(1, sh / (0.06 * mm), 1)
          );
          subs.setMatrixAt(si, m4);
          const v = hash1(i * 11.1 + j * 3.3 + a * 5.5 + b * 7.7);
          col.setRGB(0.05 + v * 0.08, 0.07 + v * 0.1, 0.06 + v * 0.07);
          if (v > 0.93) col.setRGB(0.28, 0.46, 0.04); // quelques blocs « actifs »
          subs.setColorAt(si, col);
          si++;
        }
      }
    }
  }
  for (const im of [tiles, subs]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }
  subs.instanceColor.needsUpdate = true;

  // Fils (boîtes unitaires étirées sur X, tournées de 90° pour les fils selon Z).
  const wireGeo = new THREE.BoxGeometry(1, 1, 1);
  const wires = [];
  const addWire = (cx, cz, len, alongZ, w = 0.035 * mm, hgt = 0.03 * mm, y = 0.06 * mm, seed = 0) => {
    wires.push({ cx, cz, len, alongZ, w, hgt, y, seed });
  };
  // Dans les interstices entre colonnes (fils selon Z) et entre rangées (fils selon X).
  for (let i = 0; i <= NX; i++) {
    const wx = x0 + (i - 0.5) * pitchX;
    for (let j = 0; j < NZ; j++) {
      for (const dx of [-0.07 * mm, 0.07 * mm]) addWire(wx + dx, zRow(j), tileD * 0.98, true, 0.04 * mm, 0.03 * mm, 0.065 * mm, i * 31 + j * 7 + (dx > 0 ? 1 : 0));
    }
  }
  // Interstices entre rangées : bords extérieurs et milieux, hors bande centrale.
  const gapsZ = [zRow(0) - pitchZ / 2];
  for (let j = 0; j < NZ - 1; j++) if (j !== NZ / 2 - 1) gapsZ.push((zRow(j) + zRow(j + 1)) / 2);
  gapsZ.push(zRow(NZ - 1) + pitchZ / 2);
  gapsZ.forEach((wz, jj) => {
    for (let i = 0; i < NX; i++) {
      for (const dz of [-0.07 * mm, 0.07 * mm]) addWire(x0 + i * pitchX, wz + dz, tileW * 0.98, false, 0.04 * mm, 0.03 * mm, 0.065 * mm, jj * 17 + i * 5 + (dz > 0 ? 3 : 0));
    }
  });
  // Bus central : quatre voies larges selon X, en pièces.
  for (let lane = 0; lane < 4; lane++) {
    const lz = (lane - 1.5) * 0.46 * mm;
    for (let i = 0; i < NX; i++) addWire(x0 + i * pitchX, lz, tileW + gap * 0.98, false, 0.11 * mm, 0.05 * mm, 0.075 * mm, 900 + lane * 13 + i);
  }

  const wireMat = pbr({ color: 0x0b0f0d, metalness: 0.9, roughness: 0.25 });
  addWirePulse(wireMat, { base: 0.045, peak: 5.5, speed: 0.6 });
  const wireMesh = new THREE.InstancedMesh(wireGeo, wireMat, wires.length);
  const seeds = new Float32Array(wires.length);
  const lens = new Float32Array(wires.length);
  wires.forEach((w, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.alongZ ? Math.PI / 2 : 0);
    m4.compose(new THREE.Vector3(w.cx, w.y, w.cz), q, new THREE.Vector3(w.len, w.hgt, w.w));
    wireMesh.setMatrixAt(i, m4);
    seeds[i] = hash1(w.seed * 1.7 + 0.3);
    lens[i] = 2 + Math.floor(hash1(w.seed * 2.3) * 4);
  });
  wireGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  wireGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(lens, 1));
  wireMesh.instanceMatrix.needsUpdate = true;
  g.add(wireMesh);

  // Vias verticaux : petits cylindres d'acier sombre aux intersections.
  const viaMat = pbr({ color: 0x59606a, metalness: 1, roughness: 0.32 });
  const nVia = 360;
  const vias = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.028 * mm, 0.028 * mm, 0.18 * mm, 10), viaMat, nVia);
  for (let i = 0; i < nVia; i++) {
    const t = tileCenters[Math.floor(hash1(i * 4.1) * tileCenters.length)];
    const ox = (hash1(i * 7.7) - 0.5) * tileW * 0.9;
    const oz = (hash1(i * 9.9) - 0.5) * tileD * 0.9;
    m4.compose(new THREE.Vector3(t[0] + ox, 0.05 * mm + t[2] + 0.02 * mm, t[1] + oz), q.identity(), one);
    vias.setMatrixAt(i, m4);
  }
  vias.instanceMatrix.needsUpdate = true;
  g.add(vias);

  // Cavité fermée : parois sombres brillantes + plafond (visible seulement depuis l'intérieur, percé
  // par la même ouverture que la face supérieure de la puce).
  const wallMat = pbr({ color: 0x050607, metalness: 0.9, roughness: 0.22 });
  const dieH = 0.78 * mm;
  for (const [w, h, d, x, z] of [
    [0.1 * mm, dieH, 31 * mm, -13.45 * mm, 0], [0.1 * mm, dieH, 31 * mm, 13.45 * mm, 0],
    [27 * mm, dieH, 0.1 * mm, 0, -15.45 * mm], [27 * mm, dieH, 0.1 * mm, 0, 15.45 * mm],
  ]) {
    const wmesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wmesh.position.set(x, h / 2, z);
    g.add(wmesh);
  }
  // Plafond : géométrie pivotée (normale vers le bas) pour que son repère objet reste aligné avec celui de
  // la puce ; l'ouverture (addReveal) se calcule en coordonnées xz du repère objet. Visible de l'intérieur.
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x030405, metalness: 0.9, roughness: 0.3 });
  if (reveal) addReveal(ceilMat, reveal);
  const ceilGeo = new THREE.PlaneGeometry(27 * mm, 31 * mm);
  ceilGeo.rotateX(Math.PI / 2);
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.position.y = dieH - 0.02 * mm;
  ceiling.layers.set(1);
  g.add(ceiling);

  return { group: g, extents: { w: 27 * mm, d: 31 * mm } };
}
