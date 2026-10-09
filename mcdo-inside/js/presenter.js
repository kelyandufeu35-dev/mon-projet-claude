/* Présentateur « réaliste stylisé » — personnage original, dessiné en canvas 2D (aucun outil externe).
   Animation déterministe en fonction du temps : respiration, clignements, regard, balancement de tête,
   synchronisation labiale (enveloppe audio PRES_ENV), salut de la main, entrée/sortie. */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const eoutB = (u) => { u = clamp(u, 0, 1); const c = 1.5; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

  const CFG = Object.assign({ start: 0.15, voiceStart: 0.15, end: 3.5, waveAt: 2.75 }, window.PRES_CFG || {});

  function env(t) {
    const E = window.PRES_ENV; if (!E) return 0;
    const i = (t - CFG.voiceStart) * E.fps; if (i < 0 || i >= E.d.length - 1) return 0;
    let s = 0, n = 0; for (let k = -2; k <= 2; k++) { const j = Math.round(i) + k; if (j >= 0 && j < E.d.length) { s += E.d[j]; n++; } }
    return clamp(s / n, 0, 1.15);
  }
  const blink = (t) => { const T = 2.35, ph = (t + 0.4) % T, b = ph / 0.16; return b < 1 ? Math.abs(1 - 2 * b) : 1; };

  function grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((s) => g.addColorStop(s[0], s[1])); return g; }
  function rgrad(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s) => g.addColorStop(s[0], s[1])); return g; }

  const SKIN = ["#F6CDAA", "#E9B48E", "#CF9168"];
  function facePath(ctx) { ctx.beginPath(); ctx.moveTo(0, -535); ctx.bezierCurveTo(98, -535, 120, -470, 115, -408); ctx.bezierCurveTo(110, -342, 72, -288, 0, -283); ctx.bezierCurveTo(-72, -288, -110, -342, -115, -408); ctx.bezierCurveTo(-120, -470, -98, -535, 0, -535); ctx.closePath(); }

  function drawBody(ctx, t, wave) {
    const br = 1 + 0.006 * Math.sin(t * 2.1);
    ctx.save(); ctx.scale(1, br);
    // bras gauche (repos)
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = grad(ctx, -300, -200, -200, 0, [[0, "#26385A"], [1, "#1B2A45"]]); ctx.lineWidth = 86;
    ctx.beginPath(); ctx.moveTo(-190, -235); ctx.quadraticCurveTo(-268, -120, -272, 330); ctx.stroke(); ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-232, -200); ctx.quadraticCurveTo(-232, -100, -234, 330); ctx.stroke();
    // torse
    ctx.beginPath(); ctx.moveTo(-292, 330); ctx.lineTo(-282, -150); ctx.bezierCurveTo(-278, -225, -225, -262, -150, -274); ctx.lineTo(-62, -292); ctx.lineTo(62, -292); ctx.lineTo(150, -274); ctx.bezierCurveTo(225, -262, 278, -225, 282, -150); ctx.lineTo(292, 330); ctx.closePath();
    ctx.fillStyle = grad(ctx, -290, -280, 290, 40, [[0, "#2E4470"], [0.55, "#223555"], [1, "#16233B"]]); ctx.fill();
    // chemise
    ctx.beginPath(); ctx.moveTo(-70, -292); ctx.lineTo(0, -150); ctx.lineTo(70, -292); ctx.closePath(); ctx.fillStyle = grad(ctx, 0, -292, 0, -150, [[0, "#FFFFFF"], [1, "#E4E9F0"]]); ctx.fill();
    // t-shirt col rond
    ctx.beginPath(); ctx.moveTo(-60, -292); ctx.quadraticCurveTo(0, -215, 60, -292); ctx.lineTo(70, -292); ctx.lineTo(0, -150); ctx.lineTo(-70, -292); ctx.closePath(); ctx.fillStyle = "#F6F8FB"; ctx.fill();
    // revers
    ctx.beginPath(); ctx.moveTo(-74, -292); ctx.lineTo(-4, -140); ctx.lineTo(-52, -118); ctx.lineTo(-135, -262); ctx.closePath(); ctx.fillStyle = grad(ctx, -135, -262, -4, -140, [[0, "#3A5282"], [1, "#1D2D4C"]]); ctx.fill();
    ctx.beginPath(); ctx.moveTo(74, -292); ctx.lineTo(4, -140); ctx.lineTo(52, -118); ctx.lineTo(135, -262); ctx.closePath(); ctx.fillStyle = grad(ctx, 135, -262, 4, -140, [[0, "#2B3F66"], [1, "#16233B"]]); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-74, -292); ctx.lineTo(-4, -140); ctx.moveTo(74, -292); ctx.lineTo(4, -140); ctx.stroke();
    // ombre épaule / lumière
    ctx.fillStyle = rgrad(ctx, -150, -250, 10, 220, [[0, "rgba(255,255,255,0.14)"], [1, "rgba(255,255,255,0)"]]); ctx.fillRect(-300, -300, 600, 600);
    ctx.restore();

    // bras droit (salut)
    const w = wave; // 0 repos, 1 main levée
    const sx = 195, sy = -235;
    const sway = Math.sin(t * 9) * 0.5 * w;
    const ex = lerp(268, 300, w), ey = lerp(-110, -180, w);
    const hx = lerp(272, 318 + sway * 34, w), hy = lerp(330, -372 + Math.abs(sway) * 8, w);
    ctx.strokeStyle = grad(ctx, sx, sy, ex, ey, [[0, "#2B3F66"], [1, "#1B2A45"]]); ctx.lineWidth = 86;
    ctx.beginPath(); ctx.moveTo(sx - 10, sy + 6); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = grad(ctx, ex, ey, hx, hy, [[0, "#24365A"], [1, "#1B2A45"]]); ctx.lineWidth = lerp(86, 62, w); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, lerp(hy, hy + 52, w)); ctx.stroke(); if (w > 0.02) { ctx.strokeStyle = "#F4F6FA"; ctx.lineWidth = 10; ctx.globalAlpha = w; ctx.beginPath(); ctx.moveTo(hx - 31, hy + 54); ctx.lineTo(hx + 31, hy + 54); ctx.stroke(); ctx.globalAlpha = 1; }
    // main
    if (w > 0.02) {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(sway * 0.5); ctx.globalAlpha = clamp(w * 2, 0, 1);
      const sk = grad(ctx, -30, -40, 30, 50, [[0, SKIN[0]], [1, SKIN[2]]]);
      ctx.strokeStyle = sk; ctx.lineWidth = 15; ctx.lineCap = "round";
      [[-24, -34, -34, -2], [-9, -46, -12, -2], [8, -46, 11, -2], [24, -38, 33, -2]].forEach((f) => { ctx.beginPath(); ctx.moveTo(f[2] * 0.6, 4); ctx.lineTo(f[0], f[1] - 12); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(-26, 10); ctx.lineTo(-52, -6); ctx.stroke();
      ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(0, 14, 36, 40, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(160,90,50,0.18)"; ctx.beginPath(); ctx.ellipse(8, 26, 22, 22, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
  }

  function drawHead(ctx, t, m, p) {
    // cou
    ctx.fillStyle = grad(ctx, 0, -310, 0, -250, [[0, "#C98E66"], [1, "#E4AD86"]]); ctx.fillRect(-50, -312, 100, 70);
    ctx.fillStyle = "rgba(90,40,20,0.28)"; ctx.beginPath(); ctx.ellipse(0, -296, 62, 22, 0, 0, 6.2832); ctx.fill();
    // oreilles
    [-1, 1].forEach((s) => { ctx.fillStyle = grad(ctx, s * 100, -440, s * 135, -380, [[0, SKIN[1]], [1, SKIN[2]]]); ctx.beginPath(); ctx.ellipse(s * 116, -408, 17, 33, s * 0.1, 0, 6.2832); ctx.fill(); ctx.fillStyle = "rgba(150,70,50,0.35)"; ctx.beginPath(); ctx.ellipse(s * 118, -408, 7, 18, 0, 0, 6.2832); ctx.fill(); });
    // visage
    facePath(ctx); ctx.fillStyle = rgrad(ctx, -34, -470, 20, 190, [[0, SKIN[0]], [0.6, SKIN[1]], [1, SKIN[2]]]); ctx.fill();
    ctx.save(); facePath(ctx); ctx.clip();
    ctx.fillStyle = grad(ctx, 0, -400, 0, -283, [[0, "rgba(60,30,15,0)"], [1, "rgba(60,30,15,0.26)"]]); ctx.fillRect(-130, -400, 260, 130); // mâchoire
    ctx.fillStyle = rgrad(ctx, 0, -318, 10, 120, [[0, "rgba(40,28,22,0)"], [0.45, "rgba(40,28,22,0.10)"], [0.8, "rgba(40,28,22,0.08)"], [1, "rgba(40,28,22,0)"]]); ctx.beginPath(); ctx.ellipse(0, -318, 130, 110, 0, 0, 6.2832); ctx.fill(); // barbe de 3 jours
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.ellipse(-52, -470, 36, 54, -0.3, 0, 6.2832); ctx.fill(); // lumière front
    [-1, 1].forEach((s) => { ctx.fillStyle = "rgba(220,100,90,0.17)"; ctx.beginPath(); ctx.ellipse(s * 62, -366, 34, 22, 0, 0, 6.2832); ctx.fill(); });
    ctx.restore();
    // nez
    ctx.strokeStyle = "rgba(120,60,35,0.35)"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-10, -430); ctx.quadraticCurveTo(-20, -385, -22, -362); ctx.stroke();
    ctx.fillStyle = "rgba(120,60,35,0.30)"; ctx.beginPath(); ctx.ellipse(-12, -356, 8, 5, 0.2, 0, 6.2832); ctx.ellipse(12, -356, 8, 5, -0.2, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "rgba(120,60,35,0.4)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, -362); ctx.quadraticCurveTo(0, -342, 24, -362); ctx.stroke();
    ctx.fillStyle = "rgba(255,240,225,0.28)"; ctx.beginPath(); ctx.ellipse(2, -374, 7, 11, 0, 0, 6.2832); ctx.fill();
    // yeux
    const bl = blink(t), lx = Math.sin(t * 0.7) * 2.5, ly = Math.sin(t * 0.43) * 1.5;
    [-1, 1].forEach((s) => {
      const cx = s * 46, cy = -423;
      ctx.fillStyle = "rgba(120,70,45,0.18)"; ctx.beginPath(); ctx.ellipse(cx, cy - 6, 30, 17, 0, 0, 6.2832); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 22, Math.max(0.8, 12.5 * bl), 0, 0, 6.2832); ctx.clip();
      ctx.fillStyle = "#FBFBFA"; ctx.fillRect(cx - 24, cy - 14, 48, 28);
      ctx.fillStyle = rgrad(ctx, cx + lx, cy + ly, 1, 11, [[0, "#6B4326"], [0.7, "#4A2C18"], [1, "#2B170B"]]); ctx.beginPath(); ctx.arc(cx + lx, cy + ly, 10.5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#0B0605"; ctx.beginPath(); ctx.arc(cx + lx, cy + ly, 4.8, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(cx + lx - 3.5, cy + ly - 4, 2.8, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(60,30,20,0.28)"; ctx.fillRect(cx - 24, cy - 14, 48, 6 + (1 - bl) * 10);
      ctx.restore();
      ctx.strokeStyle = "#2A1A12"; ctx.lineWidth = 4.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(cx, cy, 22, Math.max(0.8, 12.5 * bl), 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
      ctx.strokeStyle = "rgba(120,60,40,0.4)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy + 3, 21, 11 * bl, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    });
    // sourcils
    const lift = 3 + m * 9 + p.brow * 8;
    ctx.strokeStyle = "#2B1B12"; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-72, -446 - lift * 0.5); ctx.quadraticCurveTo(-48, -462 - lift, -20, -450 - lift * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(72, -446 - lift * 0.5); ctx.quadraticCurveTo(48, -462 - lift, 20, -450 - lift * 0.6); ctx.stroke();
    // bouche
    const open = clamp(m, 0, 1) * 0.95, mw = 42 + p.smile * 6 - open * 8 * (0.5 + 0.5 * Math.sin(t * 14)), my = -318, hOpen = open * 36, up = 7 + p.smile * 7;
    if (hOpen > 1.5) {
      ctx.beginPath(); ctx.moveTo(-mw, my - up * 0.2); ctx.quadraticCurveTo(0, my - 7, mw, my - up * 0.2); ctx.quadraticCurveTo(mw * 0.7, my + hOpen + 8, 0, my + hOpen + 10); ctx.quadraticCurveTo(-mw * 0.7, my + hOpen + 8, -mw, my - up * 0.2); ctx.closePath();
      ctx.fillStyle = "#3A1010"; ctx.fill(); ctx.save(); ctx.clip();
      ctx.fillStyle = "#FDFBF7"; ctx.fillRect(-mw, my - 8, mw * 2, Math.min(hOpen * 0.55, 13) + 8);
      ctx.fillStyle = "#C2575C"; ctx.beginPath(); ctx.ellipse(0, my + hOpen + 6, mw * 0.55, hOpen * 0.5, 0, 0, 6.2832); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "#B8605C"; ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(-mw, my - up * 0.2); ctx.quadraticCurveTo(0, my - 9, mw, my - up * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-mw, my - up * 0.2); ctx.quadraticCurveTo(-mw * 0.7, my + hOpen + 8, 0, my + hOpen + 10); ctx.quadraticCurveTo(mw * 0.7, my + hOpen + 8, mw, my - up * 0.2); ctx.stroke();
    } else {
      ctx.strokeStyle = "#B8605C"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-mw, my - up); ctx.quadraticCurveTo(0, my + 9 + p.smile * 6, mw, my - up); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-mw * 0.5, my + 4); ctx.quadraticCurveTo(0, my + 12 + p.smile * 4, mw * 0.5, my + 4); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(110,50,30,0.28)"; ctx.lineWidth = 3.5; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(s * (mw + 8), my - up - 2); ctx.quadraticCurveTo(s * (mw + 18), my - 6, s * (mw + 10), my + 8); ctx.stroke(); });
    // cheveux
    ctx.beginPath(); ctx.moveTo(-122, -405); ctx.bezierCurveTo(-136, -540, -66, -584, 14, -580); ctx.bezierCurveTo(88, -578, 140, -540, 122, -405); ctx.bezierCurveTo(116, -450, 106, -478, 84, -494); ctx.bezierCurveTo(52, -470, 6, -492, -38, -482); ctx.bezierCurveTo(-70, -474, -96, -468, -112, -438); ctx.closePath();
    ctx.fillStyle = grad(ctx, -120, -580, 120, -440, [[0, "#4A3222"], [0.5, "#2C1D13"], [1, "#1A110B"]]); ctx.fill();
    ctx.strokeStyle = "rgba(255,230,200,0.22)"; ctx.lineWidth = 5; ctx.lineCap = "round";
    [[-80, -540, -20, -566], [-30, -552, 40, -568], [30, -556, 90, -530], [-100, -510, -60, -545]].forEach((h) => { ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo((h[0] + h[2]) / 2, Math.min(h[1], h[3]) - 8, h[2], h[3]); ctx.stroke(); });
    // pattes
    [-1, 1].forEach((s) => { ctx.fillStyle = "#24160E"; ctx.beginPath(); ctx.moveTo(s * 112, -440); ctx.lineTo(s * 124, -396); ctx.lineTo(s * 106, -388); ctx.lineTo(s * 100, -436); ctx.closePath(); ctx.fill(); });
  }

  function layout(W, H) {
    return W < H ? { s: 1.5, x: W * 0.5, y: H - 150, disc: [W * 0.5, H - 560, 720] } : { s: H / 720 * 0.9, x: W * 0.22, y: H + 40, disc: [W * 0.22, H * 0.55, H * 0.7] };
  }

  window.PRES = {
    cfg: CFG,
    draw(ctx, t, W, H) {
      if (t < CFG.start - 0.1 || t > CFG.end + 0.7) return;
      const L = layout(W, H), uIn = eoutB((t - CFG.start) / 0.55), uOut = sm((t - CFG.end) / 0.55);
      const vis = uIn * (1 - uOut); if (vis <= 0.01) return;
      const m = env(t), wave = sm((t - CFG.waveAt) / 0.3) * (1 - sm((t - CFG.end + 0.1) / 0.3)) + 0, smile = 0.3 + 0.7 * sm((t - CFG.waveAt) / 0.4);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      // voile crème : masque la scène derrière le présentateur
      ctx.globalAlpha = clamp(vis * 1.6, 0, 1) * (1 - uOut) * 0.97; ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, "#FFF6D8"], [1, "#FFE08A"]]); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      // fond : disque lumineux
      const [dx, dy, dr] = L.disc; ctx.globalAlpha = clamp(vis * 1.4, 0, 1) * (1 - uOut);
      const yo = (1 - uIn) * 700 + uOut * 800;
      ctx.fillStyle = rgrad(ctx, dx, dy + yo * 0.2, dr * 0.15, dr, [[0, "rgba(255,255,255,1)"], [0.82, "rgba(255,247,215,1)"], [1, "rgba(255,230,140,0)"]]); ctx.beginPath(); ctx.arc(dx, dy + yo * 0.2, dr, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(L.x, L.y + yo); ctx.scale(L.s, L.s);
      // ombre au sol
            drawBody(ctx, t, wave);
      ctx.save(); const sway = Math.sin(t * 1.3) * 0.018 + m * 0.012 * Math.sin(t * 8), nod = Math.sin(t * 2.2) * 3 - m * 4;
      ctx.translate(0, -270); ctx.rotate(sway); ctx.translate(0, 270 + nod);
      drawHead(ctx, t, m, { smile, brow: wave });
      ctx.restore(); ctx.restore();
    },
  };
})();
