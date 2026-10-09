/* SCÈNE 3 — La logistique : centre de distribution, chambres froides, réseaux régionaux */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng, mix, newBox, setB, partAt, mkPath, pathAt, PA } = E;
  const sc = new L.Scene("logi", 25, 40);
  sc.sky = ["#7CCBF0", "#BFE9FA"];
  const rr = rng(77);

  sc.keys = [
    [0.0, 380, 250, 0, 0.82, -45, 35.3, 0, 0],
    [2.4, 420, 250, 0, 0.9, -38, 34, 0, 0],
    [4.6, 560, 240, 0, 0.95, -52, 36, 0, 0],
    [6.4, 1300, 330, 0, 0.36, -45, 37, 0, 0],
    [8.4, 1800, 280, 0, 0.5, -42, 36, 0, 0],
    [10.4, 2500, 300, 0, 0.5, -42, 36, 0, 0],
    [12.2, 1500, 420, 0, 0.42, -44, 36, 0, 0],
    [13.8, 850, 500, 0, 0.8, -40, 35, 0, 0],
    [15.0, 960, 500, 0, 1.0, -45, 35.3, 0, 0],
  ];

  /* ---------- mer + îles ---------- */
  sc.ground((t) => {
    E.grect(-4000, -3000, 11000, 8000, 0, "#5BB8EA");
    for (let i = -10; i < 50; i++) for (let j = -8; j < 30; j++) if ((i + j) % 2 === 0) E.grect(i * 120, j * 120, 120, 120, 0.1, "#63C0F0", 0.5);
    // vaguelettes
    for (let k = 0; k < 90; k++) { const x = -600 + (k * 313) % 4200, y = -500 + (k * 197) % 1600, ph = (t * 0.5 + k * 0.13) % 1; E.gline(x, y, x + 50, y, 0.2, "#fff", 2, 0.5 * (1 - Math.abs(ph - 0.5) * 2)); }
  });
  const ISL = [{ x: -60, y: -140, w: 1260, d: 760, c: "#7CC24F" }, { x: 1380, y: -120, w: 700, d: 620, c: "#8ACB5A" }, { x: 2260, y: -120, w: 700, d: 620, c: "#9AD069" }];
  function slab(x, y, w, d, h, top, side1, side2) {
    const T = E.trig(); const Q = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => { E.P(p[0], p[1], p[2]); if (i) ctx.lineTo(E.px(), E.py()); else ctx.moveTo(E.px(), E.py()); }); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    Q([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], side1); Q([[x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h]], side2);
    Q([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], top);
  }
  sc.ground((t) => { ISL.forEach((s) => { slab(s.x - 14, s.y - 14, s.w + 28, s.d + 28, 18, "#F3EBD6", "#D8CBA8", "#E9DFC6"); E.grect(s.x, s.y, s.w, s.d, 18.2, s.c); for (let a = 0; a < s.w / 110; a++) for (let b = 0; b < s.d / 110; b++) if ((a + b) % 2 === 0) E.grect(s.x + a * 110, s.y + b * 110, 110, 110, 18.3, "#fff", 0.07); }); });
  const Z0 = 18; // niveau des îles
  function B(o) { o.z = (o.z || 0) + Z0; return sc.box(o); }
  function Cy(o) { o.z = (o.z || 0) + Z0; return sc.cyl(o); }
  function Rf(o) { o.z = (o.z || 0) + Z0; return sc.roof(o); }
  function treeAt(x, y, s) { s = s || 1; B({ x: x - 3 * s, y: y - 3 * s, w: 6 * s, d: 6 * s, h: 14 * s, c: C.soil2, noShadow: true, flat: true }); Cy({ x, y, z: 12 * s, r: 16 * s, h: 20 * s, c: "#3E9A3A", top: "#5BB546" }); Cy({ x, y, z: 28 * s, r: 10 * s, h: 17 * s, c: "#3E9A3A", top: "#6CC651" }); }

  /* ---------- CENTRE DE DISTRIBUTION (île 1) ---------- */
  const DX = 90, DY = 40, DW = 640, DD = 340;
  sc.ground(() => { E.grect(DX - 20, DY - 20, DW + 40, DD + 40 + 150, 18.4, "#CBD1D9"); E.grect(DX, DY, DW, DD, 24, "#E6EAF0"); for (let x = DX; x <= DX + DW; x += 40) E.gline(x, DY, x, DY + DD, 24.2, "#CFD6DF", 1, 0.8); E.grect(DX - 60, DY + DD + 70, 1200, 70, 18.5, "#59606B"); E.gdash(DX - 60, DY + DD + 105, DX + 1140, DY + DD + 105, 18.6, "#E8ECEF", 2.5, 30, 24, 0.9); });
  const wallC = "#F4F6F9";
  function wall(o) { const long = o.w >= o.d, L2 = long ? o.w : o.d, n = Math.max(1, Math.ceil(L2 / 100)), st = L2 / n; for (let k = 0; k < n; k++) B(Object.assign({}, o, long ? { x: o.x + k * st, w: st + 0.4 } : { y: o.y + k * st, d: st + 0.4 })); }
  wall({ x: DX, y: DY, w: DW, d: 10, h: 90, c: wallC, band: [C.red, 0.82, 1] });
  wall({ x: DX + DW - 10, y: DY, w: 10, d: DD, h: 90, c: wallC, band: [C.red, 0.82, 1] });
  wall({ x: DX, y: DY + DD - 10, w: DW, d: 10, h: 26, c: wallC, noShadow: true });
  wall({ x: DX, y: DY, w: 10, d: DD, h: 26, c: wallC, noShadow: true });
  // rayonnages
  const SLOTS = [];
  for (let r = 0; r < 2; r++) for (let b = 0; b < 5; b++) {
    const bx = DX + 40 + b * 78, by = DY + 40 + r * 120;
    for (const lv of [0, 1]) B({ x: bx, y: by, z: 6 + lv * 46, w: 70, d: 40, h: 4, c: "#2B6CB0", top: "#4C8FD6" });
    [[0, 0], [66, 0], [0, 36], [66, 36]].forEach((p) => B({ x: bx + p[0], y: by + p[1], z: 6, w: 4, d: 4, h: 96, c: "#F28C28", top: "#FFB05C" }));
    for (const lv of [0, 1]) for (let k = 0; k < 2; k++) { const col = ["#D8A24A", "#E8EDF4", C.red, "#3DAA5D", C.yellow][(r * 3 + b + lv + k) % 5]; B({ x: bx + 6 + k * 32, y: by + 6, z: 10 + lv * 46, w: 28, d: 28, h: 30 - (k + lv) * 2, c: col, top: mix(col, "#fff", 0.25), edge: "rgba(0,0,0,0.15)" }); }
  }
  // palettes au sol près des quais
  for (let i = 0; i < 7; i++) { B({ x: DX + 40 + i * 62, y: DY + 270, z: 6, w: 44, d: 44, h: 6, c: "#B98550", noShadow: true }); B({ x: DX + 44 + i * 62, y: DY + 274, z: 12, w: 36, d: 36, h: 26 + (i % 3) * 6, c: [C.yellow, "#E8EDF4", C.red, "#3DAA5D"][i % 4], top: "#fff", band: ["rgba(255,255,255,0.7)", 0.45, 0.6] }); }

  /* chambre froide (aile bleue glacée) */
  const KX = 760, KY = 70, KW = 250, KD = 280;
  sc.ground(() => { E.grect(KX - 10, KY - 10, KW + 20, KD + 20, 18.4, "#BFD0DD"); E.grect(KX, KY, KW, KD, 24, "#D9F1FF"); for (let x = KX; x <= KX + KW; x += 40) E.gline(x, KY, x, KY + KD, 24.2, "#B7DCF2", 1, 0.9); });
  wall({ x: KX, y: KY, w: KW, d: 10, h: 100, c: "#CFEFFF", band: ["#4FB5EE", 0.82, 1] }); wall({ x: KX + KW - 10, y: KY, w: 10, d: KD, h: 100, c: "#CFEFFF", band: ["#4FB5EE", 0.82, 1] });
  wall({ x: KX, y: KY + KD - 10, w: KW, d: 10, h: 30, c: "#CFEFFF", flat: true, noShadow: true }); wall({ x: KX, y: KY, w: 10, d: KD, h: 30, c: "#CFEFFF", noShadow: true });
  for (let r = 0; r < 2; r++) for (let b = 0; b < 3; b++) {
    const bx = KX + 24 + b * 72, by = KY + 40 + r * 110;
    B({ x: bx, y: by, z: 6, w: 64, d: 40, h: 4, c: "#6FA8D6", top: "#9CC9EC" }); B({ x: bx, y: by, z: 52, w: 64, d: 40, h: 4, c: "#6FA8D6", top: "#9CC9EC" });
    for (const lv of [0, 1]) for (let k = 0; k < 2; k++) B({ x: bx + 5 + k * 30, y: by + 6, z: 10 + lv * 46, w: 26, d: 28, h: 30, c: ["#F6FBFF", "#E0F2FF", "#FFE3E0"][(b + k + lv) % 3], top: "#fff", band: ["#8FD0F5", 0.45, 0.6], edge: "rgba(120,190,240,0.6)" });
  }
  sc.over((t) => { for (let i = 0; i < 26; i++) { const ph = (t * 0.35 + i * 0.173) % 1, x = KX + 20 + (i * 53) % 210, y = KY + 20 + (i * 37) % 240; E.P(x, y, Z0 + 110 - ph * 90); ctx.fillStyle = "rgba(255,255,255," + 0.9 * Math.sin(ph * 3.14) + ")"; ctx.beginPath(); ctx.arc(E.px() + Math.sin(t + i) * 4, E.py(), 2.4 * E.cam.scale * 1.4, 0, 6.28); ctx.fill(); } });

  /* panneaux températures */
  function tempBoard(x, y, txt, col) { sc.add({ key() { E.P(x, y, 90); return E.pd() + 70; }, draw(t) { E.P(x, y, Z0 + 86); const s = Math.max(0.6, E.cam.scale * 1.5), X = E.px(), Y = E.py(); ctx.save(); ctx.fillStyle = "#0E2A47"; ctx.fillRect(X - 36 * s, Y - 14 * s, 72 * s, 28 * s); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(X - 36 * s, Y - 14 * s, 72 * s, 28 * s); ctx.fillStyle = col; ctx.font = "700 " + 18 * s + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, X, Y + 1 * s); ctx.restore(); } }); }
  tempBoard(KX + KW / 2, KY + 4, "−18 °C", "#7FE3FF"); tempBoard(DX + 200, DY + 4, "+3 °C", "#9BFFB0");

  /* tableaux de stock holographiques */
  sc.over((t) => {
    const hp = (x, y, z, w, h) => {
      E.planeBegin(x, y, z, 1, 0, 0, 0, 0, -1);
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = "rgba(34,150,230,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { const bh = (0.25 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.9))) * (h - 14); ctx.fillStyle = i % 2 ? C.red : C.yellow; ctx.fillRect(8 + i * (w - 16) / 7, h - 6 - bh, (w - 16) / 7 - 4, bh); }
      ctx.restore();
    };
    hp(DX + 120, DY + 160, Z0 + 140, 92, 50); hp(DX + 380, DY + 160, Z0 + 140, 92, 50);
  });

  /* camions du centre : côté route, arrivent en roulant puis repartent chargés */
  const ROAD_Y = DY + DD + 105;
  const trucks = [];
  function addTruck(x0, dock, t0, cold, col) { const tk = new L.Truck({ L: 260, cold, cab: col || C.red, stripe: cold ? "#4FB5EE" : C.yellow }); tk.k = 0.5; const R = L.mkRoute(t0, 160, [[x0, ROAD_Y + 24, 0], [dock, ROAD_Y + 24, 5.5], [dock + 900, ROAD_Y + 24, 0]]); trucks.push({ tk, R }); }
  addTruck(-10, 330, -2.2, false); addTruck(-10, 620, -0.4, false); addTruck(-10, 880, 1.6, true, "#2E7DD1");
  sc.dyn((t, f) => {
    trucks.forEach((o) => {
      const p = L.routeAt(o.R, t), hd = p.ang; // cabine en tête : l'origine est l'arrière
      const back = 0; const ox = p.x - Math.cos(hd) * (o.tk.L + 110) * o.tk.k, oy = p.y - Math.sin(hd) * (o.tk.L + 110) * o.tk.k;
      o.tk.place(ox, oy, hd, 1, 0, o.tk.k); o.tk.parts.forEach((q) => { q.b.z += Z0; }); o.tk.push(f);
    });
  });
  // palettes chargées par chariots élévateurs
  const forks = [];
  for (let i = 0; i < 3; i++) forks.push({ body: newBox({ c: C.yellow, top: "#FFE07A", bias: 14, band: ["#222", 0.4, 0.5] }), mast: newBox({ c: "#555", top: "#777", bias: 15 }), pal: newBox({ c: "#B98550", bias: 14 }), ld: newBox({ c: [C.red, C.yellow, "#E8EDF4"][i], top: "#fff", band: ["rgba(255,255,255,0.7)", 0.45, 0.6], bias: 15 }), x: 330 + i * 290, off: i * 1.7 });
  sc.dyn((t, f) => {
    forks.forEach((k) => {
      const ph = ((t + k.off) % 5.2) / 5.2, going = ph < 0.5, u = going ? ph / 0.5 : (ph - 0.5) / 0.5, y = going ? lerp(DY + 290, DY + DD + 36, eio(u)) : lerp(DY + DD + 36, DY + 290, eio(u)), hd = going ? Math.PI / 2 : -Math.PI / 2;
      partAt(k.body, k.x, y, hd, 0, 0, Z0 + 4, 34, 24, 16); partAt(k.mast, k.x, y, hd, 20, 0, Z0 + 4, 5, 22, 40); f.push(k.body); f.push(k.mast);
      if (going) { partAt(k.pal, k.x, y, hd, 34, 0, Z0 + 12, 28, 28, 5); partAt(k.ld, k.x, y, hd, 34, 0, Z0 + 17, 24, 24, 24); f.push(k.pal); f.push(k.ld); }
    });
  });
  // préparateurs
  const prep = [];
  for (let i = 0; i < 4; i++) prep.push({ p: new L.Person({ shirt: [C.red, C.yellow, "#2E7DD1", "#fff"][i], pants: "#2B3447", cap: i % 2 ? C.red : C.yellow }), R: L.patrol([[DX + 60 + i * 120, DY + 250], [DX + 60 + i * 120, DY + 150]], i * 1.3, 28, 1.5) });
  sc.dyn((t, f) => prep.forEach((w) => { const o = L.routeAt(w.R, t); w.p.pose(o.x, o.y, o.ang, o.mov, t, Z0 + 6); w.p.push(f); }));

  /* ---------- réseaux régionaux ---------- */
  const NET = [];
  function resto(x, y, s) { s = s || 1; B({ x, y, w: 64 * s, d: 50 * s, h: 24 * s, c: "#FFF3D0", win: { rows: 1, cols: 3, color: "#7FB7DA", lit: "#CDEBFA", seed: 4 } }); B({ x: x - 4, y: y - 4, w: 72 * s, d: 58 * s, z: 24 * s, h: 8 * s, c: C.red, top: "#EF4B3E" }); const ax = x + 32 * s, ay = y + 25 * s; sc.add({ key() { E.P(ax, ay, 60); return E.pd() + 40; }, draw() { E.P(ax, ay, Z0 + 52 * s); L.drawArches(ctx, E.px(), E.py(), 0.2 * Math.max(0.5, E.cam.scale * 1.5) * s, C.yellow, "#C99200"); } }); }
  function region(ox, oy, name, withDC) {
    const reg = { ox, oy, routes: [], dc: [ox, oy] };
    // fournisseur (usine)
    B({ x: ox - 260, y: oy - 130, w: 110, d: 80, h: 44, c: "#E3E8EE", band: [C.red, 0.8, 1] }); Cy({ x: ox - 150, y: oy - 120, r: 12, h: 66, c: "#D0D6DE", top: "#fff", band: [C.red, 0.8, 0.9] });
    // champ du fournisseur
    sc.ground(() => { E.grect(ox - 300, oy - 220, 220, 70, 18.5, "#E8B84A"); E.grect(ox - 300, oy + 120, 200, 60, 18.5, "#7A4F2B"); });
    // DC régional
    B({ x: ox - 70, y: oy - 55, w: 140, d: 100, h: 40, c: "#F4F6F9", band: [C.red, 0.82, 1], win: { rows: 1, cols: 4, color: "#9ABBD4", lit: "#D5ECF9", seed: 5 } });
    Rf({ x: ox - 70, y: oy - 55, z: 40, w: 140, d: 100, rh: 20, c: "#3A78C2", gable: "#F4F6F9", over: 4 });
    // restaurants
    const rs = [[ox + 170, oy - 170], [ox + 240, oy - 20], [ox + 130, oy + 120], [ox + 260, oy + 130]];
    rs.forEach((p) => resto(p[0], p[1], 0.9));
    // routes
    const mk = (pts, col) => { const path = mkPath(pts, 30); reg.routes.push({ path, pts }); return path; };
    mk([[ox - 150, oy - 60], [ox - 150, oy + 80], [ox - 70, oy + 80]]);
    rs.forEach((p) => mk([[ox, oy + 50], [ox, oy + 90], [p[0] + 30, oy + 90], [p[0] + 30, p[1] + 60]]));
    sc.ground(() => { reg.routes.forEach((r) => { for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i]; E.gline(a[0], a[1], b[0], b[1], 18.7, "#59606B", 14, 1); E.gline(a[0], a[1], b[0], b[1], 18.8, "#E8ECEF", 1.4, 0.8); } }); });
    for (let i = 0; i < 8; i++) treeAt(ox - 270 + i * 70, oy + 210 - (i % 3) * 8, 0.9 + (i % 2) * 0.2);
    NET.push(reg);
  }
  region(1730, 190, "Réseau 2"); region(2610, 190, "Réseau 3");
  // réseau 1 (centre détaillé) : restaurants + routes
  const R1 = { ox: 900, oy: 330, routes: [] };
  const r1pts = [[860, 540], [1010, 540], [1010, 470], [1010, 420]];
  resto(980, 360, 1.1);
  resto(1060, 300, 0.9); resto(1070, 460, 0.9); resto(1110, 130, 0.9);
  sc.ground(() => { E.gline(DX + 400, ROAD_Y + 24, 1010, ROAD_Y + 24, 18.7, "#59606B", 14, 1); E.gline(1010, ROAD_Y + 24, 1010, 140, 18.7, "#59606B", 14, 1); E.gline(1010, 400, 1075, 400, 18.7, "#59606B", 14, 1); E.gline(1010, 260, 1130, 260, 18.7, "#59606B", 14, 1); E.gline(1010, 140, 1130, 140, 18.7, "#59606B", 14, 1); });
  for (let i = 0; i < 10; i++) treeAt(80 + i * 62, 600 + (i % 2) * 14, 1);
  for (let i = 0; i < 8; i++) treeAt(1130 + (i % 2) * 20, 20 + i * 70, 1.1);
  // champ fournisseur (île 1)
  sc.ground(() => { E.grect(DX + 100, DY + DD + 150, 360, 70, 18.5, "#E8B84A"); });

  // camions McDonald's sur chaque réseau (trajets DC → restaurants) + camions fournisseurs
  const netTrucks = [];
  NET.forEach((reg, ri) => {
    reg.routes.slice(1).forEach((r, k) => { const t0 = 6.8 + k * 1.1 + ri * 0.6; netTrucks.push({ tk: new L.Truck({ L: 150, cold: k % 2 === 0, cab: C.red, stripe: C.yellow }), r, off: t0, per: 6.4, scale: 0.55 }); });
    const r0 = reg.routes[0]; netTrucks.push({ tk: new L.Truck({ L: 150, cab: "#2E7DD1", stripe: C.yellow }), r: r0, off: 6.5 + ri, per: 5, scale: 0.55 });
  });
  sc.dyn((t, f) => {
    netTrucks.forEach((o) => {
      const u = (((t - o.off) % o.per) + o.per) % o.per / o.per, dir = u < 0.5 ? u / 0.5 : 1 - (u - 0.5) / 0.5;
      pathAt(o.r.path, dir * o.r.path.len); const hd = PA.ang + (u < 0.5 ? 0 : Math.PI), s = o.scale;
      o.tk.place(PA.x - Math.cos(hd) * 40, PA.y - Math.sin(hd) * 40, hd, 1, 0, 0.36); o.tk.parts.forEach((q) => { q.b.z += Z0; });
      o.tk.push(f);
    });
  });
  // flux lumineux : lignes de commande des réseaux (jaune pulsé)
  sc.over((t) => {
    const lines = [];
    NET.forEach((reg, ri) => reg.routes.forEach((r) => lines.push(r)));
    lines.forEach((r, k) => {
      const u = ((t * 0.35 + k * 0.17) % 1) * r.path.len; ctx.fillStyle = "#FFD23F";
      for (let d = 0; d < 3; d++) { pathAt(r.path, (u + d * 40) % r.path.len); E.P(PA.x, PA.y, Z0 + 8); ctx.globalAlpha = 1 - d * 0.3; ctx.beginPath(); ctx.arc(E.px(), E.py(), 4.5 * E.cam.scale * 1.3, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; }
    });
    // flux lumineux de l'île 1
    for (let k = 0; k < 3; k++) { const u = (t * 0.3 + k * 0.33) % 1; E.P(lerp(DX + 400, 1010, u), ROAD_Y + 24, Z0 + 10); ctx.fillStyle = "#FFD23F"; ctx.beginPath(); ctx.arc(E.px(), E.py(), 5 * E.cam.scale * 1.3, 0, 6.28); ctx.fill(); }
  });
  // camion final : DC → restaurant (île 1) ; suivi par la caméra en fin de scène
  const final = new L.Truck({ L: 230, cab: C.red, stripe: C.yellow });
  const FR = L.mkRoute(10.8, 150, [[DX + 440, ROAD_Y + 24, 0], [1010, ROAD_Y + 24, 0], [1010, 470, 0], [1010, 420, 0]]);
  sc.dyn((t, f) => { if (t < 10.4) return; const o = L.routeAt(FR, t); const hd = o.ang; final.place(o.x - Math.cos(hd) * (final.L + 110) * 0.5, o.y - Math.sin(hd) * (final.L + 110) * 0.5, hd, 1, 0, 0.5); final.parts.forEach((q) => { q.b.z += Z0; }); final.push(f); });
  // repères d'étiquettes
  window.LOGI_TAGS = { dc: [DX + 300, DY + 200, 130], cold: [KX + 125, KY + 150, 130], r2: [1730, 140, 120], r3: [2610, 140, 120], truck: [900, ROAD_Y + 24, 100], stock: [DX + 250, DY + 160, 150] };
  window.SCENES.push(sc);
})();
