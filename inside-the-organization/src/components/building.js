import * as THREE from 'three';
import { C } from '../engine/palette.js';
import { M, std, facadeMaterial, BAY } from '../engine/materials.js';
import { rbox, cyl } from './furniture.js';
import { clamp, easeOutBack, easeOutCubic, smooth, lerp } from '../util/math.js';

/* ========================================================================
 * Bâtiments miniatures : tours qui se construisent étage par étage,
 * arches dorées, podiums.
 * ======================================================================== */

/** Boîte de façade : UV réglés pour une rangée de baies par étage (origine = base). */
export function facadeBoxGeo(w, h, d, uOffset = 0, rows = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const fw = f < 2 ? d : w;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      let u = uv.getX(i), v = uv.getY(i);
      if (f === 2 || f === 3) { u = 0.004; v = 0.5; } else { u = u * (fw / (BAY * 8)) + uOffset; v = v * rows; }
      uv.setXY(i, u, v);
    }
  }
  g.translate(0, h / 2, 0);
  return g;
}

export function makeArches({ size = 2, color = C.yellow, thick = 0.17, tilt = 0 } = {}) {
  const g = new THREE.Group();
  const a = 0.55 * size, hgt = 1.25 * size, leg = 0.2 * hgt;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15, emissive: color, emissiveIntensity: 0.45 });
  const mkArch = (cx) => {
    const pts = [new THREE.Vector3(cx + a, 0, 0)];
    for (let i = 0; i <= 28; i++) {
      const th = (Math.PI * i) / 28;
      pts.push(new THREE.Vector3(cx + a * Math.cos(th), leg + (hgt - leg) * Math.pow(Math.sin(th), 0.85), 0));
    }
    pts.push(new THREE.Vector3(cx - a, 0, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, 80, thick * size, 12, false);
    const m = new THREE.Mesh(geo, mat); m.scale.z = 0.55; m.castShadow = true;
    return m;
  };
  g.add(mkArch(-a * 0.98), mkArch(a * 0.98));
  g.userData.mat = mat;
  g.rotation.z = tilt;
  return g;
}

/**
 * Tour modulaire.
 * build(p) : p 0..1 → étages qui poussent un à un.
 */
export function makeTower({ w = 6, d = 6, floors = 6, fh = 1.3, wall = C.white, glass = C.glass, seed = 3, fins = null, bands = null, base = null, cap = C.grey2, roofColor = C.paper, lit = 0.55, accentLit = 0.15, ledge = true } = {}) {
  const group = new THREE.Group();
  const facade = facadeMaterial(wall, glass, { litProb: lit, seed, accentLit });
  const roofMat = std(roofColor, { rough: 0.7 });
  const mats = [facade, facade, roofMat, roofMat, facade, facade];
  const floorGroup = new THREE.Group(); group.add(floorGroup);
  const meshes = [];
  const y0 = base ? base.h : 0;
  if (base) {
    const b = rbox(base.w, base.h, base.d, std(base.color ?? C.white, { rough: 0.6 }), { r: 0.15 });
    group.add(b);
    const glassBand = rbox(base.w + 0.04, base.h * 0.45, base.d + 0.04, M.glass(), { r: 0.08 }); glassBand.position.y = base.h * 0.22; group.add(glassBand);
    group.userData.base = b;
  }
  for (let i = 0; i < floors; i++) {
    const m = new THREE.Mesh(facadeBoxGeo(w, fh, d, (i * 0.37 + seed * 0.11) % 1), mats);
    m.position.y = y0 + i * fh; m.castShadow = true; m.receiveShadow = true;
    const slab = ledge ? rbox(w + 0.14, 0.09, d + 0.14, std(cap, { rough: 0.6 }), { r: 0.03 }) : null;
    const holder = new THREE.Group(); holder.position.y = y0 + i * fh; m.position.y = 0;
    holder.add(m);
    if (slab) { slab.position.y = fh - 0.09; holder.add(slab); }
    floorGroup.add(holder); meshes.push(holder);
  }
  const height = y0 + floors * fh;
  // arêtes colorées
  const trims = new THREE.Group(); group.add(trims);
  if (fins) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const f = rbox(0.22, floors * fh, 0.22, std(fins, { rough: 0.4 }), { r: 0.04 });
      f.position.set(sx * (w / 2 + 0.02), y0, sz * (d / 2 + 0.02)); trims.add(f);
    }
  }
  if (bands) {
    for (const bi of bands.at) {
      const b = rbox(w + 0.2, 0.16, d + 0.2, std(bands.color ?? fins ?? C.red, { rough: 0.45 }), { r: 0.04 });
      b.position.y = y0 + bi * fh + fh * 0.5; trims.add(b);
    }
  }
  const roof = rbox(w + 0.2, 0.22, d + 0.2, std(cap, { rough: 0.6 }), { r: 0.06 }); roof.position.y = height; group.add(roof);

  const build = (p) => {
    const N = floors, win = 0.4;
    for (let i = 0; i < N; i++) {
      const start = (i / N) * (1 - win);
      const q = clamp((p - start) / win);
      const s = Math.max(0.0001, easeOutBack(q, 1.1));
      meshes[i].scale.y = s; meshes[i].visible = q > 0;
    }
    trims.scale.y = Math.max(0.0001, easeOutCubic(clamp(p / 0.9))); trims.visible = p > 0.02;
    const rp = clamp((p - 0.88) / 0.12);
    roof.visible = rp > 0; roof.scale.setScalar(Math.max(0.0001, easeOutBack(rp, 1.6)));
    if (base) group.userData.base.visible = p > 0.005;
  };
  build(1);
  group.userData = { ...group.userData, height, floors, fh, w, d, roof, y0 };
  return { group, height, build, roof, w, d, floors, fh, y0 };
}

/** Plateforme circulaire / carrée arrondie (« tuile » de diorama) dont le dessus est à y = 0. */
export function makePlatform({ r = 10, h = 0.9, color = C.grey4, top = 0x3a3e47, ring = null, shape = 'round', w = 20, d = 20 } = {}) {
  const g = new THREE.Group();
  let base, slab;
  if (shape === 'round') {
    base = cyl(r, r * 0.985, h - 0.13, std(color, { rough: 0.85 }), 96);
    slab = cyl(r * 0.985, r * 0.985, 0.12, std(top, { rough: 0.9 }), 96);
  } else {
    base = rbox(w, h - 0.13, d, std(color, { rough: 0.85 }), { r: 0.4 });
    slab = rbox(w - 0.2, 0.12, d - 0.2, std(top, { rough: 0.9 }), { r: 0.1 });
  }
  base.position.y = -h; slab.position.y = -0.12;
  base.receiveShadow = slab.receiveShadow = true;
  g.add(base, slab);
  if (ring) {
    const rm = new THREE.Mesh(new THREE.RingGeometry(ring.r0, ring.r1, 96).rotateX(-Math.PI / 2), std(ring.color, { rough: 0.8, emissive: ring.color, emI: ring.glow ?? 0 }));
    rm.position.y = 0.012; rm.receiveShadow = true; g.add(rm);
  }
  return g;
}

/** Petit restaurant McDonald's stylisé (réutilisé : ville, marchés, organigramme). */
export function makeMiniRestaurant({ w = 1.5, d = 1.0, h = 0.55, roof = C.red, sign = true, signSize = 0.42, glassFront = true } = {}) {
  const g = new THREE.Group();
  const body = rbox(w, h, d, M.white(), { r: Math.min(0.05, h * 0.2) }); g.add(body);
  if (glassFront) {
    const gl = rbox(w * 0.86, h * 0.55, 0.04, M.glass(), { r: 0.015 }); gl.position.set(0, h * 0.14, d / 2 + 0.005); g.add(gl);
    const gl2 = rbox(0.04, h * 0.55, d * 0.78, M.glass(), { r: 0.015 }); gl2.position.set(w / 2 + 0.005, h * 0.14, 0); g.add(gl2);
  }
  const rf = rbox(w + 0.14, 0.09, d + 0.14, std(roof, { rough: 0.45 }), { r: 0.03 }); rf.position.y = h; g.add(rf);
  const band = rbox(w + 0.16, 0.06, d + 0.16, M.yellow(), { r: 0.02 }); band.position.y = h - 0.06; g.add(band);
  let arches = null;
  if (sign) {
    const pole = cyl(0.03, 0.03, 0.55, M.grey2(), 6); pole.position.set(w / 2 + 0.28, 0, d / 2 + 0.15); g.add(pole);
    arches = makeArches({ size: signSize, thick: 0.15 }); arches.position.set(w / 2 + 0.28, 0.5, d / 2 + 0.15); arches.rotation.y = 0.4; g.add(arches);
  }
  g.userData = { w, d, h, arches };
  return g;
}

/** Paroi à bandeau plein + bandeau vitré + montants (origine = centre du pied de paroi). */
export function makeGlassWall(len, h = 2.7, { low = C.white, top = C.red, solid = 0.8, doorAt = null } = {}) {
  const g = new THREE.Group();
  const t = 0.22;
  const lowM = rbox(len, solid, t, std(low, { rough: 0.55 }), { r: 0.04 }); g.add(lowM);
  const glass = rbox(len - 0.12, h - solid - 0.12, t * 0.45, M.glass(), { r: 0.03 }); glass.position.y = solid; g.add(glass);
  const n = Math.max(2, Math.round(len / 2.6));
  for (let i = 0; i <= n; i++) {
    const p = rbox(0.16, h, 0.26, M.white(), { r: 0.03 }); p.position.x = -len / 2 + (i * len) / n; g.add(p);
  }
  const stripe = rbox(len, 0.14, 0.3, std(top, { rough: 0.45 }), { r: 0.03 }); stripe.position.y = h - 0.14; g.add(stripe);
  if (doorAt != null) {
    const door = rbox(1.6, h * 0.82, 0.3, std(C.grey3, { rough: 0.3, metal: 0.4 }), { r: 0.04 }); door.position.set(doorAt, 0, 0); g.add(door);
    const dg = rbox(1.4, h * 0.7, 0.34, M.glass(), { r: 0.03 }); dg.position.set(doorAt, 0.05, 0); g.add(dg);
  }
  return g;
}
