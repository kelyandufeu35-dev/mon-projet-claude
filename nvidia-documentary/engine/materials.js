// Fabrique de matériaux PBR. Les matériaux texturés utilisent la convention ORM partagée
// (voir patches.js) : une seule lecture de texture pour occlusion + rugosité + métallicité.

import * as THREE from 'three';

/**
 * @param {object} o
 * @param {number|string} [o.color]
 * @param {THREE.Texture} [o.map]
 * @param {THREE.Texture} [o.orm]        R = AO, G = rugosité, B = métallicité
 * @param {THREE.Texture} [o.normal]
 * @param {number} [o.normalScale]
 * @param {number} [o.metalness]         sans ORM : valeur directe ; avec ORM : multiplicateur
 * @param {number} [o.roughness]
 * @param {boolean} [o.physical]         MeshPhysicalMaterial (clearcoat, anisotropie, irisation...)
 */
export function pbr(o = {}) {
  const { physical = false, orm = null, normal = null, normalScale = 1, ...rest } = o;
  const Mat = physical || rest.clearcoat || rest.anisotropy || rest.iridescence || rest.sheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat(rest);
  if (orm) {
    m.roughnessMap = orm;
    m.metalnessMap = orm;
    m.aoMap = orm;
    m.aoMapIntensity = o.aoMapIntensity ?? 1;
    if (o.roughness === undefined) m.roughness = 1;
    if (o.metalness === undefined) m.metalness = 1;
    m.defines = { ...(m.defines || {}), ORM_SHARED: '' };
  }
  if (normal) {
    m.normalMap = normal;
    m.normalScale = new THREE.Vector2(normalScale, normalScale);
  }
  return m;
}

// Émissif HDR : intensité > 1 pour déclencher le bloom, comme une vraie source.
export function emissive(color, intensity = 4) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
}

export const NVIDIA_GREEN = 0x76b900;
