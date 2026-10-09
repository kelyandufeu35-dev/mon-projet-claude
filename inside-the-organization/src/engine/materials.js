import * as THREE from 'three';
import { C } from './palette.js';
import { rng } from '../util/math.js';

const cache = new Map();

/** Matériau standard mis en cache (clé = paramètres). */
export function std(color, { rough = 0.62, metal = 0.04, emissive = 0x000000, emI = 0, side = THREE.FrontSide, vertexColors = false } = {}) {
  const key = [color, rough, metal, emissive, emI, side, vertexColors].join('|');
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: metal, emissive, emissiveIntensity: emI, side, vertexColors,
    }));
  }
  return cache.get(key);
}

export const M = {
  white: () => std(C.white, { rough: 0.55 }),
  paper: () => std(C.paper, { rough: 0.7 }),
  red: () => std(C.red, { rough: 0.45 }),
  redDeep: () => std(C.redDeep, { rough: 0.5 }),
  yellow: () => std(C.yellow, { rough: 0.38, metal: 0.1, emissive: C.yellow, emI: 0.25 }),
  grey1: () => std(C.grey1, { rough: 0.7 }),
  grey2: () => std(C.grey2, { rough: 0.7 }),
  grey3: () => std(C.grey3, { rough: 0.75 }),
  grey4: () => std(C.grey4, { rough: 0.8 }),
  charcoal: () => std(C.charcoal, { rough: 0.8 }),
  glass: () => std(C.glass, { rough: 0.15, metal: 0.3, emissive: 0x6f8396, emI: 0.25 }),
  ground: () => std(0x2c2f36, { rough: 0.95 }),
  groundLight: () => std(0x3a3e47, { rough: 0.95 }),
  vc: () => std(0xffffff, { rough: 0.6, vertexColors: true }), // matériau à couleurs de sommets (personnages)
};

// ---- Façades : une rangée de baies par étage, textures procédurales déterministes ----
const facadeCache = new Map();
export const BAY = 1.1; // largeur d'une baie en unités monde

function drawFacade(wall, glass, litProb, seed, accentLit) {
  const bays = 8, cw = 96, ch = 96;
  const mk = () => { const c = document.createElement('canvas'); c.width = cw * bays; c.height = ch; return c; };
  const a = mk(), e = mk();
  const ca = a.getContext('2d'), ce = e.getContext('2d');
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  ca.fillStyle = hex(wall); ca.fillRect(0, 0, a.width, a.height);
  ce.fillStyle = '#000'; ce.fillRect(0, 0, e.width, e.height);
  const r = rng(seed);
  for (let i = 0; i < bays; i++) {
    const x = i * cw + 14, y = 20, w = cw - 28, h = ch - 40;
    const g = ca.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hex(glass)); g.addColorStop(1, '#46525e');
    ca.fillStyle = g; ca.fillRect(x, y, w, h);
    // montant
    ca.fillStyle = 'rgba(255,255,255,0.16)'; ca.fillRect(x, y + h - 5, w, 5);
    if (r() < litProb) {
      ce.fillStyle = r() < accentLit ? '#ffc72c' : '#ffe9b8';
      ce.globalAlpha = 0.55 + r() * 0.45; ce.fillRect(x, y, w, h); ce.globalAlpha = 1;
    }
  }
  const mkTex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mkTex(a, true), emissiveMap: mkTex(e, true) };
}

/** Matériau de façade (partagé par couleur de mur). */
export function facadeMaterial(wall = C.white, glass = C.glass, { litProb = 0.55, seed = 7, accentLit = 0.15, emI = 0.9 } = {}) {
  const key = [wall, glass, litProb, seed, emI].join('|');
  if (!facadeCache.has(key)) {
    const { map, emissiveMap } = drawFacade(wall, glass, litProb, seed, accentLit);
    facadeCache.set(key, new THREE.MeshStandardMaterial({
      color: 0xffffff, map, emissive: 0xffffff, emissiveMap, emissiveIntensity: emI, roughness: 0.55, metalness: 0.05,
    }));
  }
  return facadeCache.get(key);
}
