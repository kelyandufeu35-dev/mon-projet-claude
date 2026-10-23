// Dessin d'une image de la scène à l'instant t. Fonction pure du temps : aucun état n'est
// conservé d'une image à l'autre, donc la lecture, l'enregistrement et l'export image par image
// produisent exactement la même chose.

import { WORLD_W, WORLD_H, ballAt, cameraAt, lastImpactIndex } from './planner.js';
import { hexToRgb, mix, rgba } from './palettes.js';
import { noteName } from './melody.js';

const TAU = Math.PI * 2;
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

function hash(i, salt) {
  let x = Math.imul(i + 11, 0x9e3779b1) ^ Math.imul(salt + 3, 0x85ebca6b);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

function pill(ctx, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + r, -r);
  ctx.lineTo(w / 2 - r, -r);
  ctx.arc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-w / 2 + r, r);
  ctx.arc(-w / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// Couleurs du décor à l'instant t : celles de la partie en cours, en fondu (1,8 s) depuis la
// partie précédente. Le fondu commence un peu avant la frontière pour l'annoncer.
function paletteAt(scene, t, st) {
  const sections = scene.sections;
  if (!sections?.length || !scene.settings.evolveColors) return { bgTop: st.bgTop, bgBottom: st.bgBottom, accents: st.accents };
  let k = 0;
  while (k + 1 < sections.length && sections[k + 1].t0 <= t + 0.3) k++;
  const cur = sections[k].rgb;
  const prev = sections[Math.max(0, k - 1)].rgb;
  const f = k === 0 ? 1 : smooth((t - sections[k].t0 + 0.3) / 1.8);
  return {
    bgTop: mix(prev.bgTop, cur.bgTop, f),
    bgBottom: mix(prev.bgBottom, cur.bgBottom, f),
    accents: [mix(prev.low, cur.low, f), mix(prev.mid, cur.mid, f), mix(prev.high, cur.high, f)],
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.styleKey = null;
  }

  prepare(scene) {
    const c = scene.settings.colors;
    const key = scene;
    if (this.styleKey === key) return this.style;
    this.styleKey = key;
    const bgTop = hexToRgb(c.bgTop);
    const bgBottom = hexToRgb(c.bgBottom);
    const ball = hexToRgb(c.ball);
    const accents = [hexToRgb(c.low), hexToRgb(c.mid), hexToRgb(c.high)];
    const bokeh = [];
    for (let k = 0; k < 22; k++) {
      bokeh.push({
        x: hash(k, 1) * WORLD_W,
        y: hash(k, 2) * 2600,
        r: 50 + hash(k, 3) * 150,
        a: 0.035 + hash(k, 4) * 0.07,
        p: 0.12 + hash(k, 5) * 0.3,
        c: k % 3,
        ph: hash(k, 6) * TAU,
      });
    }
    // Poussières lumineuses : petites, nombreuses, montent doucement et scintillent.
    const dust = [];
    for (let k = 0; k < 70; k++) {
      dust.push({
        x: hash(k, 11) * WORLD_W,
        y: hash(k, 12) * 2400,
        r: 1.2 + hash(k, 13) * 3,
        p: 0.3 + hash(k, 14) * 0.5,
        v: 6 + hash(k, 15) * 22,
        f: 0.4 + hash(k, 16) * 1.6,
        ph: hash(k, 17) * TAU,
        c: k % 3,
      });
    }
    this.style = { bgTop, bgBottom, ball, accents, bokeh, dust };
    return this.style;
  }

  draw(scene, t) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const st = this.prepare(scene);
    const s = Math.min(W / WORLD_W, H / WORLD_H);
    const offX = (W - WORLD_W * s) / 2;
    const offY = (H - WORLD_H * s) / 2;
    const top = cameraAt(scene.lanes[0].camera, t);
    const pal = paletteAt(scene, t, st);
    const lively = scene.settings.livelyDecor;
    // Zone visible en unités du monde : au-delà du cadre 9:16 si l'écran est plus haut ou plus large.
    const x0 = -offX / s;
    const y0 = -offY / s;
    const vw = W / s;
    const vh = H / s;

    // Fond : dégradé vertical, halos flous en parallaxe, lumière douce venant du haut.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, rgba(pal.bgTop));
    bg.addColorStop(1, rgba(pal.bgBottom));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.setTransform(s, 0, 0, s, offX, offY);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of st.bokeh) {
      const span = 2600;
      const y = ((((b.y - top * b.p) % span) + span) % span) - 340 + y0;
      const x = b.x + Math.sin(t * 0.25 + b.ph) * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
      const c = pal.accents[b.c];
      g.addColorStop(0, rgba(c, b.a));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
    }
    if (lively) {
      for (const d of st.dust) {
        const span = 2400;
        const y = ((((d.y - top * d.p - t * d.v) % span) + span) % span) - 240 + y0;
        const x = d.x + Math.sin(t * 0.4 + d.ph) * 18;
        const tw = 0.25 + 0.75 * Math.sin(t * d.f + d.ph) ** 2;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, TAU);
        ctx.fillStyle = rgba(mix(WHITE, pal.accents[d.c], 0.45), 0.55 * tw);
        ctx.fill();
      }
    }
    // Lumière douce venant du haut, qui pulse sur les temps forts (grosse caisse ou 1er temps).
    const kicks = lively ? scene.pulses || [] : scene.kicks || [];
    let k = 0;
    let kEnd = kicks.length;
    while (k < kEnd) {
      const mid = (k + kEnd) >> 1;
      if (kicks[mid] <= t) k = mid + 1;
      else kEnd = mid;
    }
    const pulse = k > 0 ? Math.exp(-(t - kicks[k - 1]) / 0.16) : 0;
    const light = ctx.createRadialGradient(WORLD_W * 0.3, -WORLD_H * 0.15, 0, WORLD_W * 0.3, -WORLD_H * 0.15, WORLD_H * 1.05);
    light.addColorStop(0, rgba(mix(st.ball, pal.bgTop, 0.3), 0.16 + (lively ? 0.1 : 0.07) * pulse));
    light.addColorStop(1, rgba(st.ball, 0));
    ctx.fillStyle = light;
    ctx.fillRect(x0, y0, vw, vh);

    // Monde : une piste par bille, chacune avec sa caméra (qui ne fait que décaler verticalement).
    const lanes = scene.lanes;
    lanes.forEach((lane, li) => {
      const laneTop = cameraAt(lane.camera, t);
      ctx.save();
      ctx.setTransform(s, 0, 0, s, offX + lane.x * s, offY - laneTop * s);
      if (lanes.length > 1) {
        // Chaque piste reste dans sa colonne ; celles du bord vont jusqu'au bord de l'écran.
        const left = li === 0 ? x0 - lane.x : 0;
        const right = li === lanes.length - 1 ? x0 + vw - lane.x : lane.width;
        ctx.beginPath();
        ctx.rect(left, laneTop + y0, right - left, vh);
        ctx.clip();
      }
      this.drawLane(scene, lane, t, laneTop, y0, vh, st);
      ctx.restore();
    });
    if (lanes.length > 1) {
      // Séparation discrète entre les pistes.
      ctx.setTransform(s, 0, 0, s, offX, offY);
      for (let li = 1; li < lanes.length; li++) {
        const x = lanes[li].x;
        const g = ctx.createLinearGradient(0, y0, 0, y0 + vh);
        g.addColorStop(0, rgba(WHITE, 0));
        g.addColorStop(0.5, rgba(WHITE, 0.12));
        g.addColorStop(1, rgba(WHITE, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 1, y0, 2, vh);
      }
    }

    // Changement de partie : éclair doux sur tout l'écran et onde qui part de chaque bille.
    if (lively && scene.sections) {
      ctx.setTransform(s, 0, 0, s, offX, offY);
      ctx.globalCompositeOperation = 'lighter';
      for (const sec of scene.sections) {
        const tau = t - sec.t0;
        if (sec.t0 <= 0 || tau < 0 || tau >= 1.6) continue;
        const k = 1 - tau / 1.6;
        ctx.fillStyle = rgba(pal.accents[1], 0.14 * Math.exp(-tau / 0.25));
        ctx.fillRect(x0, y0, vw, vh);
        for (const lane of lanes) {
          const b = ballAt(lane.course, t);
          ctx.beginPath();
          ctx.arc(lane.x + b.x, b.y - cameraAt(lane.camera, t), 60 + tau * 1100, 0, TAU);
          ctx.strokeStyle = rgba(mix(WHITE, pal.accents[2], 0.5), 0.45 * k);
          ctx.lineWidth = 2 + 10 * k;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Titre (premières secondes) et vignettage.
    ctx.setTransform(s, 0, 0, s, offX, offY);
    ctx.globalCompositeOperation = 'source-over';
    if (scene.settings.showTitle && scene.title) {
      const a = t < 3.2 ? 1 : Math.max(0, 1 - (t - 3.2) / 0.6);
      if (a > 0) {
        ctx.fillStyle = rgba(WHITE, 0.92 * a);
        ctx.font = '600 54px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 18;
        ctx.fillText(`♪ ${scene.title}`, WORLD_W / 2, 170);
        ctx.shadowBlur = 0;
      }
    }
    this.drawGrain(t);
    const vig = ctx.createRadialGradient(WORLD_W / 2, WORLD_H * 0.45, WORLD_H * 0.32, WORLD_W / 2, WORLD_H * 0.45, Math.max(vh, vw) * 0.82);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(x0, y0, vw, vh);
  }

  // Grain très léger (±1,5 % de luminosité), redessiné à chaque image : il casse les « marches »
  // des dégradés sombres, que la compression vidéo en 8 bits rend sinon très visibles.
  drawGrain(t) {
    const { ctx, canvas } = this;
    if (!this.grain) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 256;
      const g = tile.getContext('2d');
      const img = g.createImageData(256, 256);
      let seed = 12345;
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const v = 128 + ((seed >> 8) % 64) - 32;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.grain = ctx.createPattern(tile, 'repeat');
    }
    const frame = Math.floor(t * 60);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, (frame * 97) % 256, (frame * 61) % 256);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = this.grain;
    ctx.fillRect(-256, -256, canvas.width + 512, canvas.height + 512);
    ctx.restore();
  }

  drawLane(scene, lane, t, top, y0, vh, st) {
    const course = lane.course;
    const o = course.options;
    const impacts = course.impacts;
    const viewMin = top + y0 - 240;
    const viewMax = top + y0 + vh + 240;
    let lo = 0;
    let hi = impacts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (impacts[mid].y < viewMin - o.maxRise) lo = mid + 1;
      else hi = mid;
    }
    for (let j = lo; j < impacts.length && impacts[j].y < viewMax; j++) {
      if (impacts[j].platform.cy < viewMin) continue;
      this.drawPlatform(scene, lane, j, t - impacts[j].t, st);
    }
    for (let j = lo; j < impacts.length && impacts[j].y < viewMax; j++) {
      const tau = t - impacts[j].t;
      if (tau >= 0 && tau < 0.95) this.drawBurst(lane, j, tau, scene.settings.livelyDecor);
    }
    this.drawBall(lane, t, st);
  }

  drawPlatform(scene, lane, j, tau, st) {
    const { ctx } = this;
    const imp = lane.course.impacts[j];
    const p = imp.platform;
    const base = lane.colors[j];
    const hit = tau >= 0;
    const flash = hit ? Math.exp(-tau / 0.32) : 0;
    // Petit enfoncement amorti sous l'impact.
    const u = p.thickness / 28; // échelle de la piste (plus petite à deux billes)
    const dip = hit ? 9 * u * Math.exp(-tau / 0.1) * Math.sin(Math.min(tau * 32, Math.PI * 3)) * (0.5 + 0.5 * imp.velocity) : 0;
    const cx = p.cx - p.nx * dip;
    const cy = p.cy - p.ny * dip;
    const body = hit ? mix(base, WHITE, 0.45 * flash) : mix(base, st.bgTop, 0.18);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.angle);

    if (flash > 0.01 || hit) {
      // Halo additif : fort à l'impact, faible lueur résiduelle ensuite.
      const glow = 0.12 + 0.75 * flash;
      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.scale(1, 0.5);
      const r = p.width * (0.9 + 0.5 * flash);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(base, glow));
      g.addColorStop(1, rgba(base, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    ctx.globalCompositeOperation = 'source-over';
    // Ombre portée douce.
    ctx.save();
    ctx.translate(0, 14 * u);
    pill(ctx, p.width + 6 * u, p.thickness + 6 * u);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
    ctx.restore();

    pill(ctx, p.width, p.thickness);
    const grad = ctx.createLinearGradient(0, -p.thickness / 2, 0, p.thickness / 2);
    grad.addColorStop(0, rgba(mix(body, WHITE, 0.35)));
    grad.addColorStop(0.45, rgba(body));
    grad.addColorStop(1, rgba(mix(body, BLACK, 0.4)));
    ctx.fillStyle = grad;
    ctx.fill();

    // Reflet sur l'arête supérieure.
    ctx.beginPath();
    ctx.moveTo(-p.width / 2 + p.thickness / 2, -p.thickness / 2 + 3);
    ctx.lineTo(p.width / 2 - p.thickness / 2, -p.thickness / 2 + 3);
    ctx.strokeStyle = rgba(WHITE, 0.35 + 0.55 * flash);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (scene.settings.showNoteNames) {
      ctx.fillStyle = rgba(hit ? BLACK : WHITE, 0.72);
      ctx.font = `700 ${Math.round(p.thickness * 0.55)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noteName(imp.midi), 0, 1);
    }
    ctx.restore();
  }

  drawBurst(lane, j, tau, lively = false) {
    const { ctx } = this;
    const imp = lane.course.impacts[j];
    const base = mix(lane.colors[j], WHITE, 0.4);
    const R = lane.course.options.ballRadius;
    const u = R / 34;
    ctx.globalCompositeOperation = 'lighter';
    // Onde circulaire dans le plan de la plateforme.
    if (tau < 0.45) {
      const k = tau / 0.45;
      ctx.save();
      ctx.translate(imp.x - imp.nx * R, imp.y - imp.ny * R);
      ctx.rotate(imp.platform.angle);
      ctx.scale(1, 0.38);
      ctx.beginPath();
      ctx.arc(0, 0, (20 + k * 150) * u, 0, TAU);
      ctx.strokeStyle = rgba(base, 0.55 * (1 - k));
      ctx.lineWidth = (6 * (1 - k) + 1) * u;
      ctx.stroke();
      ctx.restore();
    }
    // Note accentuée (forte ou sur un premier temps) : deuxième onde plus large, plus d'étincelles.
    const strong = lively && imp.strong;
    if (strong && tau >= 0.06 && tau < 0.7) {
      const k = (tau - 0.06) / 0.64;
      ctx.save();
      ctx.translate(imp.x - imp.nx * R, imp.y - imp.ny * R);
      ctx.rotate(imp.platform.angle);
      ctx.scale(1, 0.45);
      ctx.beginPath();
      ctx.arc(0, 0, (40 + k * 300) * u, 0, TAU);
      ctx.strokeStyle = rgba(mix(base, WHITE, 0.3), 0.4 * (1 - k));
      ctx.lineWidth = (4 * (1 - k) + 1) * u;
      ctx.stroke();
      ctx.restore();
    }
    // Étincelles projetées vers le haut, retombant sous la gravité.
    const count = strong ? 18 : 9;
    const life = strong ? 0.95 : 0.75;
    const spread = Math.atan2(imp.ny, imp.nx);
    for (let k = 0; k < count; k++) {
      const a = spread + (hash(j, k) - 0.5) * 2.4;
      const v = (170 + hash(j, k + 50) * 380 * (0.5 + imp.velocity)) * u * (strong ? 1.35 : 1);
      const x = imp.x - imp.nx * R + Math.cos(a) * v * tau;
      const y = imp.y - imp.ny * R + Math.sin(a) * v * tau + 700 * u * tau * tau;
      const f = 1 - tau / life;
      if (f <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, (2 + hash(j, k + 90) * 4) * f * u, 0, TAU);
      ctx.fillStyle = rgba(base, 0.85 * f);
      ctx.fill();
    }
  }

  drawBall(lane, t, st) {
    const { ctx } = this;
    const course = lane.course;
    const R = course.options.ballRadius;
    const b = ballAt(course, t);
    const li = lastImpactIndex(course, t);
    const reflect = li >= 0 ? lane.colors[li] : st.accents[1];

    // Traînée lumineuse.
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 8; k >= 1; k--) {
      const tk = t - k * 0.014;
      if (tk < course.start.t) continue;
      const p = ballAt(course, tk);
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1 - k * 0.07), 0, TAU);
      ctx.fillStyle = rgba(mix(st.ball, reflect, 0.5), 0.07 * (1 - k / 9));
      ctx.fill();
    }
    const halo = ctx.createRadialGradient(b.x, b.y, R * 0.6, b.x, b.y, R * 3.2);
    halo.addColorStop(0, rgba(mix(st.ball, reflect, 0.3), 0.28));
    halo.addColorStop(1, rgba(st.ball, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(b.x - R * 3.2, b.y - R * 3.2, R * 6.4, R * 6.4);

    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(b.x, b.y);
    // Écrasement bref à l'impact, dans l'axe de la normale.
    if (li >= 0) {
      const since = t - course.impacts[li].t;
      const imp = course.impacts[li];
      const k = 0.24 * Math.exp(-since / 0.03) * (0.5 + 0.5 * imp.velocity);
      if (k > 0.004) {
        const ang = Math.atan2(imp.ny, imp.nx);
        ctx.rotate(ang);
        ctx.scale(1 - k, 1 + k * 0.6);
        ctx.rotate(-ang);
      }
    }
    const body = ctx.createRadialGradient(-R * 0.38, -R * 0.42, R * 0.05, 0, 0, R);
    body.addColorStop(0, rgba(WHITE));
    body.addColorStop(0.28, rgba(st.ball));
    body.addColorStop(0.78, rgba(mix(st.ball, BLACK, 0.42)));
    body.addColorStop(1, rgba(mix(st.ball, BLACK, 0.62)));
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    // Liseré coloré renvoyé par la dernière plateforme touchée.
    ctx.beginPath();
    ctx.arc(0, 0, R - 1.5, Math.PI * 0.1, Math.PI * 0.9);
    ctx.strokeStyle = rgba(reflect, 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();
    // Reflet spéculaire.
    ctx.beginPath();
    ctx.ellipse(-R * 0.36, -R * 0.42, R * 0.26, R * 0.16, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
  }
}
