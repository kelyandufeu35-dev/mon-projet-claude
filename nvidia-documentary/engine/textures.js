// Textures procédurales (canvas 2D), toutes déterministes (graine fixe).
//
// Convention de packing "ORM" : R = occlusion ambiante, G = rugosité, B = métallicité.
// Un seul échantillonnage par pixel est utilisé pour les trois (voir patches.js) : dans le
// rendu logiciel chaque lecture de texture coûte cher.

import * as THREE from 'three';
import { mulberry32 } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(c, { srgb = false, repeat = null, aniso = 4, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.flipY = flipY;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

// Bruit fin par pixel, ajouté à un canal d'ImageData (amplitude en niveaux 0..255).
function addPixelNoise(ctx, w, h, rnd, amp, channels = [0, 1, 2]) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 2 * amp;
    for (const c of channels) d[i + c] = Math.max(0, Math.min(255, d[i + c] + n));
  }
  ctx.putImageData(img, 0, 0);
}

// Taches basse fréquence (variations de teinte/rugosité à grande échelle).
function addBlobs(ctx, w, h, rnd, count, rMin, rMax, color, alpha) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rMin + rnd() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', String(alpha * (0.4 + rnd() * 0.6))));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * Substrat organique du package GPU, vu de dessus.
 * Retourne les positions (en mm, repère du substrat centré) des condensateurs CMS pour que la
 * géométrie instanciée coïncide avec les plages de soudure dessinées ici.
 * @param {number} sizeMM côté du substrat en millimètres
 */
export function makeSubstrate({ sizeMM = 76, px = 2048, seed = 11, interposer = { w: 58, h: 50 } } = {}) {
  const rnd = mulberry32(seed);
  const mm = px / sizeMM;
  const W = px, H = px;

  const albedo = canvas(W, H);
  const a = albedo.getContext('2d');
  const orm = canvas(W, H);
  const o = orm.getContext('2d');
  const nrm = canvas(W, H); // hauteur en niveaux de gris, converti en normal map après
  const hgt = nrm.getContext('2d');

  // Masque de soudure vert-noir satiné.
  a.fillStyle = '#1b2d23';
  a.fillRect(0, 0, W, H);
  addBlobs(a, W, H, rnd, 260, 40, 260, 'rgba(46,84,62,A)', 0.14);
  addBlobs(a, W, H, rnd, 140, 30, 180, 'rgba(0,0,0,A)', 0.2);
  addPixelNoise(a, W, H, rnd, 4);

  o.fillStyle = 'rgb(255,150,0)'; // AO=1, rugosité ~0.59, métal 0
  o.fillRect(0, 0, W, H);
  addBlobs(o, W, H, rnd, 220, 40, 220, 'rgba(255,200,0,A)', 0.2);
  addBlobs(o, W, H, rnd, 220, 40, 220, 'rgba(255,90,0,A)', 0.2);
  addPixelNoise(o, W, H, rnd, 6, [1]);

  hgt.fillStyle = 'rgb(128,128,128)';
  hgt.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const toPx = (x, y) => [cx + x * mm, cy - y * mm];

  // Tissage de fibre de verre : très léger motif quadrillé dans la hauteur.
  hgt.globalAlpha = 0.06;
  hgt.strokeStyle = '#fff';
  hgt.lineWidth = 1;
  for (let i = 0; i < W; i += 6) {
    hgt.beginPath();
    hgt.moveTo(i + 0.5, 0);
    hgt.lineTo(i + 0.5, H);
    hgt.stroke();
  }
  hgt.strokeStyle = '#000';
  for (let j = 0; j < H; j += 6) {
    hgt.beginPath();
    hgt.moveTo(0, j + 0.5);
    hgt.lineTo(W, j + 0.5);
    hgt.stroke();
  }
  hgt.globalAlpha = 1;

  const gold = '#c9a24e';
  const padRect = (xmm, ymm, wmm, hmm, rot = false) => {
    const [x, y] = toPx(xmm, ymm);
    const w = (rot ? hmm : wmm) * mm;
    const h = (rot ? wmm : hmm) * mm;
    a.fillStyle = gold;
    a.fillRect(x - w / 2, y - h / 2, w, h);
    o.fillStyle = 'rgb(255,70,255)'; // lisse, métallique
    o.fillRect(x - w / 2, y - h / 2, w, h);
    hgt.fillStyle = 'rgb(172,172,172)'; // plage en relief
    hgt.fillRect(x - w / 2, y - h / 2, w, h);
  };

  // Condensateurs de découplage : anneau autour de l'interposeur.
  const caps = [];
  const ringX = interposer.w / 2 + 4.2;
  const ringY = interposer.h / 2 + 4.2;
  const placeRow = (x0, y0, x1, y1, n, vertical) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      caps.push({ x, y, vertical, size: rnd() < 0.18 ? 1 : 0 });
    }
  };
  placeRow(-ringX + 1.4, ringY, ringX - 1.4, ringY, 22, false);
  placeRow(-ringX + 1.4, -ringY, ringX - 1.4, -ringY, 22, false);
  placeRow(-ringX, -ringY + 1.8, -ringX, ringY - 1.8, 16, true);
  placeRow(ringX, -ringY + 1.8, ringX, ringY - 1.8, 16, true);
  // Seconde rangée, plus dense, sur deux côtés.
  placeRow(-ringX + 3, ringY + 2.1, ringX - 3, ringY + 2.1, 26, false);
  placeRow(-ringX + 3, -ringY - 2.1, ringX - 3, -ringY - 2.1, 26, false);

  // Halo d'occlusion sous chaque composant + plages dorées.
  for (const c of caps) {
    const [x, y] = toPx(c.x, c.y);
    const r = (c.size ? 2.6 : 1.9) * mm;
    const g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = g;
    // L'AO est stocké dans R : on assombrit R uniquement en superposant un halo rouge-noir.
    o.save();
    o.globalCompositeOperation = 'multiply';
    const g2 = o.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, 'rgb(130,255,255)');
    g2.addColorStop(1, 'rgb(255,255,255)');
    o.fillStyle = g2;
    o.fillRect(x - r, y - r, 2 * r, 2 * r);
    o.restore();
    const L = c.size ? 1.6 : 1.0;
    const Wd = c.size ? 1.1 : 0.55;
    const gap = c.size ? 0.6 : 0.4;
    if (!c.vertical) {
      padRect(c.x - (L / 2 + gap / 2) + 0.15, c.y, 0.8, Wd + 0.2);
      padRect(c.x + (L / 2 + gap / 2) - 0.15, c.y, 0.8, Wd + 0.2);
    } else {
      padRect(c.x, c.y - (L / 2 + gap / 2) + 0.15, Wd + 0.2, 0.8);
      padRect(c.x, c.y + (L / 2 + gap / 2) - 0.15, Wd + 0.2, 0.8);
    }
  }

  // Réseau de microplages (pas 0,5 mm) dans une couronne entre interposeur et condensateurs.
  const ringInX = interposer.w / 2 + 0.8;
  const ringInY = interposer.h / 2 + 0.8;
  const ringOutX = interposer.w / 2 + 2.6;
  const ringOutY = interposer.h / 2 + 2.6;
  for (let y = -ringOutY; y <= ringOutY; y += 0.5) {
    for (let x = -ringOutX; x <= ringOutX; x += 0.5) {
      const inside = Math.abs(x) < ringInX && Math.abs(y) < ringInY;
      if (inside) continue;
      if (rnd() < 0.18) continue;
      const [px_, py_] = toPx(x, y);
      const s = 0.2 * mm;
      a.fillStyle = 'rgba(190,150,70,0.55)';
      a.fillRect(px_ - s / 2, py_ - s / 2, s, s);
      o.fillStyle = 'rgb(255,110,200)';
      o.fillRect(px_ - s / 2, py_ - s / 2, s, s);
    }
  }

  // Ombre de contact de l'interposeur sur le substrat.
  {
    const [x, y] = toPx(0, 0);
    const w = (interposer.w + 3.2) * mm;
    const h = (interposer.h + 3.2) * mm;
    o.save();
    o.globalCompositeOperation = 'multiply';
    const grd = o.createLinearGradient(0, 0, 0, 1);
    o.fillStyle = 'rgb(165,255,255)';
    o.fillRect(x - w / 2, y - h / 2, w, h);
    o.restore();
  }

  // Marquages sérigraphiés (fiduciales, repère de coin A1, grille de crans).
  a.strokeStyle = 'rgba(214,220,214,0.85)';
  a.fillStyle = 'rgba(214,220,214,0.85)';
  a.lineWidth = 0.18 * mm;
  const corner = sizeMM / 2 - 2.6;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [x, y] = toPx(sx * corner, sy * corner);
    a.beginPath();
    a.arc(x, y, 0.9 * mm, 0, Math.PI * 2);
    a.stroke();
    a.beginPath();
    a.moveTo(x - 1.5 * mm, y);
    a.lineTo(x + 1.5 * mm, y);
    a.moveTo(x, y - 1.5 * mm);
    a.lineTo(x, y + 1.5 * mm);
    a.stroke();
  }
  // Repère A1 (triangle).
  {
    const [x, y] = toPx(-corner + 3.2, corner - 0.5);
    a.beginPath();
    a.moveTo(x, y);
    a.lineTo(x + 2.0 * mm, y);
    a.lineTo(x, y + 2.0 * mm);
    a.closePath();
    a.fill();
  }
  // Code 2D (Data Matrix factice, pour le réalisme : non porteur d'information).
  {
    const n = 14;
    const cell = 0.42 * mm;
    const [x0, y0] = toPx(corner - 9.0, -corner + 2.8);
    a.fillStyle = 'rgba(224,228,224,0.9)';
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const solidL = i === 0 || j === n - 1;
        const clock = (i === n - 1 && j % 2 === 0) || (j === 0 && i % 2 === 0);
        const data = i > 0 && j < n - 1 && i < n - 1 && j > 0 && rnd() < 0.5;
        if (solidL || clock || data) a.fillRect(x0 + i * cell, y0 + j * cell, cell * 0.92, cell * 0.92);
      }
    }
    // Cadre de la zone de marquage.
    a.lineWidth = 0.1 * mm;
    a.strokeRect(x0 - cell, y0 - cell, (n + 2) * cell, (n + 2) * cell);
  }

  const heightImg = hgt.getImageData(0, 0, W, H);
  const normalCanvas = heightToNormal(heightImg, 3.0);

  return {
    map: toTexture(albedo, { srgb: true, aniso: 8 }),
    orm: toTexture(orm, { srgb: false, aniso: 8 }),
    normal: toTexture(normalCanvas, { srgb: false, aniso: 8 }),
    caps,
    sizeMM,
  };
}

// Conversion hauteur (niveaux de gris) -> normal map tangente (Sobel).
export function heightToNormal(heightImageData, strength = 2.0) {
  const { width: w, height: h, data } = heightImageData;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const H = (x, y) => data[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * Dos de puce en silicium poli : rayures de sciage très fines, légères variations de
 * rugosité, et gravure laser discrète. Retourne ORM + normal.
 */
export function makeSiliconBack({ px = 1024, seed = 5, marking = true } = {}) {
  const rnd = mulberry32(seed);
  const orm = canvas(px, px);
  const o = orm.getContext('2d');
  o.fillStyle = 'rgb(255,40,255)'; // poli : rugosité ~0.16, métal
  o.fillRect(0, 0, px, px);
  addBlobs(o, px, px, rnd, 120, 30, 220, 'rgba(255,75,255,A)', 0.25);
  // Micro-rayures : traits fins, courts, orientés au hasard dans un cône étroit.
  o.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const x = rnd() * px, y = rnd() * px;
    const len = 20 + rnd() * 140;
    const ang = (rnd() - 0.5) * 0.5 + (rnd() < 0.5 ? 0 : Math.PI / 2);
    o.strokeStyle = `rgba(255,${100 + (rnd() * 60) | 0},255,${0.03 + rnd() * 0.07})`;
    o.lineWidth = 0.5 + rnd() * 0.5;
    o.beginPath();
    o.moveTo(x, y);
    o.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    o.stroke();
  }
  addPixelNoise(o, px, px, rnd, 5, [1]);

  const hgt = canvas(px, px);
  const h = hgt.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, px, px);
  h.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = rnd() * px, y = rnd() * px;
    const len = 30 + rnd() * 120;
    const ang = (rnd() - 0.5) * 0.4 + (rnd() < 0.5 ? 0 : Math.PI / 2);
    h.strokeStyle = `rgba(${rnd() < 0.5 ? 255 : 0},${0},${0},${0.04 + rnd() * 0.07})`;
    h.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.03 + rnd() * 0.06})` : `rgba(0,0,0,${0.03 + rnd() * 0.06})`;
    h.lineWidth = 0.7;
    h.beginPath();
    h.moveTo(x, y);
    h.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    h.stroke();
  }
  if (marking) {
    // Gravure laser : petits rectangles et un identifiant générique dans un coin.
    h.fillStyle = 'rgba(255,255,255,0.35)';
    h.font = `bold ${Math.round(px * 0.028)}px "Courier New", monospace`;
    h.fillText('ZA3 0524  F7C1-0098', px * 0.06, px * 0.94);
    h.fillRect(px * 0.06, px * 0.955, px * 0.18, px * 0.004);
    o.fillStyle = 'rgba(255,170,255,0.8)';
    o.font = h.font;
    o.fillText('ZA3 0524  F7C1-0098', px * 0.06, px * 0.94);
  }
  const normal = heightToNormal(h.getImageData(0, 0, px, px), 2.2);
  return { orm: toTexture(orm, { aniso: 8 }), normal: toTexture(normal, { aniso: 8 }) };
}

/**
 * Métal brossé (aluminium anodisé / nickel) : rugosité à fines stries directionnelles.
 * Les stries sont horizontales dans l'espace UV ; tourner la texture ou les UV pour les orienter.
 */
export function makeBrushedMetal({ px = 1024, seed = 3, base = 90, spread = 40 } = {}) {
  const rnd = mulberry32(seed);
  const orm = canvas(px, px);
  const o = orm.getContext('2d');
  o.fillStyle = `rgb(255,${base},255)`;
  o.fillRect(0, 0, px, px);
  for (let i = 0; i < px * 1.4; i++) {
    const y = rnd() * px;
    const x = rnd() * px;
    const len = 80 + rnd() * px * 0.9;
    const g = Math.max(0, Math.min(255, base + (rnd() - 0.5) * spread * 2));
    o.strokeStyle = `rgba(255,${g | 0},255,${0.08 + rnd() * 0.22})`;
    o.lineWidth = 0.6 + rnd() * 0.9;
    o.beginPath();
    o.moveTo(x, y);
    o.lineTo(x + len, y + (rnd() - 0.5) * 1.2);
    o.stroke();
  }
  addBlobs(o, px, px, rnd, 90, 60, 320, 'rgba(255,150,255,A)', 0.14);
  const hgt = canvas(px, px);
  const h = hgt.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, px, px);
  for (let i = 0; i < px * 1.2; i++) {
    const y = rnd() * px, x = rnd() * px;
    const len = 60 + rnd() * px * 0.8;
    h.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.05 + rnd() * 0.12})` : `rgba(0,0,0,${0.05 + rnd() * 0.12})`;
    h.lineWidth = 0.7;
    h.beginPath();
    h.moveTo(x, y);
    h.lineTo(x + len, y + (rnd() - 0.5));
    h.stroke();
  }
  const normal = heightToNormal(h.getImageData(0, 0, px, px), 1.4);
  return { orm: toTexture(orm, { aniso: 8 }), normal: toTexture(normal, { aniso: 8 }) };
}

/**
 * Face supérieure de l'interposeur silicium : métallisation fine, champs de micro-billes
 * entre la puce et les piles mémoire, occlusion de contact sous chaque composant.
 * @param {{x:number,z:number,w:number,d:number}[]} footprints  empreintes (mm, repère centré, z vers l'avant)
 */
export function makeInterposer({ wMM = 58, dMM = 50, px = 2048, seed = 31, footprints = [] } = {}) {
  const rnd = mulberry32(seed);
  const mm = px / wMM;
  const W = px;
  const H = Math.round(dMM * mm);
  const cx = W / 2, cy = H / 2;
  const toPx = (x, z) => [cx + x * mm, cy + z * mm]; // z vers l'avant = bas de l'image (v inversé géré par flipY)

  const map = canvas(W, H);
  const a = map.getContext('2d');
  const orm = canvas(W, H);
  const o = orm.getContext('2d');
  const hgt = canvas(W, H);
  const h = hgt.getContext('2d');

  // Albédo : gris-bleu froid, avec de très légers dégradés irisés (métallisation en couches minces).
  a.fillStyle = '#7a828c';
  a.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 380;
    const g = a.createRadialGradient(x, y, 0, x, y, r);
    const hue = [210, 255, 285, 170, 35][(rnd() * 5) | 0];
    g.addColorStop(0, `hsla(${hue},45%,58%,0.10)`);
    g.addColorStop(1, `hsla(${hue},45%,58%,0)`);
    a.fillStyle = g;
    a.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  o.fillStyle = 'rgb(255,52,255)';
  o.fillRect(0, 0, W, H);
  addBlobs(o, W, H, rnd, 160, 30, 200, 'rgba(255,95,255,A)', 0.2);

  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);

  // Trame fine de lignes de métallisation (très faible contraste).
  h.globalAlpha = 0.09;
  for (let x = 0; x < W; x += 5) {
    h.fillStyle = (x / 5) % 2 ? '#fff' : '#000';
    h.fillRect(x, 0, 1, H);
  }
  for (let y = 0; y < H; y += 40) {
    h.fillStyle = '#fff';
    h.fillRect(0, y, W, 1);
  }
  h.globalAlpha = 1;

  // Champs de micro-billes dans les interstices entre empreintes voisines.
  const near = (A, B) => {
    const gx = Math.max(A.x - A.w / 2, B.x - B.w / 2) - Math.min(A.x + A.w / 2, B.x + B.w / 2);
    const gz = Math.max(A.z - A.d / 2, B.z - B.z / 2) - Math.min(A.z + A.d / 2, B.z + B.d / 2);
    return { gx, gz };
  };
  const dots = (x0, z0, x1, z1) => {
    const pitch = 0.11;
    for (let z = z0; z <= z1; z += pitch) {
      for (let x = x0; x <= x1; x += pitch) {
        const [px_, py_] = toPx(x, z);
        const r = 0.032 * mm;
        a.fillStyle = 'rgba(150,156,166,0.55)';
        a.beginPath(); a.arc(px_, py_, r * 1.1, 0, Math.PI * 2); a.fill();
        o.fillStyle = 'rgb(255,90,255)';
        o.beginPath(); o.arc(px_, py_, r * 1.1, 0, Math.PI * 2); o.fill();
        h.fillStyle = 'rgba(255,255,255,0.35)';
        h.beginPath(); h.arc(px_, py_, r, 0, Math.PI * 2); h.fill();
      }
    }
  };
  const die = footprints[0];
  for (const f of footprints.slice(1)) {
    // Bande de micro-billes côté puce, le long de chaque pile HBM.
    const side = Math.sign(f.x - die.x);
    const xEdgeDie = die.x + side * die.w / 2;
    const xEdgeHbm = f.x - side * f.w / 2;
    const xa = Math.min(xEdgeDie, xEdgeHbm), xb = Math.max(xEdgeDie, xEdgeHbm);
    dots(xa + 0.12, f.z - f.d / 2 + 0.6, xb - 0.12, f.z + f.d / 2 - 0.6);
  }

  // Occlusion de contact (R) : halos sombres sous les arêtes de chaque empreinte.
  for (const f of footprints) {
    const [x, y] = toPx(f.x, f.z);
    const w = f.w * mm, d = f.d * mm;
    const feather = 1.1 * mm;
    o.save();
    o.globalCompositeOperation = 'multiply';
    const grad = (x0, y0, x1, y1, stops) => {
      const g = o.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([p, c]) => g.addColorStop(p, c));
      return g;
    };
    const dark = 'rgb(95,255,255)', lite = 'rgb(255,255,255)';
    o.fillStyle = grad(x - w / 2 - feather, 0, x - w / 2, 0, [[0, lite], [1, dark]]);
    o.fillRect(x - w / 2 - feather, y - d / 2 - feather, feather, d + 2 * feather);
    o.fillStyle = grad(x + w / 2, 0, x + w / 2 + feather, 0, [[0, dark], [1, lite]]);
    o.fillRect(x + w / 2, y - d / 2 - feather, feather, d + 2 * feather);
    o.fillStyle = grad(0, y - d / 2 - feather, 0, y - d / 2, [[0, lite], [1, dark]]);
    o.fillRect(x - w / 2, y - d / 2 - feather, w, feather);
    o.fillStyle = grad(0, y + d / 2, 0, y + d / 2 + feather, [[0, dark], [1, lite]]);
    o.fillRect(x - w / 2, y + d / 2, w, feather);
    o.restore();
  }

  // Anneau d'étanchéité et rainure de découpe près du bord.
  a.strokeStyle = 'rgba(30,34,40,0.8)';
  a.lineWidth = 0.06 * mm;
  a.strokeRect(0.55 * mm, 0.55 * mm, W - 1.1 * mm, H - 1.1 * mm);
  h.strokeStyle = 'rgba(0,0,0,0.9)';
  h.lineWidth = 0.1 * mm;
  h.strokeRect(0.55 * mm, 0.55 * mm, W - 1.1 * mm, H - 1.1 * mm);

  addPixelNoise(o, W, H, rnd, 5, [1]);
  const normal = heightToNormal(h.getImageData(0, 0, W, H), 2.2);
  return { map: toTexture(map, { srgb: true, aniso: 8 }), orm: toTexture(orm, { aniso: 8 }), normal: toTexture(normal, { aniso: 8 }) };
}

/**
 * Carte mère / baseboard : masque vert très sombre, pistes routées à 45°, matrices de vias,
 * désignateurs sérigraphiés, trous de fixation. Vue de dessus, +y image = -z monde.
 */
export function makeBoard({ wMM = 460, dMM = 340, px = 2048, seed = 41, zones = [] } = {}) {
  const rnd = mulberry32(seed);
  const mm = px / wMM;
  const W = px;
  const H = Math.round(dMM * mm);
  const albedo = canvas(W, H);
  const a = albedo.getContext('2d');
  const orm = canvas(W, H);
  const o = orm.getContext('2d');
  const hgt = canvas(W, H);
  const h = hgt.getContext('2d');

  a.fillStyle = '#16251d';
  a.fillRect(0, 0, W, H);
  addBlobs(a, W, H, rnd, 300, 40, 300, 'rgba(36,70,52,A)', 0.14);
  addBlobs(a, W, H, rnd, 160, 30, 200, 'rgba(0,0,0,A)', 0.2);
  o.fillStyle = 'rgb(255,150,0)';
  o.fillRect(0, 0, W, H);
  addBlobs(o, W, H, rnd, 220, 40, 220, 'rgba(255,200,0,A)', 0.2);
  addBlobs(o, W, H, rnd, 220, 40, 220, 'rgba(255,90,0,A)', 0.2);
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);

  // Pistes : segments orthogonaux et à 45°, très légèrement plus clairs et plus lisses que le masque.
  const trace = (x0, y0, x1, y1, w) => {
    a.strokeStyle = 'rgba(60,104,80,0.55)';
    a.lineWidth = w;
    a.beginPath(); a.moveTo(x0, y0); a.lineTo(x1, y1); a.stroke();
    h.strokeStyle = 'rgba(255,255,255,0.5)';
    h.lineWidth = w;
    h.beginPath(); h.moveTo(x0, y0); h.lineTo(x1, y1); h.stroke();
    o.strokeStyle = 'rgba(255,70,0,0.5)';
    o.lineWidth = w;
    o.beginPath(); o.moveTo(x0, y0); o.lineTo(x1, y1); o.stroke();
  };
  for (let i = 0; i < 1300; i++) {
    let x = rnd() * W, y = rnd() * H;
    const w = (0.12 + rnd() * 0.2) * mm;
    const segs = 2 + ((rnd() * 4) | 0);
    for (let k = 0; k < segs; k++) {
      const dir = (rnd() * 8) | 0;
      const ang = (dir * Math.PI) / 4;
      const len = (6 + rnd() * 30) * mm;
      const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
      trace(x, y, nx, ny, w);
      x = nx; y = ny;
    }
  }
  // Vias : petits anneaux dorés.
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = (0.22 + rnd() * 0.12) * mm;
    a.fillStyle = 'rgba(170,138,70,0.8)';
    a.beginPath(); a.arc(x, y, r, 0, Math.PI * 2); a.fill();
    o.fillStyle = 'rgb(255,70,255)';
    o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
    a.fillStyle = '#0a120e';
    a.beginPath(); a.arc(x, y, r * 0.4, 0, Math.PI * 2); a.fill();
  }
  // Désignateurs sérigraphiés.
  a.fillStyle = 'rgba(212,218,212,0.8)';
  a.font = `${Math.max(5, Math.round(1.3 * mm))}px "Arial Narrow", Arial, sans-serif`;
  const pref = ['C', 'R', 'L', 'U', 'J', 'Q', 'D', 'FB'];
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * W, y = rnd() * H;
    a.save();
    a.translate(x, y);
    if (rnd() < 0.5) a.rotate(Math.PI / 2);
    a.fillText(`${pref[(rnd() * pref.length) | 0]}${(rnd() * 3000) | 0}`, 0, 0);
    a.restore();
  }
  // Trous de fixation (anneau doré + noyau sombre).
  for (const [fx, fy] of [[0.04, 0.05], [0.96, 0.05], [0.04, 0.95], [0.96, 0.95], [0.5, 0.04], [0.5, 0.96]]) {
    const x = fx * W, y = fy * H;
    a.fillStyle = '#b4934e';
    a.beginPath(); a.arc(x, y, 3.2 * mm, 0, Math.PI * 2); a.fill();
    a.fillStyle = '#040605';
    a.beginPath(); a.arc(x, y, 1.9 * mm, 0, Math.PI * 2); a.fill();
    o.fillStyle = 'rgb(255,60,255)';
    o.beginPath(); o.arc(x, y, 3.2 * mm, 0, Math.PI * 2); o.fill();
  }
  // Zones d'occlusion douces sous les modules (halo sombre).
  for (const z of zones) {
    const x = W / 2 + z.x * mm, y = H / 2 + z.z * mm;
    const r = z.r * mm;
    o.save();
    o.globalCompositeOperation = 'multiply';
    const g = o.createRadialGradient(x, y, r * 0.55, x, y, r);
    g.addColorStop(0, 'rgb(120,255,255)');
    g.addColorStop(1, 'rgb(255,255,255)');
    o.fillStyle = g;
    o.fillRect(x - r, y - r, 2 * r, 2 * r);
    o.restore();
  }
  addPixelNoise(a, W, H, rnd, 3);
  addPixelNoise(o, W, H, rnd, 5, [1]);
  const normal = heightToNormal(h.getImageData(0, 0, W, H), 1.6);
  return { map: toTexture(albedo, { srgb: true, aniso: 8 }), orm: toTexture(orm, { aniso: 8 }), normal: toTexture(normal, { aniso: 8 }) };
}

/**
 * Façade de baie 0,6 x 2,2 m : empilement de serveurs 1U-4U avec perforations hexagonales,
 * poignées, LED. Retourne l'albédo et une carte émissive séparée (clignotement via addBlink).
 * px : largeur en pixels ; la hauteur suit le rapport 2,2 / 0,6.
 */
export function makeRackFront({ px = 768, seed = 51, ledColor = '#76b900' } = {}) {
  const rnd = mulberry32(seed);
  const W = px;
  const H = Math.round((px * 2.2) / 0.6);
  const mmpx = W / 600; // pixels par mm
  const alb = canvas(W, H);
  const a = alb.getContext('2d');
  const emi = canvas(W, H);
  const e = emi.getContext('2d');

  a.fillStyle = '#16191c';
  a.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  const U = 44.45 * mmpx;
  const y0 = 150 * mmpx; // marge basse
  const nU = 42;
  let u = 0;
  const ledPalette = [ledColor, '#d8e8ff', ledColor, '#4aa3ff', ledColor, '#ffffff'];
  while (u < nU) {
    const size = [1, 1, 2, 2, 2, 4][(rnd() * 6) | 0];
    const hU = Math.min(size, nU - u);
    const yTop = H - (y0 + (u + hU) * U);
    const h = hU * U - 3 * mmpx;
    const x0 = 10 * mmpx, w = W - 20 * mmpx;
    // Face du serveur : dégradé vertical subtil.
    const g = a.createLinearGradient(0, yTop, 0, yTop + h);
    const base = 30 + ((rnd() * 8) | 0);
    g.addColorStop(0, `rgb(${base + 8},${base + 10},${base + 13})`);
    g.addColorStop(1, `rgb(${base},${base + 2},${base + 5})`);
    a.fillStyle = g;
    a.fillRect(x0, yTop, w, h);
    // Filet métallique haut/bas.
    a.fillStyle = 'rgba(120,130,140,0.55)';
    a.fillRect(x0, yTop, w, 1.2 * mmpx);
    a.fillStyle = 'rgba(0,0,0,0.6)';
    a.fillRect(x0, yTop + h - 1.2 * mmpx, w, 1.2 * mmpx);
    // Zone de ventilation : grille à lamelles horizontales (lisible de loin, sans motif haute fréquence).
    const ventW = w * (0.55 + rnd() * 0.17);
    const ventX = rnd() < 0.5 ? x0 + 14 * mmpx : x0 + w - ventW - 14 * mmpx;
    a.fillStyle = '#07090b';
    a.fillRect(ventX, yTop + 3 * mmpx, ventW, h - 6 * mmpx);
    const slat = 4.2 * mmpx;
    for (let yy = yTop + 4 * mmpx; yy < yTop + h - 4 * mmpx; yy += slat) {
      a.fillStyle = 'rgba(70,78,88,0.55)';
      a.fillRect(ventX, yy, ventW, 0.9 * mmpx);
    }
    // Poignées : petites barres plus claires aux extrémités.
    a.fillStyle = 'rgba(70,78,86,0.9)';
    a.fillRect(x0 + 3 * mmpx, yTop + h * 0.2, 6 * mmpx, h * 0.6);
    a.fillRect(x0 + w - 9 * mmpx, yTop + h * 0.2, 6 * mmpx, h * 0.6);
    // LED d'état côté opposé aux perforations.
    const ledX0 = ventX < x0 + 20 * mmpx ? x0 + w - 60 * mmpx : x0 + 20 * mmpx;
    const nLed = 3 + ((rnd() * 7) | 0);
    for (let k = 0; k < nLed; k++) {
      const lx = ledX0 + (k % 8) * 5 * mmpx;
      const ly = yTop + h * (hU > 1 ? 0.25 + (Math.floor(k / 8) % 3) * 0.25 : 0.5);
      const col = ledPalette[(rnd() * ledPalette.length) | 0];
      a.fillStyle = '#05080a';
      a.beginPath(); a.arc(lx, ly, 2.6 * mmpx, 0, Math.PI * 2); a.fill();
      e.fillStyle = col;
      e.beginPath(); e.arc(lx, ly, 1.7 * mmpx, 0, Math.PI * 2); e.fill();
    }
    // Liseré vert d'accent sur certains serveurs (discret).
    if (rnd() < 0.22) {
      e.fillStyle = '#76b900';
      e.fillRect(x0 + 12 * mmpx, yTop + 2 * mmpx, w * 0.3, 1.0 * mmpx);
    }
    u += hU;
  }
  // Montants de baie sombres, à gauche et à droite.
  a.fillStyle = '#07080a';
  a.fillRect(0, 0, 8 * mmpx, H);
  a.fillRect(W - 8 * mmpx, 0, 8 * mmpx, H);
  addPixelNoise(a, W, H, rnd, 1.2);
  return { map: toTexture(alb, { srgb: true, aniso: 8 }), emissive: toTexture(emi, { srgb: true, aniso: 4 }) };
}

/** Dalle de faux plancher 0,6 m (texture de 1,2 m = 2x2 dalles, dont une perforée). */
export function makeRaisedFloor({ px = 1024, seed = 61 } = {}) {
  const rnd = mulberry32(seed);
  const alb = canvas(px, px);
  const a = alb.getContext('2d');
  const orm = canvas(px, px);
  const o = orm.getContext('2d');
  const hgt = canvas(px, px);
  const h = hgt.getContext('2d');
  const half = px / 2;
  a.fillStyle = '#1d2227';
  a.fillRect(0, 0, px, px);
  o.fillStyle = 'rgb(255,52,0)';
  o.fillRect(0, 0, px, px);
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, px, px);
  // Légères variations de teinte entre dalles.
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * half, y = Math.floor(i / 2) * half;
    const v = (rnd() - 0.5) * 8;
    a.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 100})`;
    a.fillRect(x, y, half, half);
  }
  addBlobs(a, px, px, rnd, 90, 20, 160, 'rgba(255,255,255,A)', 0.018);
  addBlobs(o, px, px, rnd, 90, 20, 160, 'rgba(255,100,0,A)', 0.18);
  // Dalle perforée (en haut à gauche) : grille de trous.
  const pitch = px / 48;
  for (let y = pitch / 2; y < half; y += pitch) {
    for (let x = pitch / 2; x < half; x += pitch) {
      a.fillStyle = '#030405';
      a.beginPath(); a.arc(x, y, pitch * 0.33, 0, Math.PI * 2); a.fill();
      h.fillStyle = 'rgb(20,20,20)';
      h.beginPath(); h.arc(x, y, pitch * 0.33, 0, Math.PI * 2); h.fill();
    }
  }
  // Joints entre dalles + bords métalliques.
  const seam = Math.max(2, px / 256);
  for (const p of [0, half, px]) {
    a.fillStyle = '#050607';
    a.fillRect(p - seam / 2, 0, seam, px);
    a.fillRect(0, p - seam / 2, px, seam);
    h.fillStyle = 'rgb(40,40,40)';
    h.fillRect(p - seam / 2, 0, seam, px);
    h.fillRect(0, p - seam / 2, px, seam);
  }
  addPixelNoise(a, px, px, rnd, 2);
  addPixelNoise(o, px, px, rnd, 4, [1]);
  const normal = heightToNormal(h.getImageData(0, 0, px, px), 1.4);
  return {
    map: toTexture(alb, { srgb: true, repeat: [1, 1], aniso: 8 }),
    orm: toTexture(orm, { repeat: [1, 1], aniso: 8 }),
    normal: toTexture(normal, { repeat: [1, 1], aniso: 8 }),
  };
}

/** Plancher de l'architecture interne : fine grille de métallisation + rectangles (émissif séparé). */
export function makeArchFloor({ px = 2048, wMM = 27, dMM = 31, seed = 71 } = {}) {
  const rnd = mulberry32(seed);
  const mm = px / wMM;
  const W = px;
  const H = Math.round(dMM * mm);
  const alb = canvas(W, H);
  const a = alb.getContext('2d');
  const emi = canvas(W, H);
  const e = emi.getContext('2d');
  a.fillStyle = '#05080a';
  a.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  // Grille fine (pas 0,08 mm) très discrète.
  e.strokeStyle = 'rgba(46,120,40,0.16)';
  e.lineWidth = 1;
  const pitch = 0.08 * mm;
  for (let x = 0; x < W; x += pitch) { e.beginPath(); e.moveTo(x, 0); e.lineTo(x, H); e.stroke(); }
  for (let y = 0; y < H; y += pitch) { e.beginPath(); e.moveTo(0, y); e.lineTo(W, y); e.stroke(); }
  // Rectangles de logique : contours lumineux, intensités variées.
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W, y = rnd() * H;
    const w = (0.1 + rnd() * 0.6) * mm, h = (0.1 + rnd() * 0.4) * mm;
    const k = rnd();
    e.strokeStyle = `rgba(${k < 0.1 ? '210,235,255' : '118,185,0'},${0.15 + rnd() * 0.5})`;
    e.lineWidth = 1;
    e.strokeRect(x, y, w, h);
    if (rnd() < 0.18) {
      e.fillStyle = `rgba(118,185,0,${0.06 + rnd() * 0.16})`;
      e.fillRect(x, y, w, h);
    }
  }
  return { map: toTexture(alb, { srgb: true, aniso: 8 }), emissive: toTexture(emi, { srgb: true, aniso: 8 }) };
}

/** Paroi de châssis 4U (0,86 x 0,175 m) : fentes de ventilation, étiquette, rivets. Albédo seulement. */
export function makeChassisPanel({ px = 1536, seed = 81 } = {}) {
  const rnd = mulberry32(seed);
  const W = px;
  const H = Math.round((px * 0.175) / 0.86);
  const c = canvas(W, H);
  const a = c.getContext('2d');
  a.fillStyle = '#9aa0a8';
  a.fillRect(0, 0, W, H);
  addBlobs(a, W, H, rnd, 60, 30, 200, 'rgba(255,255,255,A)', 0.05);
  addBlobs(a, W, H, rnd, 60, 30, 200, 'rgba(0,0,0,A)', 0.07);
  const mm = W / 860;
  // Fentes de ventilation : 3 rangées dans la moitié avant.
  a.fillStyle = '#15181b';
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 26; i++) {
      const x = (430 + 12 + i * 15) * mm, y = (40 + row * 38) * mm;
      a.beginPath();
      a.roundRect(x, y, 10 * mm, 6 * mm, 2.5 * mm);
      a.fill();
    }
  }
  // Étiquette (code-barres fictif).
  a.fillStyle = '#e8eaec';
  a.fillRect(120 * mm, 38 * mm, 120 * mm, 56 * mm);
  a.fillStyle = '#16191c';
  for (let i = 0; i < 48; i++) {
    const w = (0.8 + rnd() * 2.2) * mm;
    a.fillRect((126 + i * 2.35) * mm, 44 * mm, w, 26 * mm);
  }
  a.fillRect(126 * mm, 76 * mm, 60 * mm, 3 * mm);
  a.fillRect(126 * mm, 82 * mm, 40 * mm, 3 * mm);
  // Rivets.
  a.fillStyle = 'rgba(60,64,70,0.9)';
  for (let i = 0; i < 18; i++) {
    for (const y of [14 * mm, H - 14 * mm]) {
      a.beginPath();
      a.arc((40 + i * 46) * mm, y, 2.2 * mm, 0, Math.PI * 2);
      a.fill();
    }
  }
  addPixelNoise(a, W, H, rnd, 3);
  return toTexture(c, { srgb: true, aniso: 8 });
}
