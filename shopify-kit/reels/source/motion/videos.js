// Motion design « Pattoune » (12 s, 1080×1920). Coupes calées sur 120 BPM (un temps = 0,5 s).
(() => {
const { W, H, C, ctx, clamp, prog, easeOut, easeInOut, pop, fill, dots, sticker, bigText, spin, roundRect, kibble } = window.V;
const IMG = {};

/* ------------------------------------------------------------ Outils */
const lerp = (a, b, x) => a + (b - a) * x;
const easeIn = (x) => x * x * x;
const back = (x, s = 1.7) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2));
const elastic = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1);
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Empreinte de patte (coussinet + 4 doigts).
function paw(x, y, size, rot, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const s = size / 100;
  ctx.beginPath();
  ctx.ellipse(0, 18 * s, 30 * s, 25 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy, r] of [[-34, -16, 12], [-13, -36, 12.5], [13, -36, 12.5], [34, -16, 12]]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, dy * s, r * s, r * 1.25 * s, dx * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Carte photo carrée, bord encre + ombre décalée, avec échelle, rotation et opacité.
function tile(im, x, y, w, { rot = 0, scale = 1, alpha = 1, radius = 36, border = 7, shadow = 14 } = {}) {
  if (scale <= 0.001 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  roundRect(-w / 2 + shadow, -w / 2 + shadow, w, w, radius);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.save();
  roundRect(-w / 2, -w / 2, w, w, radius);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-w / 2, -w / 2, w, w);
  const k = Math.max(w / im.width, w / im.height);
  ctx.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k);
  ctx.restore();
  roundRect(-w / 2, -w / 2, w, w, radius);
  ctx.lineWidth = border;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

// Rayons de soleil qui tournent lentement.
function rays(cx, cy, t, color, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-90, -1600);
    ctx.lineTo(90, -1600);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Formes flottantes (cercles et pattes) en arrière-plan, parallaxe douce.
function floaters(t, color, n = 14, seed = 0) {
  for (let i = 0; i < n; i++) {
    const x = rnd(i + seed) * W;
    const y = ((rnd(i + seed + 50) * H - t * (40 + rnd(i + seed + 9) * 60)) % H + H) % H;
    const r = 10 + rnd(i + seed + 3) * 26;
    if (i % 3 === 0) paw(x, y, r * 2.2, rnd(i + seed) * 6, color, 0.5);
    else {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Titre qui glisse depuis un masque (lignes de texte, police d'affichage).
function maskTitle(lines, { y, size, color, p, align = 'center', x = W / 2, stroke = null }) {
  if (p <= 0) return;
  ctx.save();
  ctx.font = `800 ${size}px "Bricolage Grotesque"`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    const q = clamp(p * 1.4 - i * 0.25);
    const ly = y + (i - (lines.length - 1) / 2) * size * 1.0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ly - size * 0.62, W, size * 1.24);
    ctx.clip();
    const off = (1 - easeOut(q)) * size * 1.1;
    if (stroke) {
      ctx.lineWidth = size * 0.14;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke;
      ctx.strokeText(l, x, ly + off);
    }
    ctx.fillStyle = color;
    ctx.fillText(l, x, ly + off);
    ctx.restore();
  });
  ctx.restore();
}

// Volet circulaire.
function circleWipe(cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Colis dessiné.
function parcel(x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  roundRect(-60 + 8, -50 + 8, 120, 100, 14);
  ctx.fillStyle = '#000';
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
  roundRect(-60, -50, 120, 100, 14);
  ctx.fillStyle = '#d9a066';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.sun;
  ctx.fillRect(-12, -50, 24, 100);
  ctx.strokeRect(-12, -50, 24, 100);
  paw(30, 18, 34, 0.2, C.ink, 0.85);
  ctx.restore();
}

/* ------------------------------------------------------------ Scènes */
const PRODUCTS = ['puzzle', 'canne', 'peluche', 'balle', 'garnir', 'gamelle', 'brosse', 'peigne', 'kit'];

// 1. 0–1,5 s : la balle tombe, rebondit, projette des croquettes ; volet jaune depuis l'impact.
function s1(t) {
  fill(C.ink);
  dots('rgba(255,255,255,0.07)');
  const GY = 1180;
  let y;
  let sx = 1;
  let sy = 1;
  if (t < 0.5) y = lerp(-420, GY, easeIn(t / 0.5));
  else if (t < 1.0) {
    const u = (t - 0.5) / 0.5;
    y = GY - 520 * (1 - Math.pow(2 * u - 1, 2));
  } else y = GY;
  const sq = (a) => Math.max(0, 1 - Math.abs(t - a) / 0.09);
  const k = Math.max(sq(0.5), sq(1.0));
  sx = 1 + 0.22 * k;
  sy = 1 - 0.2 * k;
  // Ombre au sol.
  const h = clamp((GY - y) / 900);
  ctx.save();
  ctx.globalAlpha = 0.45 * (1 - h * 0.7);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(W / 2, GY + 230, 230 * (1 - h * 0.5), 34 * (1 - h * 0.5), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Croquettes projetées au premier impact.
  if (t > 0.5) {
    for (let i = 0; i < 16; i++) {
      const tt = t - 0.5;
      const a = -Math.PI * (0.12 + 0.76 * rnd(i + 3));
      const v = 900 + rnd(i + 8) * 900;
      const px = W / 2 + Math.cos(a) * v * tt;
      const py = GY + 160 + Math.sin(a) * v * tt + 2600 * tt * tt;
      if (py < H + 50) kibble(px, py, 16 + (i % 3) * 5, tt * (4 + i % 5));
    }
  }
  ctx.save();
  ctx.translate(W / 2, y + 230 * (1 - sy));
  ctx.scale(sx, sy);
  spin(t * 1.4, { x: 0, y: 0, size: 520 });
  ctx.restore();
  // Petit texte d'ambiance.
  const tp = prog(t, 0.1, 0.45);
  if (tp > 0) {
    ctx.save();
    ctx.globalAlpha = tp * (1 - prog(t, 1.0, 1.2));
    ctx.font = '700 46px "Bricolage Grotesque"';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.cream;
    ctx.letterSpacing = `${lerp(30, 10, easeOut(tp))}px`;
    ctx.fillText('PATTOUNE PRÉSENTE', W / 2, 420);
    ctx.restore();
  }
  // Volet jaune depuis le point d'impact.
  if (t > 1.0) circleWipe(W / 2, GY + 150, easeInOut(prog(t, 1.0, 1.5)) * 2300, C.sun);
}

// 2. 1,5–3 s : le logo arrive en ressort, rayons, pattes qui marchent, accroche.
function s2(t) {
  const lt = t - 1.5;
  fill(C.sun);
  rays(W / 2, 820, lt, '#fff', 0.16);
  dots('rgba(20,22,43,0.10)');
  // Pattes qui traversent l'écran en marchant.
  for (let i = 0; i < 9; i++) {
    const at = 0.25 + i * 0.12;
    const p = prog(lt, at, at + 0.18);
    if (p <= 0) continue;
    const x = 120 + i * 112;
    const y = 1640 - Math.sin(i * 0.5) * 60 + (i % 2 ? -38 : 38);
    paw(x, y, 70 * (1.4 - 0.4 * easeOut(p)), 1.2 + (i % 2 ? 0.25 : -0.25), C.ink, 0.85 * easeOut(p));
  }
  const p = back(prog(lt, 0.0, 0.55), 2.2);
  const im = IMG.shop;
  const s = 780;
  ctx.save();
  ctx.translate(W / 2, 820);
  ctx.rotate(lerp(-0.35, -0.035, easeOut(prog(lt, 0, 0.55))) + Math.sin(lt * 3) * 0.012);
  ctx.scale(p, p);
  roundRect(-s / 2 + 18, -s / 2 + 18, s, s, 60);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.save();
  roundRect(-s / 2, -s / 2, s, s, 60);
  ctx.clip();
  ctx.drawImage(im, -s / 2, -s / 2, s, s);
  ctx.restore();
  roundRect(-s / 2, -s / 2, s, s, 60);
  ctx.lineWidth = 9;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
  sticker('Jouets & accessoires pour chats et chiens', { y: 1370, size: 52, bg: C.paper, rot: 2, p: prog(lt, 0.45, 0.8), maxW: 1000 });
}

// 3. 3–5,5 s : mosaïque des 9 produits qui volent en place, puis repartent.
function s3(t) {
  const lt = t - 3.0;
  fill(C.cream);
  dots('rgba(20,22,43,0.08)');
  floaters(lt, 'rgba(255,194,58,0.55)', 12, 7);
  ctx.save();
  ctx.font = '700 34px "Bricolage Grotesque"';
  ctx.textAlign = 'center';
  ctx.fillStyle = C.pink;
  ctx.globalAlpha = prog(lt, 0.05, 0.3) * (1 - prog(lt, 2.15, 2.4));
  ctx.letterSpacing = '8px';
  ctx.fillText('— LA BOUTIQUE —', W / 2, 250);
  ctx.restore();
  maskTitle(['Ses jeux, ses soins,', 'ses souvenirs.'], { y: 390, size: 92, color: C.ink, p: prog(lt, 0.1, 0.6) * (1 - prog(lt, 2.15, 2.35)) });
  const zoom = 1 + 0.05 * easeInOut(prog(lt, 0.3, 2.2));
  ctx.save();
  ctx.translate(W / 2, 1120);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -1120);
  PRODUCTS.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tx = 210 + col * 330;
    const ty = 790 + row * 330;
    const a = rnd(i + 21) * Math.PI * 2;
    const fx = W / 2 + Math.cos(a) * 1500;
    const fy = 1120 + Math.sin(a) * 1700;
    const pin = back(prog(lt, 0.25 + i * 0.07, 0.8 + i * 0.07), 1.4);
    const pout = easeIn(prog(lt, 1.95 + (8 - i) * 0.035, 2.35 + (8 - i) * 0.035));
    const x = lerp(fx, tx, pin);
    const y = lerp(fy, ty, pin) - pout * 2200;
    const rot = lerp((rnd(i + 2) - 0.5) * 1.6, (rnd(i + 5) - 0.5) * 0.1, pin) + pout * (i % 2 ? 0.4 : -0.4);
    const bob = Math.sin(lt * 3 + i) * 6 * pin;
    tile(IMG[k], x, y + bob, 290, { rot, radius: 30, border: 6, shadow: 10 });
  });
  ctx.restore();
}

// 4. 5,5–8,5 s : trois volets par univers, cartes en éventail, glissement latéral.
const PANELS = [
  { title: ['Pour les', 'chats'], bg: C.pink, dark: false, items: ['puzzle', 'canne', 'peluche'] },
  { title: ['Pour les', 'chiens'], bg: C.cobalt, dark: true, items: ['garnir', 'balle', 'brosse'] },
  { title: ['Soin &', 'accessoires'], bg: C.mint, dark: false, items: ['peigne', 'gamelle', 'kit'] },
];
function panel(pi, lt, ox) {
  const P = PANELS[pi];
  ctx.save();
  ctx.translate(ox, 0);
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
  dots(P.dark ? 'rgba(255,255,255,0.12)' : 'rgba(20,22,43,0.10)');
  floaters(lt + pi, P.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.35)', 10, 30 + pi * 10);
  maskTitle(P.title, { y: 400, size: 150, color: P.dark ? C.sun : '#fff', stroke: C.ink, p: prog(lt, 0.05, 0.45) });
  const fan = [-0.2, 0, 0.2];
  const xs = [W / 2 - 250, W / 2, W / 2 + 250];
  const ys = [1150, 1080, 1150];
  [2, 0, 1].forEach((j) => {
    const p = back(prog(lt, 0.12 + j * 0.08, 0.55 + j * 0.08), 1.6);
    const sway = Math.sin(lt * 4 + j) * 0.02;
    const x = lerp(W / 2, xs[j], p);
    const y = lerp(1500, ys[j], p) + Math.sin(lt * 3 + j * 2) * 8;
    tile(IMG[P.items[j]], x, y, j === 1 ? 470 : 400, { rot: fan[j] * p + sway, scale: lerp(0.4, 1, p), alpha: clamp(p * 2) });
  });
  sticker(pi === 0 ? 'Chasser, guetter, mordiller' : pi === 1 ? 'Chercher, mâchouiller, jouer' : 'Pelage, repas, souvenirs', { y: 1560, size: 54, bg: C.paper, rot: -2, p: prog(lt, 0.4, 0.7), maxW: 960 });
  ctx.restore();
}
function s4(t) {
  const lt = t - 5.5;
  const i = Math.min(2, Math.floor(lt));
  const local = lt - i;
  // Glissement vers la gauche pendant les 0,18 dernières secondes de chaque volet.
  const sw = i < 2 ? easeInOut(prog(local, 0.82, 1.0)) : 0;
  // Le volet suivant commence à s'animer pendant le glissement (avance de 0,25 s sur l'horloge locale).
  panel(i, local + 0.25, -sw * W);
  if (i < 2 && sw > 0) panel(i + 1, local - 1 + 0.25, W - sw * W);
}

// 5. 8,5–10 s : jauge jusqu'à 25 €, colis qui avance, « Livraison offerte ».
function s5(t) {
  const lt = t - 8.5;
  fill(C.ink);
  dots('rgba(255,255,255,0.07)');
  maskTitle(['Livraison', 'offerte'], { y: 560, size: 160, color: C.sun, p: prog(lt, 0.05, 0.4) });
  const bx = 140;
  const bw = W - 280;
  const by = 1020;
  const fp = easeInOut(prog(lt, 0.25, 0.95));
  roundRect(bx, by - 30, bw, 60, 30);
  ctx.fillStyle = 'rgba(244,236,226,0.12)';
  ctx.fill();
  if (fp > 0) {
    roundRect(bx, by - 30, Math.max(60, bw * fp), 60, 30);
    ctx.fillStyle = C.mint;
    ctx.fill();
  }
  roundRect(bx, by - 30, bw, 60, 30);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(244,236,226,0.5)';
  ctx.stroke();
  parcel(bx + bw * fp, by - 110 - Math.abs(Math.sin(lt * 18)) * 14 * (fp < 1 ? 1 : 0), 1.1, Math.sin(lt * 18) * 0.06);
  // Compteur 0 → 25 €.
  ctx.save();
  ctx.font = '800 120px "Bricolage Grotesque"';
  ctx.textAlign = 'center';
  ctx.fillStyle = C.cream;
  const v = Math.round(25 * fp);
  ctx.fillText(`dès ${v} €`, W / 2, 1270);
  ctx.restore();
  // Confettis à l'arrivée.
  if (lt > 0.95) {
    const ct = lt - 0.95;
    for (let i = 0; i < 26; i++) {
      const a = rnd(i + 70) * Math.PI * 2;
      const vv = 500 + rnd(i + 71) * 900;
      const x = bx + bw + Math.cos(a) * vv * ct;
      const y = by + Math.sin(a) * vv * ct + 1200 * ct * ct;
      const col = [C.sun, C.pink, C.mint, '#fff'][i % 4];
      if (i % 4 === 0) paw(x, y, 40, a, col, clamp(1 - ct * 1.4));
      else {
        ctx.save();
        ctx.globalAlpha = clamp(1 - ct * 1.4);
        ctx.fillStyle = col;
        ctx.translate(x, y);
        ctx.rotate(a + ct * 8);
        ctx.fillRect(-9, -5, 18, 10);
        ctx.restore();
      }
    }
  }
  sticker('France · UE · Suisse', { y: 1450, size: 58, bg: C.mint, rot: 2, p: prog(lt, 0.95, 1.2) });
}

// 6. 10–12 s : fin sur le logo et l'adresse de la boutique.
function s6(t) {
  const lt = t - 10.0;
  fill(C.sun);
  rays(W / 2, 800, lt + 2, '#fff', 0.14);
  dots('rgba(20,22,43,0.10)');
  for (let i = 0; i < 6; i++) {
    const p = prog(lt, 0.3 + i * 0.08, 0.5 + i * 0.08);
    paw(140 + i * 160, 1660 + (i % 2 ? -30 : 30), 60, 0.3 * (i % 2 ? 1 : -1), C.ink, 0.8 * p);
  }
  const p = elastic(prog(lt, 0, 0.9));
  const s = 700;
  ctx.save();
  ctx.translate(W / 2, 800);
  ctx.scale(p, p);
  ctx.rotate(-0.03);
  roundRect(-s / 2 + 18, -s / 2 + 18, s, s, 56);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.save();
  roundRect(-s / 2, -s / 2, s, s, 56);
  ctx.clip();
  ctx.drawImage(IMG.shop, -s / 2, -s / 2, s, s);
  ctx.restore();
  roundRect(-s / 2, -s / 2, s, s, 56);
  ctx.lineWidth = 9;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
  sticker('pattounejouets.myshopify.com', { y: 1300, size: 50, bg: C.paper, rot: -2, p: prog(lt, 0.35, 0.65), maxW: 1000 });
  sticker('Livraison offerte dès 25 €', { y: 1440, size: 48, bg: C.pink, rot: 2, p: prog(lt, 0.5, 0.8), maxW: 1000 });
}

const VIDEOS = {
  motion: {
    duration: 12.0,
    draw(t) {
      if (t < 1.5) s1(t);
      else if (t < 3.0) s2(t);
      else if (t < 5.5) s3(t);
      else if (t < 8.5) s4(t);
      else if (t < 10.0) s5(t);
      else s6(t);
      // Coupe franche adoucie : petit éclair blanc sur les changements de scène.
      for (const at of [1.5, 3.0, 5.5, 8.5, 10.0]) {
        const d = Math.abs(t - at);
        if (d < 0.1) {
          ctx.fillStyle = `rgba(255,255,255,${(1 - d / 0.1) * 0.55})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    },
  },
};

window.setup = async (name) => {
  await document.fonts.load('800 80px "Bricolage Grotesque"');
  await document.fonts.load('700 40px "Bricolage Grotesque"');
  await Promise.all([...PRODUCTS, 'shop'].map(async (k) => { IMG[k] = await window.V.loadImage(`img/${k}.jpg`); }));
  await window.V.loadSpin('spin');
  return VIDEOS[name].duration;
};
window.drawAt = (name, t) => VIDEOS[name].draw(t);
})();
