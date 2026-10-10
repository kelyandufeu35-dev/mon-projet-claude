// Objets financiers 3D : actions, mosaïque d'actionnaires, graphiques, bandeau boursier, billets, coffre, jauge.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Builder } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { labelTexture } from "../core/world.js";
import { clamp, lerp, ease, TAU, rng } from "../core/util.js";

// ---------------------------------------------------------------------------
// Certificat d'action : texture + dalle arrondie
// ---------------------------------------------------------------------------
export function shareTexture(label, { accent = "#58b4ff", sub = "ACTION · CERTIFICAT", w = 1280, h = 800 } = {}) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0a1a42"); bg.addColorStop(1, "#13306e");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // guillochis
  g.lineWidth = 2.4;
  for (let k = 0; k < 26; k++) {
    g.strokeStyle = `rgba(88,180,255,${0.05 + (k % 3) * 0.025})`;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = h / 2 + Math.sin(x * 0.01 + k * 0.5) * (60 + k * 6.4) * Math.cos(k * 0.2);
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  // bordure dorée double
  g.strokeStyle = "#ffb81c"; g.lineWidth = 16; g.strokeRect(28, 28, w - 56, h - 56);
  g.strokeStyle = "rgba(255,217,120,0.7)"; g.lineWidth = 4; g.strokeRect(60, 60, w - 120, h - 120);
  g.fillStyle = "#ffd978"; g.font = '500 52px "JetBrains Mono"'; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(sub, w / 2, 136);
  g.fillStyle = "#ffffff"; g.shadowColor = accent; g.shadowBlur = 52;
  let size = 300;
  g.font = `700 ${size}px "Space Grotesk"`;
  while (g.measureText(label).width > w - 240 && size > 80) { size -= 10; g.font = `700 ${size}px "Space Grotesk"`; }
  g.fillText(label, w / 2, h / 2 + 12);
  g.shadowBlur = 0;
  g.fillStyle = "rgba(255,255,255,0.55)"; g.font = '500 44px "JetBrains Mono"';
  g.fillText("N° 000 001  ·  1 ACTION", w / 2, h - 132);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const _shareBody = new RoundedBoxGeometry(6.4, 4.0, 0.8, 3, 0.18);
export function makeShareBlock(label, { accent = "#58b4ff", scale = 1, sub } = {}) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(_shareBody, new THREE.MeshStandardMaterial({ color: 0x102a66, roughness: 0.35, metalness: 0.5 }));
  body.castShadow = true;
  grp.add(body);
  const tex = shareTexture(label, { accent, sub });
  const faceM = new THREE.MeshBasicMaterial({ map: tex });
  const f1 = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 3.7), faceM);
  f1.position.z = 0.405;
  const f2 = f1.clone();
  f2.position.z = -0.405;
  f2.rotation.y = Math.PI;
  grp.add(f1, f2);
  grp.scale.setScalar(scale);
  return grp;
}

// ---------------------------------------------------------------------------
// Mosaïque instanciée (grille de cubes) : 100 blocs = 100 % d'une entreprise
// ---------------------------------------------------------------------------
export class Mosaic {
  constructor(cols, rows, { cell = 1.3, size = 1.1, material = null } = {}) {
    this.cols = cols; this.rows = rows; this.n = cols * rows; this.cell = cell; this.size = size;
    const m = material || new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.12), m, this.n);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 3), 3);
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
  }
  /** fn(i, col, row) -> { s, y, sy, color(hex), dx, dz } */
  update(fn) {
    const d = this._d, c = this._c;
    for (let i = 0; i < this.n; i++) {
      const col = i % this.cols, row = Math.floor(i / this.cols);
      const st = fn(i, col, row);
      const s = Math.max(1e-4, st.s ?? 1);
      d.position.set((col - (this.cols - 1) / 2) * this.cell + (st.dx ?? 0), (st.y ?? 0) + ((st.sy ?? 1) * this.size * s) / 2, (row - (this.rows - 1) / 2) * this.cell + (st.dz ?? 0));
      d.rotation.set(st.rx ?? 0, st.ry ?? 0, 0);
      d.scale.set(this.size * s, this.size * s * (st.sy ?? 1), this.size * s);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      c.set(st.color ?? 0x6b7a99);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Histogramme 3D instancié
// ---------------------------------------------------------------------------
export class BarChart3D {
  constructor(n, { width = 1.4, depth = 1.4, gap = 0.5, material = null } = {}) {
    this.n = n; this.width = width; this.depth = depth; this.gap = gap;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material || new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
  }
  /** fn(i) -> { h, color } */
  update(fn) {
    const d = this._d, c = this._c;
    for (let i = 0; i < this.n; i++) {
      const st = fn(i);
      const h = Math.max(1e-3, st.h);
      d.position.set((i - (this.n - 1) / 2) * (this.width + this.gap), h / 2, 0);
      d.scale.set(this.width, h, this.depth);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      c.set(st.color ?? 0x2b7bff);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Ruban de courbe boursière 3D (mis à jour à chaque image) + aire sous la courbe
// ---------------------------------------------------------------------------
export class LineRibbon {
  constructor(samples = 90, { width = 40, depth = 1.6, thick = 0.7, color = 0x39e0ff, fill = 0x2b7bff, fillOpacity = 0.16 } = {}) {
    this.m = samples; this.width = width; this.depth = depth; this.thick = thick;
    const m = samples;
    this.pos = new Float32Array(m * 4 * 3);
    const idx = [];
    for (let i = 0; i < m - 1; i++) {
      const a = i * 4, b = (i + 1) * 4;
      // dessus, avant, arrière, dessous
      idx.push(a, b, a + 2, b, b + 2, a + 2);
      idx.push(a + 1, a, b + 1, a, b, b + 1);
      idx.push(a + 3, b + 3, a + 2, b + 3, b + 2, a + 2);
      idx.push(a + 1, b + 1, a + 3, b + 1, b + 3, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setIndex(idx);
    this.ribbon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6) }));
    this.ribbon.frustumCulled = false;
    // aire
    this.fpos = new Float32Array(m * 2 * 3);
    const fidx = [];
    for (let i = 0; i < m - 1; i++) { const a = i * 2, b = (i + 1) * 2; fidx.push(a, b, a + 1, b, b + 1, a + 1); }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(this.fpos, 3));
    fg.setIndex(fidx);
    this.area = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: fill, transparent: true, opacity: fillOpacity, side: THREE.DoubleSide, depthWrite: false }));
    this.area.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.area, this.ribbon);
  }
  /** f(u) -> hauteur (u 0..1) ; reveal 0..1 (tracé progressif) */
  update(f, reveal = 1) {
    const m = this.m, p = this.pos, fp = this.fpos, hd = this.depth / 2, ht = this.thick / 2;
    for (let i = 0; i < m; i++) {
      const u = (i / (m - 1)) * clamp(reveal, 0.0001, 1);
      const x = (i / (m - 1)) * this.width * clamp(reveal, 0.0001, 1) - this.width / 2;
      const y = f(u);
      const k = i * 12;
      p.set([x, y + ht, hd, x, y - ht, hd, x, y + ht, -hd, x, y - ht, -hd], k);
      fp.set([x, 0, 0, x, y, 0], i * 6);
    }
    this.ribbon.geometry.attributes.position.needsUpdate = true;
    this.area.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Bandeau boursier défilant (canvas redessiné à chaque image)
// ---------------------------------------------------------------------------
export class TickerBoard {
  constructor(w, h, { px = 1536, py = 96 } = {}) {
    this.cv = document.createElement("canvas");
    this.cv.width = px; this.cv.height = py;
    this.g = this.cv.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex }));
    this.px = px; this.py = py;
  }
  /** items : [{ text, dir (+1/-1/0) }] ; t : temps ; speed px/s */
  update(t, items, speed = 160) {
    const g = this.g, W = this.px, Hh = this.py;
    g.fillStyle = "#050a14"; g.fillRect(0, 0, W, Hh);
    g.font = '700 52px "JetBrains Mono"'; g.textBaseline = "middle";
    const gap = 90;
    const widths = items.map((it) => g.measureText(it.text + "  ▲").width + gap);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -((t * speed) % total);
    for (let rep = 0; rep < 3; rep++)
      items.forEach((it, i) => {
        g.fillStyle = it.dir > 0 ? "#2bd67b" : it.dir < 0 ? "#ff4d5e" : "#cfd8e8";
        g.fillText(it.text + (it.dir > 0 ? "  ▲" : it.dir < 0 ? "  ▼" : "  ■"), x, Hh / 2 + 2);
        x += widths[i];
      });
    this.tex.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Liasses de billets (pile statique fusionnée) et cadenas
// ---------------------------------------------------------------------------
export function makeCashPile({ cols = 4, rows = 3, layers = 3, scale = 1 } = {}) {
  const b = new Builder();
  b.setLayer(0, "static");
  const bill = colored(0x78d99a);
  const band = mat("paper");
  for (let l = 0; l < layers; l++)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const x = (i - (cols - 1) / 2) * 1.5, z = (j - (rows - 1) / 2) * 0.85;
        b.box(1.4, 0.45, 0.75, x, l * 0.47, z, bill);
        b.box(0.28, 0.5, 0.78, x, l * 0.47 - 0.02, z, band);
      }
  const g = b.build();
  g.scale.setScalar(scale);
  return g;
}

export function makePadlock(scale = 1, glow = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.2, 0.6, 2, 0.1), glow ? mat("goldGlow") : mat("gold"));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.12, 8, 16, Math.PI), mat("steel"));
  arch.position.y = 0.62;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.65, 8), mat("black"));
  hole.rotation.x = Math.PI / 2;
  g.add(body, arch, hole);
  body.castShadow = true;
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------------------
// Jauge (ratio prêt / valeur des garanties) : arc coloré + aiguille
// ---------------------------------------------------------------------------
export class Gauge {
  constructor(radius = 4) {
    this.group = new THREE.Group();
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const a0 = Math.PI - (i / segs) * Math.PI, a1 = Math.PI - ((i + 1) / segs) * Math.PI - 0.015;
      const col = i < segs * 0.5 ? C.green : i < segs * 0.78 ? C.orange : C.red;
      const ring = new THREE.RingGeometry(radius * 0.78, radius, 4, 1, a1, a0 - a1);
      const m = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.15), side: THREE.DoubleSide }));
      this.group.add(m);
    }
    const back = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.12, 40, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x070d1a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    back.position.z = -0.05;
    this.group.add(back);
    this.needle = new THREE.Group();
    const nd = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.86, 0.22, 0.12), mat("whiteGlow"));
    nd.position.x = radius * 0.43;
    this.needle.add(nd);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16), mat("white"));
    hub.rotation.x = Math.PI / 2;
    this.needle.add(hub);
    this.needle.position.z = 0.1;
    this.group.add(this.needle);
  }
  /** k : 0 (gauche, sûr) -> 1 (droite, danger) */
  set(k) {
    this.needle.rotation.z = Math.PI - clamp(k) * Math.PI;
  }
}

// ---------------------------------------------------------------------------
// Coffre-fort : porte circulaire articulée + roue à rayons + boulons
// ---------------------------------------------------------------------------
export class Vault {
  constructor(radius = 3.4) {
    this.group = new THREE.Group();
    this.r = radius;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.35, 0.55, 14, 40), mat("steel"));
    frame.castShadow = true;
    this.group.add(frame);
    // intérieur du coffre (disque sombre au fond)
    const inside = new THREE.Mesh(new THREE.CircleGeometry(radius, 36), mat("black"));
    inside.position.z = -0.05;
    this.group.add(inside);
    // porte
    this.hinge = new THREE.Group();
    this.hinge.position.x = -(radius + 0.1);
    this.group.add(this.hinge);
    this.door = new THREE.Group();
    this.door.position.x = radius + 0.1;
    this.hinge.add(this.door);
    const dm = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.9, 40), mat("steel"));
    dm.rotation.x = Math.PI / 2;
    dm.position.z = 0.45;
    dm.castShadow = true;
    this.door.add(dm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.1, 8, 40), mat("metalDark"));
    ring.position.z = 0.92;
    this.door.add(ring);
    this.bolts = new THREE.Group();
    this.bolts.position.z = 0.9;
    this.door.add(this.bolts);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10), mat("gold"));
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88, 0);
      this.bolts.add(bolt);
    }
    this.wheel = new THREE.Group();
    this.wheel.position.z = 1.1;
    this.door.add(this.wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16), mat("gold"));
    hub.rotation.x = Math.PI / 2;
    this.wheel.add(hub);
    const wr = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 8, 28), mat("gold"));
    this.wheel.add(wr);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.14), mat("gold"));
      sp.rotation.z = (i / 6) * Math.PI;
      this.wheel.add(sp);
    }
  }
  /** k : 0 fermé -> 1 grande ouverture */
  set(k) {
    const spin = ease.io3(clamp(k / 0.4));
    const swing = ease.io3(clamp((k - 0.35) / 0.65));
    this.wheel.rotation.z = spin * TAU * 1.5;
    this.bolts.rotation.z = -spin * 0.5;
    this.hinge.rotation.y = -swing * 1.75;
    this.door.position.z = ease.out2(clamp((k - 0.3) / 0.15)) * 0.0;
  }
}
