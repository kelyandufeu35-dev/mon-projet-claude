/* Utilitaires mathématiques déterministes (aucune dépendance au temps réel). */
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const sstep = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
export const sstep5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
export const easeOutBack = (u, c = 1.6) => { u = clamp(u, 0, 1); return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
export const easeOutCubic = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
export const fract = (x) => x - Math.floor(x);
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const lerpAngle = (a, b, u) => a + wrapAngle(b - a) * u;
/* générateur pseudo-aléatoire à graine (mulberry32) */
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* mélange récursif de structures de nombres / tableaux / objets (poses) */
export function lerpDeep(a, b, w) {
  if (typeof a === "number") return a + (b - a) * w;
  if (Array.isArray(a)) return a.map((v, i) => lerpDeep(v, b[i], w));
  const o = {}; for (const k in a) o[k] = lerpDeep(a[k], b[k], w); return o;
}
export const cloneDeep = (a) => (typeof a === "number" ? a : Array.isArray(a) ? a.map(cloneDeep) : Object.fromEntries(Object.entries(a).map(([k, v]) => [k, cloneDeep(v)])));
