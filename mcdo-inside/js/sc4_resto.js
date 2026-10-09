/* SCÈNE 4 — Le fonctionnement d'un restaurant : réception, stockage, bornes, cuisine, remise, drive, livraison */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng, mix, newBox, setB, partAt } = E;
  const sc = new L.Scene("resto", 40, 55);
  sc.sky = ["#9ADBFF", "#F4FBFF"];
  const rr = rng(2026);

  /* itinéraires par images-clés [t, x, y] */
  function kf(list) {
    return (t) => {
      let i = 0; while (i < list.length - 1 && t > list[i + 1][0]) i++;
      const a = list[i], b = list[Math.min(i + 1, list.length - 1)];
      const u = a === b ? 0 : clamp((t - a[0]) / (b[0] - a[0]), 0, 1), e = sm(u);
      const x = lerp(a[1], b[1], e), y = lerp(a[2], b[2], e);
      const dx = b[1] - a[1], dy = b[2] - a[2], mov = a !== b && u > 0 && u < 1 && Math.hypot(dx, dy) > 1;
      kf.last = kf.last || {}; const key = list; const st = (kf._m = kf._m || new Map()).get(key) || { ang: Math.atan2(dy, dx) || 0 };
      if (Math.hypot(dx, dy) > 1 && u > 0 && u < 1) st.ang = Math.atan2(dy, dx); else if (Math.hypot(dx, dy) > 1 && u >= 1) st.ang = Math.atan2(dy, dx);
      kf._m.set(key, st); return { x, y, ang: st.ang, mov };
    };
  }

  /* caméra */
  sc.keys = [
    [0.0, 850, 220, 0, 0.82, -52, 35.3, 0, 0],
    [1.5, 500, 280, 0, 0.62, -45, 35.3, 0, 0],
    [3.6, 330, 230, 0, 0.62, -45, 36, 0, 0],
    [4.8, 110, 150, 0, 0.98, -40, 34, 0, 0],
    [6.2, 480, 280, 0, 0.98, -44, 34, 0, 0],
    [8.0, 320, 100, 0, 1.08, -40, 34, 0, 0],
    [10.2, 310, 150, 0, 1.0, -40, 34, 0, 0],
    [11.8, 290, 290, 0, 1.0, -42, 34, 0, 0],
    [13.2, 540, 260, 0, 0.82, -48, 35, 0, 0],
    [15.0, 420, 240, 0, 0.5, -45, 36.5, 0, 0],
  ];

  /* sol : parking, route, drive */
  sc.ground((t) => {
    E.grect(-4000, -3000, 11000, 8000, 0, "#86CC57");
    for (let i = -9; i < 40; i++) for (let j = -7; j < 28; j++) if ((i + j) % 2 === 0) E.grect(i * 100, j * 100, 100, 100, 0.1, "#8FD562", 0.5);
    E.grect(-260, -140, 1130, 780, 0.3, "#5E6670"); // parking enrobé
    E.grect(-60, -40, 700, 500, 0.5, "#D6DAE0"); // dalle bâtiment
    // places de parking
    for (let i = 0; i < 12; i++) E.gline(-10 + i * 56, 480, -10 + i * 56, 560, 0.7, "#fff", 2.4, 0.85);
    E.grect(-200, 560, 960, 70, 0.4, "#4B535D"); E.gdash(-200, 595, 760, 595, 0.6, "#F2F4F6", 2.4, 30, 24, 0.9);
    // voie du drive (est)
    E.grect(630, -140, 90, 700, 0.45, "#4B535D"); E.gdash(675, -140, 675, 560, 0.7, "#FFC72C", 2.4, 22, 18, 0.9);
    // route de livraison (ouest)
    E.grect(-170, -140, 80, 770, 0.45, "#4B535D"); E.gdash(-130, -140, -130, 630, 0.7, "#F2F4F6", 2.4, 30, 24, 0.9);
    // trottoirs/pelouses
    E.grect(-60, 450, 700, 12, 0.6, "#EEE");
    E.grect(480, 470, 150, 60, 0.7, "#6FBE43", 0.0);
  });

  /* ---------- bâtiment ---------- */
  const BW = 620, BD = 440, FL = 6;
  const wallC = "#FFF6DE";
  function wall(o) { const long = o.w >= o.d, L2 = long ? o.w : o.d, n = Math.max(1, Math.ceil(L2 / 90)), st = L2 / n; for (let k = 0; k < n; k++) sc.box(Object.assign({}, o, long ? { x: o.x + k * st, w: st + 0.4 } : { y: o.y + k * st, d: st + 0.4 })); }
  sc.ground(() => { E.grect(0, 0, BW, BD, FL, "#F2E6CE"); // sol clair
    for (let x = 0; x < BW; x += 40) for (let y = 0; y < BD; y += 40) if (((x + y) / 40) % 2 === 0) E.grect(x, y, 40, 40, FL + 0.1, "#EADCBD");
    E.grect(0, 0, 180, 270, FL + 0.2, "#CFE6F2", 0.85); // zone stockage
    E.grect(180, 0, 280, 250, FL + 0.2, "#D9DEE4", 0.9); // cuisine
    E.grect(150, 250, 320, 60, FL + 0.2, "#F6D2CC", 0.85); // zone comptoir
    E.grect(0, 310, BW, 130, FL + 0.2, "#F6E4B2", 0.7); // salle
  });
  // murs : nord et est hauts ; sud et ouest bas
  wall({ x: 0, y: 0, w: BW, d: 12, z: FL, h: 96, c: wallC, band: [C.red, 0.86, 1] });
  wall({ x: BW - 12, y: 0, w: 12, d: 150, z: FL, h: 96, c: wallC, band: [C.red, 0.86, 1] });
  wall({ x: BW - 12, y: 215, w: 12, d: BD - 215, z: FL, h: 96, c: wallC, band: [C.red, 0.86, 1] });
  wall({ x: BW - 12, y: 150, w: 12, d: 65, z: FL + 46, h: 50, c: "#BFE3F7", a: 0.6 });
  wall({ x: 0, y: BD - 12, w: 270, d: 12, z: FL, h: 30, c: wallC, noShadow: true }); wall({ x: 350, y: BD - 12, w: 270, d: 12, z: FL, h: 30, c: wallC, noShadow: true });
  wall({ x: 0, y: 0, w: 12, d: 70, z: FL, h: 30, c: wallC, noShadow: true }); wall({ x: 0, y: 170, w: 12, d: BD - 170, z: FL, h: 30, c: wallC, noShadow: true });
  wall({ x: 0, y: BD - 12, w: BW, d: 6, z: FL + 30, h: 40, c: "#BFE3F7", a: 0.28, noShadow: true, flat: true });
  // piliers d'angle rouges
  [[0, 0], [BW - 16, 0], [0, BD - 16], [BW - 16, BD - 16]].forEach((p) => sc.box({ x: p[0], y: p[1], w: 16, d: 16, z: FL, h: 98, c: C.red, top: "#EF4B3E" }));

  /* ---------- toit qui se soulève ---------- */
  const roof = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const b = sc.box({ x: i * BW / 4 - 4, y: j * BD / 3 - 4, w: BW / 4 + 8, d: BD / 3 + 8, z: FL + 96, h: 14, c: C.red, top: "#EF4B3E", edge: "rgba(255,255,255,0.35)", bias: 30 });
    roof.push({ b, d: (i + j * 0.9) / 6 * 0.5, z0: b.z });
  }
  const sign = sc.add({ key() { E.P(60, 40, 260); return E.pd() + 80; }, draw() { const u = this.u == null ? 1 : this.u; E.P(40, 36, FL + 96 + 14 + this.dz); const s = Math.max(0.5, E.cam.scale * 1.6); ctx.save(); ctx.globalAlpha = u; L.drawArches(ctx, E.px(), E.py() - 50 * s, 0.55 * s, C.yellow, "#C99200"); ctx.fillStyle = "#8C8C8C"; ctx.fillRect(E.px() - 3 * s, E.py() - 10 * s, 6 * s, 14 * s); ctx.restore(); }, dz: 0, u: 1 });
  const ROOF_T = 1.8;
  sc.dyn((t) => { roof.forEach((r) => { const u = clamp((t - ROOF_T - r.d) / 1.1, 0, 1), e = eio(u); r.b.z = r.z0 + e * 520; r.b.a = 1 - Math.pow(u, 1.8); }); sign.dz = (roof[0].b.z - roof[0].z0); sign.u = roof[0].b.a; });

  /* ---------- stockage + réception ---------- */
  sc.box({ x: 18, y: 20, w: 120, d: 110, z: FL, h: 66, c: "#DDF1FB", top: "#F2FBFF", band: ["#4FB5EE", 0.45, 0.58], edge: "rgba(120,190,240,0.6)" }); // chambre froide
  sc.box({ x: 38, y: 130, w: 70, d: 6, z: FL, h: 46, c: "#9FD7F2", top: "#C6EAFB", noShadow: true });
  sc.box({ x: 60, y: 138, w: 26, d: 5, z: FL + 8, h: 18, c: "#fff", noShadow: true, flat: true }); // poignée
  // étagères de réserve sèche
  for (let k = 0; k < 3; k++) { sc.box({ x: 20 + k * 52, y: 190, z: FL, w: 46, d: 18, h: 4, c: "#6B7B8D" }); sc.box({ x: 20 + k * 52, y: 190, z: FL + 24, w: 46, d: 18, h: 4, c: "#6B7B8D" }); for (let l = 0; l < 2; l++) for (let q = 0; q < 2; q++) sc.box({ x: 24 + k * 52 + q * 20, y: 192, z: FL + 4 + l * 24, w: 18, d: 14, h: 16, c: [C.yellow, "#E8EDF4", C.red, "#3DAA5D", "#C48F43"][(k + l + q) % 5], edge: "rgba(0,0,0,0.15)" }); }
  const crates = [];
  for (let i = 0; i < 6; i++) crates.push({ b: newBox({ c: "#C48F43", top: "#E0A95D", edge: "rgba(0,0,0,0.2)", bias: 20 }), t0: 2.6 + i * 0.9 });
  // camion de livraison : arrive du sud, gare sa remorque le long du mur ouest
  const truck = new L.Truck({ L: 300, cab: C.red, stripe: C.yellow, cold: true });
  const TK = 0.42, tkx = -70;
  const truckAt = (t) => { const u = sm5(prog(t, -1.2, 1.4)); return { y: lerp(780, 250, u) }; };
  sc.dyn((t, f) => { const p = truckAt(t); truck.place(tkx, p.y, -Math.PI / 2, 1, 0, TK); truck.push(f); });
  // livreur : sort et transporte les caisses jusqu'à la réserve
  const driver = new L.Person({ shirt: "#2E7DD1", pants: "#2B3447", cap: "#2E7DD1" }), stock = new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447" });
  sc.dyn((t, f) => {
    // cycles de 1.8 s : camion → porte (10,100) → réserve (70,100)
    const cyc = 1.8; let x = tkx + 22, y = 190, mov = false, carry = false;
    for (let i = 0; i < 6; i++) { const t0 = 2.4 + i * cyc; if (t >= t0 && t < t0 + cyc) { const u = (t - t0) / cyc; if (u < 0.45) { x = lerp(tkx + 24, 60, u / 0.45); y = lerp(205, 105, u / 0.45); carry = true; mov = true; } else if (u < 0.55) { x = 60; y = 105; carry = false; } else { x = lerp(60, tkx + 24, (u - 0.55) / 0.45); y = lerp(105, 205, (u - 0.55) / 0.45); mov = true; } } }
    driver.pose(x, y, mov && carry ? 0 : (mov ? Math.PI : 0), mov, t, 0); driver.push(f);
    crates.forEach((c, i) => { const t0 = 2.4 + i * cyc; if (t < t0) return; const u = (t - t0) / cyc; let cx, cy, cz = FL + 12; if (u < 0.45) { cx = lerp(tkx + 24, 60, u / 0.45) + 8; cy = lerp(205, 105, u / 0.45); } else { cx = 28 + (i % 3) * 26; cy = 96 + Math.floor(i / 3) * 0; cz = FL + 0; if (u < 0.55) { cx = 68; cy = 105; } } if (u >= 0.55) { cx = 36 + (i % 3) * 24; cy = 100 + Math.floor(i / 3) * 22; cz = FL; } setB(c.b, cx, cy, u < 0.55 ? FL + 14 : cz, 20, 18, 14, 0); f.push(c.b); });
    const so = (Math.sin(t * 0.9) + 1) / 2; stock.pose(60 + so * 10, 160 + so * 12, 0, false, t, 0); stock.push(f);
  });

  /* ---------- cuisine ---------- */
  // plan de travail le long du mur nord
  sc.box({ x: 190, y: 18, w: 270, d: 28, z: FL, h: 30, c: "#C9D0D8", top: "#EEF2F6", edge: "rgba(255,255,255,0.5)" });
  // friteuses
  const FRY = [[205, 22], [255, 22]];
  FRY.forEach((p) => { sc.box({ x: p[0], y: p[1], w: 44, d: 40, z: FL, h: 34, c: "#B9C3CE", top: "#ECEFF3" }); sc.box({ x: p[0] + 4, y: p[1] + 4, w: 36, d: 30, z: FL + 33, h: 3, c: "#E8A33A", top: "#F8C76B", noShadow: true }); });
  // plaque / grill
  sc.box({ x: 320, y: 22, w: 60, d: 40, z: FL, h: 30, c: "#4A525C", top: "#2B2F36", edge: "rgba(255,255,255,0.3)" });
  sc.box({ x: 390, y: 22, w: 60, d: 40, z: FL, h: 30, c: "#C9D0D8", top: "#EEF2F6" });
  // table d'assemblage
  const AS = { x: 300, y: 90 };
  sc.box({ x: AS.x - 60, y: AS.y - 22, w: 120, d: 44, z: FL, h: 30, c: "#D9DEE4", top: "#F6F8FA", edge: "rgba(255,255,255,0.6)" });
  sc.box({ x: AS.x + 70, y: AS.y - 22, w: 24, d: 44, z: FL, h: 34, c: "#C9D0D8", top: "#fff" });
  [[-52, -14, "#E8D7A5"], [-30, -14, "#7A4A32"], [-8, -14, C.yellow], [14, -14, "#6CC450"], [36, -14, C.red]].forEach((b) => sc.box({ x: AS.x + b[0], y: AS.y + b[1], z: FL + 30, w: 18, d: 12, h: 6, c: b[2], top: mix(b[2], "#fff", 0.2), noShadow: true }));
  // bacs d'ingrédients
  // écrans cuisine (KDS)
  [[250, 8], [330, 8], [410, 8]].forEach((p, i) => sc.box({ x: p[0], y: p[1], z: FL + 56, w: 40, d: 5, h: 26, c: "#0F1B2D", top: "#1D2E4A", band: ["#7CD3FF", 0.15, 0.85], noShadow: true }));
  // lampes chauffantes
  for (let i = 0; i < 3; i++) sc.box({ x: 270 + i * 48, y: 70, z: FL + 62, w: 30, d: 12, h: 6, c: "#B71C1C", top: "#FF8A65", noShadow: true });
  // personnel de cuisine
  const crewK = [new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447", apron: "#222" }), new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447", apron: "#222" }), new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447", apron: "#222", skin: C.skin2 }), new L.Person({ shirt: "#fff", cap: C.red, pants: "#2B3447" })];
  const trayCrew = new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447", skin: C.skin3 });
  sc.dyn((t, f) => {
    // 0 : friteuse
    const a = crewK[0]; const fp = Math.sin(t * 1.5); a.pose(228, 70 + fp * 2, -Math.PI / 2, false, t, FL); a.push(f);
    // 1 : assemblage
    const b = crewK[1]; b.pose(AS.x - 10 + Math.sin(t * 2) * 3, AS.y + 34, -Math.PI / 2, false, t, FL); b.push(f);
    // 2 : grill
    const c = crewK[2]; c.pose(350, 74, -Math.PI / 2, false, t, FL); c.push(f);
    const d = crewK[3]; const mv = Math.sin(t * 0.8) * 30; d.pose(200 + 100 + mv, 150, mv > 0 ? 0 : Math.PI, true, t, FL); d.push(f);
  });
  // paniers de frites animés
  const basket = newBox({ c: "#555", top: "#888", bias: 18 }), fries = [];
  for (let i = 0; i < 9; i++) fries.push(newBox({ c: "#F2B21E", top: "#FFD54D", bias: 19, noShadow: true }));
  sc.dyn((t, f) => {
    const cyc = (t % 3.2) / 3.2, up = cyc < 0.55 ? 0 : sm((cyc - 0.55) / 0.2) * (cyc < 0.85 ? 1 : 1 - sm((cyc - 0.85) / 0.15));
    const bx = 227, by = 46, bz = FL + 18 + up * 26; setB(basket, bx, by, bz, 26, 20, 10, 0); f.push(basket);
    for (let i = 0; i < 9; i++) { setB(fries[i], bx - 9 + (i % 3) * 9, by - 6 + Math.floor(i / 3) * 6, bz + 8, 3.4, 3.4, 12, 0); f.push(fries[i]); }
  });

  /* ---------- le burger de la commande ---------- */
  const T_ORDER = { tap: 6.0, ticket0: 6.1, ticket1: 7.0, bun: 8.0, patty: 8.5, cheese: 8.9, lettuce: 9.3, tomato: 9.7, top: 10.1, tray: 10.8, carry0: 11.0, carry1: 12.4, pick: 12.9 };
  const L0 = FL + 30 + 3;
  function layer(name, tStart, make) { return { name, t0: tStart, ...make }; }
  const parts = [
    { t0: T_ORDER.bun, kind: "cyl", r: 17, h: 6, z: 0, c: "#D69A4E", top: "#E9B56B" },
    { t0: T_ORDER.patty, kind: "cyl", r: 16, h: 6, z: 6, c: "#6B3F2A", top: "#85543A" },
    { t0: T_ORDER.cheese, kind: "box", w: 36, d: 36, h: 2.4, z: 12, c: "#FFC72C", top: "#FFD84F" },
    { t0: T_ORDER.lettuce, kind: "cyl", r: 19, h: 3, z: 14.4, c: "#6CC450", top: "#8BE06A" },
    { t0: T_ORDER.tomato, kind: "cyl", r: 14, h: 3, z: 17.4, c: "#E5392C", top: "#FF5A4A" },
    { t0: T_ORDER.top, kind: "cyl", r: 17, h: 9, z: 20.4, c: "#D69A4E", top: "#EDBB74" },
  ];
  const bobj = parts.map((p) => p.kind === "cyl" ? new E.Cyl({ r: p.r, h: p.h, c: p.c, top: p.top, bias: 24 }) : newBox({ w: p.w, d: p.d, h: p.h, c: p.c, top: p.top, bias: 24 }));
  const seeds = []; for (let i = 0; i < 7; i++) seeds.push(newBox({ c: "#FFF1CC", top: "#fff", bias: 26, noShadow: true }));
  const tray = newBox({ c: C.red, top: "#EF4B3E", bias: 22 }), cup = new E.Cyl({ r: 7, h: 22, c: "#fff", top: "#eee", band: [C.red, 0.35, 0.65], bias: 25 }), carton = newBox({ c: C.red, top: "#EF4B3E", bias: 25, band: [C.yellow, 0.5, 0.8] }), cfries = [];
  for (let i = 0; i < 6; i++) cfries.push(newBox({ c: "#F2B21E", top: "#FFD54D", bias: 26, noShadow: true }));
  // position du plateau au cours du temps
  const COUNTER = { x: 300, y: 270 };
  const trayPos = (t) => {
    if (t < T_ORDER.carry0) return { x: AS.x + 40, y: AS.y + 6, z: FL + 30, on: t >= T_ORDER.tray - 0.5 };
    if (t < T_ORDER.carry1) { const u = sm((t - T_ORDER.carry0) / (T_ORDER.carry1 - T_ORDER.carry0)); return { x: lerp(AS.x + 40, COUNTER.x, u), y: lerp(AS.y + 6, COUNTER.y - 4, u), z: FL + 34, on: true }; }
    if (t < T_ORDER.pick) return { x: COUNTER.x, y: COUNTER.y - 4, z: FL + 30, on: true };
    const u = sm((t - T_ORDER.pick) / 1.3);
    return { x: lerp(COUNTER.x, 160, u), y: lerp(COUNTER.y - 4, 370, u), z: lerp(FL + 30, FL + 22, u), on: true };
  };
  sc.dyn((t, f) => {
    const tp = trayPos(t);
    // burger : assemblage couche par couche (chute) sur la table, puis sur le plateau
    const anchorX = t < T_ORDER.tray ? AS.x : tp.x - 8, anchorY = t < T_ORDER.tray ? AS.y : tp.y, baseZ = t < T_ORDER.tray ? L0 : tp.z + 6;
    parts.forEach((p, i) => { if (t < p.t0) return; const u = clamp((t - p.t0) / 0.35, 0, 1), drop = (1 - eout(u)) * 40; const o = bobj[i]; if (p.kind === "cyl") { o.x = anchorX; o.y = anchorY; o.z = baseZ + p.z + drop; } else { o.x = anchorX - p.w / 2; o.y = anchorY - p.d / 2; o.z = baseZ + p.z + drop; } o.a = u; f.push(o); });
    if (t >= T_ORDER.top + 0.25) seeds.forEach((s, i) => { setB(s, anchorX - 9 + (i % 4) * 5, anchorY - 4 + Math.floor(i / 4) * 6, baseZ + 29.4, 3, 2, 1.4, 0.3 * i); f.push(s); });
    if (tp.on) { setB(tray, tp.x, tp.y, tp.z, 64, 40, 4, 0); f.push(tray); setB(carton, tp.x + 12, tp.y + 6, tp.z + 4, 16, 10, 20, 0); f.push(carton); cfries.forEach((q, i) => { setB(q, tp.x + 6 + i * 2.5, tp.y + 6, tp.z + 22, 2.8, 2.8, 9, 0); f.push(q); }); cup.x = tp.x + 24; cup.y = tp.y - 8; cup.z = tp.z + 4; f.push(cup); }
  });
  // ticket qui vole de la borne vers l'écran de cuisine
  const ticketPath = (t) => { const u = clamp((t - T_ORDER.ticket0) / (T_ORDER.ticket1 - T_ORDER.ticket0), 0, 1), e = eio(u); return { x: lerp(500, 330, e), y: lerp(290, 12, e), z: FL + 40 + 70 * Math.sin(Math.PI * e) + e * 30, u }; };
  sc.over((t) => {
    if (t < T_ORDER.ticket0 || t > T_ORDER.ticket1 + 0.4) return;
    const p = ticketPath(t); E.P(p.x, p.y, p.z); const s = Math.max(0.6, E.cam.scale * 1.4), X = E.px(), Y = E.py();
    ctx.save(); ctx.translate(X, Y); ctx.rotate(-0.2 + p.u * 0.4); ctx.fillStyle = "#fff"; ctx.fillRect(-14 * s, -18 * s, 28 * s, 36 * s); ctx.fillStyle = C.red; ctx.fillRect(-14 * s, -18 * s, 28 * s, 7 * s); ctx.fillStyle = "#999"; for (let i = 0; i < 4; i++) ctx.fillRect(-9 * s, (-6 + i * 6) * s, 18 * s, 2 * s); ctx.restore();
    E.glow(p.x, p.y, p.z, 90, "#FFC72C", 0.5);
  });
  // halo qui suit la commande (burger puis plateau)
  sc.over((t) => {
    if (t < T_ORDER.bun - 0.2 || t > T_ORDER.pick + 1.6) return;
    const tp = trayPos(t), x = t < T_ORDER.tray ? AS.x : tp.x, y = t < T_ORDER.tray ? AS.y : tp.y, z = (t < T_ORDER.tray ? L0 : tp.z) + 12;
    E.glow(x, y, z, 120 + 14 * Math.sin(t * 6), "#FFC72C", 0.55);
  });

  /* ---------- comptoir, bornes, salle ---------- */
  sc.box({ x: 150, y: 262, w: 320, d: 22, z: FL, h: 32, c: C.red, top: "#F6F0E0", edge: "rgba(255,255,255,0.5)", band: [C.yellow, 0.7, 0.82] });
  sc.box({ x: 440, y: 262, w: 22, d: 70, z: FL, h: 32, c: C.red, top: "#F6F0E0" });
  [200, 340].forEach((x) => { sc.box({ x, y: 268, w: 30, d: 14, z: FL + 32, h: 14, c: "#222B38", top: "#4B6B96", edge: "rgba(255,255,255,0.4)" }); }); // caisses
  // étagère de retrait derrière le comptoir
  sc.box({ x: 160, y: 232, w: 120, d: 14, z: FL, h: 36, c: "#B9C3CE", top: "#EEF2F6" });
  // bornes de commande
  const KIOSK = [[500, 292], [540, 292], [580, 292]];
  KIOSK.forEach((p, i) => { sc.box({ x: p[0] - 14, y: p[1] - 10, w: 28, d: 20, z: FL, h: 54, c: "#E5E8EC", top: "#fff" }); sc.box({ x: p[0] - 12, y: p[1] + 4, w: 24, d: 4, z: FL + 24, h: 24, c: "#0F1B2D", top: "#19304F", band: ["#FFC72C", 0.1, 0.9], noShadow: true }); sc.box({ x: p[0] - 14, y: p[1] - 10, w: 28, d: 6, z: FL + 50, h: 6, c: C.red, top: "#EF4B3E" }); });
  // tables + chaises
  const TABLES = [[60, 360], [160, 360], [260, 390], [400, 370], [540, 390], [110, 410]];
  TABLES.forEach((p) => { sc.cyl({ x: p[0], y: p[1], r: 20, h: 3, z: FL + 22, c: "#F6F0E0", top: "#fff" }); sc.cyl({ x: p[0], y: p[1], r: 3, h: 22, z: FL, c: "#8C8C8C" }); [[-26, 0], [26, 0]].forEach((o) => sc.box({ x: p[0] + o[0] - 8, y: p[1] + o[1] - 8, w: 16, d: 16, z: FL, h: 14, c: C.red, top: "#EF4B3E" })); });
  // personnage client héros : entre, commande à la borne, attend, retire, s'assoit
  const hero = new L.Person({ shirt: "#2E86DE", pants: "#3B4252", cap: "#4B3621", skin: C.skin });
  const heroAt = kf([[0, 330, 560], [3.6, 330, 560], [5.0, 330, 420], [5.4, 380, 350], [6.0, 520, 318], [6.1, 520, 318], [7.9, 520, 318], [8.8, 420, 330], [10.8, 330, 312], [12.8, 300, 296], [13.0, 300, 296], [14.4, 140, 372], [15.0, 140, 372]]);
  sc.dyn((t, f) => { const p = heroAt(t); const facing = t > 5.9 && t < 7.9 ? -Math.PI / 2 : p.ang; hero.pose(p.x, p.y, facing, p.mov, t, FL); hero.push(f); });
  sc.over((t) => { if (t > 4.6 && t < 5.9) { const p = heroAt(t); E.P(p.x, p.y, FL + 56); } });
  // autres clients (couleurs variées) + assis
  const palette = ["#E85D8A", "#7A5CC8", "#2FA24A", "#F28C28", "#22B2A4", "#C0392B", "#2E86DE"], skins = [C.skin, C.skin2, C.skin3];
  const guests = [];
  function guest(x, y, hd, sit) { const g = new L.Person({ shirt: palette[guests.length % 7], pants: "#3B4252", cap: ["#3A2A1E", "#C79A3B", "#1E1E1E", "#8D5A3B"][guests.length % 4], skin: skins[guests.length % 3] }); guests.push({ g, x, y, hd, sit, ph: rr() * 6 }); return g; }
  guest(60, 392, -Math.PI / 2, true); guest(160, 330, Math.PI / 2, true); guest(260, 362, Math.PI / 2, true); guest(260, 420, -Math.PI / 2, true); guest(400, 342, Math.PI / 2, true); guest(540, 362, Math.PI / 2, true); guest(110, 382, Math.PI / 2, true);
  const g2 = kf([[0, 540, 330], [1.5, 540, 330], [3.5, 540, 300], [4.0, 540, 300], [9.0, 540, 300], [10, 480, 340], [12, 430, 400], [13, 430, 400], [15, 430, 400]]);
  const g3 = kf([[0, 580, 340], [4, 580, 340], [4.5, 580, 316], [9.5, 580, 316], [10.5, 600, 360], [13, 700, 420], [15, 700, 420]]);
  const gw = kf([[0, 300, 540], [2.0, 300, 540], [3.2, 300, 430], [4.5, 240, 330], [8.0, 240, 330], [9.0, 220, 292], [11.4, 220, 292], [12.4, 160, 350], [15.0, 160, 350]]);
  const gE = [new L.Person({ shirt: "#F28C28", pants: "#3B4252", cap: "#222" }), new L.Person({ shirt: "#22B2A4", pants: "#3B4252", cap: "#222" }), new L.Person({ shirt: "#C0392B", pants: "#3B4252", cap: "#C79A3B" })];
  sc.dyn((t, f) => {
    guests.forEach((o) => { const bob = Math.sin(t * 2 + o.ph) * 0.8; o.g.pose(o.x, o.y, o.hd, false, t, FL + 4 + bob * 0); o.g.push(f); });
    [[g2, gE[0]], [g3, gE[1]], [gw, gE[2]]].forEach(([k, p]) => { const q = k(t); p.pose(q.x, q.y, q.ang, q.mov, t, FL); p.push(f); });
    // comptoir : caissier
    const cs = crewC; cs.pose(230, 244, Math.PI / 2, false, t, FL); cs.push(f);
  });
  const crewC = new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447", skin: C.skin2 });
  // équipier plateau : de la table au comptoir puis retour
  const tcrew = kf([[0, 300, 120], [10.0, 300, 120], [10.8, 340, 112], [11.0, 340, 112], [12.4, 300, 246], [13.0, 300, 246], [14.2, 330, 130], [15.0, 330, 130]]);
  sc.dyn((t, f) => { const q = tcrew(t); trayCrew.pose(q.x, q.y, q.ang, q.mov, t, FL); trayCrew.push(f); });

  /* ---------- drive-thru ---------- */
  sc.box({ x: 640, y: 40, w: 8, d: 8, h: 56, c: "#555", top: "#777" }); sc.box({ x: 650, y: 20, w: 16, d: 40, z: 40, h: 34, c: "#0F1B2D", top: "#1D2E4A", band: ["#FFC72C", 0.1, 0.9], noShadow: true });
  sc.box({ x: BW - 22, y: 165, w: 26, d: 36, z: FL + 10, h: 8, c: "#E9EDF1", top: "#fff", noShadow: true }); // tablette de la fenêtre
  const dcrew = new L.Person({ shirt: C.red, cap: C.yellow, pants: "#2B3447", skin: C.skin3 });
  sc.dyn((t, f) => { const hand = prog(t, 11.8, 12.6); dcrew.pose(BW - 40, 183, 0, false, t, FL); dcrew.push(f); });
  const car1 = new L.Car("#E53935", false), car2 = new L.Car("#1E88E5", false), car3 = new L.Car("#FDD835", true);
  const c1 = kf([[0, 675, -100], [2, 675, 60], [4, 675, 180], [11.6, 675, 180], [13.6, 675, 180], [14.6, 675, 420], [15.2, 675, 600]]);
  const c2 = kf([[0, 675, -240], [3, 675, -60], [5, 675, 60], [13.6, 675, 60], [14.4, 675, 180], [15, 675, 180]]);
  const c3 = kf([[0, 675, -420], [6, 675, -200], [14, 675, -90], [15, 675, -50]]);
  sc.dyn((t, f) => { [[car1, c1], [car2, c2], [car3, c3]].forEach(([c, k]) => { const p = k(t); c.pose(p.x, p.y, Math.PI / 2); c.push(f); }); });
  // sac remis au conducteur
  const bag = newBox({ c: "#E4C68A", top: "#F2DDB0", bias: 24, band: [C.red, 0.5, 0.65] });
  sc.dyn((t, f) => { if (t < 11.8 || t > 14.2) return; const u = prog(t, 11.8, 12.6); const sx = lerp(BW - 30, 650, eio(u)), z = FL + 24 + 6 * Math.sin(u * 3.14); setB(bag, sx, 181, z, 14, 10, 16, 0); f.push(bag); });

  /* ---------- livraison à domicile ---------- */
  const scooters = [];
  for (let i = 0; i < 3; i++) scooters.push({ body: newBox({ c: ["#F28C28", "#22B2A4", "#2E86DE"][i], top: "#fff", bias: 12 }), seat: newBox({ c: "#222", top: "#333", bias: 13 }), box: newBox({ c: "#FF8A00", top: "#FFB347", band: ["#fff", 0.5, 0.6], bias: 14 }), w1: newBox({ c: "#14181F", top: "#2A303A", noShadow: true, bias: 11 }), w2: newBox({ c: "#14181F", top: "#2A303A", noShadow: true, bias: 11 }), rider: new L.Person({ shirt: ["#F28C28", "#22B2A4", "#2E86DE"][i], pants: "#2B3447", cap: "#222" }), k: i });
  const sKF = [kf([[0, 40, 520], [12.8, 40, 520], [13.4, 40, 520], [14.0, -80, 560], [15, -80, 700]]), kf([[0, 100, 520], [15, 100, 520]]), kf([[0, 160, 520], [14.2, 160, 520], [14.8, 160, 520], [15, 160, 560]])];
  sc.sensors = 0;
  sc.dyn((t, f) => { scooters.forEach((s, i) => { const p = sKF[i](t), hd = i === 0 && t > 13.6 ? Math.PI * 0.85 : -Math.PI / 2 * 1; partAt(s.body, p.x, p.y, hd, 0, 0, 6, 34, 12, 12); partAt(s.seat, p.x, p.y, hd, -4, 0, 18, 14, 11, 4); partAt(s.box, p.x, p.y, hd, -20, 0, 18, 16, 16, 16); partAt(s.w1, p.x, p.y, hd, 14, 0, 0, 10, 4, 12); partAt(s.w2, p.x, p.y, hd, -14, 0, 0, 10, 4, 12); [s.body, s.seat, s.box, s.w1, s.w2].forEach((b) => f.push(b)); s.rider.pose(p.x, p.y, hd, false, t, 8); s.rider.push(f); }); });
  // étagère livraison : sacs oranges prêts
  for (let i = 0; i < 3; i++) sc.box({ x: 120 + i * 20, y: 300 + 0, w: 14, d: 12, z: FL, h: 14, c: "#FF8A00", top: "#FFB347", band: ["#fff", 0.5, 0.6] });

  /* ---------- extérieurs ---------- */
  for (let i = 0; i < 6; i++) { sc.cyl({ x: -130 + (i % 2) * 8, y: -100 + i * 100, z: 0, r: 16, h: 18, c: "#3E9A3A", top: "#5BB546" }); }
  [[-20, 500, "#E53935"], [36, 500, "#1E88E5"], [204, 500, "#43A047"], [372, 500, "#FDD835"], [484, 500, "#8E24AA"]].forEach((c, i) => { const car = new L.Car(c[2], false); sc.dyn((t, f) => { car.pose(c[0] + 26, c[1] + 20, Math.PI / 2); car.push(f); }); });
  window.RESTO_TAGS = { truck: [-70, 250, 100], storage: [70, 120, 90], kiosk: [540, 300, 100], kitchen: [320, 70, 110], counter: [300, 270, 90], drive: [630, 180, 90], deliv: [100, 500, 70], burger: [AS.x, AS.y, 60] };
  window.RESTO_T = T_ORDER;
  window.SCENES.push(sc);
})();
