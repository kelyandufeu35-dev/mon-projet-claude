// Construction du parcours à partir des notes.
//
// Chaque note i devient un impact à l'instant T_i (horaire de la note + amorce). Entre deux
// impacts, la bille suit une parabole exacte : on choisit la hauteur du rebond h et la descente dy
// en fonction de l'écart dt, puis on résout la vitesse verticale initiale et la gravité qui font
// arriver la bille au point de contact suivant exactement à T_{i+1}. Avec h et dy proportionnels
// à dt², la gravité est la même pour tous les rebonds courts (mouvement crédible) ; pour les notes
// longues, la croissance est freinée et la bille « flotte » un peu plus.
//
// La plateforme est ensuite orientée selon la normale n ∝ (v_sortie − v_entrée) : c'est
// l'orientation qui rend le rebond visuellement plausible (réflexion sur la surface).

export const WORLD_W = 1080;
export const WORLD_H = 1920;

export const DEFAULTS = {
  ballRadius: 34,
  platformThickness: 28,
  platformWidth: 150,
  platformExtraWidth: 40, // ajoutée selon la durée de la note
  marginX: 130,
  leadIn: 0.9, // délai minimal avant le premier impact (s)
  dropTime: 0.5, // durée de la chute initiale (s)
  gravity: 4000, // px/s² pour les rebonds courts
  minRise: 10,
  minDrop: 46,
  maxRise: 560,
  maxDrop: 780,
  quadLimit: 0.6, // au-delà de cet écart (s), h et dy croissent moins vite que dt²
  longExponent: 1.15,
  vxBase: 620,
  dxMin: 200,
  dxMax: 520,
  maxTilt: (35 * Math.PI) / 180,
  finalHopDt: 0.65,
  tail: 2.2, // durée après le dernier impact (s)
  tolerance: 0.75, // pénétration tolérée par le vérificateur (px)
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hash(i, salt = 0) {
  let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

// Rebond de durée dt qui part en hauteur h (montée) et arrive dy plus bas.
export function solveHop(dt, rise, drop) {
  const a = (2 * rise * (1 + Math.sqrt(1 + drop / rise))) / dt;
  return { vy: -a, g: (a * a) / (2 * rise) };
}

function hopShape(dt, o, riseFactor, dropFactor) {
  const s = dt <= o.quadLimit ? dt * dt : o.quadLimit ** 2 * (dt / o.quadLimit) ** o.longExponent;
  const k = o.gravity / 18; // avec dy = 3h, la gravité vaut exactement o.gravity
  const rise = clamp(k * s, o.minRise, o.maxRise) * riseFactor;
  const drop = clamp(3 * k * s, o.minDrop, o.maxDrop) * dropFactor;
  return { rise, drop };
}

// Variantes d'un rebond, de la plus naturelle à la plus contrainte. Le planificateur prend la
// première qui ne touche aucune autre plateforme.
const DX_FACTORS = [1, 0.8, 1.25, 0.6, 1.55, 0.45, 1.9];
const RISE_FACTORS = [1, 0.6, 1.7, 2.6, 0.35, 3.8];
const DROP_FACTORS = [1, 1.5, 2.2, 3.2, 4.5];

function hopCandidates(dt, x, dir, i, o) {
  const minX = o.marginX;
  const maxX = WORLD_W - o.marginX;
  const nominal = clamp(o.vxBase * dt * (0.85 + 0.3 * hash(i)), o.dxMin, o.dxMax);
  // Un demi-tour se fait de préférence sur une note longue, quand la bille approche du bord.
  const room = dir > 0 ? maxX - x : x - minX;
  const wantTurn = room < nominal * 1.6 && dt >= 0.4;
  const turnCost = wantTurn ? 0.1 : room < nominal * 2.5 ? 0.6 : 1.4;
  const list = [];
  for (const d of [dir, -dir]) {
    for (const fx of DX_FACTORS) {
      const dx = d * nominal * fx;
      if (x + dx < minX || x + dx > maxX) continue;
      for (const fr of RISE_FACTORS) {
        for (const fd of DROP_FACTORS) {
          const cost =
            Math.abs(Math.log(fx)) + 0.8 * Math.abs(Math.log(fr)) + 1.1 * Math.log(fd) + (d !== dir ? turnCost : 0);
          list.push({ dir: d, dx, fr, fd, cost });
        }
      }
    }
  }
  return list.sort((a, b) => a.cost - b.cost);
}

export function hopAt(hop, t) {
  const tau = t - hop.t0;
  return {
    x: hop.x0 + hop.vx * tau,
    y: hop.y0 + hop.vy * tau + 0.5 * hop.g * tau * tau,
    vx: hop.vx,
    vy: hop.vy + hop.g * tau,
  };
}

function makePlatform(x, y, vin, vout, width, o) {
  let nx = vout.x - vin.x;
  let ny = vout.y - vin.y;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  // Limite l'inclinaison par rapport à l'horizontale.
  let angle = Math.atan2(nx, -ny);
  angle = clamp(angle, -o.maxTilt, o.maxTilt);
  nx = Math.sin(angle);
  ny = -Math.cos(angle);
  const off = o.ballRadius + o.platformThickness / 2;
  const cx = x - nx * off;
  const cy = y - ny * off;
  const half = (width - o.platformThickness) / 2; // demi-longueur du segment central de la pilule
  const tx = Math.cos(angle);
  const ty = Math.sin(angle);
  return {
    cx,
    cy,
    angle,
    nx,
    ny,
    width,
    thickness: o.platformThickness,
    ax: cx - tx * half,
    ay: cy - ty * half,
    bx: cx + tx * half,
    by: cy + ty * half,
  };
}

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const u = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

function segmentDistance(p, q) {
  return Math.min(
    pointSegmentDistance(p.ax, p.ay, q.ax, q.ay, q.bx, q.by),
    pointSegmentDistance(p.bx, p.by, q.ax, q.ay, q.bx, q.by),
    pointSegmentDistance(q.ax, q.ay, p.ax, p.ay, p.bx, p.by),
    pointSegmentDistance(q.bx, q.by, p.ax, p.ay, p.bx, p.by),
  );
}

// Écart entre la surface de la bille et celle de la plateforme (négatif = pénétration).
export function clearance(x, y, platform, radius) {
  return pointSegmentDistance(x, y, platform.ax, platform.ay, platform.bx, platform.by) - platform.thickness / 2 - radius;
}

function hopSamples(hop) {
  const span = hop.t1 - hop.t0;
  const n = Math.max(24, Math.ceil(span * 300));
  const pts = [];
  for (let s = 1; s < n; s++) pts.push(hopAt(hop, hop.t0 + (span * s) / n));
  return pts;
}

function hopHitsPlatform(samples, platform, o, minClearance) {
  const top = Math.min(platform.ay, platform.by) - platform.thickness - o.ballRadius - minClearance;
  const bottom = Math.max(platform.ay, platform.by) + platform.thickness + o.ballRadius + minClearance;
  for (const p of samples) {
    if (p.y < top || p.y > bottom) continue;
    if (clearance(p.x, p.y, platform, o.ballRadius) < minClearance) return true;
  }
  return false;
}

// Nombre de contacts parasites si la note i prend cette plateforme et ce rebond. Les plateformes
// sont des pilules convexes : la bille qui arrive ou repart du bon côté ne les pénètre jamais,
// donc les trajectoires de contact sont contrôlées en entier, avec une tolérance numérique.
function countConflicts(i, platform, samples, impacts, hops, o) {
  const margin = 2;
  const contact = -0.25;
  let conflicts = 0;
  let yMin = Infinity;
  for (const p of samples) yMin = Math.min(yMin, p.y);
  for (let j = i - 1; j >= 0; j--) {
    if (impacts[j].y < yMin - 300) break;
    const other = impacts[j].platform;
    if (hopHitsPlatform(samples, other, o, margin)) conflicts++;
    if (segmentDistance(platform, other) < platform.thickness + 8) conflicts++;
  }
  if (hopHitsPlatform(samples, platform, o, contact)) conflicts++;
  for (let j = hops.length - 1; j >= 0 && j >= hops.length - 40; j--) {
    if (hopHitsPlatform(hops[j].samples, platform, o, j === hops.length - 1 ? contact : margin)) conflicts++;
  }
  return conflicts;
}

export function buildCourse(inputNotes, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const notes = inputNotes
    .filter((n) => Number.isFinite(n.time) && Number.isFinite(n.midi))
    .sort((a, b) => a.time - b.time);
  if (!notes.length) {
    return { options: o, lead: 0, impacts: [], hops: [], start: { t: 0, x: WORLD_W / 2, y: 0 }, lastT: 0, duration: 3, warnings: [] };
  }
  const lead = Math.max(0, o.leadIn - notes[0].time);
  const times = notes.map((n) => n.time + lead);
  const x0 = o.marginX + (WORLD_W - 2 * o.marginX) * 0.3;
  const dropTime = Math.min(o.dropTime, times[0]);
  const start = { t: times[0] - dropTime, x: x0, y: -0.5 * o.gravity * dropTime * dropTime };
  const dropHop = { t0: start.t, t1: times[0], x0, y0: start.y, vx: 0, vy: 0, g: o.gravity };
  dropHop.samples = hopSamples(dropHop);

  const hops = [dropHop];
  const impacts = [];
  const warnings = [];
  // Pile de recherche : pour chaque note, l'état d'arrivée, ses variantes et la variante retenue.
  const steps = [];
  let budget = 400 * notes.length + 4000;
  let furthest = 0;
  let state = { x: x0, y: 0, vin: { x: 0, y: o.gravity * dropTime }, dir: 1 };
  let i = 0;

  const evaluate = (c, st, dt, width, idx) => {
    const { rise, drop } = hopShape(dt, o, c.fr, c.fd);
    const { vy, g } = solveHop(dt, rise, drop);
    const hop = { t0: times[idx], t1: times[idx] + dt, x0: st.x, y0: st.y, vx: c.dx / dt, vy, g };
    const vout = { x: hop.vx, y: vy };
    const platform = makePlatform(st.x, st.y, st.vin, vout, width, o);
    const samples = hopSamples(hop);
    budget--;
    return { hop, platform, samples, vout, conflicts: countConflicts(idx, platform, samples, impacts, hops, o) };
  };

  while (i < notes.length) {
    const isLast = i === notes.length - 1;
    const dt = isLast ? o.finalHopDt : times[i + 1] - times[i];
    const width = o.platformWidth + clamp((notes[i].duration || 0) * 40, 0, o.platformExtraWidth);
    let step = steps[i];
    if (!step) {
      step = { state, candidates: hopCandidates(dt, state.x, state.dir, i, o), next: 0, best: null };
      steps[i] = step;
    }
    let chosen = null;
    while (step.next < step.candidates.length && budget > 0) {
      const c = step.candidates[step.next++];
      const r = evaluate(c, step.state, dt, width, i);
      r.dir = c.dir;
      if (!step.best || r.conflicts < step.best.conflicts) step.best = r;
      if (r.conflicts === 0) {
        chosen = r;
        break;
      }
    }
    // Impasse : on revient sur les notes précédentes (au plus 6 en arrière), sinon on garde
    // la variante la moins gênante et on le signale.
    if (!chosen && budget > 0 && i > 0 && furthest - i < 6) {
      steps.length = i;
      i--;
      impacts.pop();
      hops.pop();
      continue;
    }
    if (!chosen) {
      chosen = step.best ?? Object.assign(evaluate(step.candidates[0], step.state, dt, width, i), { dir: step.candidates[0].dir });
      warnings.push(`Note ${i + 1} : rebond proche d’une autre plateforme`);
    }
    hops.push(Object.assign(chosen.hop, { samples: chosen.samples }));
    const note = notes[i];
    impacts.push({
      index: i,
      t: times[i],
      noteTime: note.time,
      midi: note.midi,
      velocity: note.velocity ?? 0.8,
      duration: note.duration ?? dt,
      x: step.state.x,
      y: step.state.y,
      vin: step.state.vin,
      vout: chosen.vout,
      nx: chosen.platform.nx,
      ny: chosen.platform.ny,
      platform: chosen.platform,
    });
    const end = hopAt(chosen.hop, chosen.hop.t1);
    state = { x: end.x, y: end.y, vin: { x: end.vx, y: end.vy }, dir: chosen.dir };
    i++;
    furthest = Math.max(furthest, i);
    if (steps[i]) steps.length = i; // l'état d'arrivée a changé : variantes à recalculer
  }
  for (const hop of hops) delete hop.samples;

  const lastT = times[times.length - 1];
  return { options: o, lead, impacts, hops, start, lastT, duration: lastT + o.tail, warnings };
}

function searchLast(list, t, key) {
  let lo = 0;
  let hi = list.length - 1;
  if (hi < 0 || list[0][key] > t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid][key] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Dernier impact survenu à l'instant t (ou -1).
export function lastImpactIndex(course, t) {
  return searchLast(course.impacts, t, 't');
}

// Position de la bille à l'instant t : fonction pure du temps, identique en lecture et en export.
export function ballAt(course, t) {
  if (!course.hops.length || t <= course.start.t) {
    return { x: course.start.x, y: course.start.y, vx: 0, vy: 0 };
  }
  const h = searchLast(course.hops, t, 't0');
  return hopAt(course.hops[h], t);
}

// Caméra : suit la ligne des points de contact, lissée par un noyau gaussien centré (le futur est
// connu, donc pas de retard), puis bornée pour garder la bille dans le cadre.
export function buildCamera(course, { fps = 60, sigma = 0.5, anchor = 0.4 } = {}) {
  const n = Math.ceil(course.duration * fps) + 2;
  const target = new Float64Array(n);
  const ball = new Float64Array(n);
  const { impacts } = course;
  for (let s = 0; s < n; s++) {
    const t = s / fps;
    ball[s] = ballAt(course, t).y;
    if (!impacts.length) target[s] = ball[s];
    else if (t <= impacts[0].t) target[s] = t <= course.start.t ? impacts[0].y - 200 : ball[s];
    else {
      const i = lastImpactIndex(course, t);
      const a = impacts[i];
      const b = impacts[i + 1];
      target[s] = b ? a.y + ((b.y - a.y) * (t - a.t)) / (b.t - a.t) : a.y;
    }
  }
  const smooth = gaussian(target, sigma * fps);
  const view = new Float64Array(n);
  const freeze = (course.lastT ?? 0) + 0.3;
  for (let s = 0; s < n; s++) {
    let top = smooth[s] - anchor * WORLD_H;
    if (s / fps <= freeze) top = clamp(top, ball[s] - 0.8 * WORLD_H, ball[s] - 0.12 * WORLD_H);
    view[s] = top;
  }
  return { fps, top: gaussian(view, 0.12 * fps) };
}

function gaussian(src, sigma) {
  const n = src.length;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let sum = 0;
  for (let k = -r; k <= r; k++) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel.push(w);
    sum += w;
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += kernel[k + r] * src[clamp(i + k, 0, n - 1)];
    out[i] = acc / sum;
  }
  return out;
}

export function cameraAt(camera, t) {
  const f = clamp(t * camera.fps, 0, camera.top.length - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, camera.top.length - 1);
  return camera.top[i] + (camera.top[j] - camera.top[i]) * (f - i);
}
