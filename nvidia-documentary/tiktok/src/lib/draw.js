// Textures procédurales (canvas 2D) pour les plans de la vidéo verticale. Déterministes : graine fixe.
import * as THREE from 'three';
import { mulberry32 } from '../../../engine/rng.js';
import { toTexture } from '../../../engine/textures.js';

export function cvs(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Wafer de 300 mm vu de dessus : champs de masquage rectangulaires remplis de puces, bord biseauté et
 * encoche. Retourne { map, orm } (ORM : R = AO, G = rugosité, B = métallicité).
 */
export function makeWaferTextures({ px = 2048, seed = 7 } = {}) {
  const rnd = mulberry32(seed);
  const alb = cvs(px);
  const a = alb.getContext('2d');
  const orm = cvs(px);
  const o = orm.getContext('2d');
  const c = px / 2;
  const R = px * 0.495;
  // Fond : silicium poli, légèrement bleuté.
  a.fillStyle = '#566277';
  a.fillRect(0, 0, px, px);
  o.fillStyle = 'rgb(255,46,255)';
  o.fillRect(0, 0, px, px);
  // Champs de masquage (reticle fields) : grille régulière ; chaque champ contient 3x4 puces.
  const fw = px * 0.092, fh = px * 0.072;
  a.save();
  a.beginPath(); a.arc(c, c, R * 0.965, 0, Math.PI * 2); a.clip();
  o.save();
  o.beginPath(); o.arc(c, c, R * 0.965, 0, Math.PI * 2); o.clip();
  for (let gy = -7; gy <= 7; gy++) {
    for (let gx = -6; gx <= 6; gx++) {
      const x = c + (gx - 0.5) * fw, y = c + (gy - 0.5) * fh;
      const inside = Math.hypot(x + fw / 2 - c, y + fh / 2 - c) < R * 0.985;
      if (!inside) continue;
      const hue = 214 + (rnd() - 0.5) * 36 + gx * 1.2;
      const lum = 34 + rnd() * 14;
      a.fillStyle = `hsl(${hue},${32 + rnd() * 22}%,${lum}%)`;
      a.fillRect(x + 2, y + 2, fw - 4, fh - 4);
      // Puces à l'intérieur du champ.
      const cols = 3, rows = 4;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const dx = x + 4 + (i * (fw - 8)) / cols, dy = y + 4 + (j * (fh - 8)) / rows;
          const g = a.createLinearGradient(dx, dy, dx + (fw - 8) / cols, dy + (fh - 8) / rows);
          g.addColorStop(0, `hsla(${hue + 18},40%,${lum + 16}%,0.9)`);
          g.addColorStop(1, `hsla(${hue - 14},45%,${lum + 3}%,0.9)`);
          a.fillStyle = g;
          a.fillRect(dx + 1, dy + 1, (fw - 8) / cols - 2, (fh - 8) / rows - 2);
        }
      }
      // Lignes de découpe sombres.
      a.strokeStyle = 'rgba(8,12,20,0.85)';
      a.lineWidth = 1.2;
      a.strokeRect(x + 2, y + 2, fw - 4, fh - 4);
      // Rugosité un peu plus élevée dans les champs (diffraction).
      o.fillStyle = `rgb(255,${70 + Math.floor(rnd() * 30)},255)`;
      o.fillRect(x + 2, y + 2, fw - 4, fh - 4);
    }
  }
  a.restore();
  o.restore();
  // Bord : anneau d'exclusion lisse + biseau.
  a.strokeStyle = '#8c98ad'; a.lineWidth = px * 0.012;
  a.beginPath(); a.arc(c, c, R * 0.985, 0, Math.PI * 2); a.stroke();
  // Encoche.
  a.fillStyle = '#0a0d12';
  a.beginPath(); a.arc(c, c + R * 1.0, px * 0.012, 0, Math.PI * 2); a.fill();
  // Marquage laser près de l'encoche (illisible volontairement).
  a.fillStyle = 'rgba(200,210,230,0.5)';
  for (let i = 0; i < 14; i++) a.fillRect(c - px * 0.07 + i * px * 0.01, c + R * 0.9, px * 0.006, px * 0.014);
  return { map: toTexture(alb, { srgb: true, aniso: 8 }), orm: toTexture(orm, { aniso: 8 }) };
}

/**
 * Plan de masse d'une puce de calcul (dessin au trait lumineux, fond transparent) : puce centrale en grille de
 * blocs, piles mémoire de part et d'autre, réseau de liaisons. Générique : aucune caractéristique réelle.
 * @returns {{ map: THREE.CanvasTexture, aspect: number }}
 */
export function makeFloorplan({ px = 2048, seed = 3, layer = 'outline' } = {}) {
  const rnd = mulberry32(seed);
  const W = px, H = Math.round(px * 0.8);
  const k = cvs(W, H);
  const g = k.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  const line = (w, alpha, blur = 0) => {
    g.strokeStyle = `rgba(150,230,40,${alpha})`;
    g.shadowColor = 'rgba(118,185,0,0.9)';
    g.shadowBlur = blur;
    g.lineWidth = w;
  };
  const rect = (x, y, w, h) => g.strokeRect(x, y, w, h);
  const mx = W * 0.06, my = H * 0.08;
  const dieX = W * 0.22, dieW = W * 0.56, dieY = H * 0.14, dieH = H * 0.72;
  if (layer === 'outline') {
    line(4, 1, 18);
    rect(mx, my, W - 2 * mx, H - 2 * my);                 // substrat
    rect(W * 0.17, H * 0.12, W * 0.66, H * 0.76);          // interposeur
    rect(dieX, dieY, dieW, dieH);                          // puce de calcul
    // Piles mémoire : 3 de chaque côté.
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 3; i++) {
        const x = s === 0 ? W * 0.075 : W * 0.795, y = H * 0.14 + i * H * 0.245;
        rect(x, y, W * 0.105, H * 0.2);
        line(2, 0.7, 8);
        for (let j = 1; j < 6; j++) { g.beginPath(); g.moveTo(x, y + (j * H * 0.2) / 6); g.lineTo(x + W * 0.105, y + (j * H * 0.2) / 6); g.stroke(); }
        line(4, 1, 18);
      }
    }
  } else {
    // Calcul : grille de blocs + bus.
    line(2.4, 0.9, 10);
    const cols = 12, rows = 9;
    const cw = dieW / cols, ch = dieH / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (rnd() < 0.06) continue;
        rect(dieX + i * cw + cw * 0.12, dieY + j * ch + ch * 0.14, cw * 0.76, ch * 0.72);
      }
    }
    line(1.6, 0.55, 6);
    for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(dieX, dieY + j * ch); g.lineTo(dieX + dieW, dieY + j * ch); g.stroke(); }
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(dieX + i * cw, dieY); g.lineTo(dieX + i * cw, dieY + dieH); g.stroke(); }
    // Liaisons vers les piles mémoire.
    line(1.6, 0.6, 6);
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 3; i++) {
        const y0 = H * 0.14 + i * H * 0.245 + H * 0.1;
        for (let j = 0; j < 7; j++) {
          const yy = y0 + (j - 3) * H * 0.018;
          g.beginPath();
          g.moveTo(s === 0 ? W * 0.18 : W * 0.795, yy);
          g.lineTo(s === 0 ? dieX : dieX + dieW, yy);
          g.stroke();
        }
      }
    }
    // Plots périphériques.
    g.shadowBlur = 8;
    for (let i = 0; i < 96; i++) {
      const x = mx + ((W - 2 * mx) * (i + 0.5)) / 96;
      g.fillStyle = 'rgba(160,235,60,0.8)';
      g.fillRect(x - 3, my + 10, 6, 14);
      g.fillRect(x - 3, H - my - 24, 6, 14);
    }
  }
  const t = new THREE.CanvasTexture(k);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return { map: t, aspect: W / H };
}

/** Motif de routage orthogonal (lignes de métallisation) : { map } avec alpha = lignes. */
export function makeRouting({ px = 1024, seed = 5, pitch = 18, density = 0.55, color = '#ffffff', lineW = 3 } = {}) {
  const rnd = mulberry32(seed);
  const k = cvs(px);
  const g = k.getContext('2d');
  g.clearRect(0, 0, px, px);
  g.strokeStyle = color;
  g.lineWidth = lineW;
  g.lineCap = 'square';
  const n = Math.floor(px / pitch);
  for (let i = 0; i < n; i++) {
    let x = 0;
    while (x < px) {
      const len = (2 + Math.floor(rnd() * 14)) * pitch;
      if (rnd() < density) { g.beginPath(); g.moveTo(x, i * pitch + pitch / 2); g.lineTo(Math.min(px, x + len), i * pitch + pitch / 2); g.stroke(); }
      x += len + pitch * (1 + Math.floor(rnd() * 3));
    }
    let y = 0;
    while (y < px) {
      const len = (2 + Math.floor(rnd() * 10)) * pitch;
      if (rnd() < density * 0.7) { g.beginPath(); g.moveTo(i * pitch + pitch / 2, y); g.lineTo(i * pitch + pitch / 2, Math.min(px, y + len)); g.stroke(); }
      y += len + pitch * (1 + Math.floor(rnd() * 4));
    }
  }
  const t = new THREE.CanvasTexture(k);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return { map: t };
}

/** Motifs alpha génériques pour couches translucides : 'dots', 'tiles', 'rings', 'grid'. */
export function makePattern(kind, { px = 1024, seed = 9 } = {}) {
  const rnd = mulberry32(seed);
  const k = cvs(px);
  const g = k.getContext('2d');
  g.clearRect(0, 0, px, px);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  if (kind === 'dots') {
    const pitch = px / 40;
    for (let y = pitch / 2; y < px; y += pitch) for (let x = pitch / 2; x < px; x += pitch) {
      const r = pitch * (0.08 + rnd() * 0.22);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'tiles') {
    const n = 8, p = px / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (rnd() < 0.18) continue;
      g.lineWidth = 5;
      const x = i * p + p * 0.1, y = j * p + p * 0.1, w = p * 0.8, h = p * 0.8, r = p * 0.12;
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      g.stroke();
      if (rnd() < 0.35) { g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1; }
    }
  } else if (kind === 'rings') {
    g.lineWidth = 4;
    for (let r = px * 0.06; r < px * 0.5; r += px * 0.04) {
      g.beginPath();
      const a0 = rnd() * Math.PI * 2, a1 = a0 + Math.PI * (0.5 + rnd() * 1.3);
      g.arc(px / 2, px / 2, r, a0, a1);
      g.stroke();
    }
  } else {
    g.lineWidth = 3;
    const n = 32, p = px / n;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * p, 0); g.lineTo(i * p, px); g.stroke(); g.beginPath(); g.moveTo(0, i * p); g.lineTo(px, i * p); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(k);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return { map: t };
}
