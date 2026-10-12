// Petit moteur de vidéo : chaque image est dessinée sur un canvas 1080×1920
// en fonction du temps t (en secondes). Aucune animation CSS : le rendu est
// déterministe, image par image.
const W = 1080;
const H = 1920;
const C = { ink: '#14162b', sun: '#ffc23a', pink: '#ff7aa8', cobalt: '#2338e8', mint: '#4fd1a5', paper: '#f5f6fb', cream: '#f4ece2', kibble: '#8a4f22' };
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

/* ------------------------------------------------------------ Outils */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Petit rebond quand un autocollant apparaît.
const pop = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));

function loadImage(src) {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = ko;
    im.src = src;
  });
}

// Photo plein écran (recadrage « cover ») avec zoom lent.
function photo(im, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(W / im.width, H / im.height) * zoom;
  const w = im.width * s;
  const h = im.height * s;
  ctx.drawImage(im, (W - w) * fx, (H - h) * fy, w, h);
}

function fill(color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

function dots(color = 'rgba(20,22,43,0.12)', step = 44) {
  ctx.fillStyle = color;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(text, font, maxW) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  return lines;
}

// Autocollant de texte : fond coloré, bordure et ombre décalée façon site.
function sticker(text, { x = W / 2, y, size = 78, bg = C.sun, fg = C.ink, rot = -2, p = 1, maxW = 800, weight = 800, align = 'center' } = {}) {
  if (p <= 0) return;
  const font = `${weight} ${size}px "Bricolage Grotesque"`;
  const lines = wrap(text, font, maxW - 80);
  const lh = size * 1.06;
  ctx.font = font;
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const bw = tw + 76;
  const bh = lines.length * lh + 50;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  const sc = pop(p);
  ctx.scale(sc, sc);
  ctx.globalAlpha = clamp(p * 3);
  const bx = align === 'left' ? 0 : -bw / 2;
  roundRect(bx + 12, -bh / 2 + 12, bw, bh, 34);
  ctx.fillStyle = C.ink;
  ctx.fill();
  roundRect(bx, -bh / 2, bw, bh, 34);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, -bh / 2 + 25 + lh * (i + 0.5) + size * 0.04));
  ctx.restore();
}

// Grand texte libre avec contour, pour les titres.
function bigText(lines, { y, size = 120, color = C.ink, stroke = null, p = 1, rot = 0 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate((rot * Math.PI) / 180);
  const sc = pop(p);
  ctx.scale(sc, sc);
  ctx.globalAlpha = clamp(p * 3);
  ctx.font = `800 ${size}px "Bricolage Grotesque"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    const ly = (i - (lines.length - 1) / 2) * size * 1.02;
    if (stroke) {
      ctx.lineWidth = size * 0.14;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke;
      ctx.strokeText(l, 0, ly);
    }
    ctx.fillStyle = color;
    ctx.fillText(l, 0, ly);
  });
  ctx.restore();
}

// Croquette dessinée.
function kibble(x, y, r, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.kibble;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

// Pluie de croquettes (positions pseudo-aléatoires stables).
function rain(t, t0, n = 18, speed = 900) {
  for (let i = 0; i < n; i++) {
    const seed = Math.sin(i * 91.7) * 1000;
    const rx = (seed - Math.floor(seed)) * W;
    const delay = ((i * 0.37) % 1.6);
    const tt = t - t0 - delay;
    if (tt < 0) continue;
    const y = -60 + tt * speed;
    if (y > H + 60) continue;
    kibble(rx, y, 22 + (i % 3) * 6, tt * (2 + (i % 4)));
  }
}

// Balle qui roule (images issues du rendu Blender).
let SPIN = [];
async function loadSpin(base, n = 90) {
  SPIN = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`${base}/f_${String(i + 1).padStart(4, '0')}.png`)));
}
function spin(t, { x = W / 2, y = H / 2, size = 900, fps = 30 } = {}) {
  if (!SPIN.length) return;
  const im = SPIN[Math.floor(t * fps) % SPIN.length];
  ctx.drawImage(im, x - size / 2, y - size / 2, size, size);
}

// Carte photo encadrée, légèrement inclinée.
function card(im, { x, y, w, rot = -3, p = 1 } = {}) {
  if (p <= 0) return;
  const h = w;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  const sc = pop(p);
  ctx.scale(sc, sc);
  roundRect(-w / 2 + 16, -h / 2 + 16, w, h, 44);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.save();
  roundRect(-w / 2, -h / 2, w, h, 44);
  ctx.clip();
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
  roundRect(-w / 2, -h / 2, w, h, 44);
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

// Petite marque Pattoune en haut.
function brand(p = 1) {
  sticker('Pattoune', { y: 200, size: 44, bg: C.paper, rot: -3, maxW: 400, p });
}

// Fondu au noir/blanc entre deux plans.
function flash(t, at, dur = 0.18) {
  const d = Math.abs(t - at);
  if (d > dur) return;
  ctx.fillStyle = `rgba(255,255,255,${(1 - d / dur) * 0.85})`;
  ctx.fillRect(0, 0, W, H);
}

window.V = { W, H, C, ctx, clamp, prog, easeOut, easeInOut, pop, loadImage, photo, fill, dots, sticker, bigText, kibble, rain, loadSpin, spin, card, brand, flash, roundRect };
