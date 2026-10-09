/* Rendu multi-scènes avec transitions "iris" (zoom + ouverture circulaire) */
(function () {
  const E = window.ENG, L = window.LIB;
  const { ctx, W, H, clamp, lerp, sm, sm5, prog, eio, eout } = E;
  const SC = (window.SCENES = window.SCENES || []);
  const BOUNDS = [10, 25, 40, 55, 70]; // instants de transition entre scènes
  const TT0 = 0.35, TT1 = 1.05; // avant / après la frontière

  function skyFill(sc) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sc.sky[0]); g.addColorStop(1, sc.sky[1]);
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const frame = [];
  // rendu d'une scène isométrique ; zoomMul permet les push-in de transition
  function renderIso(sc, tl, zoomMul, oyAdd) {
    const keys = sc.keys, tmax = keys[keys.length - 1][0];
    const c = L.camAt(keys, clamp(tl, 0, tmax));
    c[3] *= 0.78 * (zoomMul || 1); c[7] += (oyAdd || 0) - 140;
    L.applyCam(c);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    skyFill(sc);
    if (sc.bgFn) sc.bgFn(tl);
    ctx.lineCap = "butt";
    sc.G.forEach((f) => f(tl));
    frame.length = 0;
    for (let i = 0; i < sc.S.length; i++) { const b = sc.S[i]; if (b.vis !== false) frame.push(b); }
    for (let i = 0; i < sc.UP.length; i++) sc.UP[i](tl, frame);
    // ombres au sol
    for (let i = 0; i < frame.length; i++) { const o = frame[i]; if (o.drawShadow) o.drawShadow(); }
    for (let i = 0; i < frame.length; i++) { const o = frame[i]; o._k = o.key ? o.key() : o.k; }
    frame.sort((a, b) => a._k - b._k);
    for (let i = 0; i < frame.length; i++) { const o = frame[i]; if (o.draw) o.draw(tl); }
    sc.OV.forEach((f) => f(tl));
  }
  window.RENDER = { renderIso };

  function drawScene(sc, t, zoomMul) {
    const tl = t - sc.t0;
    if (sc.render) sc.render(tl, zoomMul || 1); else renderIso(sc, tl, zoomMul);
  }

  function iris(r, cx, cy) {
    ctx.save();
    ctx.lineWidth = 26; ctx.strokeStyle = "#FFC72C";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 10; ctx.strokeStyle = "#DA291C";
    ctx.beginPath(); ctx.arc(cx, cy, r + 18, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  window.renderAt = function (t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    let i = SC.length - 1;
    for (let k = 0; k < BOUNDS.length; k++) if (t < BOUNDS[k] - TT0 && k < i) { i = k; break; }
    // trouver la scène principale
    let idx = 0; while (idx < BOUNDS.length && t >= BOUNDS[idx] + TT1) idx++;
    // transition ?
    let tr = -1; for (let k = 0; k < BOUNDS.length; k++) if (t >= BOUNDS[k] - TT0 && t < BOUNDS[k] + TT1) tr = k;
    if (tr >= 0) {
      const u = (t - (BOUNDS[tr] - TT0)) / (TT0 + TT1), e = eio(clamp(u, 0, 1));
      const out = SC[tr], inn = SC[tr + 1];
      drawScene(out, t, 1 + 0.18 * e);
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2 + 60, r = R * e;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, r), 0, 6.2832); ctx.clip();
      drawScene(inn, t, 0.62 + 0.38 * e);
      ctx.restore();
      if (e > 0.01 && e < 0.995) iris(r, cx, cy);
    } else {
      const sc = SC[Math.min(idx, SC.length - 1)];
      drawScene(sc, t, 1);
    }
    if (window.PRES) window.PRES.draw(ctx, t, W, H);
    if (window.HUD) window.HUD(t);
  };
  window.DURATION = 85;
})();
