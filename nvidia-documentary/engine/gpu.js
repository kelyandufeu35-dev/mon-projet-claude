// Module accélérateur (package GPU générique) : substrat, interposeur, puce de calcul,
// six piles mémoire HBM, condensateurs de découplage, cadre de renfort.
//
// Les proportions suivent un package d'accélérateur de calcul moderne, mais il s'agit d'un modèle
// générique : aucune référence de produit ni caractéristique chiffrée n'y est représentée.
// Unités : mètres. Le dessus du substrat est à y = 0.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { pbr } from './materials.js';
import { makeSubstrate, makeSiliconBack, makeBrushedMetal, makeInterposer } from './textures.js';
import { mulberry32 } from './rng.js';

const mm = 0.001;

function rbox(w, h, d, r, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-6, h / 2 - 1e-6, d / 2 - 1e-6));
}

// Cadre rectangulaire biseauté (renfort métallique).
function frameGeometry(outer, inner, height, bevel) {
  const s = new THREE.Shape();
  const o = outer / 2;
  s.moveTo(-o, -o); s.lineTo(o, -o); s.lineTo(o, o); s.lineTo(-o, o); s.closePath();
  const h = new THREE.Path();
  const i = inner / 2;
  h.moveTo(-i, -i); h.lineTo(-i, i); h.lineTo(i, i); h.lineTo(i, -i); h.closePath();
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

// Empreintes (mm, repère centré, z vers l'avant) : puce puis piles HBM. Partagées avec la texture
// de l'interposeur pour que micro-billes et occlusion de contact tombent exactement sous les pièces.
const DIE = { w: 27, d: 31 };
const HBM = { w: 9.2, d: 10.6 };
const HBM_X = DIE.w / 2 + 1.3 + HBM.w / 2;
const HBM_Z = [-11.6, 0, 11.6];

export function buildGPUPackage({ seed = 21 } = {}) {
  const g = new THREE.Group();
  g.name = 'gpu-package';
  const rnd = mulberry32(seed);

  const sub = makeSubstrate({ sizeMM: 76, px: 2048, seed: 11, interposer: { w: 58, h: 50 } });
  const siliconDie = makeSiliconBack({ px: 1024, seed: 5, marking: true });
  const siliconHbm = makeSiliconBack({ px: 512, seed: 9, marking: false });
  const brushed = makeBrushedMetal({ px: 1024, seed: 3, base: 95, spread: 45 });

  // --- Substrat -----------------------------------------------------------------
  const substrateMat = pbr({ color: 0xffffff, map: sub.map, orm: sub.orm, normal: sub.normal, normalScale: 0.8, metalness: 1, roughness: 1 });
  // Les UV d'une boîte arrondie couvrent chaque face de 0..1 ; seule la face supérieure est texturée de façon utile.
  const substrate = new THREE.Mesh(rbox(76 * mm, 1.6 * mm, 76 * mm, 0.25 * mm, 2), substrateMat);
  substrate.position.y = -0.8 * mm;
  substrate.receiveShadow = true;
  substrate.name = 'substrate';
  g.add(substrate);

  // --- Interposeur silicium --------------------------------------------------------
  const footprints = [{ x: 0, z: 0, w: DIE.w, d: DIE.d }];
  for (const sx of [-1, 1]) for (const z of HBM_Z) footprints.push({ x: sx * HBM_X, z, w: HBM.w, d: HBM.d });
  const ip = makeInterposer({ wMM: 58, dMM: 50, px: 2048, seed: 31, footprints });
  const interposerMat = pbr({
    color: 0xffffff, map: ip.map, orm: ip.orm, normal: ip.normal, normalScale: 0.3, metalness: 1, roughness: 1,
  });
  const interposer = new THREE.Mesh(rbox(58 * mm, 0.8 * mm, 50 * mm, 0.12 * mm, 2), interposerMat);
  interposer.position.y = 0.4 * mm + 0.05 * mm;
  interposer.castShadow = true;
  interposer.receiveShadow = true;
  g.add(interposer);

  // Rebord d'underfill (résine sombre brillante) autour de l'interposeur.
  const underfill = new THREE.Mesh(
    rbox(60.4 * mm, 0.5 * mm, 52.4 * mm, 0.22 * mm, 3),
    pbr({ color: 0x050607, roughness: 0.22, metalness: 0.0 })
  );
  underfill.position.y = 0.25 * mm;
  underfill.receiveShadow = true;
  g.add(underfill);

  const topY = 0.85 * mm; // dessus de l'interposeur

  // --- Puce de calcul centrale ------------------------------------------------------
  const dieMat = pbr({ color: 0x7c8690, orm: siliconDie.orm, normal: siliconDie.normal, normalScale: 0.6, metalness: 1, roughness: 1 });
  const dieH = 0.78 * mm;
  const die = new THREE.Mesh(rbox(27 * mm, dieH, 31 * mm, 0.1 * mm, 2), dieMat);
  die.position.y = topY + dieH / 2;
  die.castShadow = true;
  die.receiveShadow = true;
  die.name = 'die';
  g.add(die);

  // --- Piles HBM : base logique + 8 couches DRAM, avec micro-interstices ---------------
  const hbmW = 9.2 * mm;
  const hbmD = 10.6 * mm;
  const baseH = 0.12 * mm;
  const layerH = 0.07 * mm;
  const gap = 0.012 * mm;
  const layers = 8;
  const hbmGeo = rbox(hbmW, layerH, hbmD, 0.03 * mm, 1);
  const baseGeo = rbox(hbmW + 0.2 * mm, baseH, hbmD + 0.2 * mm, 0.03 * mm, 1);
  const hbmMat = pbr({ color: 0x7f8790, orm: siliconHbm.orm, normal: siliconHbm.normal, normalScale: 0.4, metalness: 1, roughness: 1.15 });
  const hbmTopMat = pbr({ color: 0x90989f, orm: siliconHbm.orm, normal: siliconHbm.normal, normalScale: 0.4, metalness: 1, roughness: 1.0 });
  const baseMat = pbr({ color: 0x4a5057, metalness: 0.8, roughness: 0.38 });
  const xPos = [-(13.5 + 1.3 + hbmW / mm / 2) * mm, (13.5 + 1.3 + hbmW / mm / 2) * mm];
  const zPos = [-11.6 * mm, 0, 11.6 * mm];
  const slabs = new THREE.InstancedMesh(hbmGeo, hbmMat, 6 * (layers - 1));
  const tops = new THREE.InstancedMesh(hbmGeo, hbmTopMat, 6);
  const bases = new THREE.InstancedMesh(baseGeo, baseMat, 6);
  const m4 = new THREE.Matrix4();
  let si = 0, ti = 0, bi = 0;
  for (const x of xPos) {
    for (const z of zPos) {
      let y = topY;
      m4.makeTranslation(x, y + baseH / 2, z);
      bases.setMatrixAt(bi++, m4);
      y += baseH + gap;
      for (let l = 0; l < layers; l++) {
        const cy = y + layerH / 2;
        m4.makeTranslation(x, cy, z);
        if (l === layers - 1) tops.setMatrixAt(ti++, m4);
        else slabs.setMatrixAt(si++, m4);
        y += layerH + gap;
      }
    }
  }
  for (const im of [slabs, tops, bases]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // --- Condensateurs CMS (corps céramique + deux terminaisons étamées) -----------------
  const caps = sub.caps;
  const bodyMat = pbr({ color: 0x6b4d33, roughness: 0.55, metalness: 0.0 });
  const endMat = pbr({ color: 0xcfd3d8, roughness: 0.32, metalness: 1.0 });
  const bodyGeos = [rbox(1.0 * mm, 0.5 * mm, 0.5 * mm, 0.06 * mm, 1), rbox(1.6 * mm, 0.9 * mm, 1.1 * mm, 0.1 * mm, 1)];
  const endGeos = [rbox(0.2 * mm, 0.52 * mm, 0.52 * mm, 0.05 * mm, 1), rbox(0.35 * mm, 0.92 * mm, 1.12 * mm, 0.08 * mm, 1)];
  const bodies = [0, 1].map((k) => new THREE.InstancedMesh(bodyGeos[k], bodyMat, caps.filter((c) => c.size === k).length));
  const ends = [0, 1].map((k) => new THREE.InstancedMesh(endGeos[k], endMat, caps.filter((c) => c.size === k).length * 2));
  const counters = [0, 0];
  const endCounters = [0, 0];
  const q = new THREE.Quaternion();
  for (const c of caps) {
    const k = c.size;
    const L = k ? 1.6 : 1.0;
    const H = k ? 0.9 : 0.5;
    const rot = c.vertical ? Math.PI / 2 : 0;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot + (rnd() - 0.5) * 0.03);
    const cx = c.x * mm;
    const cz = -c.y * mm; // le canvas a +y vers le haut de l'image ; le monde a -z vers l'avant
    m4.compose(new THREE.Vector3(cx, H * mm / 2 + 0.03 * mm, cz), q, new THREE.Vector3(1, 1, 1));
    bodies[k].setMatrixAt(counters[k]++, m4);
    const off = (L / 2 - (k ? 0.175 : 0.1)) * mm;
    for (const sgn of [-1, 1]) {
      const dx = c.vertical ? 0 : sgn * off;
      const dz = c.vertical ? sgn * off : 0;
      m4.compose(new THREE.Vector3(cx + dx, H * mm / 2 + 0.03 * mm, cz + dz), q, new THREE.Vector3(1, 1, 1));
      ends[k].setMatrixAt(endCounters[k]++, m4);
    }
  }
  for (const im of [...bodies, ...ends]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }

  // --- Cadre de renfort en nickel brossé ----------------------------------------------
  const frameMat = pbr({ color: 0xc9ccd0, orm: brushed.orm, normal: brushed.normal, normalScale: 0.6, metalness: 1, roughness: 1 });
  const frame = new THREE.Mesh(frameGeometry(76 * mm, 71.6 * mm, 0.9 * mm, 0.14 * mm), frameMat);
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  g.userData.dieTop = topY + dieH;
  g.userData.dieMesh = die;
  g.userData.dieMat = dieMat;
  return g;
}
