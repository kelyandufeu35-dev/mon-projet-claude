/* SCÈNE 5 — L'argent : 95 % de restaurants franchisés, revenus franchisés vs ventes des restaurants en propre */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, clamp, lerp, sm, sm5, prog, eio, eoutB, rng } = E;
  const sc = new L.Scene("money", 55, 70);
  sc.sky = ["#9ED8FF", "#F3FBFF"];
  sc.keys = [
    [0.0, 200, 150, 0, 1.38, -45, 35.3, 0, 0],
    [4.0, 220, 150, 0, 1.45, -45, 35.3, 0, 0],
    [6.5, 520, 150, 0, 1.16, -40, 35.5, 0, 0],
    [9.0, 700, 130, 0, 1.3, -45, 35.5, 0, 0],
    [12.0, 520, 140, 0, 0.87, -45, 36, 0, 0],
    [15.0, 520, 140, 0, 0.9, -45, 36, 0, 0],
  ];
  sc.ground((t) => {
    E.grect(-4000, -3000, 11000, 8000, 0, "#BFE6FB");
    for (let i = -10; i < 50; i++) for (let j = -8; j < 30; j++) if ((i + j) % 2 === 0) E.grect(i * 120, j * 120, 120, 120, 0.1, "#C9ECFD", 0.6);
    E.grect(-90, -90, 520, 420, 1, "#F2F5F8"); E.grect(-76, -76, 492, 392, 1.5, "#FFFFFF");
    E.grect(470, -50, 520, 300, 1, "#F2F5F8"); E.grect(484, -36, 492, 272, 1.5, "#FFFFFF");
    for (let k = 0; k <= 5; k++) E.gline(500, 10 + k * 40, 960, 10 + k * 40, 2, "#C9D6E2", 2, 0.8);
  });
  const N = 20, GX = 20, GY = 0, SP = 78;
  const rs = [];
  for (let i = 0; i < N; i++) {
    const cx = i % 5, cy = Math.floor(i / 5), x = GX + cx * SP, y = GY + cy * SP, own = i === 7, t0 = 0.8 + i * 0.13;
    const base = sc.box({ x, y, w: 50, d: 42, h: 24, c: "#FFF3D0", top: "#FFF8E4", z: 2, win: { rows: 1, cols: 3, color: "#7FB7DA", lit: "#CDEBFA", seed: i } });
    const rf = sc.box({ x: x - 3, y: y - 3, z: 26, w: 56, d: 48, h: 7, c: own ? "#1B1B1B" : C.red, top: own ? "#3A3A3A" : "#EF4B3E" });
    rs.push({ x, y, own, t0, base, rf });
  }
  sc.dyn((t) => rs.forEach((r) => { const u = eoutB((t - r.t0) / 0.5); r.base.h = Math.max(0.01, 24 * u); r.rf.z = 2 + 24 * u; r.rf.h = Math.max(0.01, 7 * u); }));
  // pastilles : franchisé (bleu, clé) / exploité en propre (étoile jaune)
  sc.over((t) => {
    const s = Math.max(0.6, E.cam.scale * 1.4);
    rs.forEach((r) => { const u = eoutB((t - 3.0 - r.x / 600 - r.y / 900) / 0.5); if (u <= 0.05) return; E.P(r.x + 25, r.y + 21, 56); ctx.save(); ctx.translate(E.px(), E.py() - 10 * s); ctx.scale(s * u, s * u); ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.28); ctx.fill(); ctx.shadowColor = "transparent"; ctx.lineWidth = 3.5; ctx.strokeStyle = r.own ? "#E8A800" : "#2E7DD1"; ctx.stroke(); ctx.fillStyle = r.own ? "#E8A800" : "#2E7DD1"; ctx.beginPath(); ctx.arc(0, -4, 4.5, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(0, 11, 8.5, Math.PI, 0); ctx.fill(); ctx.restore(); });
  });
  // histogramme 3D
  const BARS = [{ x: 560, y: 70, h: 231, c: C.red, top: "#EF4B3E", t0: 6.4 }, { x: 760, y: 70, h: 136, c: "#E8A800", top: "#FFC72C", t0: 7.4 }];
  const bb = BARS.map((b) => sc.box({ x: b.x, y: b.y, z: 2, w: 100, d: 100, h: 1, c: b.c, top: b.top }));
  sc.dyn((t) => BARS.forEach((b, i) => { bb[i].h = Math.max(0.5, b.h * eoutB(clamp((t - b.t0) / 1.8, 0, 1.2) / 1.2 * 1)); }));
  // pièces des restaurants franchisés vers la barre rouge
  function coin(x, y, z, col, s) { E.P(x, y, z); const X = E.px(), Y = E.py(), r = 9 * s; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.28); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * s; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "900 " + 12 * s + "px Montserrat, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", X, Y + 1); }
  sc.over((t) => {
    if (t < 9.6) return; const s = Math.max(0.6, E.cam.scale * 1.5);
    rs.forEach((r, i) => { if (r.own || i % 2) return; const u = ((t - 9.6) / 3.2 + i * 0.173) % 1; const f = Math.min(1, (t - 9.6) / 0.6); ctx.globalAlpha = f; coin(lerp(r.x + 25, 610, u), lerp(r.y + 21, 120, u), 40 + 160 * Math.sin(Math.PI * u), C.yellow, s); ctx.globalAlpha = 1; });
    const o = rs[7]; const u = ((t - 9.8) / 3.2) % 1; if (t > 9.8) coin(lerp(o.x + 25, 810, u), lerp(o.y + 21, 120, u), 40 + 120 * Math.sin(Math.PI * u), "#E8A800", s);
  });
  window.FRANCH_TAGS = { grid: [GX + 2 * SP + 25, GY + 1.5 * SP, 40], own: [rs[7].x + 25, rs[7].y + 21, 60], b1: [610, 120, 238], b2: [810, 120, 142] };
  window.SCENES.push(sc);
})();
