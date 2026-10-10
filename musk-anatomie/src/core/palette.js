// Direction artistique : noir, blanc, gris métallique, bleu électrique, accents dorés.
//
// Choix de performance (rendu WebGL logiciel, mesuré) :
//  - surfaces mates (murs, sol, béton, peau…)  -> MeshLambertMaterial  (≈ 2× plus rapide que PBR)
//  - petites pièces « héros » (métal, or, verre) -> MeshStandardMaterial (reflets via environnement procédural)
//  - tout ce qui émet de la lumière (fenêtres, flux, néons) -> MeshBasicMaterial HDR (le tone mapping crée le halo)
import * as THREE from "three";

export const C = {
  void: 0x04060b,
  ink: 0x0a0f1a,
  floor: 0x0c121d,
  steel: 0x8e99aa,
  steelDark: 0x3a4454,
  white: 0xeef2f8,
  offwhite: 0xd9dfe9,
  blue: 0x2b7bff,
  blueHi: 0x58b4ff,
  cyan: 0x39e0ff,
  gold: 0xffb81c,
  goldHi: 0xffd978,
  red: 0xff4d5e,
  green: 0x2bd67b,
  orange: 0xff8a3d,
  skin: 0xe9b995,
  black: 0x0d0f14,
};

const cache = new Map();

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const std = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
/** émissif HDR : color × intensité (peut dépasser 1, le tone mapping fait le reste) */
const glow = (hex, intensity = 1.6, extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity), ...extra });

/** matériau mis en cache : mat('white'), mat('metal'), mat('goldGlow')… */
export function mat(name) {
  if (cache.has(name)) return cache.get(name);
  let m;
  switch (name) {
    // --- mats (Lambert)
    case "white": m = lambert(C.white); break;
    case "offwhite": m = lambert(C.offwhite); break;
    case "concrete": m = lambert(0x596170); break;
    case "dark": m = lambert(0x1a202c); break;
    case "black": m = lambert(C.black); break;
    case "blue": m = lambert(C.blue); break;
    case "navy": m = lambert(0x10244f); break;
    case "red": m = lambert(C.red); break;
    case "green": m = lambert(C.green); break;
    case "skin": m = lambert(C.skin); break;
    case "hair": m = lambert(0x1b140f); break;
    case "paper": m = lambert(0xf7f3e8); break;
    case "rubber": m = lambert(0x0b0c10); break;
    case "marble": m = lambert(0xe6e9ef); break;
    // --- héros (PBR)
    case "metal": m = std(C.steel, 0.3, 0.9); break;
    case "metalDark": m = std(C.steelDark, 0.4, 0.85); break;
    case "steel": m = std(0xcfd6e2, 0.22, 1.0); break;
    case "gold": m = std(C.gold, 0.24, 1.0); break;
    case "carWhite": m = std(0xf2f5fa, 0.25, 0.35); break;
    case "carRed": m = std(0xd9202f, 0.25, 0.4); break;
    case "carBlue": m = std(0x1d5fe0, 0.25, 0.4); break;
    case "carBlack": m = std(0x14171d, 0.22, 0.5); break;
    case "glass": m = std(0x9fd3ff, 0.05, 0.2, { transparent: true, opacity: 0.35, depthWrite: false }); break;
    // --- émissifs (Basic HDR)
    case "blueGlow": m = glow(C.blue, 1.7); break;
    case "cyanGlow": m = glow(C.cyan, 1.9); break;
    case "goldGlow": m = glow(C.gold, 1.7); break;
    case "redGlow": m = glow(C.red, 1.8); break;
    case "greenGlow": m = glow(C.green, 1.7); break;
    case "whiteGlow": m = glow(0xffffff, 1.5); break;
    case "window": m = glow(0x6fc3ff, 1.1); break;
    case "windowDim": m = glow(0x2a5a9a, 0.9); break;
    case "windowWarm": m = glow(0xffc766, 1.1); break;
    default: throw new Error("matériau inconnu: " + name);
  }
  m.name = name;
  cache.set(name, m);
  return m;
}

/** matériau mat coloré (non mis en cache) */
export function colored(hex, { metal = 0, rough = 0.5, glowIntensity = 0, transparent = false, opacity = 1 } = {}) {
  if (glowIntensity > 0) return glow(hex, glowIntensity, { transparent, opacity });
  if (metal > 0) return std(hex, rough, metal, { transparent, opacity });
  return lambert(hex, { transparent, opacity });
}

export const glowAdd = (hex, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
