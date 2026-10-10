// Utilitaires purs et déterministes : tout est fonction du temps t (secondes), jamais d'une horloge.
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** progression normalisée de x entre a et b (0..1, bornée) */
export const inv = (a, b, x) => (b === a ? 1 : clamp((x - a) / (b - a)));
/** fenêtre temporelle : progression de t dans [a, b] */
export const win = (t, a, b) => inv(a, b, t);

// Easings -------------------------------------------------------------
export const ease = {
  lin: (x) => x,
  in2: (x) => x * x,
  out2: (x) => 1 - (1 - x) * (1 - x),
  in3: (x) => x * x * x,
  out3: (x) => 1 - Math.pow(1 - x, 3),
  out4: (x) => 1 - Math.pow(1 - x, 4),
  io2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  io3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  io4: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  smooth: (x) => x * x * (3 - 2 * x),
  smoother: (x) => x * x * x * (x * (x * 6 - 15) + 10),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
  outElastic: (x) =>
    x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin(((x * 10 - 0.75) * TAU) / 3) + 1,
  outBounce: (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
  expoOut: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  expoIn: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  expoIO: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
};

// PRNG à graine (mulberry32) : même séquence à chaque rendu ----------------
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

/**
 * Piste d'animation : keys = [[t, valeur, easing?], ...] triées par t.
 * L'easing d'une clé s'applique au segment qui la SUIT. Valeurs numériques.
 */
export function track(keys, defaultEase = ease.io3) {
  const n = keys.length;
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const [t0, v0, e0] = keys[i];
    const [t1, v1] = keys[i + 1];
    const e = e0 || defaultEase;
    return v0 + (v1 - v0) * e(inv(t0, t1, t));
  };
}

/** impulsion 0→1→0 : montée sur [a,b], plateau, descente sur [c,d] */
export const pulse = (t, a, b, c, d) => ease.smooth(inv(a, b, t)) * (1 - ease.smooth(inv(c, d, t)));

/** bruit lisse déterministe 1D (sommes de sinus), pour tremblement de caméra / flottement */
export const wobble = (t, seed = 0) =>
  (Math.sin(t * 1.31 + seed * 7.1) * 0.5 + Math.sin(t * 2.17 + seed * 3.3) * 0.3 + Math.sin(t * 0.53 + seed) * 0.2);

export const fmt = {
  /** 1 004 000 000 000 -> « 1 004 » en milliards, séparateur espace insécable fin (fr) */
  int: (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "),
  dec: (n, d = 1) => n.toFixed(d).replace(".", ","),
};
