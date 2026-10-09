/* SCÈNE 3 — Le modèle franchise : la marque, le site (terrain + bâtiment), le franchisé, loyer et redevance */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng } = E;
  const sc = new L.Scene("franchise3", 25, 40);
  sc.sky = ["#8FD4FF", "#EAF7FF"];
  const rr = rng(31);

  sc.keys = [
    [0.0, 190, 150, 0, 1.45, -45, 35.3, 0, 0],
    [3.0, 230, 190, 0, 1.38, -45, 35.3, 0, 0],
    [5.0, 470, 280, 0, 1.3, -42, 35.5, 0, 0],
    [8.0, 430, 270, 0, 1.3, -48, 35.5, 0, 0],
    [10.5, 400, 250, 0, 1.13, -45, 35.5, 0, 0],
    [12.5, 700, 280, 0, 0.8, -45, 36, 0, 0],
    [15.0, 800, 290, 0, 0.72, -45, 36, 0, 0],
  ];

  const RY = 420; // route
  sc.ground((t) => {
    E.grect(-4000, -3000, 11000, 8000, 0, "#7CC24F");
    for (let i = -10; i < 50; i++) for (let j = -8; j < 30; j++) if ((i + j) % 2 === 0) E.grect(i * 120, j * 120, 120, 120, 0.1, "#86CB57", 0.6);
    E.grect(-400, RY, 2600, 70, 0.4, "#5B6270"); E.grect(-400, RY - 14, 2600, 14, 0.5, "#D9D4C7"); E.grect(-400, RY + 70, 2600, 14, 0.5, "#D9D4C7");
    for (let x = -380; x < 2200; x += 90) E.grect(x, RY + 33, 44, 4, 0.6, "#FFE27A");
    // parcelles (dalle de béton)
    PLOTS.forEach((p, i) => { const u = i === 0 ? 1 : eoutB((t - p.t0 + 0.4) / 0.5); if (u <= 0) return; E.grect(p.x - 20, p.y - 20, 210, 250, 0.7, "#CFCBBE"); E.grect(p.x - 12, p.y - 12, 194, 234, 0.8, "#DAD6CA"); });
    // contour pointillé du terrain (avant construction)
    const o = 1 - sm(prog(t, 6.2, 7.0)); if (o > 0.01) { const x = PLOTS[0].x - 20, y = PLOTS[0].y - 20; for (let k = 0; k < 20; k++) { const a = (k + (t * 3) % 1) * 12; E.gline(x + a, y, x + a + 7, y, 1, C.red, 4, o); E.gline(x + a, y + 250, x + a + 7, y + 250, 1, C.red, 4, o); } for (let k = 0; k < 20; k++) { const a = (k + (t * 3) % 1) * 12.5; E.gline(x, y + a, x, y + a + 7, 1, C.red, 4, o); E.gline(x + 210, y + a, x + 210, y + a + 7, 1, C.red, 4, o); } }
  });

  const Z0 = 0;
  const PLOTS = [{ x: 420, y: 130, t0: 0 }, { x: 820, y: 130, t0: 12.6 }, { x: 1220, y: 130, t0: 13.2 }, { x: 620, y: 520, t0: 13.8 }];
  const B = (o) => sc.box(o);

  // siège
  const HQ = [120, 130];
  B({ x: HQ[0] - 50, y: HQ[1] - 40, w: 100, d: 80, h: 36, c: "#F4F7FA", top: "#fff", win: { rows: 2, cols: 5, color: "#6BA8D0", lit: "#CDEBFA", seed: 5 } });
  B({ x: HQ[0] - 34, y: HQ[1] - 28, z: 36, w: 68, d: 56, h: 70, c: "#E8EEF4", top: "#fff", win: { rows: 6, cols: 5, color: "#6BA8D0", lit: "#CDEBFA", seed: 3 } });
  B({ x: HQ[0] - 38, y: HQ[1] - 32, z: 106, w: 76, d: 64, h: 8, c: C.red, top: "#EF4B3E" });
  sc.add({ key() { E.P(HQ[0], HQ[1], 130); return E.pd() + 120; }, draw(t) { E.P(HQ[0], HQ[1], 148); const u = eoutB((t - 0.4) / 0.6); if (u > 0) L.drawArches(ctx, E.px(), E.py(), 0.6 * Math.max(0.5, E.cam.scale * 1.5) * u, C.yellow, "#C99200"); } });

  // arbres et décor
  [[300, 60], [330, 400], [30, 330], [640, 60], [1060, 330], [1420, 60], [1500, 360], [-60, 190], [250, 330], [980, 70]].forEach((p) => L.tree(sc, p[0], p[1], 1 + rr() * 0.5, rr() > 0.5 ? 1 : 0));

  // restaurants
  function resto(p, k) {
    const bw = 150, bd = 110;
    const base = B({ x: p.x + 16, y: p.y + 30, w: bw, d: bd, h: 40, c: "#FFF3D0", top: "#FFF8E4", win: { rows: 1, cols: 4, color: "#7FB7DA", lit: "#CDEBFA", seed: 7 + k } });
    const band = B({ x: p.x + 8, y: p.y + 22, z: 40, w: bw + 16, d: bd + 16, h: 12, c: C.red, top: "#EF4B3E" });
    const door = B({ x: p.x + 16 + bw - 2, y: p.y + 30 + 40, z: 0, w: 4, d: 30, h: 28, c: "#8CC9EA" });
    sc.add({ key() { E.P(p.x + 90, p.y + 85, 60); return E.pd() + 90; }, draw(t) { const u = clamp(eoutB((t - p.t0 - 2.6) / 0.5), 0, 1.3); if (u <= 0.05 || p.t0 === 0 && false) return; E.P(p.x + 90, p.y + 85, 92); L.drawArches(ctx, E.px(), E.py(), 0.45 * Math.max(0.5, E.cam.scale * 1.5) * u, C.yellow, "#C99200"); } });
    sc.dyn((t) => { const t0 = p.t0 === 0 ? 4.6 : p.t0; const u = eoutB((t - t0) / 1.8); base.h = Math.max(0.01, 40 * u); band.z = 40 * u; band.h = Math.max(0.01, 12 * u); door.h = Math.max(0.01, 28 * u); });
    p.door = [p.x + 16 + bw + 18, p.y + 30 + 55];
  }
  PLOTS.forEach(resto);

  // franchisé : sort du siège, marche jusqu'au restaurant, reçoit les clés
  const fr = new L.Person({ shirt: "#1F3A5F", pants: "#2B3447", hair: "#3A2A1E" });
  const owners = PLOTS.slice(1).map((_, i) => new L.Person({ shirt: ["#2FA24A", "#8A4FBF", "#E08A1E"][i], pants: "#2B3447", cap: i === 1 ? "#222" : null, skin: i === 2 ? C.skin2 : C.skin }));
  const P0 = PLOTS[0];
  sc.dyn((t, f) => {
    const u = clamp((t - 8.0) / 2.2, 0, 1), x = lerp(HQ[0] + 60, P0.door[0] + 10, eio(u)), y = lerp(HQ[1] + 50, P0.door[1] + 26, eio(u));
    const mov = u > 0 && u < 1;
    // trajet en L : d'abord y puis x
    const px = x, py = lerp(HQ[1] + 50, P0.door[1] + 26, eio(clamp(u * 1.4, 0, 1)));
    fr.pose(px, py, mov ? 0.6 : Math.PI * 0.75, mov, t, 0); fr.push(f);
    owners.forEach((o, i) => { const p = PLOTS[i + 1], s = clamp((t - p.t0 - 1.0) / 1.4, 0, 1); if (s <= 0) return; o.pose(p.door[0] + 8, lerp(p.door[1] + 60, p.door[1] + 18, eio(s)), -Math.PI / 2, s < 1, t, 0); o.push(f); });
  });

  // pièces : loyer (rouge) + redevance (jaune) vers le siège ; reste vers le franchisé (vert)
  function coin(x, y, z, col, s) { E.P(x, y, z); const X = E.px(), Y = E.py(), r = 9 * s; ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(X, Y + r * 0.9, r, r * 0.4, 0, 0, 6.28); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.28); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.2 * s; ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "900 " + 12 * s + "px Montserrat, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", X, Y + 1); }
  function stream(src, dst, col, t0, per, n, h, cnt) {
    return (t) => { const s = Math.max(0.6, E.cam.scale * 1.5); if (t < t0) return; for (let i = 0; i < n; i++) { const u = (((t - t0) / per) + i / n) % 1, fade = Math.min(1, (t - t0) / 0.6); const x = lerp(src[0], dst[0], u), y = lerp(src[1], dst[1], u), z = 40 + h * Math.sin(Math.PI * u); ctx.globalAlpha = fade; coin(x, y, z, col, s); ctx.globalAlpha = 1; } };
  }
  const HQd = [HQ[0] + 55, HQ[1] + 40];
  const rent = [stream([P0.x + 90, P0.y + 85], HQd, C.red, 10.6, 3.2, 5, 150), stream([P0.x + 90, P0.y + 85], HQd, C.yellow, 11.4, 3.0, 5, 230)];
  const extra = PLOTS.slice(1).map((p, i) => stream([p.x + 90, p.y + 85], HQd, i % 2 ? C.red : C.yellow, p.t0 + 2.2, 3.6, 3, 220 + i * 40));
  sc.over((t) => {
    rent.forEach((f) => f(t)); extra.forEach((f) => f(t));
    // clé remise
    const k = prog(t, 10.2, 10.8) * (1 - prog(t, 12.0, 12.6)); if (k > 0.01) { E.P(P0.door[0] + 10, P0.door[1] + 26, 78); const s = Math.max(0.6, E.cam.scale * 1.5) * k, X = E.px(), Y = E.py(); ctx.save(); ctx.translate(X, Y - 10 * k); ctx.scale(s, s); ctx.strokeStyle = C.yellow; ctx.fillStyle = "#fff"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(-8, 0, 11, 0, 6.28); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, 6); ctx.lineTo(24, 24); ctx.moveTo(15, 16); ctx.lineTo(23, 8); ctx.stroke(); ctx.restore(); }
  });
  // voitures sur la route
  [[0, "#E53935", 1, 0], [1, "#1E88E5", -1, 0.5], [2, "#FDD835", 1, 0.25], [3, "#43A047", -1, 0.75], [4, "#8E24AA", 1, 0.6]].forEach((c) => { const car = new L.Car(c[1], c[0] === 2); sc.dyn((t, f) => { const u = (((t * 0.05 + c[3]) % 1) + 1) % 1, x = c[2] > 0 ? lerp(-300, 1900, u) : lerp(1900, -300, u); car.pose(x, RY + (c[2] > 0 ? 46 : 14), c[2] > 0 ? 0 : Math.PI); car.push(f); }); });
  window.LOGI_TAGS = { hq: [HQ[0], HQ[1], 120], site: [P0.x + 20, P0.y + 30, 10], fr: [P0.door[0] + 10, P0.door[1] + 26, 80], rest: [P0.x + 90, P0.y + 85, 96], rent: [(P0.x + HQ[0]) / 2 + 40, (P0.y + HQ[1]) / 2 + 30, 160], more: [PLOTS[2].x + 90, PLOTS[2].y + 85, 90] };
  window.SCENES.push(sc);
})();
