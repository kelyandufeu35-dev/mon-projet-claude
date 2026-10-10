// Table de timing unique : toute la chorégraphie (3D, HUD, audio) se cale sur la narration.
// Les durées viennent des fichiers WAV synthétisés (assets/audio/narration/durations.json).
import script from "../narration/script.json";
import durations from "../assets/audio/narration/durations.json";

const D = durations.durations;
const text = Object.fromEntries(script.segments.map((s) => [s.id, s.text]));

/** segments : id -> { start, dur, end, text } */
export const seg = {};
let cursor = 0;
function place(id, gapBefore) {
  cursor += gapBefore;
  seg[id] = { id, start: +cursor.toFixed(3), dur: D[id], end: +(cursor + D[id]).toFixed(3), text: text[id] };
  cursor += D[id] - 0.08; // les 120 ms de silence final se chevauchent avec la phrase suivante
}

// pauses (secondes) avant chaque segment — les ruptures de scène sont recouvertes par des transitions visuelles
place("s1a", 0.45);
place("s1b", 0.45);
place("s2a", 0.2);
place("s2b", 0.12);
place("s2c", 0.12);
place("s3a", 0.3);
place("s3b", 0.1);
place("s3c", 0.12);
place("s4a", 0.35);
place("s4b", 0.1);
place("s4c", 0.15);
place("s5a", 0.4);
place("s5b", 0.12);
place("s5c", 0.1);
place("s6a", 0.4);
place("s6b", 0.1);
place("s6c", 0.1);
place("s7a", 0.4);
place("s7b", 0.1);
place("s7c", 0.25);

/** instant approximatif où le narrateur prononce `phrase` dans le segment `id` (avance de lead secondes) */
export function when(id, phrase, lead = 0.12) {
  const s = seg[id];
  const i = s.text.indexOf(phrase);
  if (i < 0) throw new Error(`when(): « ${phrase} » introuvable dans ${id}`);
  const speechDur = s.dur - 0.2;
  return +(s.start + (i / s.text.length) * speechDur - lead).toFixed(3);
}

/** instant de fin d'un mot/phrase (même heuristique) */
export function whenEnd(id, phrase, lead = 0) {
  const s = seg[id];
  const i = s.text.indexOf(phrase);
  if (i < 0) throw new Error(`whenEnd(): « ${phrase} » introuvable dans ${id}`);
  const speechDur = s.dur - 0.2;
  return +(s.start + ((i + phrase.length) / s.text.length) * speechDur - lead).toFixed(3);
}

// Scènes : démarrent avec leur première phrase ; transitions visuelles (flash) autour des bascules.
export const SC = {
  s1: { t0: 0, t1: seg.s2a.start },
  s2: { t0: seg.s2a.start, t1: seg.s3a.start },
  s3: { t0: seg.s3a.start, t1: seg.s4a.start },
  s4: { t0: seg.s4a.start, t1: seg.s5a.start },
  s5: { t0: seg.s5a.start, t1: seg.s6a.start },
  s6: { t0: seg.s6a.start, t1: seg.s7a.start },
  s7: { t0: seg.s7a.start, t1: +(seg.s7c.end + 1.6).toFixed(3) },
};

export const DURATION = +(seg.s7c.end + 1.6).toFixed(2);
