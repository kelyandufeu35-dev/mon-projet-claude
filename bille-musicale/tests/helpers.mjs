// Fabrique un fichier MIDI standard en mémoire pour les tests.

const vlq = (n) => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};

export function track(events) {
  const body = [];
  for (const [delta, ...bytes] of events) body.push(...vlq(delta), ...bytes);
  body.push(0, 0xff, 0x2f, 0);
  const len = body.length;
  return [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...body];
}

export function smf(tracks, { format = 1, division = 480 } = {}) {
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, tracks.length, division >> 8, division & 255];
  return new Uint8Array([...header, ...tracks.flat()]);
}

export const tempo = (bpm) => {
  const us = Math.round(60e6 / bpm);
  return [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255];
};
export const name = (s) => [0xff, 0x03, s.length, ...[...s].map((c) => c.charCodeAt(0))];

export function rng(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}
