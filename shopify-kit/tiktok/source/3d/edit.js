// Montage de l'animation 3D : plans Blender + textes animés sur le rythme.
(() => {
  const { W, H, C, ctx, clamp, prog, pop, loadImage, sticker } = window.V;
  const BEAT = 0.5;
  // Plans : nom, début (s), nombre d'images (24 i/s).
  const SHOTS = [
    ['drop', 0, 36],
    ['macro', 1.5, 36],
    ['roll', 3.0, 60],
    ['trio', 5.5, 48],
    ['hero', 7.5, 60],
  ];
  const DURATION = 10;
  const FR = {};

  // Gros mot qui « claque » : apparaît en grand, se pose, contour épais.
  function slam(text, t, t0, { y, size = 170, color = '#fff', rot = -4, out = null } = {}) {
    const p = prog(t, t0, t0 + 0.16);
    if (p <= 0) return;
    if (out !== null && t > out) return;
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.rotate((rot * Math.PI) / 180);
    const s = 1.6 - 0.6 * pop(p);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(p * 2.5);
    ctx.font = `800 ${size}px "Bricolage Grotesque"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Ombre décalée + contour façon autocollant.
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(text, 10, 12);
    ctx.fillStyle = C.ink;
    ctx.fillText(text, 10, 12);
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function frameFor(t) {
    for (let i = SHOTS.length - 1; i >= 0; i--) {
      const [name, start, n] = SHOTS[i];
      if (t >= start) return { name, im: FR[name][Math.min(n - 1, Math.floor((t - start) * 24))], lt: t - start };
    }
  }

  function draw(t) {
    const { name, im, lt } = frameFor(t);
    // Petite pulsation sur chaque temps + secousse aux impacts.
    const beatPhase = (t % BEAT) / BEAT;
    let zoom = 1 + 0.025 * Math.exp(-beatPhase * 6);
    let sx = 0;
    let sy = 0;
    const impacts = [0.458, 6.12, 6.44, 6.76];
    for (const ti of impacts) {
      const d = t - ti;
      if (d >= 0 && d < 0.25) {
        const k = (1 - d / 0.25) * 16;
        sx += Math.sin(d * 90) * k;
        sy += Math.cos(d * 70) * k;
        zoom += 0.02 * (1 - d / 0.25);
      }
    }
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, -W / 2, -H / 2, W, H);
    ctx.restore();

    // Flash blanc très court sur chaque coupe.
    for (const [, start] of SHOTS.slice(1)) {
      const d = t - start;
      if (d >= 0 && d < 0.1) {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - d / 0.1)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Textes, calés sur les temps (0,5 s).
    if (name === 'drop') {
      slam('TON CHIEN', t, 0.0, { y: 420, color: '#fff', rot: -4 });
      slam('S’ENNUIE ?', t, 0.5, { y: 600, color: C.sun, rot: 3 });
      if (t >= 1.0) sticker('ou ton chat ?', { y: 1450, size: 66, bg: C.paper, rot: -3, p: prog(t, 1.0, 1.2) });
    } else if (name === 'macro') {
      slam('LA BALLE', t, 1.5, { y: 360, size: 150, rot: -3 });
      slam('QUI LIBÈRE', t, 2.0, { y: 520, size: 130, color: C.sun, rot: 2 });
      slam('SES CROQUETTES', t, 2.5, { y: 1500, size: 110, color: '#fff', rot: -2 });
    } else if (name === 'roll') {
      slam('IL JOUE', t, 3.0, { y: 420, size: 170, rot: -4, out: 4.0 });
      slam('IL MANGE', t, 4.0, { y: 420, size: 170, color: C.sun, rot: 3, out: 5.0 });
      slam('IL S’OCCUPE', t, 5.0, { y: 420, size: 150, color: C.pink, rot: -3 });
    } else if (name === 'trio') {
      slam('−20 %', t, 5.5, { y: 430, size: 260, color: C.sun, rot: -5 });
      slam('DÈS 3 BALLES', t, 6.5, { y: 1500, size: 120, rot: 2 });
    } else {
      slam('14,99 €', t, 7.5, { y: 400, size: 230, color: '#fff', rot: -4 });
      if (t >= 8.0) sticker('Livraison offerte', { y: 1380, size: 72, bg: C.mint, rot: 2, p: prog(t, 8.0, 8.25) });
      if (t >= 8.5) sticker('Lien en bio', { y: 1530, size: 72, bg: C.pink, rot: -3, p: prog(t, 8.5, 8.75) });
      if (t >= 9.0) sticker('Pattoune', { y: 200, size: 48, bg: C.paper, rot: -3, maxW: 420, p: prog(t, 9.0, 9.2) });
    }
  }

  window.setup = async () => {
    await document.fonts.load('800 80px "Bricolage Grotesque"');
    for (const [name, , n] of SHOTS) {
      FR[name] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`frames/${name}/f_${String(i + 1).padStart(4, '0')}.jpg`)));
    }
    return DURATION;
  };
  window.drawAt = (_name, t) => draw(t);
})();
