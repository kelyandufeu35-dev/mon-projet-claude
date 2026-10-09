/* NEXALOG — moteur isométrique déterministe (canvas 2D, fonction pure du temps) */
(function () {
  const W = 1080, H = 1920;
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const cam = { tx: 0, ty: 0, tz: 0, scale: 0.4, yaw: -Math.PI / 4, el: 0.6155, ox: 0, oy: 0 };
  let cY, sY, cE, sE;
  function camUpdate() {
    cY = Math.cos(cam.yaw); sY = Math.sin(cam.yaw);
    cE = Math.cos(cam.el); sE = Math.sin(cam.el);
  }
  camUpdate();
  let PX = 0, PY = 0, PD = 0;
  function P(x, y, z) {
    const dx = x - cam.tx, dy = y - cam.ty, dz = z - cam.tz;
    const xr = dx * cY - dy * sY, yr = dx * sY + dy * cY;
    PX = W / 2 + cam.ox + xr * cam.scale;
    PY = H / 2 + cam.oy + (yr * sE - dz * cE) * cam.scale;
    PD = yr * cE + dz * sE;
  }

  /* ---------- couleurs ---------- */
  const rgbCache = {}, shCache = {};
  function rgb(h) {
    let r = rgbCache[h];
    if (!r) {
      if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
      r = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      rgbCache[h] = r;
    }
    return r;
  }
  function shade(h, f) {
    const k = h + "|" + ((f * 100) | 0);
    let s = shCache[k];
    if (!s) {
      const c = rgb(h);
      s = "rgb(" + Math.min(255, Math.round(c[0] * f)) + "," + Math.min(255, Math.round(c[1] * f)) + "," + Math.min(255, Math.round(c[2] * f)) + ")";
      shCache[k] = s;
    }
    return s;
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    const f = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, "0");
    return "#" + f(0) + f(1) + f(2);
  }
  function rgba(h, a) { const c = rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  /* ---------- maths ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const sm5 = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const eout = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const eoutB = (t) => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- boîtes ---------- */
  const NORM = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // nord, est, sud, ouest
  const FACE_F = [0.5, 0.62, 0.58, 0.9]; // éclairage fixe, lumière venant de l'ouest
  class Box {
    constructor(o) {
      this.x = 0; this.y = 0; this.z = 0; this.w = 10; this.d = 10; this.h = 10; this.ang = 0;
      this.c = "#888888"; this.top = null; this.edge = null; this.a = 1; this.bias = 0;
      this.band = null; this.emTop = null; this.vis = true; this.sideC = null; this.noTop = false;
      Object.assign(this, o);
    }
    key() {
      P(this.x + this.w / 2, this.y + this.d / 2, this.z + this.h / 2);
      return PD + this.bias;
    }
    draw() {
      if (this.a <= 0.003 || this.h <= 0.01) return;
      const hw = this.w / 2, hd = this.d / 2, cx = this.x + hw, cy = this.y + hd;
      const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
      const lx = [-hw, hw, hw, -hw], ly = [-hd, -hd, hd, hd];
      const wx = [0, 0, 0, 0], wy = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) { wx[i] = cx + lx[i] * ca - ly[i] * sa; wy[i] = cy + lx[i] * sa + ly[i] * ca; }
      const z0 = this.z, z1 = this.z + this.h;
      // cull rapide
      P(cx, cy, (z0 + z1) / 2);
      const rad = (Math.max(this.w, this.d) + this.h) * cam.scale;
      if (PX < -rad || PX > W + rad || PY < -rad || PY > H + rad) return;
      const prevA = ctx.globalAlpha;
      if (this.a < 1) ctx.globalAlpha = prevA * this.a;
      const sideBase = this.sideC || this.c;
      for (let i = 0; i < 4; i++) {
        let nx = NORM[i][0], ny = NORM[i][1];
        const rx = nx * ca - ny * sa, ry = nx * sa + ny * ca;
        if (rx * sY + ry * cY <= 0.02) continue;
        const j = (i + 1) & 3;
        const f = clamp(0.5 + 0.5 * (-0.85 * rx + 0.22 * ry) + 0.05, 0.4, 0.95);
        ctx.beginPath();
        P(wx[i], wy[i], z0); ctx.moveTo(PX, PY);
        P(wx[j], wy[j], z0); ctx.lineTo(PX, PY);
        P(wx[j], wy[j], z1); ctx.lineTo(PX, PY);
        P(wx[i], wy[i], z1); ctx.lineTo(PX, PY);
        ctx.closePath();
        ctx.fillStyle = shade(sideBase, f);
        ctx.fill();
        if (this.band) {
          const b = this.band;
          const za = z0 + (z1 - z0) * b[1], zb = z0 + (z1 - z0) * b[2];
          ctx.beginPath();
          P(wx[i], wy[i], za); ctx.moveTo(PX, PY);
          P(wx[j], wy[j], za); ctx.lineTo(PX, PY);
          P(wx[j], wy[j], zb); ctx.lineTo(PX, PY);
          P(wx[i], wy[i], zb); ctx.lineTo(PX, PY);
          ctx.closePath();
          ctx.fillStyle = b[0];
          ctx.fill();
        }
      }
      if (!this.noTop) {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { P(wx[i], wy[i], z1); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
        ctx.closePath();
        ctx.fillStyle = this.emTop || (this.top ? this.top : shade(this.c, 1.18));
        ctx.fill();
        if (this.edge) { ctx.strokeStyle = this.edge; ctx.lineWidth = 1; ctx.stroke(); }
      }
      ctx.globalAlpha = prevA;
    }
  }

  /* ---------- primitives sol / plans ---------- */
  function gpoly(pts, z, fill, alpha) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { P(pts[i][0], pts[i][1], z); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
    ctx.closePath();
    if (alpha != null && alpha < 1) { const p = ctx.globalAlpha; ctx.globalAlpha = p * alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = p; }
    else { ctx.fillStyle = fill; ctx.fill(); }
  }
  function grect(x, y, w, h, z, fill, alpha) { gpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], z, fill, alpha); }
  function gline(x1, y1, x2, y2, z, col, lw, alpha) {
    P(x1, y1, z); const ax = PX, ay = PY; P(x2, y2, z);
    const p = ctx.globalAlpha; if (alpha != null) ctx.globalAlpha = p * alpha;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(PX, PY);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); ctx.globalAlpha = p;
  }
  function gdash(x1, y1, x2, y2, z, col, lw, dash, gap, alpha) {
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    for (let s = 0; s < L; s += dash + gap) { const e = Math.min(L, s + dash); gline(x1 + ux * s, y1 + uy * s, x1 + ux * e, y1 + uy * e, z, col, lw, alpha); }
  }
  // transformation affine d'un plan : u,v sont des vecteurs unitaires monde
  function planeBegin(x, y, z, ux, uy, uz, vx, vy, vz) {
    P(x, y, z); const ox = PX, oy = PY;
    P(x + ux, y + uy, z + uz); const a = PX - ox, b = PY - oy;
    P(x + vx, y + vy, z + vz); const c = PX - ox, d = PY - oy;
    ctx.save(); ctx.transform(a, b, c, d, ox, oy);
  }
  function groundText(txt, x, y, z, size, col, font, align, rot, alpha) {
    planeBegin(x, y, z, 1, 0, 0, 0, 1, 0);
    if (rot) ctx.rotate(rot);
    ctx.font = (font || "900") + " " + size + "px Montserrat, sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore();
  }
  function wallText(txt, x, y, z, axis, size, col, font, align) {
    // axis 'x' : face sud (texte le long de x) ; axis 'y' : face ouest (le long de y)
    if (axis === "x") planeBegin(x, y, z, 1, 0, 0, 0, 0, -1); else planeBegin(x, y, z, 0, 1, 0, 0, 0, -1);
    ctx.font = (font || "900") + " " + size + "px Montserrat, sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore();
  }
  function pool(x, y, z, r, col, a) {
    planeBegin(x, y, z, 1, 0, 0, 0, 1, 0);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    const prev = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.globalCompositeOperation = prev; ctx.restore();
  }
  function glow(x, y, z, r, col, a) {
    P(x, y, z); const R = r * cam.scale; if (!(R >= 1.5) || !isFinite(PX + PY)) return;
    if (PX < -R || PX > W + R || PY < -R || PY > H + R) return;
    const g = ctx.createRadialGradient(PX, PY, 0, PX, PY, R);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    const prev = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g; ctx.fillRect(PX - R, PY - R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = prev;
  }
  // capsule 3D projetée (bras robotisés, mâts…)
  function limb(x1, y1, z1, x2, y2, z2, wd, col, a) {
    P(x1, y1, z1); const ax = PX, ay = PY; P(x2, y2, z2);
    const p = ctx.globalAlpha; if (a != null) ctx.globalAlpha = p * a;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(PX, PY);
    ctx.strokeStyle = shade(col, 0.55); ctx.lineWidth = wd * cam.scale + 1.6; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, wd * cam.scale); ctx.stroke();
    ctx.strokeStyle = shade(col, 1.35); ctx.lineWidth = Math.max(0.5, wd * cam.scale * 0.32); ctx.stroke();
    ctx.lineCap = "butt"; ctx.globalAlpha = p;
  }
  function ball(x, y, z, r, col) {
    P(x, y, z); const R = Math.max(0.6, r * cam.scale);
    const g = ctx.createRadialGradient(PX - R * 0.3, PY - R * 0.35, R * 0.1, PX, PY, R);
    g.addColorStop(0, shade(col, 1.45)); g.addColorStop(1, shade(col, 0.6));
    ctx.beginPath(); ctx.arc(PX, PY, R, 0, 6.2832); ctx.fillStyle = g; ctx.fill();
  }

  window.ENG = { W, H, cv, ctx, cam, camUpdate, P, pt: () => [PX, PY, PD], px: () => PX, py: () => PY, pd: () => PD,
    rgb, shade, mix, rgba, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng, Box,
    gpoly, grect, gline, gdash, groundText, wallText, planeBegin, pool, glow, limb, ball };
})();
