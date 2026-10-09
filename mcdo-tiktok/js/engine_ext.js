/* Extension du moteur : éclairage jour, ombres portées, dégradés, cylindres, toits à pignon, chemins */
(function () {
  const E = window.ENG;
  const { Box, ctx, cam, clamp, lerp, shade, mix, rgba, P } = E;
  const px = E.px, py = E.py, pd = E.pd;
  const NORM = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function trig() { return { cY: Math.cos(cam.yaw), sY: Math.sin(cam.yaw), cE: Math.cos(cam.el), sE: Math.sin(cam.el) }; }
  E.sunK = 1; // intensité du contraste d'éclairage

  /* ----- Box : dégradé vertical, fenêtres, éclairage jour ----- */
  Box.prototype.draw = function () {
    if (this.a <= 0.003 || this.h <= 0.01) return;
    const T = trig();
    const hw = this.w / 2, hd = this.d / 2, cx = this.x + hw, cy = this.y + hd;
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    const lx = [-hw, hw, hw, -hw], ly = [-hd, -hd, hd, hd];
    const wx = [0, 0, 0, 0], wy = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { wx[i] = cx + lx[i] * ca - ly[i] * sa; wy[i] = cy + lx[i] * sa + ly[i] * ca; }
    const z0 = this.z, z1 = this.z + this.h;
    P(cx, cy, (z0 + z1) / 2);
    const rad = (Math.max(this.w, this.d) + this.h) * cam.scale;
    if (px() < -rad || px() > E.W + rad || py() < -rad || py() > E.H + rad) return;
    const prevA = ctx.globalAlpha;
    if (this.a < 1) ctx.globalAlpha = prevA * this.a;
    const base = this.sideC || this.c;
    for (let i = 0; i < 4; i++) {
      const rx = NORM[i][0] * ca - NORM[i][1] * sa, ry = NORM[i][0] * sa + NORM[i][1] * ca;
      if (rx * T.sY + ry * T.cY <= 0.02) continue;
      const j = (i + 1) & 3;
      const f = clamp(0.64 + 0.36 * E.sunK * (-0.85 * rx + 0.3 * ry), 0.5, 1.0);
      P(wx[i], wy[i], z0); const ax = px(), ay = py();
      P(wx[j], wy[j], z0); const bx = px(), by = py();
      P(wx[j], wy[j], z1); const cx2 = px(), cy2 = py();
      P(wx[i], wy[i], z1); const dx = px(), dy = py();
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.lineTo(dx, dy); ctx.closePath();
      if (this.h > 22 && !this.flat) {
        const g = ctx.createLinearGradient(0, (ay + by) / 2, 0, (dy + cy2) / 2);
        g.addColorStop(0, shade(base, f * 0.8)); g.addColorStop(1, shade(base, f * 1.03));
        ctx.fillStyle = g;
      } else ctx.fillStyle = shade(base, f);
      ctx.fill();
      if (this.band) {
        const b = this.band, za = z0 + (z1 - z0) * b[1], zb = z0 + (z1 - z0) * b[2];
        ctx.beginPath();
        P(wx[i], wy[i], za); ctx.moveTo(px(), py());
        P(wx[j], wy[j], za); ctx.lineTo(px(), py());
        P(wx[j], wy[j], zb); ctx.lineTo(px(), py());
        P(wx[i], wy[i], zb); ctx.lineTo(px(), py());
        ctx.closePath(); ctx.fillStyle = b[0]; ctx.fill();
      }
      if (this.win && this.h > 40) {
        const W = this.win, nr = W.rows, nc = W.cols;
        const L = Math.hypot(wx[j] - wx[i], wy[j] - wy[i]);
        if (L > 30) {
          for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
            const u0 = (c + 0.2) / nc, u1 = (c + 0.8) / nc, v0 = z0 + (z1 - z0) * (0.12 + 0.76 * (r + 0.18) / nr), v1 = z0 + (z1 - z0) * (0.12 + 0.76 * (r + 0.78) / nr);
            const X0 = wx[i] + (wx[j] - wx[i]) * u0, Y0 = wy[i] + (wy[j] - wy[i]) * u0, X1 = wx[i] + (wx[j] - wx[i]) * u1, Y1 = wy[i] + (wy[j] - wy[i]) * u1;
            ctx.beginPath();
            P(X0, Y0, v0); ctx.moveTo(px(), py()); P(X1, Y1, v0); ctx.lineTo(px(), py()); P(X1, Y1, v1); ctx.lineTo(px(), py()); P(X0, Y0, v1); ctx.lineTo(px(), py());
            ctx.closePath(); ctx.fillStyle = ((r * 7 + c * 3 + (W.seed || 0)) % 5 === 0) ? W.lit : W.color; ctx.fill();
          }
        }
      }
    }
    if (!this.noTop) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { P(wx[i], wy[i], z1); if (i) ctx.lineTo(px(), py()); else ctx.moveTo(px(), py()); }
      ctx.closePath();
      ctx.fillStyle = this.emTop || (this.top ? this.top : shade(this.c, 1.16));
      ctx.fill();
      if (this.edge) { ctx.strokeStyle = this.edge; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.globalAlpha = prevA;
  };
  // ombre portée au sol (soleil à l'ouest/nord-ouest)
  Box.prototype.drawShadow = function () {
    if (this.a < 0.05 || this.h < 8 || this.z > 40 || this.noShadow) return;
    const hw = this.w / 2, hd = this.d / 2, cx = this.x + hw, cy = this.y + hd;
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    const dxs = this.h * 0.62, dys = this.h * 0.34;
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map((p) => [cx + p[0] * ca - p[1] * sa, cy + p[0] * sa + p[1] * ca]);
    const off = pts.map((p) => [p[0] + dxs, p[1] + dys]);
    ctx.fillStyle = "rgba(20,35,60," + (0.2 * this.a).toFixed(3) + ")";
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const j = (i + 1) & 3; ctx.moveTo(0, 0); }
    // enveloppe : on remplit empreinte + empreinte décalée + quadrilatères reliant les arêtes
    const poly = (a) => { ctx.beginPath(); a.forEach((p, i) => { P(p[0], p[1], 0.3); if (i) ctx.lineTo(px(), py()); else ctx.moveTo(px(), py()); }); ctx.closePath(); ctx.fill(); };
    poly(off);
    for (let i = 0; i < 4; i++) { const j = (i + 1) & 3; poly([pts[i], pts[j], off[j], off[i]]); }
  };

  /* ----- Cylindre vertical ----- */
  class Cyl {
    constructor(o) { Object.assign(this, { x: 0, y: 0, z: 0, r: 20, h: 40, c: "#cccccc", top: null, a: 1, bias: 0, seg: 28, band: null, noShadow: false }, o); }
    key() { P(this.x, this.y, this.z + this.h / 2); return pd() + this.bias; }
    drawShadow() {
      if (this.a < 0.05 || this.h < 8 || this.z > 40 || this.noShadow) return;
      ctx.fillStyle = "rgba(20,35,60," + (0.2 * this.a).toFixed(3) + ")";
      const dxs = this.h * 0.62, dys = this.h * 0.34;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) { const a = k / 24 * 6.2832; P(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, 0.3); if (k) ctx.lineTo(px(), py()); else ctx.moveTo(px(), py()); }
      for (let k = 24; k >= 0; k--) { const a = k / 24 * 6.2832; P(this.x + dxs + Math.cos(a) * this.r, this.y + dys + Math.sin(a) * this.r, 0.3); ctx.lineTo(px(), py()); }
      ctx.closePath(); ctx.fill();
    }
    draw() {
      if (this.a <= 0.003 || this.h <= 0.01) return;
      const T = trig(), n = this.seg, z0 = this.z, z1 = this.z + this.h;
      P(this.x, this.y, z0);
      const rad = (this.r + this.h) * cam.scale;
      if (px() < -rad || px() > E.W + rad || py() < -rad || py() > E.H + rad) return;
      const pa = ctx.globalAlpha; if (this.a < 1) ctx.globalAlpha = pa * this.a;
      // flancs : tranches verticales visibles (normale vers le spectateur)
      for (let k = 0; k < n; k++) {
        const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, am = (a0 + a1) / 2;
        const nx = Math.cos(am), ny = Math.sin(am);
        if (nx * T.sY + ny * T.cY <= 0) continue;
        const f = clamp(0.62 + 0.4 * (-0.85 * nx + 0.3 * ny), 0.48, 1.0);
        ctx.beginPath();
        P(this.x + Math.cos(a0) * this.r, this.y + Math.sin(a0) * this.r, z0); ctx.moveTo(px(), py());
        P(this.x + Math.cos(a1) * this.r, this.y + Math.sin(a1) * this.r, z0); ctx.lineTo(px(), py());
        P(this.x + Math.cos(a1) * this.r, this.y + Math.sin(a1) * this.r, z1); ctx.lineTo(px(), py());
        P(this.x + Math.cos(a0) * this.r, this.y + Math.sin(a0) * this.r, z1); ctx.lineTo(px(), py());
        ctx.closePath(); ctx.fillStyle = shade(this.c, f); ctx.fill();
        if (this.band) {
          const za = z0 + this.h * this.band[1], zb = z0 + this.h * this.band[2];
          ctx.beginPath();
          P(this.x + Math.cos(a0) * this.r, this.y + Math.sin(a0) * this.r, za); ctx.moveTo(px(), py());
          P(this.x + Math.cos(a1) * this.r, this.y + Math.sin(a1) * this.r, za); ctx.lineTo(px(), py());
          P(this.x + Math.cos(a1) * this.r, this.y + Math.sin(a1) * this.r, zb); ctx.lineTo(px(), py());
          P(this.x + Math.cos(a0) * this.r, this.y + Math.sin(a0) * this.r, zb); ctx.lineTo(px(), py());
          ctx.closePath(); ctx.fillStyle = this.band[0]; ctx.fill();
        }
      }
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const a = k / n * 6.2832; P(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, z1); if (k) ctx.lineTo(px(), py()); else ctx.moveTo(px(), py()); }
      ctx.closePath(); ctx.fillStyle = this.top || shade(this.c, 1.15); ctx.fill();
      ctx.globalAlpha = pa;
    }
  }

  /* ----- Toit à deux pans ----- */
  class Roof {
    constructor(o) { Object.assign(this, { x: 0, y: 0, z: 0, w: 100, d: 80, rh: 30, axis: "x", c: "#b0412e", gable: "#e8dcc8", a: 1, bias: 6, over: 6, noShadow: true }, o); }
    key() { P(this.x + this.w / 2, this.y + this.d / 2, this.z + this.rh / 2); return pd() + this.bias; }
    drawShadow() {}
    draw() {
      if (this.a <= 0.003) return;
      const T = trig(), o = this.over;
      const x0 = this.x - o, y0 = this.y - o, x1 = this.x + this.w + o, y1 = this.y + this.d + o, z = this.z, rh = this.rh;
      const quad = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => { P(p[0], p[1], p[2]); if (i) ctx.lineTo(px(), py()); else ctx.moveTo(px(), py()); }); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
      const vis = (n) => ((n[0] * T.sY + n[1] * T.cY) * T.cE + n[2] * T.sE) > 0.001;
      const shd = (n) => clamp(0.66 + 0.36 * (-0.85 * n[0] + 0.3 * n[1]) * 0.8 + 0.12 * n[2], 0.5, 1.05);
      const pa = ctx.globalAlpha; if (this.a < 1) ctx.globalAlpha = pa * this.a;
      if (this.axis === "x") {
        const ym = (y0 + y1) / 2, k = rh / ((y1 - y0) / 2), nl = Math.hypot(k, 1);
        const nS = [0, 1 / nl, k / nl], nN = [0, -1 / nl, k / nl];
        if (vis(nN)) quad([[x0, y0, z], [x1, y0, z], [x1, ym, z + rh], [x0, ym, z + rh]], shade(this.c, shd(nN)));
        if (vis(nS)) quad([[x0, y1, z], [x1, y1, z], [x1, ym, z + rh], [x0, ym, z + rh]], shade(this.c, shd(nS)));
        if (vis([-1, 0, 0])) quad([[this.x, this.y, z], [this.x, this.y + this.d, z], [this.x, this.y + this.d / 2, z + rh * 0.86]], shade(this.gable, shd([-1, 0, 0])));
        if (vis([1, 0, 0])) quad([[this.x + this.w, this.y, z], [this.x + this.w, this.y + this.d, z], [this.x + this.w, this.y + this.d / 2, z + rh * 0.86]], shade(this.gable, shd([1, 0, 0])));
      } else {
        const xm = (x0 + x1) / 2, k = rh / ((x1 - x0) / 2), nl = Math.hypot(k, 1);
        const nE = [1 / nl, 0, k / nl], nW = [-1 / nl, 0, k / nl];
        if (vis(nW)) quad([[x0, y0, z], [x0, y1, z], [xm, y1, z + rh], [xm, y0, z + rh]], shade(this.c, shd(nW)));
        if (vis(nE)) quad([[x1, y0, z], [x1, y1, z], [xm, y1, z + rh], [xm, y0, z + rh]], shade(this.c, shd(nE)));
        if (vis([0, -1, 0])) quad([[this.x, this.y, z], [this.x + this.w, this.y, z], [this.x + this.w / 2, this.y, z + rh * 0.86]], shade(this.gable, shd([0, -1, 0])));
        if (vis([0, 1, 0])) quad([[this.x, this.y + this.d, z], [this.x + this.w, this.y + this.d, z], [this.x + this.w / 2, this.y + this.d, z + rh * 0.86]], shade(this.gable, shd([0, 1, 0])));
      }
      ctx.globalAlpha = pa;
    }
  }

  /* ----- chemins ----- */
  function chamfer(pts, r) {
    if (!r) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const k1 = Math.min(r, l1 / 2), k2 = Math.min(r, l2 / 2);
      const p0 = [b[0] + (a[0] - b[0]) * k1 / l1, b[1] + (a[1] - b[1]) * k1 / l1], p2 = [b[0] + (c[0] - b[0]) * k2 / l2, b[1] + (c[1] - b[1]) * k2 / l2];
      for (let k = 0; k <= 6; k++) { const u = k / 6, v = 1 - u; out.push([v * v * p0[0] + 2 * u * v * b[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * b[1] + u * u * p2[1]]); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function mkPath(pts, r) {
    const p = chamfer(pts, r || 0), cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return { pts: p, cum, len: cum[cum.length - 1] };
  }
  const PA = { x: 0, y: 0, ang: 0 };
  function pathAt(path, s) {
    s = clamp(s, 0, path.len);
    let i = 1;
    while (i < path.cum.length - 1 && path.cum[i] < s) i++;
    const a = path.pts[i - 1], b = path.pts[i], seg = path.cum[i] - path.cum[i - 1] || 1, u = (s - path.cum[i - 1]) / seg;
    PA.x = a[0] + (b[0] - a[0]) * u; PA.y = a[1] + (b[1] - a[1]) * u; PA.ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return PA;
  }
  function setB(b, cx, cy, z, w, d, h, ang) { b.x = cx - w / 2; b.y = cy - d / 2; b.z = z; b.w = w; b.d = d; b.h = h; b.ang = ang || 0; }
  function partAt(b, ox, oy, hd, la, lb, z, w, d, h) { const c = Math.cos(hd), s = Math.sin(hd); setB(b, ox + c * la - s * lb, oy + s * la + c * lb, z, w, d, h, hd); }
  function newBox(o) { return new Box(o); }

  Object.assign(E, { Cyl, Roof, mkPath, pathAt, PA, setB, partAt, newBox, trig });
})();
