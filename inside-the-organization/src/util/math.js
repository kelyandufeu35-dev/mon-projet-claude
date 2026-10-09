// Utilitaires mathématiques : tout est fonction pure du temps (rendu déterministe).
export const DEG = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);

export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const linear = (x) => clamp(x);
export const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInCubic = (x) => Math.pow(clamp(x), 3);
export const easeInOutCubic = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeInOutQuart = (x) => { x = clamp(x); return x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2; };
export const easeOutQuint = (x) => 1 - Math.pow(1 - clamp(x), 5);
export const easeOutBack = (x, s = 1.70158) => { x = clamp(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const easeOutElastic = (x) => {
  x = clamp(x); if (x === 0 || x === 1) return x;
  return Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
export const pop = (x) => easeOutBack(x, 2.1);

/** Progression 0..1 de t entre a et b, avec une courbe d'accélération. */
export const seg = (t, a, b, ease = smooth) => ease(clamp((t - a) / (b - a)));
/** 1 entre a et b, avec montée/descente douces de durée `fade`. */
export const window01 = (t, a, b, fade = 0.4) => smooth((t - a) / fade) * (1 - smooth((t - (b - fade)) / fade));
export const between = (t, a, b) => t >= a && t < b;

/** PRNG déterministe (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Piste d'images clés numériques : track([[t, v, ease?], ...]) -> f(t).
 * L'ease d'une clé s'applique au segment qui MÈNE à cette clé.
 */
export function track(keys, defaultEase = smoother) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e1] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        return lerp(v0, v1, (e1 || defaultEase)(invLerp(t0, t1, t)));
      }
    }
    return keys[keys.length - 1][1];
  };
}
