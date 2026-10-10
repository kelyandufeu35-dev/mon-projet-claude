// Table des signaux sonores (effets) calée sur les mêmes ancres que l'image : exportée en JSON pour le mixage audio.
import { seg, SC, DURATION } from "./timing.js";
import { T1 } from "./scenes/hub.js";
import { T2 } from "./scenes/tesla.js";
import { T3 } from "./scenes/spacex.js";
import { T4 } from "./scenes/bourse.js";
import { T5, T6 } from "./scenes/bank.js";
import { T7 } from "./scenes/finale.js";

const c = (t, k, o = {}) => ({ t: +t.toFixed(3), k, ...o });

export const CUES = [
  // S1
  c(T1.counterA, "ticks", { d: T1.counterB - T1.counterA }),
  c(T1.coins, "shimmer", { d: 2 }),
  c(T1.toShares, "morph"), c(T1.toTowers, "morph"), c(T1.toFactory, "morph"), c(T1.toBigShare, "morph"),
  c(T1.plunge - 0.3, "riser", { d: SC.s1.t1 - T1.plunge + 0.4 }),
  c(SC.s1.t1 + 0.1, "impact"),
  // S2
  c(T2.build0, "build", { d: 2.2 }), c(T2.grid, "tinkle", { d: 1.6 }), c(T2.cap, "chime"), c(T2.eleven, "gold_up"),
  c(T2.up, "rise_arp", { d: 1.5 }), c(T2.down, "fall_arp", { d: 1.8 }), c(T2.restr, "lock"), c(T2.opts, "chime", { f: 1.25 }), c(T2.hero, "pop"),
  // S3
  c(T3.morph, "riser", { d: 1.0 }), c(T3.ignite, "roar", { d: 2.2 }), c(T3.fly0, "whoosh", { d: 1.8 }),
  c(T3.fly1, "thud"), c(T3.fly1 + 0.4, "clank"), c(T3.merge, "merge"), c(T3.ipo, "bell"), c(T3.liftoff, "roar", { d: 3.0 }),
  c(T3.ev, "chime"), c(T3.cap, "chime", { f: 1.25 }), c(T3.share, "chime", { f: 1.5 }),
  // S4
  c(T4.t0 + 0.2, "whoosh", { d: 1.6 }), c(T4.build0, "build", { d: 2 }), c(T4.up, "rise_arp", { d: 1.6 }), c(T4.up + 0.6, "coins"),
  c(T4.down, "fall_arp", { d: 1.9 }), c(T4.none, "chime"),
  // S5
  c(T5.t0 + 0.2, "whoosh", { d: 1.8 }), c(T5.open, "unbuild", { d: 1.8 }), c(T5.doorOpen - 0.2, "vault", { d: 2.0 }),
  c(T5.tray, "slide", { d: 1.6 }), c(T5.net, "stamp"), c(T5.gains, "chime", { f: 1.25 }), c(T5.tax, "hit_red"), c(T5.drop, "crash"),
  // S6
  c(T6.t0, "whoosh", { d: 0.8 }), c(T6.pledge, "lock"), c(T6.lend, "cash"), c(T6.interest, "trickle", { d: 1.4 }), c(T6.repay, "cash"),
  c(T6.fall - 0.4, "riser", { d: 1.0 }), c(T6.call, "alarm", { d: 2.4 }),
  // S7
  c(T7.t0, "riser", { d: 2.2 }), c(T7.tesla, "zip"), c(T7.spacex, "zip"), c(T7.debts, "zip", { f: 0.8 }), c(T7.value, "zip", { f: 1.2 }),
  c(T7.net, "stamp"), c(T7.line1, "swell", { d: 3.5 }), c(T7.zoom, "outro", { d: T7.end - T7.zoom }),
];

// intensité musicale par scène (0..1), interpolée linéairement entre ces points
export const INTENSITY = [
  [0, 0.25], [SC.s1.t1 - 2, 0.55], [SC.s2.t0, 0.6], [SC.s3.t0, 0.8], [SC.s4.t0, 0.9], [SC.s5.t0, 0.5],
  [SC.s6.t0, 0.7], [T6.call, 0.95], [SC.s7.t0, 0.85], [T7.line1, 1.0], [DURATION - 2, 0.7], [DURATION, 0.0],
];

export const TIMELINE = {
  duration: DURATION,
  segments: Object.fromEntries(Object.values(seg).map((s) => [s.id, { start: s.start, end: s.end, dur: s.dur }])),
  scenes: SC,
  cues: CUES,
  intensity: INTENSITY,
};
