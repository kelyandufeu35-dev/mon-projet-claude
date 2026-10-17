import * as THREE from 'three';

/**
 * Procedural geometry for the NEXUS core. Everything is built once and shared
 * (see `getGeometries`); instanced meshes reuse the same buffers.
 */

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  panel: number[] = [];
  idx: number[] = [];

  vert(p: THREE.Vector3, n: THREE.Vector3, u = 0, v = 0, outer = 0) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.panel.push(u, v, outer);
    return this.pos.length / 3 - 1;
  }

  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, d, b, c, d);
  }

  build(withPanel = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    if (withPanel) g.setAttribute('aPanel', new THREE.Float32BufferAttribute(this.panel, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const sph = (r: number, th: number, ph: number, out: THREE.Vector3) =>
  out.set(r * Math.sin(th) * Math.sin(ph), r * Math.cos(th), r * Math.sin(th) * Math.cos(ph));

/**
 * A thick spherical panel ("petal"): outer + inner surface and four side
 * walls with hard normals. Centred on phi = 0, polar angle th0..th1.
 */
export function petalGeometry(rIn: number, rOut: number, phiLen: number, th0: number, th1: number, segP = 14, segT = 14) {
  const b = new Builder();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const grid = (r: number, outward: boolean) => {
    const base = b.pos.length / 3;
    for (let j = 0; j <= segT; j++) {
      const v = j / segT;
      const th = th0 + (th1 - th0) * v;
      for (let i = 0; i <= segP; i++) {
        const u = i / segP;
        const ph = -phiLen / 2 + phiLen * u;
        sph(r, th, ph, p);
        n.copy(p).normalize();
        if (!outward) n.negate();
        b.vert(p, n, u, v, outward ? 1 : 0);
      }
    }
    const row = segP + 1;
    for (let j = 0; j < segT; j++) {
      for (let i = 0; i < segP; i++) {
        const a = base + j * row + i;
        if (outward) b.quad(a, a + row, a + row + 1, a + 1);
        else b.quad(a, a + 1, a + row + 1, a + row);
      }
    }
  };
  grid(rOut, true);
  grid(rIn, false);

  // Side walls: walk an edge of the parameter domain, extrude inner→outer.
  const wall = (steps: number, at: (s: number) => [number, number], normal: (th: number, ph: number, o: THREE.Vector3) => void) => {
    const base = b.pos.length / 3;
    const tmp = new THREE.Vector3();
    for (let s = 0; s <= steps; s++) {
      const [th, ph] = at(s / steps);
      normal(th, ph, n);
      b.vert(sph(rIn, th, ph, tmp), n);
      b.vert(sph(rOut, th, ph, tmp), n);
    }
    for (let s = 0; s < steps; s++) {
      const a = base + s * 2;
      b.quad(a, a + 2, a + 3, a + 1);
    }
  };
  // Polar-side edge (th0) faces toward the pole; equator-side edge faces away.
  wall(segP, (s) => [th0, phiLen / 2 - phiLen * s], (th, ph, o) => {
    o.set(Math.cos(th) * Math.sin(ph), -Math.sin(th), Math.cos(th) * Math.cos(ph)).negate();
  });
  wall(segP, (s) => [th1, -phiLen / 2 + phiLen * s], (th, ph, o) => {
    o.set(Math.cos(th) * Math.sin(ph), -Math.sin(th), Math.cos(th) * Math.cos(ph));
  });
  // Meridian edges face along ±phi.
  wall(segT, (s) => [th0 + (th1 - th0) * s, -phiLen / 2], (_th, ph, o) => {
    o.set(-Math.cos(ph), 0, Math.sin(ph));
  });
  wall(segT, (s) => [th1 - (th1 - th0) * s, phiLen / 2], (_th, ph, o) => {
    o.set(Math.cos(ph), 0, -Math.sin(ph));
  });
  return b.build(true);
}

/** Rectangular-section ring around Y with crisp edges. */
export function ringGeometry(r0: number, r1: number, h: number, seg = 128) {
  const b = new Builder();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const face = (pa: [number, number], pb: [number, number], normal: (c: number, s: number) => [number, number, number]) => {
    const base = b.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const [nx, ny, nz] = normal(c, s);
      n.set(nx, ny, nz);
      b.vert(p.set(pa[0] * c, pa[1], pa[0] * s), n);
      b.vert(p.set(pb[0] * c, pb[1], pb[0] * s), n);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      b.quad(a, a + 1, a + 3, a + 2);
    }
  };
  face([r1, -h], [r1, h], (c, s) => [c, 0, s]);
  face([r0, h], [r0, -h], (c, s) => [-c, 0, -s]);
  face([r1, h], [r0, h], () => [0, 1, 0]);
  face([r0, -h], [r1, -h], () => [0, -1, 0]);
  return b.build();
}

export interface Geometries {
  core: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  cage: THREE.BufferGeometry;
  petal: THREE.BufferGeometry;
  ringA: THREE.BufferGeometry;
  ringB: THREE.BufferGeometry;
  ringC: THREE.BufferGeometry;
  ringLight: THREE.BufferGeometry;
  tooth: THREE.BufferGeometry;
  pivot: THREE.BufferGeometry;
  crownBase: THREE.BufferGeometry;
  crownHub: THREE.BufferGeometry;
  crownCap: THREE.BufferGeometry;
  crownFin: THREE.BufferGeometry;
  bolt: THREE.BufferGeometry;
  spindle: THREE.BufferGeometry;
  injHousing: THREE.BufferGeometry;
  injCollar: THREE.BufferGeometry;
  injRod: THREE.BufferGeometry;
  injNozzle: THREE.BufferGeometry;
  injLight: THREE.BufferGeometry;
  halo: THREE.BufferGeometry;
  floor: THREE.BufferGeometry;
}

export const SHELL = { rIn: 1.5, rOut: 1.62, th0: 0.42, th1: 1.3, phiLen: ((Math.PI * 2) / 6) * 0.8 };
export const INJECTOR_RADIUS = 2.05;

let cache: Geometries | null = null;
let cacheDetail = -1;

export function getGeometries(sphereDetail: number): Geometries {
  if (cache && cacheDetail === sphereDetail) return cache;
  cacheDetail = sphereDetail;
  const cyl = (rt: number, rb: number, h: number, s = 32) => new THREE.CylinderGeometry(rt, rb, h, s);

  cache = {
    core: new THREE.IcosahedronGeometry(0.55, sphereDetail),
    glass: new THREE.SphereGeometry(0.82, 64, 40),
    cage: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.9, 1)),
    petal: petalGeometry(SHELL.rIn, SHELL.rOut, SHELL.phiLen, SHELL.th0, SHELL.th1),
    ringA: ringGeometry(1.28, 1.36, 0.085, 160),
    ringB: ringGeometry(1.1, 1.19, 0.045, 160),
    ringC: ringGeometry(0.97, 1.0, 0.13, 128),
    ringLight: new THREE.TorusGeometry(1.005, 0.008, 6, 160),
    tooth: new THREE.BoxGeometry(0.05, 0.07, 0.035),
    pivot: cyl(0.06, 0.06, 0.16, 20),
    crownBase: cyl(0.66, 0.74, 0.12, 64),
    crownHub: cyl(0.34, 0.4, 0.2, 48),
    crownCap: cyl(0.2, 0.22, 0.05, 40),
    crownFin: new THREE.BoxGeometry(0.035, 0.1, 0.24),
    bolt: cyl(0.032, 0.032, 0.05, 10),
    spindle: cyl(0.055, 0.055, 0.72, 16),
    injHousing: cyl(0.12, 0.14, 0.55, 28),
    injCollar: cyl(0.17, 0.17, 0.06, 28),
    injRod: cyl(0.04, 0.04, 0.6, 12),
    injNozzle: cyl(0.04, 0.1, 0.12, 20),
    injLight: new THREE.TorusGeometry(0.172, 0.012, 6, 40),
    halo: new THREE.TorusGeometry(1, 0.0035, 4, 256),
    floor: new THREE.PlaneGeometry(60, 60, 1, 1),
  };
  // Orient the injector parts along +Y so they can be rotated radially.
  cache.injLight.rotateX(Math.PI / 2);
  cache.halo.rotateX(Math.PI / 2);
  cache.ringLight.rotateX(Math.PI / 2);
  cache.floor.rotateX(-Math.PI / 2);
  return cache;
}
