/* NEXALOG — décor statique : site, hall, toit, murs, environnement */
(function () {
  const E = window.ENG;
  const { Box, clamp, lerp, sm, sm5, prog, eio, rng } = E;

  const PAL = {
    bg: "#040815", ground: "#091431", yard: "#0d1b3d", road: "#0a1430",
    floor: "#17284f", floorHi: "#1d3365", wall: "#2a4a8c", wallDark: "#1a3166",
    roof: "#3a5896", cyan: "#22e1ff", orange: "#ff8a1f", white: "#e8f1ff",
    rack: "#2c63e0", beam: "#ff8a1f", carton: "#d79a52", cartonD: "#b97a36",
    pallet: "#9a6a38", steel: "#8da2c4", dark: "#0a1226", green: "#27d6a0", red: "#ff4d5e", yellow: "#ffd23f",
  };

  const S = []; // objets triés (statiques)
  const G = []; // passe sol (statiques)
  const UP = []; // mises à jour dynamiques (t) -> peuvent pousser dans frame
  const OV = []; // passe overlay (glows etc.)
  const frameDyn = [];
  const RISE = [];
  let riseOn = true;
  function box(o) { const b = new Box(o); S.push(b); if (!riseOn) b.inter = true;
    if (riseOn && !o.norise) { b.h0 = b.h; b.rdel = 0; b.rmode = (o.z || 0) === 0 ? 0 : 1; RISE.push(b); } return b; }

  // dimensions du hall
  const HX = 1400, HY = 900, WT = 20, WH = 260;
  const SDOCK = [650, 830, 1010, 1190]; // x des quais sud (réception)
  const WDOCK = [150, 330, 510]; // y des quais ouest (expédition)
  const DOORW = 130, DOORH = 150;

  /* ---------- sol du site ---------- */
  G.push(() => {
    const ctx = E.ctx;
    E.grect(-3200, -2600, 7600, 6400, 0, PAL.ground);
    // grille discrète
    for (let i = -3200; i <= 4400; i += 100) {
      const major = i % 500 === 0;
      E.gline(i, -2600, i, 3800, -0.5, "#2a62ff", major ? 1.2 : 0.7, major ? 0.1 : 0.05);
      E.gline(-3200, i, 4400, i, -0.5, "#2a62ff", major ? 1.2 : 0.7, major ? 0.1 : 0.05);
    }
    // cours bétonnées
    E.grect(-150, 880, 1700, 1020, 0.2, PAL.yard);       // cour sud (réception)
    E.grect(-760, -60, 770, 1020, 0.2, PAL.yard);        // cour ouest (expédition)
    E.grect(1400, -60, 360, 1020, 0.2, PAL.yard);        // allée est
    // routes
    E.grect(-3200, 1860, 7600, 150, 0.3, PAL.road);
    E.grect(1760, -2600, 150, 4600, 0.3, PAL.road);
    E.grect(-1200, -2600, 130, 3600, 0.3, PAL.road);
    E.grect(-3200, 1000, 2100, 130, 0.3, PAL.road);
    E.gdash(-3200, 1935, 4400, 1935, 0.5, "#cfe6ff", 2, 60, 50, 0.45);
    E.gdash(1835, -2600, 1835, 1950, 0.5, "#cfe6ff", 2, 60, 50, 0.45);
    E.gdash(-1135, -2600, -1135, 1000, 0.5, "#cfe6ff", 2, 60, 50, 0.45);
    E.gdash(-3200, 1065, -1100, 1065, 0.5, "#cfe6ff", 2, 60, 50, 0.45);
    // marquages de manœuvre (cour sud)
    for (let i = 0; i < SDOCK.length; i++) {
      const x = SDOCK[i];
      E.gline(x - 70, 905, x - 70, 1330, 0.6, "#ffd23f", 2, 0.35);
      E.gline(x + 70, 905, x + 70, 1330, 0.6, "#ffd23f", 2, 0.35);
    }
    for (let i = 0; i < WDOCK.length; i++) {
      const y = WDOCK[i];
      E.gline(-5, y - 70, -430, y - 70, 0.6, "#ffd23f", 2, 0.35);
      E.gline(-5, y + 70, -430, y + 70, 0.6, "#ffd23f", 2, 0.35);
    }
    // parking
    E.grect(1960, 960, 760, 560, 0.2, PAL.yard);
    for (let i = 0; i <= 10; i++) E.gline(1990 + i * 70, 1000, 1990 + i * 70, 1180, 0.5, "#9fc4ff", 1.5, 0.28);
    for (let i = 0; i <= 10; i++) E.gline(1990 + i * 70, 1290, 1990 + i * 70, 1470, 0.5, "#9fc4ff", 1.5, 0.28);
    // terrain de logos
    E.groundText("NEXALOG", 640, 1560, 0.8, 170, "rgba(34,225,255,0.20)", "900", "center", 0, 1);
  });

  /* ---------- sol intérieur du hall ---------- */
  const ZONES = [
    // [x,y,w,h,couleur,label,lx,ly]
    [60, 640, 1180, 230, "#1f3a73", "RECEIVING", 640, 840],
    [220, 50, 800, 520, "#1a2f63", "AUTOMATED STORAGE", 620, 330],
    [1060, 40, 320, 560, "#203e78", "SORTING", 1220, 320],
    [60, 560, 540, 300, "#233f7a", "PICKING", 330, 760],
    [30, 40, 170, 520, "#1c3568", "SHIPPING", 110, 300],
  ];
  G.push(() => {
    // dalle
    E.grect(-10, -10, HX + 20, HY + 20, 0.5, "#0a1430");
    E.grect(0, 0, HX, HY, 1, PAL.floor);
    for (let x = 0; x <= HX; x += 100) E.gline(x, 0, x, HY, 1.2, "#3b6bd6", 0.8, x % 500 === 0 ? 0.28 : 0.1);
    for (let y = 0; y <= HY; y += 100) E.gline(0, y, HX, y, 1.2, "#3b6bd6", 0.8, y % 500 === 0 ? 0.28 : 0.1);
    for (const z of ZONES) {
      E.grect(z[0], z[1], z[2], z[3], 1.3, z[4], 0.55);
      E.gline(z[0], z[1], z[0] + z[2], z[1], 1.6, PAL.cyan, 2, 0.35);
      E.gline(z[0], z[1], z[0], z[1] + z[3], 1.6, PAL.cyan, 2, 0.35);
    }
    // couloirs jaunes
    E.gdash(60, 620, 1240, 620, 1.7, PAL.yellow, 3, 40, 24, 0.55);
    E.gdash(210, 40, 210, 640, 1.7, PAL.yellow, 3, 40, 24, 0.55);
    E.gdash(1040, 40, 1040, 640, 1.7, PAL.yellow, 3, 40, 24, 0.55);
    // textes au sol
    for (const z of ZONES) E.groundText(z[5], z[6], z[7], 1.8, z[5].length > 9 ? 34 : 44, "rgba(180,225,255,0.38)", "900", "center", 0, 1);
    // numéros de quais
    for (let i = 0; i < SDOCK.length; i++) E.groundText("Q" + (i + 1), SDOCK[i], 862, 1.8, 30, "rgba(255,210,63,0.8)", "900", "center", 0, 1);
    for (let i = 0; i < WDOCK.length; i++) E.groundText("E" + (i + 1), 52, WDOCK[i], 1.8, 30, "rgba(255,138,31,0.85)", "900", "center", Math.PI / 2, 1);
    // éclairage au sol (pools)
    for (let x = 160; x < HX; x += 230) for (let y = 130; y < HY; y += 230) E.pool(x, y, 2, 170, "#5aa9ff", 0.1);
  });

  /* ---------- murs ---------- */
  const wallS = [], wallW = [], lintS = [], lintW = [];
  function wallRun(axis, fixed, from, to, gaps, hFn, store, lint) {
    // segments (coupés aux ouvertures)
    let cuts = [from];
    gaps.forEach((g) => { cuts.push(g[0], g[1]); });
    cuts.push(to);
    for (let i = 0; i < cuts.length; i += 2) {
      let a = cuts[i], b = cuts[i + 1];
      if (b - a < 1) continue;
      const n = Math.max(1, Math.ceil((b - a) / 100)), step = (b - a) / n;
      for (let k = 0; k < n; k++) {
        const s0 = a + k * step;
        const o = axis === "x" ? { x: s0, y: fixed, w: step, d: WT } : { x: fixed, y: s0, w: WT, d: step };
        const bx = box(Object.assign({ shell: true, z: 0, h: WH, c: PAL.wall, top: "#4d78c9", edge: "rgba(160,210,255,0.35)",
          band: ["rgba(34,225,255,0.9)", 0.9, 0.93] }, o));
        if (store) store.push(bx);
      }
    }
    gaps.forEach((g) => {
      const o = axis === "x" ? { x: g[0], y: fixed, w: g[1] - g[0], d: WT } : { x: fixed, y: g[0], w: WT, d: g[1] - g[0] };
      const lb = box(Object.assign({ shell: true, z: DOORH, h: WH - DOORH, c: PAL.wallDark, top: "#4d78c9", edge: "rgba(160,210,255,0.35)",
        band: ["rgba(255,138,31,0.95)", 0.02, 0.1] }, o));
      lint.push(lb);
    });
  }
  const gapsS = SDOCK.map((x) => [x - DOORW / 2, x + DOORW / 2]);
  const gapsW = WDOCK.map((y) => [y - DOORW / 2, y + DOORW / 2]);
  // nord et est (murs de fond, hauteur constante)
  wallRun("x", 0, 0, HX, [], null, null, []);
  wallRun("y", HX - WT, WT, HY, [], null, null, []);
  wallRun("x", HY - WT, 0, HX, gapsS, null, wallS, lintS);
  wallRun("y", 0, WT, HY - WT, gapsW, null, wallW, lintW);
  // piliers d'angle
  [[0, 0], [HX - 30, 0], [0, HY - 30], [HX - 30, HY - 30]].forEach((p) =>
    box({ shell: true, x: p[0], y: p[1], w: 30, d: 30, z: 0, h: WH + 20, c: "#1b3166", top: "#5e8ad8", edge: "rgba(160,210,255,0.5)" }));

  // plaques de quai (leviers jaune)
  SDOCK.forEach((x) => box({ shell: true, x: x - 60, y: HY - WT - 12, w: 120, d: 14, z: 0, h: 6, c: "#c99a1d", top: "#ffd23f", edge: "rgba(255,255,255,0.4)" }));
  WDOCK.forEach((y) => box({ shell: true, x: 6, y: y - 60, w: 14, d: 120, z: 0, h: 6, c: "#c99a1d", top: "#ffd23f", edge: "rgba(255,255,255,0.4)" }));
  /* ---------- toit en panneaux ---------- */
  const roofPanels = [];
  const RC = 7, RR = 5, RW = HX / RC, RD = HY / RR;
  const rr = rng(77);
  for (let cx = 0; cx < RC; cx++) for (let cy = 0; cy < RR; cy++) {
    const p = { b: box({ x: cx * RW + 2, y: cy * RD + 2, w: RW - 4, d: RD - 4, z: WH, h: 14, c: "#34508d", top: "#46699f", edge: "rgba(190,225,255,0.55)", bias: 40, norise: true }),
      ex: [], delay: ((cx + cy * 0.8) / (RC + RR * 0.8)) * 0.55 + rr() * 0.12, cx, cy, jit: rr() };
    // panneaux solaires
    if ((cx + cy) % 3 !== 1) {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
        const sx = cx * RW + 22 + i * 82, sy = cy * RD + 18 + j * 52;
        p.ex.push({ b: box({ x: sx, y: sy, w: 74, d: 44, z: WH + 14, h: 4, c: "#0f1f55", top: "#17338a", edge: "rgba(34,225,255,0.55)", bias: 41, norise: true }), dx: 0, dz: 18 });
      }
    } else if (rr() > 0.4) {
      p.ex.push({ b: box({ x: cx * RW + 50, y: cy * RD + 40, w: 90, d: 70, z: WH + 14, h: 30, c: "#7f94bd", top: "#b5c6e6", edge: "rgba(255,255,255,0.4)", bias: 41, norise: true }), dx: 0, dz: 44 });
      p.ex.push({ b: box({ x: cx * RW + 70, y: cy * RD + 60, w: 50, d: 30, z: WH + 44, h: 10, c: "#27d6a0", top: "#6bf2cb", bias: 42, norise: true }), dx: 0, dz: 54 });
    } else {
      p.ex.push({ b: box({ x: cx * RW + 30, y: cy * RD + 30, w: 140, d: 120, z: WH + 14, h: 6, c: "#2fa6c9", top: "#7beaff", emTop: "#5ee7ff", edge: "rgba(255,255,255,0.7)", bias: 41, norise: true }), dx: 0, dz: 20 });
    }
    roofPanels.push(p);
  }

  /* ---------- environnement ---------- */
  const er = rng(2024);
  // bâtiment annexe (hall B)
  box({ x: 2000, y: 80, w: 760, d: 560, z: 0, h: 190, c: "#243f7a", top: "#3a5896", edge: "rgba(160,210,255,0.4)", band: ["rgba(34,225,255,0.85)", 0.82, 0.86] });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++)
    box({ x: 2040 + i * 140, y: 110 + j * 170, w: 110, d: 120, z: 190, h: 6, c: "#2fa6c9", top: "#5ee7ff", emTop: "#4fdcff", edge: "rgba(255,255,255,0.5)" });
  // tour de bureaux
  const tw = box({ x: 1500, y: -330, w: 220, d: 200, z: 0, h: 420, c: "#27478a", top: "#5b88d8", edge: "rgba(180,220,255,0.55)", band: ["rgba(255,138,31,0.95)", 0.95, 0.985] });
  box({ x: 1530, y: -300, w: 160, d: 140, z: 420, h: 50, c: "#1e3a78", top: "#6b9be8", edge: "rgba(200,230,255,0.6)" });
  box({ x: 1590, y: -260, w: 40, d: 40, z: 470, h: 70, c: "#8da2c4", top: "#d6e3fa" });
  // conteneurs (cour nord-ouest)
  const ccol = ["#d9622b", "#2c7be5", "#e5b72c", "#1fa97a", "#c43d4b", "#7a5be5"];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const n = 1 + ((i * 3 + j * 5) % 3);
    for (let k = 0; k < n; k++) box({ x: -760 + i * 120, y: -420 + j * 70, w: 112, d: 60, z: k * 34, h: 32, c: ccol[(i + j * 2 + k) % 6], top: E.mix(ccol[(i + j * 2 + k) % 6], "#ffffff", 0.18), edge: "rgba(255,255,255,0.28)" });
  }
  // voitures du parking
  const carCols = ["#e9f1ff", "#ff8a1f", "#22e1ff", "#8da2c4", "#ff4d5e", "#27d6a0"];
  for (let i = 0; i < 10; i++) for (const row of [0, 1]) {
    if (er() < 0.35) continue;
    const cx0 = 2000 + i * 70, cy0 = row ? 1320 : 1030;
    const col = carCols[Math.floor(er() * carCols.length)];
    box({ x: cx0 - 18, y: cy0, w: 36, d: 80, z: 4, h: 20, c: col, top: E.mix(col, "#ffffff", 0.2), edge: "rgba(255,255,255,0.35)" });
    box({ x: cx0 - 14, y: cy0 + 18, w: 28, d: 40, z: 24, h: 14, c: E.mix(col, "#000000", 0.4), top: "#101a38" });
  }
  // arbres stylisés
  function tree(x, y, s) {
    box({ x: x - 4 * s, y: y - 4 * s, w: 8 * s, d: 8 * s, z: 0, h: 22 * s, c: "#5a3d22", top: "#7a5430" });
    box({ x: x - 22 * s, y: y - 22 * s, w: 44 * s, d: 44 * s, z: 22 * s, h: 26 * s, c: "#1d9d7a", top: "#35e0ae" });
    box({ x: x - 14 * s, y: y - 14 * s, w: 28 * s, d: 28 * s, z: 48 * s, h: 22 * s, c: "#27c294", top: "#5ff4c4" });
  }
  for (let i = 0; i < 22; i++) tree(1500 + (i % 11) * 110 + er() * 30, 880 + (i < 11 ? 0 : 640) + er() * 20, 1 + er() * 0.6);
  for (let i = 0; i < 14; i++) tree(-1000 + er() * 800, 1200 + er() * 500, 1 + er() * 0.7);
  // lampadaires
  function lamp(x, y) {
    box({ x: x - 3, y: y - 3, w: 6, d: 6, z: 0, h: 120, c: "#334a7c", top: "#6c8bc9" });
    box({ x: x - 10, y: y - 10, w: 20, d: 20, z: 120, h: 6, c: "#d7ecff", top: "#ffffff", emTop: "#ffffff" });
    OV.push(() => { E.glow(x, y, 124, 120, "#8fd0ff", 0.55); });
    G.push(() => { E.pool(x, y, 2, 260, "#7fbfff", 0.22); });
  }
  for (let i = 0; i < 8; i++) lamp(-120 + i * 200, 1500);
  for (let i = 0; i < 5; i++) lamp(-300, 100 + i * 180);
  for (let i = 0; i < 5; i++) lamp(1560, 100 + i * 180);
  // skyline lointaine
  const sr = rng(555);
  for (let i = 0; i < 160; i++) {
    const a = sr() * 6.2832, r = 3300 + sr() * 1500;
    const x = 700 + Math.cos(a) * r * 1.15, y = 450 + Math.sin(a) * r * 0.95;
    const w = 90 + sr() * 150, d = 90 + sr() * 150, h = 120 + sr() * 520;
    const hue = sr();
    const c = hue < 0.5 ? "#1a2d5e" : hue < 0.8 ? "#1f3870" : "#162650";
    box({ x: x - w / 2, y: y - d / 2, w, d, z: 0, h, c, top: "#2e4d93", edge: "rgba(120,170,255,0.25)",
      band: sr() < 0.5 ? ["rgba(34,225,255,0.65)", 0.9, 0.93] : ["rgba(255,138,31,0.55)", 0.5, 0.53] });
  }
  // magasin (destination des livraisons)
  const STORE = { x: -2150, y: 760 };
  box({ x: STORE.x, y: STORE.y, w: 420, d: 260, z: 0, h: 120, c: "#2c5fb8", top: "#4a85e0", edge: "rgba(200,230,255,0.6)", band: ["rgba(255,255,255,0.9)", 0.62, 0.76] });
  box({ x: STORE.x - 8, y: STORE.y + 230, w: 436, d: 34, z: 118, h: 16, c: "#ff8a1f", top: "#ffb25a" });
  box({ x: STORE.x + 20, y: STORE.y + 262, w: 120, d: 8, z: 0, h: 70, c: "#0b1738", top: "#1c3a7a" });
  box({ x: STORE.x + 250, y: STORE.y + 262, w: 120, d: 8, z: 0, h: 70, c: "#0b1738", top: "#1c3a7a" });
  G.push(() => { E.groundText("STORE", STORE.x + 210, STORE.y + 120, 0.9, 54, "rgba(255,255,255,0.35)", "900", "center", 0, 1); });

  riseOn = false;
  window.WORLD = { PAL, S, G, UP, OV, box, RISE, HX, HY, WT, WH, SDOCK, WDOCK, DOORW, DOORH,
    wallS, wallW, lintS, lintW, roofPanels, STORE };
})();
