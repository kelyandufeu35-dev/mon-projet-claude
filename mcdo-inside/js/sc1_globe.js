/* SCÈNE 1 — Un empire mondial : globe de points, restaurants miniatures, lignes lumineuses */
(function () {
  const E = window.ENG, L = window.LIB, C = L.C;
  const { ctx, W, H, clamp, lerp, sm, sm5, prog, eio, eout, eoutB, rgba, mix } = E;
  const sc = new L.Scene("globe", 0, 10);
  const D = Math.PI / 180;

  const CITIES = [
    ["Paris", 48.9, 2.35], ["Londres", 51.5, -0.1], ["Berlin", 52.5, 13.4], ["Madrid", 40.4, -3.7], ["Istanbul", 41, 29], ["New York", 40.7, -74],
    ["Toronto", 43.7, -79.4], ["Chicago", 41.9, -87.6], ["Los Angeles", 34, -118.2], ["Mexico", 19.4, -99.1], ["São Paulo", -23.5, -46.6],
    ["Buenos Aires", -34.6, -58.4], ["Le Caire", 30, 31.2], ["Johannesburg", -26.2, 28], ["Dubaï", 25.2, 55.3], ["Mumbai", 19, 72.8],
    ["Singapour", 1.35, 103.8], ["Shanghai", 31.2, 121.5], ["Pékin", 39.9, 116.4], ["Tokyo", 35.7, 139.7], ["Sydney", -33.9, 151.2], ["Lagos", 6.5, 3.4],
  ];
  const ARCS = [[0, 5], [0, 14], [0, 12], [5, 8], [5, 10], [14, 15], [15, 16], [16, 19], [19, 20], [0, 17], [8, 19], [10, 11], [12, 13], [0, 21], [7, 9]];
  const nC = CITIES.length;

  function v3(lat, lon, r) { const a = lat * D, b = lon * D; return [r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b)]; }
  // rotation : lon0 (autour de Y), tilt (autour de X)
  function rot(p, lon0, tilt) {
    const c = Math.cos(-lon0 * D), s = Math.sin(-lon0 * D);
    let x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c, y = p[1];
    const ct = Math.cos(tilt * D), st = Math.sin(tilt * D);
    const y2 = y * ct - z * st, z2 = y * st + z * ct;
    return [x, y2, z2];
  }
  const dots = window.LAND.map((p) => ({ lat: p[0], lon: p[1], p: v3(p[0], p[1], 1) }));
  const cityV = CITIES.map((c) => v3(c[1], c[2], 1));
  const cityT = CITIES.map((c, i) => 0.9 + i * 0.28 + (i % 3) * 0.1); // temps d'apparition

  function view(tl) {
    // rotation Amériques → Europe → Asie, puis plongée sur Paris
    const lon0 = lerp(-105, 8, eio(prog(tl, 0, 7.2))) + prog(tl, 7.2, 10) * 2;
    const lon = lerp(lon0, 2.35, sm5(prog(tl, 7.6, 9.6)));
    const tilt = lerp(18, 48.9 * 0.55, sm5(prog(tl, 7.4, 9.6)));
    const R = lerp(250, 400, eio(prog(tl, 0, 7))) * (1 + 6.5 * Math.pow(sm5(prog(tl, 7.8, 10.2)), 2.2));
    return { lon, tilt, R, cx: W / 2 + lerp(250, 0, sm(prog(tl, 6.6, 8.6))), cy: H / 2 + 20 };
  }

  sc.render = function (tl, zoomMul) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    // fond : dégradé chaud + halo
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#FFF2C7"); g.addColorStop(1, "#FFD25A");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const gg = ctx.createRadialGradient(W * 0.5, H * 0.45, 100, W * 0.5, H * 0.45, 900); gg.addColorStop(0, "rgba(255,255,255,0.75)"); gg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    // motif d'anneaux rouges très discret
    ctx.strokeStyle = "rgba(218,41,28,0.07)"; ctx.lineWidth = 3;
    for (let k = 1; k < 7; k++) { ctx.beginPath(); ctx.arc(W * 0.5, H * 0.5, 160 + k * 150 + tl * 6, 0, 6.2832); ctx.stroke(); }

    const v = view(tl); const R = v.R * zoomMul, cx = v.cx, cy = v.cy;
    // ombre portée de la sphère
    ctx.fillStyle = "rgba(120,60,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx + 20, cy + R * 1.02, R * 0.85, R * 0.12, 0, 0, 6.2832); ctx.fill();
    // halo atmosphère
    const ah = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.18); ah.addColorStop(0, "rgba(120,200,255,0.55)"); ah.addColorStop(1, "rgba(120,200,255,0)");
    ctx.fillStyle = ah; ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, 6.2832); ctx.fill();
    // océan
    const og = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    og.addColorStop(0, "#5FC3F2"); og.addColorStop(0.65, "#2D8FD9"); og.addColorStop(1, "#1A62B3");
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    // graticule
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1.2;
    for (let lat = -60; lat <= 60; lat += 30) { ctx.beginPath(); let f = true; for (let lon = -180; lon <= 180; lon += 6) { const q = rot(v3(lat, lon, 1), v.lon, v.tilt); if (q[2] < 0) { f = true; continue; } const X = cx + q[0] * R, Y = cy - q[1] * R; if (f) { ctx.moveTo(X, Y); f = false; } else ctx.lineTo(X, Y); } ctx.stroke(); }
    for (let lon = -180; lon < 180; lon += 30) { ctx.beginPath(); let f = true; for (let lat = -80; lat <= 80; lat += 5) { const q = rot(v3(lat, lon, 1), v.lon, v.tilt); if (q[2] < 0) { f = true; continue; } const X = cx + q[0] * R, Y = cy - q[1] * R; if (f) { ctx.moveTo(X, Y); f = false; } else ctx.lineTo(X, Y); } ctx.stroke(); }
    // terres : pastilles
    const ds = Math.max(1.6, R * 0.0105);
    for (let i = 0; i < dots.length; i++) {
      const q = rot(dots[i].p, v.lon, v.tilt); if (q[2] < 0.04) continue;
      const X = cx + q[0] * R, Y = cy - q[1] * R;
      if (X < -20 || X > W + 20 || Y < -20 || Y > H + 20) continue;
      const lit = clamp(0.45 + 0.55 * q[2] + 0.18 * (-q[0] * 0.6 + q[1] * 0.5), 0, 1);
      ctx.fillStyle = "rgb(" + (70 + 60 * lit | 0) + "," + (150 + 70 * lit | 0) + "," + (60 + 30 * lit | 0) + ")";
      const s2 = ds * (0.6 + 0.5 * q[2]);
      ctx.fillRect(X - s2 / 2, Y - s2 / 2, s2, s2);
    }
    ctx.restore();
    // reflet
    const sh = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.9); sh.addColorStop(0, "rgba(255,255,255,0.3)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();

    // arcs lumineux
    ctx.lineCap = "round";
    ARCS.forEach((a, k) => {
      const t0 = 3.0 + k * 0.32, u = clamp((tl - t0) / 1.3, 0, 1); if (u <= 0) return;
      const A = cityV[a[0]], B = cityV[a[1]];
      const dot = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1), om = Math.acos(dot), so = Math.sin(om) || 1;
      const N = 36; let pts = [];
      for (let s = 0; s <= N * u; s++) {
        const f = s / N, w1 = Math.sin((1 - f) * om) / so, w2 = Math.sin(f * om) / so, h = 1 + 0.2 * Math.sin(Math.PI * f) * Math.min(1, om);
        const p = [(A[0] * w1 + B[0] * w2) * h, (A[1] * w1 + B[1] * w2) * h, (A[2] * w1 + B[2] * w2) * h];
        const q = rot(p, v.lon, v.tilt); pts.push([cx + q[0] * R, cy - q[1] * R, q[2]]);
      }
      for (const [col, lw, al] of [["rgba(218,41,28,0.35)", 7, 1], ["#FFFFFF", 3.2, 1], ["#DA291C", 1.6, 1]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw * Math.max(0.6, R / 400);
        ctx.beginPath(); let f = true; for (const p of pts) { if (p[2] < -0.02) { f = true; continue; } if (f) { ctx.moveTo(p[0], p[1]); f = false; } else ctx.lineTo(p[0], p[1]); } ctx.stroke();
      }
      // étincelle en tête
      if (u < 1 && pts.length) { const p = pts[pts.length - 1]; if (p[2] > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p[0], p[1], 5 * R / 400, 0, 6.2832); ctx.fill(); } }
    });
    ctx.lineCap = "butt";
    // restaurants miniatures (pastilles 3D : socle rouge, toit, arches jaunes)
    const items = [];
    for (let i = 0; i < nC; i++) { const q = rot(cityV[i], v.lon, v.tilt); if (q[2] < 0.12) continue; if (tl <= cityT[i]) continue; const pop = eoutB((tl - cityT[i]) / 0.6); if (pop <= 0) continue; items.push([i, q, pop]); }
    items.sort((a, b) => a[1][2] - b[1][2]);
    for (const [i, q, pop] of items) {
      const s = Math.max(0.55, R / 330) * pop * (i === 0 ? 1.35 : 1), X = cx + q[0] * R, Y = cy - q[1] * R;
      // anneau d'onde
      const ph = ((tl - cityT[i]) * 0.9) % 1;
      ctx.strokeStyle = "rgba(255,255,255," + (0.8 * (1 - ph)) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(X, Y, 8 * s + ph * 40 * s, (8 * s + ph * 40 * s) * 0.5, 0, 0, 6.2832); ctx.fill; ctx.stroke();
      // ombre
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(X + 3 * s, Y + 1, 12 * s, 5 * s, 0, 0, 6.2832); ctx.fill();
      // petit restaurant iso : cube + toit
      const w = 12 * s, h = 12 * s;
      ctx.fillStyle = "#F7F2E6"; ctx.beginPath(); ctx.moveTo(X - w, Y - 2 * s); ctx.lineTo(X, Y + 5 * s); ctx.lineTo(X, Y - h + 5 * s); ctx.lineTo(X - w, Y - h - 2 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#E9DFC9"; ctx.beginPath(); ctx.moveTo(X + w, Y - 2 * s); ctx.lineTo(X, Y + 5 * s); ctx.lineTo(X, Y - h + 5 * s); ctx.lineTo(X + w, Y - h - 2 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#DA291C"; ctx.beginPath(); ctx.moveTo(X, Y - h - 9 * s); ctx.lineTo(X + w + 3 * s, Y - h - 2 * s); ctx.lineTo(X, Y - h + 6 * s); ctx.lineTo(X - w - 3 * s, Y - h - 2 * s); ctx.closePath(); ctx.fill();
      L.drawArches(ctx, X, Y - h - 17 * s, 0.17 * s, "#FFC72C");
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  window.GLOBE_VIEW = view; window.SCENES.push(sc);
})();
