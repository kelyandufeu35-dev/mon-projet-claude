import NARR from '../data/narration.json';

// Découpage du film (secondes de la SCÈNE, c'est-à-dire hors hook). Une seule source de vérité.
export const TL = {
  total: 93.5,
  s1: [0, 15], s2: [15, 30], s3: [30, 45], s4: [45, 60], s5: [60, 75], s6: [75, 93.5],
};

// Hook d'ouverture « Comment McDo fonctionne ? » : HOOK secondes AVANT la scène 1.
// Les temps vidéo = temps scène + HOOK. Pendant le hook, montage rapide de moments clés (échantillonnés dans le film).
export const HOOK = NARR.hook.duration;
export const VIDEO_TOTAL = HOOK + TL.total;
export const CUTS = [
  { a: 0.0, b: 1.25, s0: 86.0, s1: 86.9 },   // organigramme d'ensemble
  { a: 1.25, b: 2.5, s0: 38.2, s1: 39.1 },   // globe et marchés
  { a: 2.5, b: 3.75, s0: 68.0, s1: 68.9 },   // restaurant en coupe
  { a: 3.75, b: 5.0, s0: 11.9, s1: 12.8 },   // salle du conseil
];

/** Temps vidéo -> { ts : temps de scène à rendre, hook : vrai pendant le hook }. */
export function toScene(tv) {
  if (tv >= HOOK) return { ts: tv - HOOK, hook: false };
  for (const c of CUTS) if (tv < c.b) return { ts: c.s0 + ((tv - c.a) / (c.b - c.a)) * (c.s1 - c.s0), hook: true };
  const c = CUTS[CUTS.length - 1];
  return { ts: c.s1, hook: true };
}
