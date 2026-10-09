/* NEXALOG — chemins, racks, convoyeurs, colis, scanners */
(function () {
  const E = window.ENG, Wd = window.WORLD;
  const { Box, clamp, lerp, sm, sm5, prog, eio, rng } = E;
  const { PAL, UP, OV, G, box } = Wd;

  /* ---------- utilitaires de chemin ---------- */
  function chamfer(pts, r) {
    if (!r) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const k1 = Math.min(r, l1 / 2), k2 = Math.min(r, l2 / 2);
      const p0 = [b[0] + (a[0] - b[0]) * k1 / l1, b[1] + (a[1] - b[1]) * k1 / l1];
      const p2 = [b[0] + (c[0] - b[0]) * k2 / l2, b[1] + (c[1] - b[1]) * k2 / l2];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6, v = 1 - u;
        out.push([v * v * p0[0] + 2 * u * v * b[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * b[1] + u * u * p2[1]]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function mkPath(pts, r) {
    const p = chamfer(pts, r), cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return { pts: p, cum, len: cum[cum.length - 1] };
  }
  const PA = { x: 0, y: 0, ang: 0 };
  function pathAt(path, s) {
    s = clamp(s, 0, path.len);
    let i = 1;
    while (i < path.cum.length - 1 && path.cum[i] < s) i++;
    const a = path.pts[i - 1], b = path.pts[i], seg = path.cum[i] - path.cum[i - 1] || 1;
    const u = (s - path.cum[i - 1]) / seg;
    PA.x = a[0] + (b[0] - a[0]) * u; PA.y = a[1] + (b[1] - a[1]) * u;
    PA.ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return PA;
  }
  function setB(b, cx, cy, z, w, d, h, ang) { b.x = cx - w / 2; b.y = cy - d / 2; b.z = z; b.w = w; b.d = d; b.h = h; b.ang = ang || 0; }
  // pose d'une pièce rattachée à un repère (x,y,heading) : décalage (la = le long, lb = latéral)
  function partAt(b, ox, oy, hd, la, lb, z, w, d, h) {
    const c = Math.cos(hd), s = Math.sin(hd);
    setB(b, ox + c * la - s * lb, oy + s * la + c * lb, z, w, d, h, hd);
  }
  function newBox(o) { return new Box(o); }

  /* ---------- palette de cartons ---------- */
  const KRAFT = ["#d79a52", "#c98a45", "#e0a860", "#bd7d3a"];
  const COLS = ["#d79a52", "#c98a45", "#e8edf7", "#2c63e0", "#27d6a0", "#ff8a1f", "#b7c4de", "#d79a52"];

  /* ---------- RACKS ---------- */
  const RACK = { x0: 240, bays: 8, bl: 95, depth: 55, lvlZ: [10, 66, 122], H: 172 };
  const GY = [60, 260, 460]; // y0 des 3 groupes
  const AISLE_Y = [220, 420, 600];
  const slots = []; // {x,y,z,aisle,side}
  const rk = rng(9001);
  const rackBoxes = [];
  for (let g = 0; g < 3; g++) {
    for (let row = 0; row < 2; row++) {
      const y = GY[g] + row * 65;
      // montants
      for (let b = 0; b <= RACK.bays; b++) {
        box({ x: RACK.x0 + b * RACK.bl - 3, y: y, w: 6, d: RACK.depth, z: 0, h: RACK.H, c: "#1f4fc4", top: "#7aa8ff", edge: "rgba(180,215,255,0.5)" });
      }
      // lisses
      for (let l = 0; l < 3; l++) {
        for (let b = 0; b < RACK.bays; b++) {
          const bx = RACK.x0 + b * RACK.bl + 3;
          box({ x: bx, y: y + RACK.depth - 5, w: RACK.bl - 6, d: 4, z: RACK.lvlZ[l] - 4, h: 5, c: "#d96c0c", top: "#ff9a3c", bias: 3 });
          box({ x: bx, y: y, w: RACK.bl - 6, d: RACK.depth - 5, z: RACK.lvlZ[l] - 5, h: 2, c: "#223a74", top: "#2c4a96" });
          // slot
          const aisle = row === 1 ? g : (g > 0 ? g - 1 : -1);
          const o = { x: bx + 4, y: y + 3, z: RACK.lvlZ[l] - 3, w: RACK.bl - 14, d: RACK.depth - 12, aisle, row, g, b, l, fillT: -1, full: false };
          // deux faces possibles pour l'insertion : depuis l'allée sud (row 1) ou nord (row 0 du groupe suivant)
          slots.push(o);
        }
      }
    }
  }
  // remplissage initial & créneaux réservés aux livraisons AGV
  const reserved = [[], [], []]; // par allée
  slots.forEach((s) => {
    const r = rk();
    if (s.aisle >= 0 && s.row === 1 && s.l >= 0 && r < 0.38) { reserved[s.aisle].push(s); s.full = false; }
    else if (s.aisle >= 0 && s.row === 0 && r < 0.3) { reserved[s.aisle].push(s); s.full = false; }
    else s.full = r < 0.9;
    s.col = COLS[Math.floor(rk() * COLS.length)];
    s.hh = 26 + Math.floor(rk() * 24);
    s.pb = newBox({ c: PAL.pallet, top: "#b98550", edge: "rgba(255,255,255,0.18)" });
    s.cb = newBox({ c: s.col, top: E.mix(s.col, "#ffffff", 0.18), edge: "rgba(255,255,255,0.3)", band: ["rgba(255,255,255,0.5)", 0.45, 0.58] });
    s.pb.x = s.x + 2; s.pb.y = s.y; s.pb.z = s.z; s.pb.w = s.w - 4; s.pb.d = s.d; s.pb.h = 7;
    s.cb.x = s.x + 3; s.cb.y = s.y + 2; s.cb.z = s.z + 7; s.cb.w = s.w - 6; s.cb.d = s.d - 4; s.cb.h = s.hh;
  });
  UP.push((t, frame) => {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.full || (s.fillT >= 0 && t >= s.fillT)) { frame.push(s.pb); frame.push(s.cb); }
    }
  });
  // enseigne de zone suspendue (stockage)
  const rackTagY = GY[0] - 8;
  OV.push(() => {});

  /* ---------- CONVOYEURS ---------- */
  const CW = 36, CH = 22;
  class Tile extends Box {
    constructor(o, dx, dy) { super(o); this.dx = dx; this.dy = dy; }
    draw(t) {
      super.draw();
      if (this.a < 0.05) return;
      const ctx = E.ctx, zt = this.z + this.h + 0.5;
      const L = this.dx ? this.w : this.d, ox = this.x + this.w / 2, oy = this.y + this.d / 2;
      const ph = ((t * 70) % 22) / 22;
      ctx.strokeStyle = "rgba(34,225,255,0.55)"; ctx.lineWidth = Math.max(0.8, 1.6 * E.cam.scale);
      for (let k = -2; k <= 2; k++) {
        const p = (k + ph) * 22; if (Math.abs(p) > L / 2 - 2) continue;
        const sgn = (this.dx || this.dy);
        const cx = ox + (this.dx ? p * Math.sign(this.dx) : 0), cy = oy + (this.dy ? p * Math.sign(this.dy) : 0);
        ctx.beginPath();
        if (this.dx) { E.P(cx - 4 * Math.sign(this.dx), cy - 9, zt); ctx.moveTo(E.px(), E.py()); E.P(cx + 3 * Math.sign(this.dx), cy, zt); ctx.lineTo(E.px(), E.py()); E.P(cx - 4 * Math.sign(this.dx), cy + 9, zt); ctx.lineTo(E.px(), E.py()); }
        else { E.P(cx - 9, cy - 4 * Math.sign(this.dy), zt); ctx.moveTo(E.px(), E.py()); E.P(cx, cy + 3 * Math.sign(this.dy), zt); ctx.lineTo(E.px(), E.py()); E.P(cx + 9, cy - 4 * Math.sign(this.dy), zt); ctx.lineTo(E.px(), E.py()); }
        ctx.stroke();
      }
    }
  }
  function conveyor(pts) {
    // pts : suite de points axis-alignés ; crée des tuiles de ~60 u
    const path = mkPath(pts, 0);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(L / 60)), step = L / n;
      for (let k = 0; k < n; k++) {
        const cx = a[0] + dx * (k + 0.5) * step, cy = a[1] + dy * (k + 0.5) * step;
        const w = dx ? step + 0.5 : CW, d = dx ? CW : step + 0.5;
        const tl = new Tile({ x: cx - w / 2, y: cy - d / 2, w, d, z: 0, h: CH, c: "#24488f", top: "#0e1c40", edge: "rgba(34,225,255,0.5)", sideC: "#2a56ab" }, dx, dy);
        tl.inter = true; Wd.S.push(tl);
        // rail latéral lumineux
      }
    }
    return path;
  }

  const conv = {};
  conv.F1 = [[1040, 220], [1200, 220]];
  conv.F2 = [[1040, 420], [1200, 420]];
  conv.TR = [[1200, 220], [1200, 585]];
  conv.OUT1 = [[1200, 300], [1330, 300]];
  conv.OUT2 = [[1200, 500], [1330, 500]];
  conv.FEED = [[1200, 585], [130, 585]];
  conv.OUTB = [[560, 770], [100, 770], [100, 110]];
  conv.BR = WDOCK_BR();
  function WDOCK_BR() { return Wd.WDOCK.map((y) => [[100, y], [34, y]]); }
  conveyor(conv.F1); conveyor(conv.F2); conveyor(conv.TR);
  conveyor(conv.OUT1); conveyor(conv.OUT2); conveyor(conv.FEED); conveyor(conv.OUTB);
  conv.BR.forEach((b) => conveyor(b));
  // supports des convoyeurs (pieds)
  function legs(pts, every) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
      for (let s = 20; s < L; s += every) {
        const x = a[0] + dx * s, y = a[1] + dy * s;
        box({ x: x - CW / 2 - 3, y: y - CW / 2 - 3, w: 6, d: 6, z: 0, h: 14, c: "#0c1938", top: "#1b2f66" });
      }
    }
  }

  /* ---------- Colis sur convoyeurs ---------- */
  const P_FEED_DIVERT = [
    // routes complètes : {pts}
  ];
  function join(...arrs) { const out = []; arrs.forEach((a) => a.forEach((p) => { const l = out[out.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) out.push(p); })); return out; }
  const route = {
    R1: mkPath(join(conv.F1, conv.TR, conv.FEED), 40),
    R2: null,
    D1: mkPath(join(conv.F1, [[1200, 220], [1200, 300]], conv.OUT1.slice(1)), 40),
    D2: mkPath(join(conv.F2, [[1200, 420], [1200, 500]], conv.OUT2.slice(1)), 40),
  };
  // R2 : F2 rejoint le tronc à y=330
  route.R2 = mkPath(join(conv.F2, [[1200, 420], [1200, 585]], conv.FEED), 40);
  const parcels = []; // {route,t0,v,box,stopAt...}
  const pr = rng(3141);
  function addParcel(path, t0, v, sizeIdx, extra) {
    const w = 24 + Math.floor(pr() * 3) * 3, d = 20 + Math.floor(pr() * 3) * 3, h = 14 + Math.floor(pr() * 3) * 3;
    const c = KRAFT[Math.floor(pr() * KRAFT.length)];
    const b = newBox({ c, top: E.mix(c, "#ffffff", 0.2), edge: "rgba(255,255,255,0.28)", band: ["rgba(255,255,255,0.55)", 0.5, 0.62], bias: 25 });
    b.w = w; b.d = d; b.h = h;
    const p = Object.assign({ path, t0, v, b, endHold: false }, extra || {});
    parcels.push(p); return p;
  }
  // flux de colis depuis le stockage vers le tri, dès 20 s
  const feedSpeed = 165;
  for (let k = 0; k < 100; k++) {
    const tt = 21 + k * 0.5 + pr() * 0.2;
    const kind = pr();
    const pp = kind < 0.5 ? addParcel(route.D1, tt, feedSpeed) : addParcel(route.D2, tt, feedSpeed);
    pp.b.band = [kind < 0.5 ? "rgba(34,225,255,0.95)" : "rgba(255,138,31,0.95)", 0.35, 0.7];
  }
  // le flux continue vers les cages : accumulation dans les bacs (compté par frame)
  UP.push((t, frame) => {
    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      if (p.removed) continue;
      const s = (t - p.t0) * p.v;
      if (s < 0) continue;
      let ss = s, hold = false;
      if (p.stopS != null && s >= p.stopS) { ss = p.stopS; hold = true; }
      if (ss >= p.path.len) { if (!p.keep) continue; ss = p.path.len; }
      if (p.until != null && t > p.until) continue;
      pathAt(p.path, ss);
      const b = p.b; b.x = PA.x - b.w / 2; b.y = PA.y - b.d / 2; b.z = CH + (p.zOff || 0); b.ang = 0; b.a = clamp(ss / 36, 0, 1) * (p.until != null ? clamp((p.until - t) / 0.2 + 1, 0, 1) : 1);
      frame.push(b);
    }
  });

  /* ---------- cages de tri (bacs de fin de ligne) ---------- */
  const cages = [];
  [[1330, 300], [1330, 500]].forEach((c, i) => {
    box({ x: c[0] + 4, y: c[1] - 40, w: 50, d: 80, z: 0, h: 10, c: "#16294f", top: "#24468f" });
    // cage fil (4 montants + barres)
    [[c[0] + 4, c[1] - 40], [c[0] + 50, c[1] - 40], [c[0] + 4, c[1] + 36], [c[0] + 50, c[1] + 36]].forEach((p) =>
      box({ x: p[0], y: p[1], w: 4, d: 4, z: 10, h: 62, c: "#9fb8e6", top: "#e6efff" }));
    box({ x: c[0] + 4, y: c[1] - 40, w: 50, d: 80, z: 71, h: 3, c: "#9fb8e6", top: "#cfe0ff", noTop: false, a: 0.7 });
    const stackN = 6;
    for (let k = 0; k < stackN; k++) {
      const b = newBox({ c: KRAFT[k % 4], top: E.mix(KRAFT[k % 4], "#ffffff", 0.2), edge: "rgba(255,255,255,0.28)", w: 20, d: 22, h: 14, bias: 20 });
      cages.push({ b, ci: i, k, tArr: 0 });
    }
  });
  // comptage : chaque colis des routes D1/D2 arrive à la fin → remplit les bacs
  (function planCages() {
    const arr = [[], []];
    parcels.forEach((p) => { if (p.path === route.D1) arr[0].push(p.t0 + p.path.len / p.v); if (p.path === route.D2) arr[1].push(p.t0 + p.path.len / p.v); });
    arr.forEach((a) => a.sort((x, y) => x - y));
    cages.forEach((c) => { c.tArr = arr[c.ci][c.k * 2] ?? 999; });
  })();
  UP.push((t, frame) => {
    cages.forEach((c) => {
      if (t < c.tArr) return;
      const ci = c.ci, cx = 1330, cy = ci ? 500 : 300;
      const col = c.k % 3, row = Math.floor(c.k / 3);
      const b = c.b; b.x = cx + 8 + col * 14 - 2 + (row ? 3 : 0); b.y = cy - 30 + row * 30 + (c.k % 2) * 6; b.z = 10 + Math.floor(c.k / 6) * 15 + (c.k >= 3 ? 0 : 0);
      b.z = 10; b.w = 18; b.d = 22; frame.push(b);
    });
  });

  /* ---------- portiques scanner ---------- */
  const scanners = [{ x: 1200, y: 262, axis: "y" }, { x: 1200, y: 545, axis: "y" }, { x: 900, y: 585, axis: "x" }, { x: 140, y: 770, axis: "x" }];
  scanners.forEach((s) => {
    const horiz = s.axis === "y"; // convoyeur nord-sud → portique le long de x
    const w = horiz ? 74 : 8, d = horiz ? 8 : 74;
    const o1 = { x: s.x - (horiz ? 37 : 4), y: s.y - (horiz ? 4 : 37) }, o2 = { x: s.x + (horiz ? 29 : -4), y: s.y + (horiz ? -4 : 29) };
    box({ x: o1.x, y: o1.y, w: 8, d: 8, z: 0, h: 74, c: "#3c68c8", top: "#8bb2ff", edge: "rgba(200,225,255,0.5)", band: ["rgba(34,225,255,0.9)", 0.1, 0.9] });
    box({ x: o2.x, y: o2.y, w: 8, d: 8, z: 0, h: 74, c: "#3c68c8", top: "#8bb2ff", edge: "rgba(200,225,255,0.5)", band: ["rgba(34,225,255,0.9)", 0.1, 0.9] });
    box({ x: horiz ? s.x - 37 : s.x - 4, y: horiz ? s.y - 4 : s.y - 37, w: horiz ? 74 : 8, d: horiz ? 8 : 74, z: 66, h: 12, c: "#3c68c8", top: "#8bb2ff", edge: "rgba(200,225,255,0.6)", band: ["rgba(34,225,255,1)", 0.35, 0.6] });
    OV.push((t) => {
      if (!Wd.interiorOn) return;
      // faisceau de scan qui balaie (rideau lumineux)
      const ph = (Math.sin(t * 6 + s.x * 0.01 + s.y * 0.02) * 0.5 + 0.5);
      const ctx = E.ctx;
      const z = 14 + ph * 54;
      ctx.beginPath();
      const hw = 34;
      const pts = horiz ? [[s.x - hw, s.y], [s.x + hw, s.y]] : [[s.x, s.y - hw], [s.x, s.y + hw]];
      E.P(pts[0][0], pts[0][1], z); ctx.moveTo(E.px(), E.py()); E.P(pts[1][0], pts[1][1], z); ctx.lineTo(E.px(), E.py());
      ctx.strokeStyle = "rgba(120,240,255,0.95)"; ctx.lineWidth = 2.2 * Math.max(0.7, E.cam.scale * 1.2); ctx.stroke();
      E.glow(s.x, s.y, z, 70, "#22e1ff", 0.35);
    });
  });

  // déviateurs aux embranchements du tronc
  const divs = [[300, "D1"], [500, "D2"]].map((d) => {
    const path = route[d[1]]; let best = 0, bd = 1e9;
    for (let s = 0; s < path.len; s += 1) { pathAt(path, s); const dd = Math.hypot(PA.x - 1200, PA.y - d[0]); if (dd < bd) { bd = dd; best = s; } }
    return { y: d[0], key: d[1], s0: best, b: newBox({ c: "#ffb25a", top: "#ffd9a3", edge: "rgba(255,255,255,0.6)", bias: 30, band: ["rgba(34,225,255,0.9)", 0.4, 0.6] }) };
  });
  UP.push((t, frame) => {
    divs.forEach((d) => {
      let act = 0;
      parcels.forEach((p) => { if (p.path === route[d.key]) { const s = (t - p.t0) * p.v; const k = 1 - Math.min(1, Math.abs(s - d.s0) / 90); if (k > act) act = k; } });
      const ang = -0.15 + 0.95 * E.sm(act);
      // pivot au bord ouest du tronc ; le bras se rabat vers l'est
      const cx = 1186, cy = d.y - 14;
      const L = 46; setB(d.b, cx + Math.cos(ang) * L / 2 - 0, cy + Math.sin(ang) * L / 2, CH, L, 6, 20, ang);
      frame.push(d.b);
    });
  });
  window.WORLD.PATH = { mkPath, pathAt, PA, setB, partAt, newBox, join, chamfer };
  window.WORLD.conv = conv; window.WORLD.route = route; window.WORLD.parcels = parcels;
  window.WORLD.slots = slots; window.WORLD.reserved = reserved; window.WORLD.AISLE_Y = AISLE_Y; window.WORLD.RACK = RACK;
  window.WORLD.addParcel = addParcel; window.WORLD.CH = CH; window.WORLD.KRAFT = KRAFT;
})();
