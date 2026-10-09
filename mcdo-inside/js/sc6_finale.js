/* SCÈNE 6 — Le résultat final : le burger, les étapes qui s'assemblent, puis le logo */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, W, H, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rng, mix, newBox, setB, partAt } = E;
  const sc = new L.Scene("finale", 70, 85);
  sc.sky = ["#FFE48F", "#FFF6DC"];
  const rr = rng(31);

  sc.keys = [
    [0.0, 0, 0, 40, 0.7, -45, 37, 0, 0],
    [3.0, 0, 0, 40, 0.72, -60, 38, 0, 0],
    [6.0, 0, 0, 40, 0.74, -80, 36, 0, 0],
    [9.0, 0, 0, 50, 0.84, -100, 34, 0, 0],
    [10.6, 0, 0, 50, 0.95, -115, 33, 0, 0],
    [15.0, 0, 0, 50, 0.95, -115, 33, 0, 0],
  ];
  // fond : rayons de soleil
  sc.bgFn = (t) => {
    const cx = W / 2, cy = H * 0.5; ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.05);
    for (let i = 0; i < 20; i++) { ctx.rotate(Math.PI * 2 / 20); ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.28)" : "rgba(255,199,44,0.2)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1800, -150); ctx.lineTo(1800, 150); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  /* plateforme */
  sc.cyl({ x: 0, y: 0, z: -22, r: 330, h: 16, c: C.red, top: "#EF4B3E" });
  sc.cyl({ x: 0, y: 0, z: -6, r: 312, h: 8, c: C.yellow, top: "#FFD54D" });
  sc.cyl({ x: 0, y: 0, z: 2, r: 296, h: 6, c: "#fff", top: "#FFFDF4" });

  /* burger géant */
  const lay = [
    { t0: 0.5, kind: "cyl", r: 108, h: 30, z: 8, c: "#D69A4E", top: "#E9B56B" },
    { t0: 0.95, kind: "cyl", r: 102, h: 24, z: 38, c: "#6B3F2A", top: "#8A573D" },
    { t0: 1.3, kind: "box", w: 170, d: 170, h: 8, z: 62, c: C.yellow, top: "#FFD84F", ang: 0.785 },
    { t0: 1.65, kind: "cyl", r: 116, h: 12, z: 70, c: "#5DBB41", top: "#7DDB5F" },
    { t0: 2.0, kind: "cyl", r: 92, h: 12, z: 82, c: "#E5392C", top: "#FF5A4A" },
    { t0: 2.35, kind: "cyl", r: 80, h: 6, z: 94, c: "#F4F1E8", top: "#fff" },
    { t0: 2.7, kind: "cyl", r: 108, h: 48, z: 100, c: "#D69A4E", top: "#F0BE78" },
  ];
  const BK = 1.7; lay.forEach((p) => { if (p.r) { p.r *= BK; } if (p.w) { p.w *= BK; p.d *= BK; } p.h *= BK; p.z = p.z * BK; });
  const lobj = lay.map((p) => p.kind === "cyl" ? sc.cyl({ r: p.r, h: p.h, c: p.c, top: p.top, bias: 10 }) : sc.box({ w: p.w, d: p.d, h: p.h, c: p.c, top: p.top, bias: 10, ang: p.ang }));
  const seeds = []; for (let i = 0; i < 16; i++) { const a = i * 2.4, rad = (30 + (i % 4) * 22) * 1.5; seeds.push({ b: sc.box({ x: Math.cos(a) * rad - 5, y: Math.sin(a) * rad - 3, z: 148 * 1.7, w: 12, d: 8, h: 4, c: "#FFF1CC", top: "#fff", bias: 12, noShadow: true, ang: a }), a, rad }); }
  sc.dyn((t) => {
    const bob = Math.sin(t * 2) * 3;
    lay.forEach((p, i) => { const u = eoutB((t - p.t0) / 0.5), drop = (1 - clamp((t - p.t0) / 0.5, 0, 1)) * 300; const o = lobj[i]; if (p.kind === "cyl") { o.x = 0; o.y = 0; } else { o.x = -p.w / 2; o.y = -p.d / 2; } o.z = p.z + drop + bob; o.a = clamp((t - p.t0) / 0.2, 0, 1); });
    seeds.forEach((s) => { const u = clamp((t - 3.0) / 0.4, 0, 1); s.b.z = 148 * 1.7 + bob + (1 - u) * 200; s.b.a = u; });
  });

  /* dioramas qui s'assemblent autour du burger */
  const TILES = [];
  function tile(kind, ang, t0) {
    const R = 560, cx = Math.cos(ang) * R, cy = Math.sin(ang) * R, items = [], col = { farm: "#8FD05A", factory: "#D5DAE0", logi: "#7CC0EA", resto: "#F2E6CE", client: "#F6E4B2" }[kind];
    const add = (o) => { const b = new E.Box(Object.assign({ bias: 8 }, o)); b.l = { x: o.x, y: o.y, z: o.z || 0, w: o.w, d: o.d, h: o.h }; items.push(b); sc.S.push(b); return b; };
    add({ x: -120, y: -120, z: 0, w: 240, d: 240, h: 16, c: col, top: mix(col, "#fff", 0.15), edge: "rgba(255,255,255,0.5)" });
    if (kind === "farm") {
      for (let i = 0; i < 5; i++) add({ x: -110, y: -100 + i * 22, z: 16, w: 130, d: 14, h: 6, c: i % 2 ? "#6D4426" : "#8B5A32", top: i % 2 ? "#8B5A32" : "#A06A3C", noShadow: true });
      for (let i = 0; i < 5; i++) add({ x: -100 + i * 24, y: -100, z: 22, w: 10, d: 100, h: 6, c: "#5CAF45", top: "#7CD05E", noShadow: true });
      add({ x: 30, y: -80, z: 16, w: 80, d: 70, h: 46, c: C.red, top: "#EF4B3E" }); add({ x: 40, y: 20, z: 16, w: 22, d: 22, h: 60, c: "#E2E8EF", top: "#fff" });
    } else if (kind === "factory") {
      add({ x: -90, y: -80, z: 16, w: 130, d: 100, h: 54, c: "#F4F7FA", top: "#fff", band: [C.red, 0.8, 1] }); add({ x: 50, y: -70, z: 16, w: 24, d: 24, h: 90, c: "#D0D6DE", top: "#fff", band: [C.red, 0.78, 0.9] });
      add({ x: -100, y: 40, z: 16, w: 200, d: 30, h: 12, c: "#8E9AA8", top: "#2A3340", edge: "rgba(255,199,44,0.8)" });
      for (let i = 0; i < 5; i++) add({ x: -80 + i * 36, y: 48, z: 28, w: 6, d: 6, h: 18, c: "#F2B21E", top: "#FFD54D", noShadow: true });
    } else if (kind === "logi") {
      add({ x: -110, y: -90, z: 16, w: 140, d: 110, h: 50, c: "#F4F6F9", top: "#fff", band: [C.red, 0.8, 1] }); add({ x: -90, y: -80, z: 66, w: 100, d: 90, h: 10, c: "#3A78C2", top: "#5D9BE0" });
      add({ x: -100, y: 50, z: 16, w: 130, d: 40, h: 36, c: C.white, top: "#fff", band: [C.red, 0.4, 0.55] }); add({ x: 38, y: 52, z: 16, w: 38, d: 36, h: 30, c: C.red, top: "#EF4B3E" });
      add({ x: 20, y: -60, z: 16, w: 50, d: 40, h: 28, c: "#CFEFFF", top: "#E9F8FF", band: ["#4FB5EE", 0.45, 0.58] });
    } else if (kind === "resto") {
      add({ x: -90, y: -70, z: 16, w: 180, d: 130, h: 44, c: "#FFF3D0", top: "#fff", win: { rows: 1, cols: 4, color: "#7FB7DA", lit: "#CDEBFA", seed: 1 } }); add({ x: -98, y: -78, z: 60, w: 196, d: 146, h: 14, c: C.red, top: "#EF4B3E" });
      add({ x: 60, y: 70, z: 16, w: 40, d: 20, h: 20, c: "#1E88E5", top: "#64B5F6" });
    } else {
      add({ x: -40, y: -40, z: 16, w: 80, d: 80, h: 4, c: "#F6F0E0", top: "#fff" }); add({ x: -6, y: -6, z: 20, w: 12, d: 12, h: 24, c: "#8C8C8C" });
      add({ x: -30, y: -30, z: 40, w: 60, d: 60, h: 6, c: "#fff", top: "#fff" });
      add({ x: -20, y: -20, z: 46, w: 22, d: 16, h: 10, c: "#E4C68A", top: "#F2DDB0", band: [C.red, 0.5, 0.7] }); add({ x: 10, y: 6, z: 46, w: 12, d: 12, h: 16, c: C.red, top: "#EF4B3E" });
      [[-70, 30, "#2E86DE"], [70, -30, "#E85D8A"]].forEach((p) => { add({ x: p[0] - 8, y: p[1] - 6, z: 16, w: 16, d: 12, h: 40, c: p[2], top: mix(p[2], "#fff", 0.2) }); add({ x: p[0] - 7, y: p[1] - 7, z: 56, w: 14, d: 14, h: 14, c: C.skin, top: "#FADDBE" }); });
    }
    TILES.push({ kind, cx, cy, items, t0, ang });
  }
  tile("farm", Math.PI * 1.1, 3.0); tile("factory", Math.PI * 1.55, 3.5); tile("logi", Math.PI * 1.95, 4.0); tile("resto", Math.PI * 0.5, 4.5); tile("client", Math.PI * 0.95 - 0.1, 5.0);
  TILES[4].cx = Math.cos(Math.PI * 0.27) * 560; TILES[4].cy = Math.sin(Math.PI * 0.27) * 560;
  sc.dyn((t) => {
    TILES.forEach((tl2) => {
      const u = clamp((t - tl2.t0) / 1.3, 0, 1), e = eoutB(u), s = lerp(0.25, 1, e), lift = (1 - eout(u)) * 900, spin = (1 - eout(u)) * 5, sx = 1 - (1 - eout(u)) * 0;
      const R0 = lerp(2600, 1, e), ax = tl2.cx * R0, ay = tl2.cy * R0;
      tl2.items.forEach((b) => { b.vis = u > 0; const l = b.l; b.x = ax + l.x * s; b.y = ay + l.y * s; b.z = l.z * s + lift; b.w = l.w * s; b.d = l.d * s; b.h = l.h * s; });
    });
  });
  window.FIN_TILES = TILES;
  // flux lumineux : tuiles → burger
  sc.over((t) => {
    TILES.forEach((tl2, k) => {
      const u = prog(t, tl2.t0 + 1.2, tl2.t0 + 2.2); if (u <= 0) return;
      ctx.lineCap = "round";
      const pts = []; for (let i = 0; i <= 28 * u; i++) { const f = i / 28; E.P(lerp(tl2.cx * 0.8, 0, f), lerp(tl2.cy * 0.8, 0, f), 40 + 80 * Math.sin(Math.PI * f)); pts.push([E.px(), E.py()]); }
      for (const [c2, w2] of [["rgba(255,255,255,0.9)", 9], [C.red, 4.5]]) { ctx.strokeStyle = c2; ctx.lineWidth = w2 * E.cam.scale * 1.4; ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); }
      if (u >= 1) for (let d = 0; d < 3; d++) { const f = ((t * 0.35 + k * 0.2 + d / 3) % 1); E.P(lerp(tl2.cx * 0.8, 0, f), lerp(tl2.cy * 0.8, 0, f), 40 + 80 * Math.sin(Math.PI * f)); ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(E.px(), E.py(), 6 * E.cam.scale * 1.4, 0, 6.28); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
    });
    E.glow(0, 0, 130, 520, "#FFFFFF", 0.22 * clamp((t - 0.6) / 1.5, 0, 1));
  });

  /* logo final : cercle rouge qui recouvre, arches dessinées puis remplies */
  const baseRender = (tl, zm) => { window.RENDER.renderIso(sc, tl, zm); };
  sc.render = function (tl, zm) {
    baseRender(tl, zm);
    const u = eio(prog(tl, 10.0, 11.4)); if (u <= 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const R = Math.hypot(W, H) * 0.62 * u, cx = W / 2, cy = H * 0.5;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fillStyle = C.red; ctx.fill(); ctx.clip();
    const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 1100); rg.addColorStop(0, "#F13A2C"); rg.addColorStop(1, "#B5190F"); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    // anneaux
    ctx.strokeStyle = "rgba(255,199,44,0.18)"; ctx.lineWidth = 3; for (let k = 1; k < 7; k++) { ctx.beginPath(); ctx.arc(cx, cy, 200 + k * 130 + Math.sin(tl * 0.8 + k) * 6, 0, 6.2832); ctx.stroke(); }
    // arches : tracé animé en trait épais
    const s = 4.4 + 0.35 * eout(prog(tl, 11.0, 15)), drawU = eio(prog(tl, 11.2, 12.8));
    ctx.translate(cx, cy - 40); ctx.scale(s, s);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    L.archesPath(ctx); ctx.setLineDash([260 * drawU, 600]); ctx.lineWidth = 19; ctx.strokeStyle = C.yellow; ctx.shadowColor = "rgba(255,199,44,0.85)"; ctx.shadowBlur = 22; ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    // éclat qui balaie (uniquement sur le tracé des arches)
    const sw = prog(tl, 13.0, 14.0);
    if (sw > 0 && sw < 1) { const gx = lerp(-120, 120, sw), gg = ctx.createLinearGradient(gx - 24, -50, gx + 24, 50); gg.addColorStop(0, "rgba(255,255,255,0)"); gg.addColorStop(0.5, "rgba(255,255,255,0.95)"); gg.addColorStop(1, "rgba(255,255,255,0)"); L.archesPath(ctx); ctx.lineWidth = 19; ctx.strokeStyle = gg; ctx.stroke(); }
    ctx.restore();
    // confettis jaunes/blancs
    for (let i = 0; i < 40; i++) { const ph = (tl * 0.18 + i * 0.137) % 1, x = (i * 97 % 1920), y = ((1 - ph) * 1200 - 60); ctx.fillStyle = i % 3 === 0 ? "#fff" : C.yellow; ctx.globalAlpha = 0.6 * Math.min(1, u) * (u > 0.9 ? 1 : 0); ctx.fillRect(x, y, 8, 8); ctx.globalAlpha = 1; }
  };
  window.SCENES.push(sc);
})();
