// Chronologie de la vidéo verticale : phrases de la voix off et instants-clés mesurés sur la synthèse
// (voir tools/voice.mjs et tools/cues.mjs). Les plans sont calés sur ces instants.

import tl from '../timeline.fr.json';

export const VOICE = tl;
export const DURATION = 63; // la voix finit à ~62,8 s ; le dernier flash referme la boucle
export const cue = (id) => {
  if (!(id in tl.cues)) throw new Error(`instant-clé inconnu : ${id}`);
  return tl.cues[id];
};
export const beat = (id) => tl.beats[id];

// Limites des plans : un peu avant le début de la phrase correspondante.
export const S = {
  hook: 0,
  design: tl.beats.design.start - 0.1,     // 4,89  : la caméra descend vers la puce
  foundry: tl.beats.foundry.start - 0.13,  // 13,40 : fonderie
  systems: tl.beats.systems.start - 0.17,  // 24,70 : plateau, baie, allée
  software: tl.beats.software.start - 0.2, // 33,40 : couches logicielles
  economy: tl.beats.economy.start - 0.2,   // 41,81 : campus et flux
  close: tl.beats.close.start - 0.16,      // 55,00 : globe
  end: DURATION,
};

// Bosse lisse (0 -> peak -> 0) centrée sur tc ; sert aux flashs et aux fondus de transition.
export function bump(t, tc, rise, fall, peak = 1) {
  if (t <= tc - rise || t >= tc + fall) return 0;
  const x = t < tc ? (t - (tc - rise)) / rise : 1 - (t - tc) / fall;
  return peak * x * x * (3 - 2 * x);
}
