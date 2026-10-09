/* SCÈNE 2 — Fournisseurs et production : fermes, usines, contrôle qualité */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng, mix, newBox, setB, partAt, mkPath, pathAt, PA } = E;
  const sc = new L.Scene("supply", 10, 25);
  sc.sky = ["#9ADBFF", "#F1FAFF"];
  const T = (a, b, u) => lerp(a, b, u);
  const rr = rng(42);

  /* ---------- caméra (t local 0 → 15) ---------- */
  sc.keys = [
    [0.0, 1250, 1180, 0, 1.0, -45, 35.3, 0, 0],
    [1.8, 1250, 1100, 0, 0.9, -45, 35.3, 0, 0],
    [3.6, 1100, 700, 0, 0.42, -45, 35.3, 0, 0],
    [5.4, 260, 280, 0, 0.8, -40, 34, 0, 0],
    [7.0, 330, 880, 0, 0.7, -38, 34, 0, 0],
    [8.6, 1500, 800, 0, 0.62, -42, 35, 0, 0],
    [10.0, 1560, 140, 0, 0.9, -40, 34, 0, 0],
    [11.6, 1840, 170, 0, 0.98, -38, 34, 0, 0],
    [13.0, 2060, 210, 0, 0.98, -38, 34, 0, 0],
    [14.2, 2330, 300, 0, 0.8, -42, 35, 0, 0],
    [15.0, 2560, 380, 0, 0.9, -45, 35.3, 0, 0],
  ];
  // construction progressive depuis le restaurant (apparition par la distance)
  const rise = [];
  const origin = [1250, 1180];
  function box(o) { const b = sc.box(o); if (!o.norise) { b.h0 = b.h; b.rd = 0.5 + Math.hypot((o.x || 0) - origin[0], (o.y || 0) - origin[1]) / 2300 * 2.4; rise.push(b); } return b; }
  function wall(o) { // mur long : découpé en tronçons pour un tri correct
    const long = o.w >= o.d, L2 = long ? o.w : o.d, n = Math.max(1, Math.ceil(L2 / 100)), st = L2 / n;
    for (let k = 0; k < n; k++) box(Object.assign({}, o, long ? { x: o.x + k * st, w: st + 0.4 } : { y: o.y + k * st, d: st + 0.4 }));
  }
  function cyl(o) { const b = sc.cyl(o); b.h0 = b.h; b.rd = 0.5 + Math.hypot((o.x || 0) - origin[0], (o.y || 0) - origin[1]) / 2300 * 2.4; rise.push(b); return b; }
  sc.dyn((t) => { rise.forEach((b) => { b.h = b.h0 * eoutB((t - b.rd) / 0.8); if (b.h < 0.01) b.h = 0.01; }); });
  const groundGrow = (t) => sm5(prog(t, 0.2, 3.4)); // les terrains se déploient

  /* ---------- sol, routes, champs ---------- */
  sc.ground((t) => {
    const g = groundGrow(t);
    E.grect(-4000, -3000, 11000, 8000, 0, "#7CC24F");
    // damier discret de pelouse
    for (let i = -9; i < 40; i++) for (let j = -7; j < 28; j++) if ((i + j) % 2 === 0) E.grect(i * 100, j * 100, 100, 100, 0.1, "#85CB57", 0.55);
    // routes
    const road = (pts, wd) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1], L2 = Math.hypot(dx, dy), nx = -dy / L2 * wd / 2, ny = dx / L2 * wd / 2; E.gpoly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], 0.4, C.road); E.gdash(a[0], a[1], b[0], b[1], 0.6, "#E9EDF0", 2.5, 34, 30, 0.9); } };
    road([[-300, 600], [760, 600], [1000, 640], [1250, 600], [2600, 600]], 54);
    road([[1250, 600], [1250, 1160]], 50);
    road([[2200, 560], [2600, 560], [2600, 330], [3000, 330]], 50);
    // champ de pommes de terre (rangées)
    const field = (x0, y0, w, h, c1, c2, rows, along) => {
      E.grect(x0 - 8, y0 - 8, w + 16, h + 16, 0.3, "#6B8E3A");
      for (let r = 0; r < rows; r++) {
        const f = r / rows;
        if (along === "x") E.grect(x0, y0 + r * h / rows, w, h / rows, 0.5, r % 2 ? c1 : c2);
        else E.grect(x0 + r * w / rows, y0, w / rows, h, 0.5, r % 2 ? c1 : c2);
      }
    };
    // POMMES DE TERRE
    const px0 = -100, py0 = -60, pw = 780, ph = 560, rowsP = 22;
    E.grect(px0 - 10, py0 - 10, pw + 20, ph + 20, 0.3, "#5F7F33");
    const hv = harvestProgress(t);
    for (let r = 0; r < rowsP; r++) {
      const y = py0 + r * ph / rowsP, done = clamp(hv - r * 0.0, 0, 1);
      const split = lerp(px0 + pw, px0, rowDone(r, t)); // récolte : la partie à droite du récoltant est terre nue
      E.grect(px0, y, pw, ph / rowsP, 0.5, r % 2 ? "#7A4F2B" : "#8B5A32");
      // feuillage restant
      E.grect(px0, y + 3, Math.max(0, split - px0), ph / rowsP - 6, 0.7, r % 2 ? "#4E9B3A" : "#5CAF45");
    }
    // BLÉ
    const wx0 = -100, wy0 = 700, ww = 780, wh = 560, rowsW = 26;
    E.grect(wx0 - 10, wy0 - 10, ww + 20, wh + 20, 0.3, "#8F9A3C");
    for (let r = 0; r < rowsW; r++) {
      const y = wy0 + r * wh / rowsW;
      const split = lerp(wx0 + ww, wx0, rowDoneW(r, t));
      E.grect(wx0, y, ww, wh / rowsW, 0.5, "#D9C27A");
      E.grect(wx0, y + 1, Math.max(0, split - wx0), wh / rowsW - 2, 0.7, r % 2 ? "#E8B84A" : "#F0C45A");
      // épis : traits clairs
      if (split > wx0) for (let k = 0; k < 28; k++) { const x = wx0 + 14 + k * 28; if (x < split) E.gline(x, y + 2, x, y + wh / rowsW - 3, 0.8, "#F7DA7E", 1.4, 0.9); }
    }
    // pâturage
    E.grect(790, 690, 400, 440, 0.3, "#5FAE3F"); E.grect(800, 700, 380, 420, 0.4, "#78C550");
    // chemins en terre
    E.grect(-120, 520, 900, 40, 0.35, "#C9B48A"); E.grect(700, 520, 70, 700, 0.35, "#C9B48A");
    // zones béton des usines
    E.grect(1230, -50, 1240, 620, 0.35, "#D5DAE0"); E.grect(1280, 650, 650, 380, 0.35, "#D5DAE0"); E.grect(1960, 650, 560, 380, 0.35, "#D5DAE0"); E.grect(2320, 40, 420, 420, 0.35, "#D5DAE0");
    E.grect(1160, 1050, 200, 260, 0.35, "#D5DAE0");
    // plaque restaurant + parking
    E.grect(1120, 1080, 250, 230, 0.4, "#59606B"); for (let i = 0; i < 5; i++) E.gline(1140 + i * 50, 1230, 1140 + i * 50, 1290, 0.6, "#fff", 2, 0.8);
  });
  // progression de récolte (le récoltant avance de rangée en rangée)
  function harvestProgress(t) { return clamp((t - 3.4) / 3.8, 0, 1); }
  function rowDone(r, t) { const rows = 22, start = 3.6 + r * 0.14; return eio(clamp((t - start) / 0.9, 0, 1)); }
  function rowDoneW(r, t) { const start = 5.8 + r * 0.075; return eio(clamp((t - start) / 0.9, 0, 1)); }

  /* ---------- ferme : bâtiments, silos, arbres ---------- */
  box({ x: -90, y: 570, w: 110, d: 80, h: 42, c: "#F6EFDD" }); sc.roof({ x: -90, y: 570, z: 42, w: 110, d: 80, rh: 36, c: "#C0392B", gable: "#F6EFDD" });
  box({ x: 70, y: 575, w: 120, d: 90, h: 50, c: C.red }); sc.roof({ x: 70, y: 575, z: 50, w: 120, d: 90, rh: 40, c: "#8A1F17", gable: C.red, axis: "y" });
  box({ x: 100, y: 668, w: 60, d: 2, h: 34, c: "#fff", noShadow: true, flat: true });
  cyl({ x: 250, y: 610, r: 26, h: 90, c: "#D8DEE6", top: "#F2F6FA", band: ["#9AA6B5", 0.55, 0.6] });
  cyl({ x: 306, y: 610, r: 26, h: 74, c: "#D8DEE6", top: "#F2F6FA", band: ["#9AA6B5", 0.55, 0.6] });
  for (let i = 0; i < 9; i++) E_tree(-180 + i * 30, 540 + (i % 2) * 14);
  for (let i = 0; i < 14; i++) E_tree(720 + (i % 2) * 20, -60 + i * 70);
  for (let i = 0; i < 12; i++) E_tree(1210 + (i % 3) * 10, 700 + i * 28 * 0 + i * 26);
  function E_tree(x, y) { const s = 0.9 + rr() * 0.5; box({ x: x - 3 * s, y: y - 3 * s, w: 6 * s, d: 6 * s, h: 14 * s, c: C.soil2, noShadow: true, flat: true }); cyl({ x, y, z: 12 * s, r: 17 * s, h: 20 * s, c: "#3E9A3A", top: "#5BB546" }); cyl({ x, y, z: 28 * s, r: 11 * s, h: 18 * s, c: "#3E9A3A", top: "#6CC651" }); }
  // clôtures de l'enclos
  for (let i = 0; i <= 10; i++) { box({ x: 790 + i * 38, y: 690, w: 4, d: 4, h: 18, c: "#E9DFC9", noShadow: true }); box({ x: 790 + i * 38, y: 1126, w: 4, d: 4, h: 18, c: "#E9DFC9", noShadow: true }); }
  for (let i = 0; i <= 11; i++) { box({ x: 790, y: 690 + i * 40, w: 4, d: 4, h: 18, c: "#E9DFC9", noShadow: true }); box({ x: 1186, y: 690 + i * 40, w: 4, d: 4, h: 18, c: "#E9DFC9", noShadow: true }); }
  // étable
  box({ x: 1060, y: 710, w: 110, d: 90, h: 46, c: "#B9573A" }); sc.roof({ x: 1060, y: 710, z: 46, w: 110, d: 90, rh: 38, c: "#6B3A2A", gable: "#B9573A" });
  // vaches (dynamiques, légèrement mobiles)
  const cows = [];
  for (let i = 0; i < 9; i++) {
    const cb = newBox({ c: "#F6F6F2", top: "#fff", bias: 10 }), sp = newBox({ c: "#2B2B2B", top: "#3b3b3b", bias: 11 }), hd = newBox({ c: "#F6F6F2", top: "#fff", bias: 11 }), lg = newBox({ c: "#2B2B2B", top: "#3b3b3b", bias: 9 });
    cows.push({ cb, sp, hd, lg, x: 830 + (i % 3) * 110 + rr() * 30, y: 750 + Math.floor(i / 3) * 110 + rr() * 30, ph: rr() * 6, ang: rr() * 6.28 });
  }
  sc.dyn((t, f) => {
    cows.forEach((c) => {
      const mv = Math.sin(t * 0.6 + c.ph) * 18, a = c.ang + Math.sin(t * 0.3 + c.ph) * 0.3, X = c.x + Math.cos(a) * mv * 0.3, Y = c.y + Math.sin(a) * mv * 0.3;
      partAt(c.cb, X, Y, a, 0, 0, 12, 34, 16, 16); partAt(c.sp, X, Y, a, 2, 4, 22, 12, 8, 3); partAt(c.hd, X, Y, a, 22, 0, 18, 11, 11, 12); partAt(c.lg, X, Y, a, 0, 0, 0, 28, 12, 12);
      f.push(c.cb); f.push(c.sp); f.push(c.hd); f.push(c.lg);
    });
  });

  /* ---------- engins agricoles ---------- */
  function mkMachine(col, big) {
    const body = newBox({ c: col, top: mix(col, "#fff", 0.2), edge: "rgba(255,255,255,0.3)", bias: 14 }), cab = newBox({ c: "#2A3B52", top: "#8FB4D6", bias: 15, band: ["#B7D6EE", 0.3, 0.8] }), wh = [], hd = newBox({ c: "#555", top: "#777", bias: 14 });
    for (let i = 0; i < 4; i++) wh.push(newBox({ c: "#14181F", top: "#2A303A", bias: 13, noShadow: true }));
    return { body, cab, wh, hd, big };
  }
  function poseMachine(m, x, y, hd, ws) {
    const k = m.big ? 1.4 : 1;
    partAt(m.body, x, y, hd, 0, 0, 10, 60 * k, 34 * k, 22 * k); partAt(m.cab, x, y, hd, 12 * k, 0, 32 * k, 22 * k, 26 * k, 22 * k); partAt(m.hd, x, y, hd, 40 * k, 0, 6, 16 * k, 56 * k, 16 * k);
    [[-20, -22], [-20, 22], [22, -22], [22, 22]].forEach((p, i) => partAt(m.wh[i], x, y, hd, p[0] * k, p[1] * k, 0, 18 * k, 8, 22 * k));
  }
  const pot = mkMachine("#E3A21A", true), whe = mkMachine("#2E7D32", true), trac = mkMachine("#C0392B", false);
  // récoltant de pommes de terre : balaye les rangées, de droite à gauche puis rangée suivante
  function harvesterPose(t) {
    const rows = 22, rowH = 560 / rows; let r = Math.floor((t - 3.6) / 0.14); r = clamp(r, 0, rows - 1); const u = rowDone(r, t);
    const x = lerp(680, -100, u), y = -60 + (r + 0.5) * rowH;
    return { x, y, hd: Math.PI, on: t > 3.4 && t < 7.2 + 0.5 };
  }
  function combinePose(t) {
    const rows = 26, rowH = 560 / rows; let r = Math.floor((t - 5.8) / 0.075); r = clamp(r, 0, rows - 1); const u = rowDoneW(r, t);
    return { x: lerp(680, -100, u), y: 700 + (r + 0.5) * rowH, hd: Math.PI, on: t > 5.6 && t < 8.2 };
  }
  sc.dyn((t, f) => {
    const h = harvesterPose(t), c = combinePose(t);
    poseMachine(pot, h.on ? h.x : 700, h.on ? h.y : 480, Math.PI, 0); [pot.body, pot.cab, pot.hd].concat(pot.wh).forEach((b) => f.push(b));
    poseMachine(whe, c.on ? c.x : 700, c.on ? c.y : 1200, Math.PI, 0); [whe.body, whe.cab, whe.hd].concat(whe.wh).forEach((b) => f.push(b));
    const tx = lerp(-40, 640, (Math.sin(t * 0.4) + 1) / 2); poseMachine(trac, tx, 535, 0, 0); [trac.body, trac.cab, trac.hd].concat(trac.wh).forEach((b) => f.push(b));
  });

  /* ---------- camion fournisseur (plateau + caisses) ---------- */
  const flat = { body: newBox({ c: "#2F6FB5", top: "#5E96D6", bias: 14 }), cab: newBox({ c: "#2F6FB5", top: "#6AA1DD", bias: 15, band: ["#cfe6f7", 0.35, 0.8] }), bed: newBox({ c: "#9A6B3B", top: "#B88650", bias: 13 }), crates: [], wh: [] };
  for (let i = 0; i < 8; i++) flat.crates.push(newBox({ c: "#D8A24A", top: "#E8B96A", edge: "rgba(0,0,0,0.2)", bias: 16 }));
  for (let i = 0; i < 4; i++) flat.wh.push(newBox({ c: "#14181F", top: "#2A303A", bias: 12, noShadow: true }));
  const truckRoute = L.mkRoute(7.0, 150, [[640, 600, 0.4], [1250, 600, 0], [1250, 600, 0], [1330, 600, 0]]);
  // camion de pommes de terre : entre 6,8 s et 9 s
  sc.dyn((t, f) => {
    const o = L.routeAt(truckRoute, t); const vis = t > 6.4; if (!vis) return;
    const hd = o.ang, n = clamp(Math.floor((t - 6.4) / 0.25), 0, 8);
    partAt(flat.bed, o.x, o.y, hd, 0, 0, 12, 90, 40, 8); partAt(flat.cab, o.x, o.y, hd, 56, 0, 12, 30, 40, 30); partAt(flat.body, o.x, o.y, hd, 50, 0, 8, 12, 36, 10);
    [[-30, -22], [-30, 22], [46, -22], [46, 22]].forEach((p, i) => partAt(flat.wh[i], o.x, o.y, hd, p[0], p[1], 0, 20, 8, 20));
    f.push(flat.bed); f.push(flat.cab); f.push(flat.body); flat.wh.forEach((b) => f.push(b));
    for (let i = 0; i < n; i++) { const col = i % 4, row = Math.floor(i / 4); partAt(flat.crates[i], o.x, o.y, hd, -28 + col * 22, row ? 9 : -9, 20, 20, 17, 16); f.push(flat.crates[i]); }
  });
  // balles de paille / caisses empilées aux champs
  for (let i = 0; i < 6; i++) cyl({ x: 620 + (i % 3) * 36, y: 1290 + Math.floor(i / 3) * 34, z: 0, r: 15, h: 26, c: "#E1B24A", top: "#F2C860" });
  for (let i = 0; i < 6; i++) box({ x: 700 + (i % 3) * 24, y: 480 + Math.floor(i / 3) * 24, w: 22, d: 22, h: 14, c: "#C48F43", edge: "rgba(0,0,0,0.2)" });

  /* ---------- usine de frites (cutaway) ---------- */
  const FX = 1260, FY = 20, FW = 1180, FD = 480;
  sc.ground(() => { E.grect(FX, FY, FW, FD, 6, "#DDE3EA"); for (let x = FX; x <= FX + FW; x += 60) E.gline(x, FY, x, FY + FD, 6.2, "#C2CBD6", 1, 0.7); for (let y = FY; y <= FY + FD; y += 60) E.gline(FX, y, FX + FW, y, 6.2, "#C2CBD6", 1, 0.7); E.grect(FX + 40, LY + 70, FW - 80, 14, 6.3, "#FFC72C", 0.9); });
  // murs bas vitrés
  wall({ x: FX, y: FY, w: FW, d: 10, h: 60, c: "#F4F7FA", band: [C.red, 0.82, 1], noShadow: false });
  wall({ x: FX + FW - 10, y: FY, w: 10, d: FD, h: 60, c: "#F4F7FA", band: [C.red, 0.82, 1] });
  box({ x: FX, y: FY + FD - 10, w: FW * 0.55, d: 10, h: 24, c: "#F4F7FA", noShadow: true });
  box({ x: FX, y: FY, w: 10, d: FD, h: 24, c: "#F4F7FA", noShadow: true });
  // ligne de production
  const LY = 200; // axe de la ligne
  const ST = { intake: 1330, wash: 1450, peel: 1580, cut: 1710, fry: 1860, freeze: 2030, pack: 2200 };
  // convoyeur principal
  const beltPath = [[1300, LY], [ST.pack + 40, LY]];
  class Belt extends E.Box { constructor(o, dir) { super(o); this.dir = dir; } draw(t) { super.draw(); const zt = this.z + this.h + 0.5; ctx.strokeStyle = "rgba(255,199,44,0.85)"; ctx.lineWidth = Math.max(1, 1.8 * E.cam.scale); const ph = ((t * 60) % 24) / 24; for (let k = -3; k <= 3; k++) { const p = (k + ph) * 24, cx = this.x + this.w / 2 + p; if (Math.abs(p) > this.w / 2 - 3) continue; const cy = this.y + this.d / 2; ctx.beginPath(); E.P(cx - 4, cy - 8, zt); ctx.moveTo(E.px(), E.py()); E.P(cx + 4, cy, zt); ctx.lineTo(E.px(), E.py()); E.P(cx - 4, cy + 8, zt); ctx.lineTo(E.px(), E.py()); ctx.stroke(); } } }
  for (let x = 1300; x < ST.pack + 40; x += 60) { const b = new Belt({ x, y: LY - 18, w: 60.5, d: 36, z: 6, h: 22, c: "#8E9AA8", top: "#2A3340", edge: "rgba(255,199,44,0.7)", sideC: "#A9B4C0" }, 1); sc.add(b); b.h0 = 22; b.rd = 0.5 + Math.hypot(x - origin[0], LY - origin[1]) / 2300 * 2.4; rise.push(b); }
  // postes de travail
  box({ x: ST.intake - 40, y: LY - 60, w: 80, d: 120, z: 6, h: 36, c: "#B7791F", top: "#D9A441", edge: "rgba(0,0,0,0.2)" }); // trémie
  cyl({ x: ST.wash, y: LY, z: 28, r: 34, h: 40, c: "#2E86C9", top: "#7CC4F5", band: ["#E8F6FF", 0.45, 0.58] }); box({ x: ST.wash - 40, y: LY - 40, w: 80, d: 80, z: 6, h: 22, c: "#8FA3B8" });
  box({ x: ST.peel - 40, y: LY - 40, w: 80, d: 80, z: 6, h: 54, c: "#C9D2DC", top: "#EEF3F8", band: ["#EF9A9A", 0.5, 0.6] });
  box({ x: ST.cut - 40, y: LY - 38, w: 80, d: 76, z: 6, h: 66, c: "#8895A5", top: "#C5CFDA", band: [C.yellow, 0.4, 0.5] });
  box({ x: ST.fry - 70, y: LY - 50, w: 140, d: 100, z: 6, h: 34, c: "#A0521D", top: "#E58A2B", edge: "rgba(255,255,255,0.3)" });
  box({ x: ST.freeze - 90, y: LY - 55, w: 180, d: 110, z: 6, h: 62, c: "#CFEFFF", top: "#E9F8FF", band: ["#4FB5EE", 0.45, 0.58], edge: "rgba(120,200,255,0.6)" });
  box({ x: ST.pack - 50, y: LY - 55, w: 100, d: 110, z: 6, h: 44, c: "#E8ECF1", top: "#fff", band: [C.red, 0.55, 0.7] });
  // table du bras de conditionnement
  const packArm = { x: ST.pack, y: LY - 90 };
  box({ x: packArm.x - 14, y: packArm.y - 14, w: 28, d: 28, z: 6, h: 30, c: "#1F3B73", top: "#4B6CB7", band: [C.yellow, 0.15, 0.25] });
  sc.add({ key() { E.P(packArm.x, packArm.y, 90); return E.pd() + 80; }, draw(t) { const ph = Math.sin(t * 2.4); const tx = packArm.x + 40 * Math.cos(t * 1.2), ty = packArm.y + 38 + 18 * Math.sin(t * 1.2), tz = 70 + 14 * ph; E.limb(packArm.x, packArm.y, 38, (packArm.x + tx) / 2, (packArm.y + ty) / 2, 100, 9, C.red); E.limb((packArm.x + tx) / 2, (packArm.y + ty) / 2, 100, tx, ty, tz, 8, C.yellow); E.ball(packArm.x, packArm.y, 38, 9, "#4B6CB7"); } });
  // cheminée et bâtiment technique
  cyl({ x: 1330, y: 440, r: 20, h: 140, c: "#D0D6DE", top: "#EEF2F6", band: [C.red, 0.78, 0.9] });
  box({ x: 1380, y: 360, w: 160, d: 120, h: 60, c: "#E9EDF2", top: "#fff", band: [C.red, 0.78, 1] });
  // réservoirs d'huile / silos
  for (let i = 0; i < 3; i++) cyl({ x: 2280 + i * 52, y: 420, r: 22, h: 70, c: "#E8ECF1", top: "#fff", band: [C.yellow, 0.4, 0.5] });
  // produits finis : palettes rouge/jaune près de la sortie
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { box({ x: 2250 + i * 34, y: 330 + j * 0 + (i % 2) * 2, w: 28, d: 28, z: 6, h: 6 + 0, c: "#B98550", noShadow: true }); box({ x: 2252 + i * 34, y: 332 + (i % 2) * 2, w: 24, d: 24, z: 12, h: 22 + j * 0, c: i % 2 ? C.red : C.yellow, top: i % 2 ? "#EF5A4E" : "#FFE07A", band: ["#fff", 0.45, 0.6] }); break; }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) box({ x: 1300 + i * 36, y: 330 + k * 30, z: 6, w: 30, d: 26, h: 18, c: ["#C48F43", "#D8A24A", "#B07A34"][(i + k) % 3], edge: "rgba(0,0,0,0.2)" });
  // salle de contrôle vitrée
  box({ x: 1900, y: 340, w: 160, d: 100, z: 6, h: 56, c: "#EAF4F8", top: "#fff", win: { rows: 1, cols: 4, color: "#7BB4D4", lit: "#CDEBFA", seed: 2 }, band: [C.red, 0.86, 1] });
  // ouvriers (blouse blanche + charlotte)
  const workers = [];
  function mkWorker(x, y, shirt, hair, path, speed, dwell, hat) { const p = new L.Person({ shirt, cap: hat || "#fff", pants: "#2B3447", skin: rr() < 0.5 ? C.skin : C.skin2 }); workers.push({ p, R: L.patrol(path, rr() * 4, speed, dwell), x, y }); return p; }
  mkWorker(0, 0, "#FFFFFF", "#fff", [[1360, 300], [1700, 300]], 34, 2.2);
  mkWorker(0, 0, "#FFFFFF", "#fff", [[1900, 310], [2200, 310]], 34, 2.6);
  mkWorker(0, 0, "#2FA24A", "#fff", [[1500, 110], [1800, 110]], 30, 1.8);
  mkWorker(0, 0, "#FFFFFF", "#fff", [[2100, 100], [2330, 100]], 30, 2.1);
  sc.dyn((t, f) => { workers.forEach((w) => { const o = L.routeAt(w.R, t); w.p.pose(o.x, o.y, o.ang, o.mov, t, 6); w.p.push(f); }); });

  /* ---------- héros : pomme de terre → frite → boîte ---------- */
  const heroPath = L.mkRoute(0, 1, [[0, 0]]);
  // trajets : champ → camion → usine
  function heroPos(t) {
    if (t < 4.2) return { x: 300, y: 270, z: 4, stage: 0 };
    if (t < 6.2) { const u = prog(t, 4.2, 6.2); const hv = harvesterPose(t); return { x: hv.x - 18, y: hv.y, z: 22, stage: 0 }; }
    if (t < 7.3) { const o = L.routeAt(truckRoute, t); return { x: o.x - 4, y: o.y, z: 30, stage: 0 }; }
    if (t < 9.1) { const o = L.routeAt(truckRoute, t); return { x: o.x, y: o.y, z: 30, stage: 0 }; }
    // à l'usine : suivi de la ligne
    const lx = lerp(1300, ST.pack + 30, eio(prog(t, 9.2, 13.0)));
    const stage = lx < ST.cut + 10 ? 0 : 1;
    return { x: lx, y: LY, z: 32, stage, line: true };
  }
  const hero = { pot: newBox({ c: "#B9854B", top: "#D7A96A", bias: 30 }), pot2: newBox({ c: "#A67340", top: "#C9975B", bias: 30 }), fries: [], boxb: newBox({ c: C.red, top: "#EF5A4E", band: [C.yellow, 0.4, 0.62], bias: 32 }), fl: newBox({ c: C.red, top: "#EF5A4E", bias: 33 }) };
  for (let i = 0; i < 7; i++) hero.fries.push(newBox({ c: "#F2B21E", top: "#FFD54D", bias: 31, noShadow: true }));
  sc.dyn((t, f) => {
    if (t < 4.0) return;
    const p = heroPos(t);
    if (t > 13.4) {
      // boîte rouge/jaune : palette puis camion
      const u = prog(t, 13.4, 14.4);
      setB(hero.boxb, lerp(ST.pack + 30, 2330, eio(prog(t, 13.4, 14.8))), lerp(LY, 330, eio(prog(t, 13.4, 14.8))), 30 + 4 * Math.sin(u * 3.14), 34, 28, 30, 0); f.push(hero.boxb); return;
    }
    if (p.stage === 0) {
      setB(hero.pot, p.x, p.y, p.z, 24, 18, 14, 0.4); setB(hero.pot2, p.x + 4, p.y + 3, p.z + 10, 16, 12, 9, 0.9); f.push(hero.pot); f.push(hero.pot2);
    } else {
      const wob = t > ST.fry ? 1 : 0;
      for (let i = 0; i < 7; i++) { setB(hero.fries[i], p.x - 8 + i * 3, p.y + (i % 2) * 2 - 3, p.z + (i % 3) * 3, 3.2, 3.2, 26, 0.1 * i); f.push(hero.fries[i]); }
      // cône de lueur
    }
  });
  // flux de pommes de terre/frites secondaires sur la ligne
  const stream = [];
  for (let k = 0; k < 34; k++) { const col = rr() < 0.5 ? "#C69A5E" : "#B58648"; stream.push({ t0: 9.0 + k * 0.45, b: newBox({ c: col, top: mix(col, "#fff", 0.25), bias: 28 }), fr: Array.from({ length: 4 }, () => newBox({ c: "#F2B21E", top: "#FFD54D", bias: 29, noShadow: true })) }); }
  sc.dyn((t, f) => {
    stream.forEach((s, ix) => {
      const u = (t - s.t0) / 4.4; if (u < 0 || u > 1) return;
      const x = lerp(1300, ST.pack + 30, u), y = LY + ((ix % 3) - 1) * 6;
      if (x < ST.cut) { setB(s.b, x, y, 28, 18, 14, 12, ix); f.push(s.b); }
      else s.fr.forEach((b, i) => { setB(b, x - 5 + i * 3.5, y + (i % 2) * 2, 28, 3.2, 3.2, 22, 0); f.push(b); });
    });
  });
  // bulles de friture et givre
  sc.over((t) => {
    for (let i = 0; i < 16; i++) { const ph = (t * 0.8 + i * 0.37) % 1; E.P(ST.fry - 40 + (i * 37) % 80, LY - 30 + ((i * 19) % 60), 44 + ph * 24); ctx.fillStyle = "rgba(255,240,200," + (0.8 * (1 - ph)) + ")"; ctx.beginPath(); ctx.arc(E.px(), E.py(), 2.6 * E.cam.scale * 1.2, 0, 6.28); ctx.fill(); }
    for (let i = 0; i < 20; i++) { const ph = (t * 0.5 + i * 0.29) % 1; E.P(ST.freeze - 80 + (i * 31) % 160, LY - 40 + ((i * 17) % 80), 70 - ph * 30); ctx.fillStyle = "rgba(255,255,255," + (0.9 * (1 - ph)) + ")"; ctx.beginPath(); ctx.arc(E.px(), E.py(), 2 * E.cam.scale * 1.2, 0, 6.28); ctx.fill(); }
    // fumée de cheminée
    for (let i = 0; i < 8; i++) { const ph = (t * 0.25 + i * 0.125) % 1; E.P(1330 + ph * 40, 440 + ph * 20, 150 + ph * 120); ctx.fillStyle = "rgba(255,255,255," + (0.35 * (1 - ph)) + ")"; ctx.beginPath(); ctx.arc(E.px(), E.py(), (6 + ph * 14) * E.cam.scale, 0, 6.28); ctx.fill(); }
  });

  /* ---------- boulangerie (pains) ---------- */
  const BX = 1300, BY = 680;
  sc.ground(() => { E.grect(BX, BY, 620, 330, 6, "#F7EBD0"); for (let x = BX; x <= BX + 620; x += 55) E.gline(x, BY, x, BY + 330, 6.2, "#E6D6AE", 1, 0.8); });
  wall({ x: BX, y: BY, w: 620, d: 10, h: 54, c: "#FFF3D0", band: [C.yellow, 0.8, 1] }); wall({ x: BX + 610, y: BY, w: 10, d: 330, h: 54, c: "#FFF3D0", band: [C.yellow, 0.8, 1] });
  box({ x: BX, y: BY + 320, w: 330, d: 10, h: 22, c: "#FFF3D0", noShadow: true }); box({ x: BX, y: BY, w: 10, d: 330, h: 22, c: "#FFF3D0", noShadow: true });
  const BL = BY + 160;
  for (let x = BX + 30; x < BX + 590; x += 60) { const b = new Belt({ x, y: BL - 18, w: 60.5, d: 36, z: 6, h: 20, c: "#8E9AA8", top: "#3A2F28", edge: "rgba(255,199,44,0.7)", sideC: "#A9B4C0" }, 1); sc.add(b); b.h0 = 20; b.rd = 3; rise.push(b); }
  box({ x: BX + 160, y: BL - 56, w: 130, d: 112, z: 6, h: 60, c: "#D9553D", top: "#F28B72", band: ["#FFD27A", 0.4, 0.55] }); // four
  box({ x: BX + 380, y: BL - 50, w: 100, d: 100, z: 6, h: 40, c: "#F1E7D4", top: "#fff", band: [C.red, 0.5, 0.65] }); // emballage
  cyl({ x: BX + 70, y: BL - 70, r: 28, h: 60, c: "#EADFC8", top: "#fff", band: ["#C7B98F", 0.5, 0.58] });
  const buns = [];
  for (let k = 0; k < 20; k++) buns.push({ t0: k * 0.65, b: newBox({ c: "#D69A4E", top: "#E9B56B", bias: 28 }), sd: newBox({ c: "#FFF1CC", top: "#fff", bias: 29, noShadow: true }), top: newBox({ c: "#E6A957", top: "#F5C57F", bias: 29 }) });
  sc.dyn((t, f) => {
    buns.forEach((s, i) => {
      const u = ((t - 5.5 - s.t0) % 13) / 13; if (t < 5.5 || u < 0) return;
      const x = lerp(BX + 40, BX + 560, u), y = BL + ((i % 3) - 1) * 7, raw = x < BX + 200;
      setB(s.b, x, y, 26, raw ? 14 : 20, raw ? 14 : 20, raw ? 7 : 8, 0); f.push(s.b);
      if (!raw) { setB(s.top, x, y, 34, 18, 18, 7, 0); f.push(s.top); setB(s.sd, x, y, 41, 8, 8, 1.5, 0.3); f.push(s.sd); }
    });
  });
  /* ---------- usine de viande (steaks) ---------- */
  const MX = 1990, MY = 680;
  sc.ground(() => { E.grect(MX, MY, 520, 330, 6, "#EEF1F5"); for (let x = MX; x <= MX + 520; x += 55) E.gline(x, MY, x, MY + 330, 6.2, "#D5DBE3", 1, 0.8); });
  wall({ x: MX, y: MY, w: 520, d: 10, h: 54, c: "#F4F7FA", band: [C.red, 0.8, 1] }); wall({ x: MX + 510, y: MY, w: 10, d: 330, h: 54, c: "#F4F7FA", band: [C.red, 0.8, 1] });
  box({ x: MX, y: MY + 320, w: 280, d: 10, h: 22, c: "#F4F7FA", noShadow: true }); box({ x: MX, y: MY, w: 10, d: 330, h: 22, c: "#F4F7FA", noShadow: true });
  const ML = MY + 160;
  for (let x = MX + 30; x < MX + 490; x += 60) { const b = new Belt({ x, y: ML - 18, w: 60.5, d: 36, z: 6, h: 20, c: "#8E9AA8", top: "#2A3340", edge: "rgba(255,199,44,0.7)", sideC: "#A9B4C0" }, 1); sc.add(b); b.h0 = 20; b.rd = 3; rise.push(b); }
  box({ x: MX + 40, y: ML - 50, w: 100, d: 100, z: 6, h: 50, c: "#B0B9C4", top: "#DDE4EC", band: ["#E57373", 0.4, 0.55] });
  box({ x: MX + 190, y: ML - 55, w: 120, d: 110, z: 6, h: 62, c: "#CFEFFF", top: "#E9F8FF", band: ["#4FB5EE", 0.45, 0.58] });
  box({ x: MX + 350, y: ML - 50, w: 100, d: 100, z: 6, h: 40, c: "#F1E7D4", top: "#fff", band: [C.red, 0.5, 0.65] });
  const pat = [];
  for (let k = 0; k < 20; k++) pat.push({ t0: k * 0.6, b: newBox({ c: "#7A4A32", top: "#9C6246", bias: 28, edge: "rgba(255,255,255,0.15)" }) });
  sc.dyn((t, f) => { pat.forEach((s, i) => { const u = ((t - 6.0 - s.t0) % 12) / 12; if (t < 6.0 || u < 0) return; const x = lerp(MX + 40, MX + 470, u), y = ML + ((i % 3) - 1) * 7; setB(s.b, x, y, 26, 16, 16, x < MX + 160 ? 9 : 5, 0); f.push(s.b); }); });
  /* ---------- laboratoire qualité ---------- */
  const QX = 2380, QY = 80;
  box({ x: QX, y: QY, w: 300, d: 220, h: 80, c: "#E8F3F7", top: "#F7FCFF", win: { rows: 2, cols: 5, color: "#6BA8C8", lit: "#BFE4F5", seed: 1 }, band: ["#2FA24A", 0.84, 0.96] });
  box({ x: QX + 20, y: QY + 230, w: 40, d: 8, h: 6, c: "#fff", noShadow: true, flat: true });
  // portique de contrôle au-dessus de la sortie de ligne
  const QG = { x: 2290, y: LY };
  [[-4, -50], [-4, 50]].forEach((p) => box({ x: QG.x + p[0], y: QG.y + p[1], w: 8, d: 8, z: 6, h: 70, c: "#2FA24A", top: "#6DD58A", edge: "rgba(255,255,255,0.4)" }));
  box({ x: QG.x - 4, y: QG.y - 50, w: 8, d: 108, z: 70, h: 10, c: "#2FA24A", top: "#6DD58A" });
  sc.over((t) => {
    const ph = 0.5 + 0.5 * Math.sin(t * 5); E.P(QG.x, QG.y - 44 + ph * 88, 30 + ph * 36); const a = E.px(), b = E.py(); E.P(QG.x, QG.y + 44 - ph * 0, 30 + ph * 36);
    ctx.strokeStyle = "rgba(120,255,160,0.95)"; ctx.lineWidth = 2.4; ctx.beginPath(); E.P(QG.x, QG.y - 48, 20 + ph * 50); ctx.moveTo(E.px(), E.py()); E.P(QG.x, QG.y + 48, 20 + ph * 50); ctx.lineTo(E.px(), E.py()); ctx.stroke();
    E.glow(QG.x, QG.y, 40, 120, "#5BE08C", 0.28);
  });
  // chercheur : blouse blanche + loupe
  const insp = new L.Person({ shirt: "#FFFFFF", cap: "#fff", pants: "#2B3447" });
  sc.dyn((t, f) => { insp.pose(QX + 60 + Math.sin(t * 0.6) * 30, QY + 250, -Math.PI / 2, true, t, 0); insp.push(f); });
  // enseignes (éléments de repère)
  window.SUPPLY_TAGS = { potato: [300, 250, 60], wheat: [300, 900, 60], cattle: [980, 880, 60], fries: [1750, 140, 90], bakery: [1600, 800, 80], meat: [2250, 800, 80], qc: [2530, 190, 100], resto: [1250, 1180, 120] };

  /* ---------- le restaurant d'origine ---------- */
  const RX = 1190, RY = 1120;
  box({ x: RX, y: RY, w: 150, d: 110, h: 46, c: "#FFF3D0", win: { rows: 1, cols: 4, color: "#7FB7DA", lit: "#CDEBFA", seed: 3 }, norise: true });
  box({ x: RX - 6, y: RY - 6, w: 162, d: 122, z: 46, h: 12, c: C.red, top: "#EF4B3E", norise: true });
  box({ x: RX + 20, y: RY + 20, w: 110, d: 70, z: 58, h: 6, c: "#F7F1E2", top: "#fff", norise: true });
  sc.add({ key() { E.P(RX + 75, RY + 55, 100); return E.pd() + 120; }, draw(t) { E.P(RX + 75, RY + 55, 104); L.drawArches(ctx, E.px(), E.py(), 0.5 * Math.max(0.5, E.cam.scale * 1.6), C.yellow, "#C99200"); } });
  sc.add({ key() { E.P(RX - 40, RY + 120, 40); return E.pd() + 90; }, draw(t) { E.P(RX - 40, RY + 120, 90); const s = Math.max(0.5, E.cam.scale * 1.6); ctx.fillStyle = "#6B4D2A"; ctx.fillRect(E.px() - 2 * s, E.py(), 4 * s, 56 * s); L.drawArches(ctx, E.px(), E.py() - 6 * s, 0.3 * s, C.yellow, "#C99200"); } });
  // parking : voitures
  [["#E53935", 0], ["#1E88E5", 1], ["#FDD835", 3]].forEach((c, i) => { const car = new L.Car(c[0], false); sc.dyn((t, f) => { car.pose(1150 + c[1] * 50 + 24, 1250, Math.PI / 2); car.push(f); }); });
  // flux de camions pickup d'autres fournisseurs (trafic)
  const traffic = [];
  for (let i = 0; i < 3; i++) traffic.push({ car: new L.Car(["#1E88E5", "#FFB300", "#43A047"][i], true), off: i * 5.3 });
  sc.dyn((t, f) => { traffic.forEach((c) => { const u = ((t + c.off) % 16) / 16; c.car.pose(lerp(-300, 2600, u), 600 + 12, 0); c.car.push(f); }); });

  window.SCENES.push(sc);
})();
