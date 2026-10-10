// Builder : assemble des primitives en un petit nombre de maillages fusionnés (1 par couche × matériau).
// Convention : les coordonnées (x, y, z) désignent le CENTRE DE LA BASE (y = bas de la pièce).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mat } from "./palette.js";
import { clamp, ease, inv } from "./util.js";

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Builder {
  constructor() {
    this.buckets = new Map(); // `${layer}|${matId}` -> { layer, material, geos }
    this.layer = 0;
    this.layerModes = []; // 'rise' | 'drop' | 'static'
    this.castShadow = true;
  }

  /** change la couche courante (ordre de construction) et son mode d'apparition */
  setLayer(i, mode = "rise") {
    this.layer = i;
    this.layerModes[i] = mode;
    return this;
  }

  _mat(m) {
    return typeof m === "string" ? mat(m) : m;
  }

  add(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const material_ = this._mat(material);
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute("uv");
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    const key = this.layer + "|" + material_.uuid;
    if (!this.buckets.has(key)) this.buckets.set(key, { layer: this.layer, material: material_, geos: [] });
    this.buckets.get(key).geos.push(g);
    return this;
  }

  box(w, h, d, x, y, z, material, ry = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z, 0, ry, 0);
  }
  cyl(rTop, rBot, h, x, y, z, material, seg = 20) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), material, x, y + h / 2, z);
  }
  sphere(r, x, y, z, material, seg = 16) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), material, x, y + r, z);
  }
  cone(r, h, x, y, z, material, seg = 20) {
    return this.add(new THREE.ConeGeometry(r, h, seg), material, x, y + h / 2, z);
  }
  /** plan horizontal fin (dalle) */
  slab(w, d, x, y, z, material, t = 0.2) {
    return this.box(w, t, d, x, y, z, material);
  }

  /** @returns {THREE.Group} groupe de maillages fusionnés, balisés par couche */
  build({ shadow = true } = {}) {
    const group = new THREE.Group();
    for (const { layer, material, geos } of this.buckets.values()) {
      const merged = mergeGeometries(geos, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      const emissive = material.emissive && material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
      mesh.castShadow = shadow && !emissive && !material.transparent;
      mesh.receiveShadow = !material.transparent;
      mesh.userData.layer = layer;
      group.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    group.userData.layerCount = Math.max(1, this.layerModes.length, ...[...this.buckets.values()].map((b) => b.layer + 1));
    group.userData.layerModes = this.layerModes.slice();
    return group;
  }
}

/**
 * Animation de construction : p (0..1) fait apparaître les couches l'une après l'autre.
 * 'rise'  : la couche pousse depuis le sol (échelle Y)  — fondations, murs
 * 'drop'  : la couche descend du ciel avec rebond léger — toits, équipements
 * 'static': présente dès p > 0
 */
export function applyBuild(group, p, { dropHeight = 26, overlap = 0.45 } = {}) {
  const n = group.userData.layerCount || 1;
  const modes = group.userData.layerModes || [];
  const span = 1 / (1 + (n - 1) * (1 - overlap));
  for (const mesh of group.children) {
    const i = mesh.userData.layer ?? 0;
    const mode = modes[i] || "rise";
    const start = i * (1 - overlap) * span;
    const lp = inv(start, start + span, p);
    if (mode === "static") {
      mesh.visible = p > 0.001;
      continue;
    }
    mesh.visible = lp > 0.001;
    if (!mesh.visible) continue;
    if (mode === "rise") {
      const e = ease.out3(lp);
      mesh.scale.y = Math.max(1e-3, e);
      mesh.position.y = 0;
    } else {
      const e = ease.outBack(clamp(lp * 1.0), 1.2);
      mesh.scale.y = 1;
      mesh.position.y = (1 - clamp(e, 0, 1.15)) * dropHeight;
    }
  }
}

/** Fait pivoter/avoir un groupe autour d'un point pivot sans modifier ses enfants */
export function pivot(child, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  child.position.set(-x, -y, -z);
  g.add(child);
  return g;
}
