/* SCÈNE 5 — Le modèle économique : carte du monde, franchise, fournisseurs, équipes locales */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng, mix, newBox, setB } = E;
  const sc = new L.Scene("franchise", 55, 70);
  sc.sky = ["#8FD0F5", "#E4F5FF"];
  const rr = rng(909);
  const MW = 2400, MH = 947, SX = MW / 360, SY = MH / 142;
  const mx = (lon) => (lon + 180) * SX, my = (lat) => (84 - lat) * SY;

  sc.keys = [
    [0.0, 1215, 250, 0, 1.25, -45, 35.3, 0, 0],
    [2.0, 1215, 300, 0, 0.9, -45, 36, 0, 0],
    [3.6, 1200, 470, 0, 0.5, -42, 38, 0, 0],
    [5.2, 600, 300, 0, 0.78, -40, 35, 0, 0],
    [7.4, 700, 300, 0, 0.82, -42, 35, 0, 0],
    [8.8, 1210, 260, 0, 0.9, -45, 35.3, 0, 0],
    [10.6, 1280, 270, 0, 0.88, -48, 35.3, 0, 0],
    [11.8, 2200, 380, 0, 0.62, -42, 36, 0, 0],
    [13.4, 1250, 450, 0, 0.52, -44, 36.5, 0, 0],
    [15.0, 1250, 450, 0, 0.5, -45, 36.5, 0, 0],
  ];

  /* sol : mer, carte de points */
  sc.ground((t) => {
    E.grect(-4000, -3000, 11000, 8000, 0, "#6EC3F2");
    for (let i = -10; i < 50; i++) for (let j = -8; j < 30; j++) if ((i + j) % 2 === 0) E.grect(i * 120, j * 120, 120, 120, 0.1, "#78CBF7", 0.5);
    // plaque de la carte (relief)
    const T = E.trig(); const Q = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => { E.P(p[0], p[1], p[2]); if (i) ctx.lineTo(E.px(), E.py()); else ctx.moveTo(E.px(), E.py()); }); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    const x0 = -40, y0 = -40, w = MW + 80, d = MH + 80, h = 22;
    Q([[x0, y0 + d, 0], [x0 + w, y0 + d, 0], [x0 + w, y0 + d, h], [x0, y0 + d, h]], "#D8E7F2"); Q([[x0, y0, 0], [x0, y0 + d, 0], [x0, y0 + d, h], [x0, y0, h]], "#EAF3FA");
    Q([[x0, y0, h], [x0 + w, y0, h], [x0 + w, y0 + d, h], [x0, y0 + d, h]], "#CFE9FA");
    E.grect(0, 0, MW, MH, h + 0.1, "#BFE3F8");
    for (let lon = -150; lon <= 180; lon += 30) E.gline(mx(lon), 0, mx(lon), MH, h + 0.2, "#fff", 1.2, 0.35);
    for (let lat = -50; lat <= 80; lat += 30) E.gline(0, my(lat), MW, my(lat), h + 0.2, "#fff", 1.2, 0.35);
    const L2 = window.LAND, ds = 11.5;
    for (let i = 0; i < L2.length; i++) { const p = L2[i], X = mx(p[1]), Y = my(p[0]); E.grect(X - ds / 2, Y - ds / 2, ds, ds, h + 0.6, ((i * 7) % 5 === 0) ? "#A5D86A" : "#8CCB55"); }
  });
  const Z0 = 22;
  function B(o) { o.z = (o.z || 0) + Z0; return sc.box(o); }
  /* restaurants sur la carte */
  const CITY = [[48.9, 2.35], [51.5, -0.1], [52.5, 13.4], [40.4, -3.7], [41.9, 12.5], [50.1, 14.4], [52.2, 21], [47.4, 8.5], [59.3, 18], [55.7, 37.6], [41, 29], [38.7, -9.1], [50.8, 4.4], [48.2, 16.4],
    [40.7, -74], [41.9, -87.6], [34, -118.2], [29.7, -95.4], [43.7, -79.4], [45.5, -73.6], [49.3, -123.1], [33.4, -112], [25.8, -80.2], [39.7, -105], [47.6, -122.3], [38.9, -77], [32.8, -96.8], [19.4, -99.1], [4.7, -74], [-23.5, -46.6], [-34.6, -58.4], [-33.4, -70.6], [-12, -77],
    [30, 31.2], [-26.2, 28], [6.5, 3.4], [-1.3, 36.8], [33.6, -7.6], [25.2, 55.3], [24.7, 46.7], [28.6, 77.2], [19, 72.8], [13.1, 80.3], [1.35, 103.8], [14.6, 121], [-6.2, 106.8], [22.3, 114.2], [31.2, 121.5], [39.9, 116.4], [37.6, 127], [35.7, 139.7], [34.7, 135.5], [-33.9, 151.2], [-37.8, 145], [-31.9, 115.9], [-36.8, 174.8], [3.1, 101.7], [13.8, 100.5], [41.3, 69.3], [43.2, 76.9], [23.8, 90.4], [35.7, 51.4]];
  const resto = [];
  CITY.forEach((c, i) => {
    const x = mx(c[1]), y = my(c[0]), t0 = 1.0 + (i % 40) * 0.075 + (c[1] > -30 && c[1] < 40 ? 0 : 0.6);
    const base = B({ x: x - 13, y: y - 10, w: 26, d: 20, h: 12, c: "#FFF3D0", norise: true });
    const rf = B({ x: x - 15, y: y - 12, z: 12, w: 30, d: 24, h: 5, c: C.red, top: "#EF4B3E", norise: true });
    resto.push({ x, y, base, rf, t0, i });
  });
  sc.dyn((t) => { resto.forEach((r) => { const u = eoutB((t - r.t0) / 0.5); r.base.h = Math.max(0.01, 12 * u); r.rf.z = Z0 + 12 * u; r.rf.h = Math.max(0.01, 5 * u); }); });
  sc.over((t) => { resto.forEach((r) => { const u = eoutB((t - r.t0) / 0.5); if (u < 0.3) return; E.P(r.x, r.y, Z0 + 22); const s = Math.max(0.4, E.cam.scale * 1.1) * u; L.drawArches(ctx, E.px(), E.py() - 4 * s, 0.1 * s * 2.2, C.yellow, null); }); });
  // vagues d'apparition
  sc.over((t) => { const ph = ((t - 0.8) * 0.6) % 1; if (t < 0.8 || t > 6) return; E.P(1215, 234, Z0 + 2); ctx.strokeStyle = "rgba(255,255,255," + (0.8 * (1 - ph)) + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(E.px(), E.py(), 700 * ph * E.cam.scale, 350 * ph * E.cam.scale, 0, 0, 6.28); ctx.stroke(); });

  /* pictogrammes */
  function badge(x, y, z, kind, col, u, label) {
    if (u <= 0) return; E.P(x, y, Z0 + z + 6 * Math.sin(u * 9)); const s = Math.max(0.55, E.cam.scale * 1.5) * eoutB(u), X = E.px(), Y = E.py();
    ctx.save(); ctx.translate(X, Y); ctx.scale(s, s);
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.2832); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (kind === "person") { ctx.beginPath(); ctx.arc(0, -8, 7, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(0, 14, 13, Math.PI, 0); ctx.fill(); }
    else if (kind === "key") { ctx.beginPath(); ctx.arc(-6, -4, 8, 0, 6.28); ctx.stroke(); ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(14, 15); ctx.moveTo(8, 9); ctx.lineTo(13, 4); ctx.stroke(); }
    else if (kind === "factory") { ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(-14, -2); ctx.lineTo(-5, 4); ctx.lineTo(-5, -4); ctx.lineTo(4, 2); ctx.lineTo(4, -12); ctx.lineTo(12, -12); ctx.lineTo(12, 12); ctx.closePath(); ctx.fill(); }
    else if (kind === "burger") { ctx.beginPath(); ctx.arc(0, -3, 13, Math.PI, 0); ctx.fill(); ctx.fillRect(-14, 0, 28, 4); ctx.fillStyle = "#8B4A2B"; ctx.fillRect(-14, 5, 28, 5); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 11, 13, 0, Math.PI); ctx.fill(); }
    else if (kind === "crew") { for (const dx of [-9, 9]) { ctx.beginPath(); ctx.arc(dx, -7, 5.5, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(dx, 12, 10, Math.PI, 0); ctx.fill(); } }
    else if (kind === "arches") { ctx.restore(); ctx.save(); ctx.translate(X, Y); ctx.scale(s * 0.38, s * 0.38); ctx.shadowColor = "transparent"; L.drawArches(ctx, 0, 6, 1, col, null); }
    else if (kind === "truck") { ctx.fillRect(-15, -8, 20, 16); ctx.fillRect(6, -2, 10, 10); ctx.beginPath(); ctx.arc(-8, 10, 4, 0, 6.28); ctx.arc(10, 10, 4, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }
  /* liens animés (arcs au-dessus de la carte) */
  function link(x1, y1, x2, y2, col, u, h, dots) {
    if (u <= 0) return; const N = 40; const pts = [];
    for (let k = 0; k <= N * u; k++) { const f = k / N; E.P(lerp(x1, x2, f), lerp(y1, y2, f), Z0 + 6 + h * Math.sin(Math.PI * f)); pts.push([E.px(), E.py()]); }
    ctx.lineCap = "round"; for (const [c2, w2] of [["rgba(255,255,255,0.9)", 8], [col, 4]]) { ctx.strokeStyle = c2; ctx.lineWidth = w2 * Math.max(0.6, E.cam.scale * 1.3); ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); }
    if (dots && u >= 1) for (let d = 0; d < 4; d++) { const f = ((dots + d / 4) % 1); E.P(lerp(x1, x2, f), lerp(y1, y2, f), Z0 + 6 + h * Math.sin(Math.PI * f)); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(E.px(), E.py(), 6 * Math.max(0.6, E.cam.scale * 1.3), 0, 6.28); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
  }
  const HQ = [mx(-87.6), my(41.9)];
  const FRA = [mx(2.35), my(48.9)];
  const SUP = [[mx(-95), my(36)], [mx(5), my(44)], [mx(112), my(26)]];
  // siège : tour vitrée + arches
  B({ x: HQ[0] - 36, y: HQ[1] - 30, w: 72, d: 60, h: 40, c: "#F4F7FA", top: "#fff" });
  B({ x: HQ[0] - 24, y: HQ[1] - 20, z: 40, w: 48, d: 40, h: 56, c: "#E8EEF4", top: "#fff", win: { rows: 5, cols: 4, color: "#6BA8D0", lit: "#CDEBFA", seed: 3 } });
  B({ x: HQ[0] - 28, y: HQ[1] - 24, z: 96, w: 56, d: 48, h: 7, c: C.red, top: "#EF4B3E" });
  sc.add({ key() { E.P(HQ[0], HQ[1], 140); return E.pd() + 120; }, draw(t) { const u = eoutB((t - 4.6) / 0.6); if (u <= 0) return; E.P(HQ[0], HQ[1], Z0 + 134); L.drawArches(ctx, E.px(), E.py(), 0.5 * Math.max(0.5, E.cam.scale * 1.5) * u, C.yellow, "#C99200"); } });
  // usines fournisseurs sur la carte
  SUP.forEach((p) => { B({ x: p[0] - 26, y: p[1] - 18, w: 52, d: 36, h: 24, c: "#E3E8EE", band: [C.red, 0.8, 1] }); sc.cyl({ x: p[0] + 16, y: p[1] - 8, z: Z0 + 24, r: 6, h: 24, c: "#D0D6DE", top: "#fff" }); });

  const TRI = [[mx(-60), my(30)], [mx(40), my(15)], [mx(-5), my(-30)]]; // positions du triangle final

  sc.over((t) => {
    // 1. Corporation : badge + lien vers franchisés (licence) vers l'Europe
    badge(HQ[0], HQ[1], 130, "arches", C.red, prog(t, 4.8, 5.6));
    // 2. franchisés : badges personne/clé sur des restaurants d'Europe puis monde
    const f = prog(t, 7.0, 8.0);
    [[2.35, 48.9], [-0.1, 51.5], [13.4, 52.5], [-3.7, 40.4], [12.5, 41.9], [8.5, 47.4], [-74, 40.7], [-118.2, 34], [-46.6, -23.5], [139.7, 35.7], [121.5, 31.2], [151.2, -33.9], [77.2, 28.6], [55.3, 25.2]].forEach((c, i) => badge(mx(c[0]), my(c[1]), 40, i % 2 ? "key" : "person", C.red, prog(t, 7.0 + i * 0.08, 7.7 + i * 0.08)));
    link(HQ[0], HQ[1], FRA[0], FRA[1], C.red, prog(t, 6.4, 8.0), 150, t > 8.0 ? (t * 0.25) % 1 : 0);
    link(HQ[0], HQ[1], mx(139.7), my(35.7), C.red, prog(t, 6.6, 8.6), 260, t > 8.6 ? (t * 0.22) % 1 : 0);
    link(HQ[0], HQ[1], mx(151.2), my(-33.9), C.red, prog(t, 6.8, 9.0), 280, t > 9.0 ? (t * 0.2) % 1 : 0);
    // 3. fournisseurs : usines → restaurants (flux jaunes)
    SUP.forEach((p, i) => { badge(p[0], p[1], 60, "factory", "#2E7DD1", prog(t, 8.8 + i * 0.3, 9.6 + i * 0.3)); });
    [[0, FRA[0], FRA[1]], [0, mx(-74), my(40.7)], [1, FRA[0], FRA[1]], [1, mx(12.5), my(41.9)], [1, mx(30), my(30)], [2, mx(121.5), my(31.2)], [2, mx(139.7), my(35.7)], [2, mx(103.8), my(1.35)]].forEach((l, k) => link(SUP[l[0]][0], SUP[l[0]][1], l[1], l[2], "#FFC72C", prog(t, 9.0 + k * 0.1, 10.2 + k * 0.1), 100, t > 10.4 ? (t * 0.3 + k * 0.13) % 1 : 0));
    // 4. équipes locales (icône crew) à côté d'un restaurant
    [[2.35, 48.9], [-74, 40.7], [139.7, 35.7], [77.2, 28.6]].forEach((c, i) => badge(mx(c[0]) + 48, my(c[1]) + 10, 90, "crew", "#2FA24A", prog(t, 10.5 + i * 0.2, 11.2 + i * 0.2)));
    // 5. adaptation locale : burgers de couleurs différentes sur plusieurs marchés
    [[77.2, 28.6, "#F28C28"], [139.7, 35.7, "#E85D8A"], [2.35, 48.9, "#7A5CC8"], [-99.1, 19.4, "#2FA24A"], [121.5, 31.2, "#D32F2F"], [31.2, 30, "#22B2A4"]].forEach((c, i) => badge(mx(c[0]) - 46, my(c[1]) - 6, 100, "burger", c[2], prog(t, 11.6 + i * 0.18, 12.3 + i * 0.18)));
    // 6. triangle final : marque / franchisés / fournisseurs
    const tr = prog(t, 12.8, 14.0);
    if (tr > 0) {
      const names = ["arches", "key", "factory"], cols = [C.red, "#C0392B", "#2E7DD1"];
      for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; link(TRI[i][0], TRI[i][1], TRI[j][0], TRI[j][1], "#FFC72C", clamp(tr * 1.4 - i * 0.2, 0, 1), 60, tr >= 1 ? (t * 0.3 + i * 0.33) % 1 : 0); }
      for (let i = 0; i < 3; i++) badge(TRI[i][0], TRI[i][1], 70, names[i], cols[i], clamp(tr * 1.6 - i * 0.25, 0, 1));
    }
  });
  window.FRANCH_TAGS = { hq: [HQ[0], HQ[1], 150], eu: [FRA[0], FRA[1], 80], sup: [SUP[1][0], SUP[1][1], 70], crew: [FRA[0] + 48, FRA[1] + 10, 100], local: [mx(77.2) - 46, my(28.6) - 6, 110], tri0: [TRI[0][0], TRI[0][1], 80], tri1: [TRI[1][0], TRI[1][1], 80], tri2: [TRI[2][0], TRI[2][1], 80], map: [1200, 470, 0] };
  window.SCENES.push(sc);
})();
