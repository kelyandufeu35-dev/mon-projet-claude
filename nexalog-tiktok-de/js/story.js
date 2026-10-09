/* NEXALOG — caméra, timeline narrative et boucle de rendu */
(function () {
  const E = window.ENG, Wd = window.WORLD;
  const { ctx, cam, W, H, clamp, lerp, sm, sm5, prog, eio } = E;
  const DEG = Math.PI / 180;

  // jalons caméra : [t, tx, ty, tz, scale, yaw°, el°, ox, oy]
  const KEYS = [
    [0.0, 760, 640, 0, 0.72, -78, 46, 430, 20],
    [1.5, 720, 620, 0, 0.40, -62, 40, 430, 20],
    [3.0, 700, 600, 0, 0.32, -54, 36.5, 420, 10],
    [6.5, 720, 640, 0, 0.40, -47, 35.3, 260, 0],
    [9.0, 780, 700, 0, 0.64, -42, 34, 220, -20],
    [11.2, 940, 800, 0, 0.9, -38, 33, 260, -40],
    [17.5, 900, 770, 0, 0.98, -34, 33, 260, -40],
    [21.0, 600, 380, 0, 0.88, -62, 34.5, 260, -30],
    [24.5, 620, 330, 0, 0.92, -76, 36, 260, -30],
    [27.5, 780, 320, 0, 0.92, -70, 36, 260, -30],
    [30.5, 1180, 300, 0, 1.2, -42, 36, 230, 30],
    [35.0, 1170, 360, 0, 1.2, -40, 36, 230, 30],
    [38.2, 340, 700, 0, 1.4, -32, 33, 200, 90],
    [43.2, 330, 690, 0, 1.45, -30, 32, 200, 90],
    [46.0, 40, 350, 0, 0.95, -28, 34, 260, -30],
    [50.0, -60, 330, 0, 0.82, -26, 34, 240, -20],
    [53.0, -300, 560, 0, 0.38, -40, 36, 400, 0],
    [56.0, -100, 640, 0, 0.29, -46, 37, 520, 20],
  ];
  function camAt(t) {
    // Catmull-Rom centripète simple sur chaque paramètre, extrémités tangentes nulles
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
    const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
    const u = clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1);
    const out = [];
    for (let p = 1; p < 9; p++) {
      const m1 = i === 0 ? 0 : (k2[p] - k0[p]) / (k2[0] - k0[0]) * (k2[0] - k1[0]);
      const m2 = i === KEYS.length - 2 ? 0 : (k3[p] - k1[p]) / (k3[0] - k1[0]) * (k2[0] - k1[0]);
      const u2 = u * u, u3 = u2 * u;
      out.push((2 * u3 - 3 * u2 + 1) * k1[p] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[p] + (u3 - u2) * m2);
    }
    return out;
  }
  function setCamera(t) {
    const c = camAt(t);
    cam.tx = c[0]; cam.ty = c[1]; cam.tz = c[2]; cam.scale = c[3];
    cam.yaw = c[4] * DEG; cam.el = c[5] * DEG; cam.ox = 0; cam.oy = -250; cam.scale *= 0.62;
    // impulsions calées sur le kick (112 bpm) + coups de zoom aux transitions
    const BEAT = 60 / 112;
    if (t >= 9.45 && t < 52.8) { const ph = (t - 9.45) % BEAT; const pu = Math.exp(-ph * 7); cam.scale *= 1 + 0.035 * pu; cam.oy += -10 * pu; }
    for (const tt of [6.6, 19.5, 28.2, 36.0, 44.0, 52.3]) { const d = (t - tt) / 0.3; cam.scale *= 1 + 0.16 * Math.exp(-d * d); }
    cam.yaw += Math.sin(t * 0.6) * 0.012;
    // petit souffle de caméra (déterministe)
    cam.ox += Math.sin(t * 0.9) * 3; cam.oy += Math.cos(t * 0.7) * 2;
    E.camUpdate();
  }

  /* ---------- états globaux pilotés par le temps ---------- */
  const ST = { wallLow: 0, peel: 0 };
  function updateGlobal(t) {
    ST.build = prog(t, 0.2, 2.6);
    const open = sm5(prog(t, 8.1, 9.7)), close = sm5(prog(t, 52.4, 54.6));
    ST.wallLow = open * (1 - close * 0); // les murs restent bas
    ST.peel = prog(t, 7.2, 9.6) - prog(t, 52.2, 54.6);
    Wd.wallS.concat(Wd.wallW).forEach((b) => { b.h0 = lerp(Wd.WH, 24, ST.wallLow); });
    // murs sud/ouest qui s'abaissent
    const h = lerp(Wd.WH, 24, ST.wallLow);
    Wd.lintS.concat(Wd.lintW).forEach((b) => { const z0 = Math.min(Wd.DOORH, h); b.z = z0; b.h0 = Math.max(0, h - z0); });
    // montée des bâtiments (intro)
    Wd.RISE.forEach((b) => {
      const e = E.sm5((t - b.rdel) / 0.9);
      if (b.rmode === 0) b.h = b.h0 * e; else { b.a = e * (b.a0 == null ? 1 : b.a0); if (b.h0 != null && b.rmode === 1) b.h = b.h0; }
    });
    // panneaux de toit
    Wd.roofPanels.forEach((p) => {
      const u = clamp((ST.peel - p.delay) / 0.4, 0, 1), e = eio(u);
      const bp = sm5(prog(t, 0.9 + p.delay * 1.1, 2.0 + p.delay * 1.1));
      const dz = e * 760 + (1 - bp) * 520, al = (1 - Math.pow(u, 1.6)) * bp;
      p.b.z = Wd.WH + dz; p.b.a = al;
      p.ex.forEach((x) => { x.b.z = Wd.WH + x.dz + dz; x.b.a = al; });
    });
  }

  Wd.RISE.forEach((b, i) => { const cx = b.x + b.w / 2, cy = b.y + b.d / 2; b.rdel = 0.25 + Math.hypot(cx - 700, cy - 450) / 4800 * 1.7 + ((i * 37) % 100) / 100 * 0.35; });
  const T_INT = 3.7;
  function hiddenInt(o) {
    if (o.shell) return false;
    if (o.inter) return true;
    if (o instanceof E.Box) { const cx = o.x + o.w / 2, cy = o.y + o.d / 2; return cx > 5 && cx < 1395 && cy > 5 && cy < 895 && o.z < 250; }
    return !!o.arm;
  }
  const frame = [];
  function renderAt(t) {
    Wd.interiorOn = t >= T_INT;
    updateGlobal(t);
    setCamera(t);
    // fond
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#050a1c"); g.addColorStop(1, "#0a1636");
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // passe sol
    ctx.lineCap = "butt";
    Wd.G.forEach((f) => f(t));
    if (Wd.GD) Wd.GD.forEach((f) => f(t));
    // objets triés
    frame.length = 0;
    for (let i = 0; i < Wd.S.length; i++) { const b = Wd.S[i]; frame.push(b); }
    for (let i = 0; i < Wd.UP.length; i++) Wd.UP[i](t, frame);
    if (t < T_INT) {
      let n = 0;
      for (let i = 0; i < frame.length; i++) { if (!hiddenInt(frame[i])) frame[n++] = frame[i]; }
      frame.length = n;
    }
    for (let i = 0; i < frame.length; i++) {
      const o = frame[i];
      o._k = o.key ? o.key() : o.k;
    }
    frame.sort((a, b) => a._k - b._k);
    for (let i = 0; i < frame.length; i++) { const o = frame[i]; if (o.draw) o.draw(t); }
    // overlays lumineux
    Wd.OV.forEach((f) => f(t));
    if (window.HUD) window.HUD(t);
  }
  window.renderAt = renderAt;
  window.DURATION = 56;
})();
