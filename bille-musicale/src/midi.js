// Lecture de fichiers MIDI standard (formats 0 et 1) et extraction d'une mélodie monophonique.

const GM_FAMILIES = [
  'Piano', 'Percussion chromatique', 'Orgue', 'Guitare', 'Basse', 'Cordes', 'Ensemble', 'Cuivres',
  'Anches', 'Flûtes', 'Synthé lead', 'Synthé pad', 'Synthé effets', 'Ethnique', 'Percussions', 'Effets',
];

export function parseMidi(input) {
  const d = input instanceof Uint8Array ? input : new Uint8Array(input);
  let p = 0;
  const str = (n) => String.fromCharCode(...d.subarray(p, (p += n)));
  const u32 = () => ((d[p++] << 24) | (d[p++] << 16) | (d[p++] << 8) | d[p++]) >>> 0;
  const u16 = () => (d[p++] << 8) | d[p++];

  if (d.length < 14 || str(4) !== 'MThd') throw new Error('Ce fichier n’est pas un MIDI standard (en-tête MThd absent).');
  const headerLength = u32();
  const format = u16();
  const trackCount = u16();
  const division = u16();
  p = 8 + headerLength;

  const tracks = [];
  while (p + 8 <= d.length && tracks.length < trackCount) {
    const id = str(4);
    const length = u32();
    const end = Math.min(p + length, d.length);
    if (id === 'MTrk') tracks.push(parseTrack(d, p, end));
    p = end;
  }
  if (!tracks.length) throw new Error('Aucune piste trouvée dans le fichier MIDI.');
  return { format, division, tracks };
}

function parseTrack(d, p, end) {
  const events = [];
  let tick = 0;
  let status = 0;
  const vlq = () => {
    let v = 0;
    let b;
    do {
      b = d[p++];
      v = v * 128 + (b & 0x7f);
    } while (b & 0x80 && p < end);
    return v;
  };
  while (p < end) {
    tick += vlq();
    let st = d[p];
    if (st & 0x80) p++;
    else if (status) st = status; // running status : l'octet lu est déjà une donnée
    else break; // données corrompues
    if (st === 0xff) {
      const type = d[p++];
      const len = vlq();
      events.push({ tick, kind: 'meta', type, bytes: d.subarray(p, p + len) });
      p += len;
      if (type === 0x2f) break;
    } else if (st === 0xf0 || st === 0xf7) {
      p += vlq();
    } else {
      status = st;
      const type = st >> 4;
      const a = d[p++];
      const b = type === 0xc || type === 0xd ? 0 : d[p++];
      events.push({ tick, kind: 'ch', type, ch: st & 15, a, b });
    }
  }
  return { events, endTick: tick };
}

function tickToSeconds(midi) {
  const { division } = midi;
  if (division & 0x8000) {
    const fps = 256 - (division >> 8);
    const perFrame = division & 0xff;
    return (tick) => tick / (fps * perFrame);
  }
  const tempos = [];
  for (const track of midi.tracks) {
    for (const e of track.events) {
      if (e.kind === 'meta' && e.type === 0x51 && e.bytes.length >= 3) {
        tempos.push({ tick: e.tick, us: (e.bytes[0] << 16) | (e.bytes[1] << 8) | e.bytes[2] });
      }
    }
  }
  tempos.sort((a, b) => a.tick - b.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
  // Secondes cumulées au début de chaque segment de tempo.
  const segments = [];
  let seconds = 0;
  for (let i = 0; i < tempos.length; i++) {
    if (i > 0) seconds += ((tempos[i].tick - tempos[i - 1].tick) * tempos[i - 1].us) / 1e6 / division;
    segments.push({ tick: tempos[i].tick, us: tempos[i].us, seconds });
  }
  return (tick) => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].tick <= tick) lo = mid;
      else hi = mid - 1;
    }
    const s = segments[lo];
    return s.seconds + ((tick - s.tick) * s.us) / 1e6 / division;
  };
}

export function firstTempoBpm(midi) {
  for (const track of midi.tracks) {
    for (const e of track.events) {
      if (e.kind === 'meta' && e.type === 0x51 && e.tick === 0) {
        return 60e6 / ((e.bytes[0] << 16) | (e.bytes[1] << 8) | e.bytes[2]);
      }
    }
  }
  return 120;
}

// Une « partie » par couple (piste, canal) : les fichiers de format 0 mélangent tous les canaux.
export function extractParts(midi) {
  const toSec = tickToSeconds(midi);
  const parts = [];
  midi.tracks.forEach((track, trackIndex) => {
    let name = '';
    const byChannel = new Map();
    const pending = new Map();
    const channel = (ch) => {
      if (!byChannel.has(ch)) byChannel.set(ch, { program: null, notes: [] });
      return byChannel.get(ch);
    };
    const close = (key, tick) => {
      const stack = pending.get(key);
      if (!stack || !stack.length) return;
      const n = stack.shift();
      const start = toSec(n.tick);
      channel(n.ch).notes.push({
        time: start,
        midi: n.note,
        duration: Math.max(0.02, toSec(tick) - start),
        velocity: n.vel / 127,
      });
    };
    for (const e of track.events) {
      if (e.kind === 'meta') {
        if ((e.type === 0x03 || e.type === 0x04) && !name) name = new TextDecoder('latin1').decode(e.bytes).trim();
        continue;
      }
      const key = e.ch * 128 + e.a;
      if (e.type === 0x9 && e.b > 0) {
        if (pending.get(key)?.length) close(key, e.tick); // note relancée sans note-off
        if (!pending.has(key)) pending.set(key, []);
        pending.get(key).push({ tick: e.tick, ch: e.ch, note: e.a, vel: e.b });
        channel(e.ch);
      } else if (e.type === 0x8 || (e.type === 0x9 && e.b === 0)) {
        close(key, e.tick);
      } else if (e.type === 0xc) {
        const c = channel(e.ch);
        if (c.program === null) c.program = e.a;
      }
    }
    for (const key of pending.keys()) while (pending.get(key).length) close(key, track.endTick);

    for (const [ch, c] of byChannel) {
      if (!c.notes.length) continue;
      c.notes.sort((a, b) => a.time - b.time || b.midi - a.midi);
      const isDrums = ch === 9;
      parts.push({
        id: `${trackIndex}:${ch}`,
        track: trackIndex,
        channel: ch,
        name: name || `Piste ${trackIndex + 1}`,
        instrument: isDrums ? 'Batterie' : c.program === null ? 'Piano' : GM_FAMILIES[c.program >> 3],
        isDrums,
        notes: c.notes,
        stats: partStats(c.notes),
      });
    }
  });
  return parts;
}

function partStats(notes) {
  let min = 127;
  let max = 0;
  let sum = 0;
  let overlapping = 0;
  let sounding = -Infinity;
  for (const n of notes) {
    min = Math.min(min, n.midi);
    max = Math.max(max, n.midi);
    sum += n.midi;
    if (n.time < sounding - 0.03) overlapping++;
    sounding = Math.max(sounding, n.time + n.duration);
  }
  return { count: notes.length, min, max, average: sum / notes.length, polyphony: overlapping / notes.length };
}

const MELODY_NAME = /m[ée]lod|lead|voice|vocal|chant|voix|solo|right|droite|soprano|melo|tune|flute|flûte/i;

// La mélodie est en général la partie la plus aiguë, assez fournie, peu polyphonique, hors batterie.
export function suggestMelodyPart(parts) {
  let best = null;
  let bestScore = -Infinity;
  for (const part of parts) {
    if (part.isDrums || part.stats.count < 4) continue;
    const s = part.stats;
    const score = s.average + 6 * Math.log(s.count) - 35 * s.polyphony + (MELODY_NAME.test(part.name) ? 25 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = part;
    }
  }
  return best || parts.find((p) => !p.isDrums) || parts[0] || null;
}

// Réduit une partie à une note à la fois : la note la plus aiguë de chaque accord est gardée,
// puis les notes trop rapprochées sont retirées pour que chaque rebond reste lisible.
export function toMonophonic(notes, { chordWindow = 0.03, minGap = 0.07 } = {}) {
  const sorted = [...notes].sort((a, b) => a.time - b.time || b.midi - a.midi);
  const out = [];
  let dropped = 0;
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i].time;
    let top = sorted[i];
    let j = i;
    while (j < sorted.length && sorted[j].time - start <= chordWindow) {
      if (sorted[j].midi > top.midi) top = sorted[j];
      j++;
    }
    dropped += j - i - 1;
    const prev = out[out.length - 1];
    if (prev && start - prev.time < minGap) {
      dropped++;
    } else {
      if (prev) prev.duration = Math.min(prev.duration, start - prev.time);
      out.push({ time: start, midi: top.midi, duration: top.duration, velocity: top.velocity });
    }
    i = j;
  }
  return { notes: out, dropped };
}

// Garde le passage qui commence à `start` (s) et dure au plus `maxDuration`, recalé à 0 s.
export function trimMelody(notes, maxDuration = Infinity, start = 0) {
  const kept = notes.filter((n) => n.time >= start - 1e-9);
  if (!kept.length) return [];
  const offset = kept[0].time;
  return kept
    .map((n) => ({ ...n, time: n.time - offset }))
    .filter((n) => n.time <= maxDuration + 1e-9);
}
