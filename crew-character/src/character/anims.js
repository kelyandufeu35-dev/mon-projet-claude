/* Bibliothèque d'animations : Idle, Walk, Wave, Carry, Work, Happy.
   Chaque animation est une fonction pure (temps local τ, contexte) → pose ; elles sont réutilisables, bouclables et mélangeables. */
import { neutralPose, armDir, norm3, legIK, groundHips } from "./pose.js";
import { DIM } from "./rig.js";
import { clamp, lerp, sstep, prog, TAU, fract } from "../core/util.js";
import { handTarget, HOLD, TOTAL } from "../props/work.js";

const mixv = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const side = (i) => (i === 0 ? 1 : -1);  // 0 = bras/jambe gauche (+x), 1 = droit (-x)

function finish(p) { p.hipsY = groundHips(p.legs) + (p.lift || 0); delete p.lift; return p; }

/* ============================ IDLE ============================ */
export function idle(t) {
  const p = neutralPose(), br = Math.sin(t * TAU * 0.27), sw = Math.sin(t * TAU * 0.1), lk = Math.sin(t * TAU * 0.067);
  p.root.x = 0.014 * sw; p.root.roll = 0.008 * sw;
  p.hips = [0.01 * br, -0.035 * sw, 0.025 * sw];
  p.spine = [0.012 * br, 0.05 * lk, -0.02 * sw]; p.neck = [0.018 * br, 0.05 * lk, 0]; p.head = [-0.02 + 0.03 * Math.sin(t * TAU * 0.13), 0.12 * lk, 0.03 * Math.sin(t * TAU * 0.09)];
  p.legs[0].flex = 0.02 * sw; p.legs[1].flex = -0.02 * sw; p.legs[0].knee = 0.03 + 0.03 * Math.max(0, sw); p.legs[1].knee = 0.03 + 0.03 * Math.max(0, -sw);
  p.legs[0].abd = 0.04 + 0.02 * sw; p.legs[1].abd = 0.04 - 0.02 * sw;
  p.arms.forEach((a, i) => {
    const s = side(i), ph = t * TAU * 0.27 + i * 0.7;
    a.u = armDir(s, 0.05 + 0.025 * Math.sin(ph), 0.17 + 0.02 * br); a.f = armDir(s, 0.5 + 0.06 * Math.sin(ph + 0.8), 0.12);
    a.wrist = 0.05 + 0.04 * Math.sin(ph); a.curl = 0.3 + 0.05 * Math.sin(ph + 1.2);
  });
  Object.assign(p.face, { lookX: 0.12 * lk, lookY: 0.26, smile: 0.5 + 0.1 * Math.sin(t * TAU * 0.15), brow: 0.15, cheek: 0.15, lid: 1 });
  return finish(p);
}

/* ============================ WALK ============================ */
export function walkParams(o = {}) {
  const zmax = o.zmax ?? 0.25, T = o.T ?? 0.84;
  return { zmax, T, speed: (4 * zmax) / T, lift: o.lift ?? 0.085, hipJ: o.hipJ ?? 0.692, bobAmp: o.bobAmp ?? 0.024, arm: o.arm ?? 0.55 };
}
/* trajectoire du pied (cheville) d'une jambe : phase ψ ∈ [0,1) ; retourne z (avant +), hauteur au-dessus du sol, bascule de la pointe */
function foot(psi, W) {
  let z, y = DIM.ankleH, toe = 0;
  if (psi < 0.5) { // appui : le pied recule linéairement par rapport au bassin
    z = W.zmax * (1 - 4 * psi);
    const u = sstep((psi - 0.36) / 0.14); y += 0.032 * u; toe = -0.55 * u + 0.24 * (1 - sstep(psi / 0.13));
  } else {
    const s = (psi - 0.5) / 0.5;
    z = -W.zmax + 2 * W.zmax * (0.3 * s + 0.7 * sstep(s));
    y += W.lift * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04)), 0.85) + 0.032 * (1 - sstep(s / 0.25));
    toe = -0.55 * (1 - sstep(s / 0.3)) + 0.26 * sstep((s - 0.55) / 0.45);
  }
  return { z, y, toe };
}
export function walkLower(p, t, o = {}) {
  const W = walkParams(o), ph = t / W.T, psiL = fract(ph), psiR = fract(ph + 0.5);
  const bob = 0.5 * (1 + Math.cos(4 * Math.PI * (psiL - 0.25)));
  const hipJ = W.hipJ + W.bobAmp * bob; p.hipsY = hipJ + DIM.hipDrop;
  [psiL, psiR].forEach((psi, i) => {
    const f = foot(psi, W), r = legIK(f.z, -(hipJ - f.y));
    p.legs[i] = { flex: r.flex, knee: r.knee, abd: 0.04, toe: f.toe };
  });
  const c = Math.cos(TAU * psiL), s = Math.sin(TAU * psiL);
  p.hips = [0.0, -0.13 * c, 0.035 * s]; p.root.x = 0.016 * s; p.root.roll = -0.01 * s;
  p.root.pitch = 0.0;
  return { W, c, s, psiL, bob };
}
export function walk(t, ctx = {}) {
  const p = neutralPose(), { W, c, s, bob } = walkLower(p, t, ctx.opts);
  p.spine = [0.07 + 0.012 * bob, 0.2 * c, -0.03 * s]; p.neck = [-0.03, -0.08 * c, 0]; p.head = [-0.02 + 0.015 * bob, -0.1 * c, 0.02 * s];
  p.arms.forEach((a, i) => {
    const sd = side(i), sw = (i === 0 ? -1 : 1) * W.arm * c;   // le bras avance avec la jambe opposée
    const fw = Math.max(0, sw / W.arm);
    a.u = armDir(sd, sw * 0.9, 0.13 + 0.02 * (1 - fw)); a.f = armDir(sd, sw * 0.9 + 0.35 + 0.6 * fw, 0.1);
    a.wrist = 0.05; a.curl = 0.32;
  });
  Object.assign(p.face, { lookX: 0, lookY: 0.22, smile: 0.55, brow: 0.2, cheek: 0.2, lid: 1 });
  return p;
}

/* ============================ WAVE ============================ */
export function wave(t, ctx = {}) {
  const p = idle(t * 0.9 + 3.1), hand = ctx.opts?.hand === "L" ? 0 : 1, s = side(hand), o = side(1 - hand);
  const raise = sstep(prog(t, 0, 0.5)) * (1 - sstep(prog(t, 2.5, 3.0))), osc = Math.sin(TAU * 2.2 * (t - 0.45)) * sstep(prog(t, 0.35, 0.7)) * (1 - sstep(prog(t, 2.4, 2.8)));
  const a = p.arms[hand];
  a.u = mixv(a.u, norm3([s * 0.9, 0.36, 0.13]), raise);
  a.f = mixv(a.f, norm3([s * (0.42 + 0.44 * osc), 0.86, 0.32]), raise);
  a.palm = mixv(a.palm, norm3([-s * 0.15, 0.0, 1]), raise); a.wrist = lerp(a.wrist, 0.18 * osc, raise);
  a.curl = lerp(a.curl, 0.04, raise); a.spread = lerp(a.spread, 0.62, raise); a.thumb = lerp(a.thumb, 0.0, raise);
  p.spine[2] += -s * 0.06 * raise; p.spine[0] -= 0.02 * raise; p.head[2] += s * 0.1 * raise; p.head[1] += s * -0.06 * raise; p.neck[0] -= 0.02 * raise;
  p.hips[2] += s * 0.02 * raise; p.legs[hand].knee += 0.03 * raise;
  const talk = sstep(prog(t, 0.5, 0.7)) * (1 - sstep(prog(t, 1.9, 2.1))), mo = talk * Math.max(0, Math.sin(TAU * 3.1 * t)) * 0.55;
  Object.assign(p.face, { smile: 0.85, wide: 0.45 * raise, open: Math.max(mo, 0.22 * raise * (1 - talk)), brow: 0.55 * raise + 0.1, cheek: 0.55 * raise, squint: 0.35 * raise, lookY: 0.32, lookX: 0 });
  const q = p.arms[1 - hand]; q.u = armDir(o, 0.04, 0.2); // l'autre bras reste détendu
  return finish(p);
}

/* ============================ CARRY ============================ */
export function carry(t, ctx = {}) {
  const o = ctx.opts || {}, moving = o.moving !== false, p = neutralPose();
  let c = 0, s = 0, bob = 0;
  if (moving) { const r = walkLower(p, t, { zmax: 0.2, T: 0.8, lift: 0.07, bobAmp: 0.014, ...o.walk }); c = r.c; s = r.s; bob = r.bob; p.root.x *= 0.5; p.hips[1] *= 0.5; }
  else { const q = idle(t); p.legs = q.legs; p.hipsY = q.hipsY; p.hips = q.hips; p.root.x = q.root.x * 0.6; p.root.roll = q.root.roll; }
  // plateau : position (espace torse), éventuellement déposé vers l'avant (o.place = [t0, t1])
  let tp = [0, 0.165 + 0.007 * bob, 0.385], lean = -0.06;
  if (o.place) {
    const u = sstep(prog(t, o.place[0], o.place[1] - 0.45)) * (1 - sstep(prog(t, o.place[1] - 0.05, o.place[1] + 0.35)));
    tp = mixv(tp, o.placeTo || [0, 0.07, 0.56], u); lean = lerp(lean, 0.42, u);
  }
  p.prop.tray = 1; p.prop.trayPos = tp;
  p.spine = [lean + 0.01 * bob, 0.05 * c, -0.02 * s]; p.neck = [0.02 - lean * 0.4, -0.03 * c, 0]; p.head = [-0.04 - Math.max(0, lean) * 0.5, -0.04 * c, 0.015 * s];
  p.arms.forEach((a, i) => {
    const sd = side(i);
    a.ikT = { w: 1, t: [sd * 0.225, tp[1] - 0.034, tp[2]], pole: [sd * 0.75, -0.65, -0.1], palm: [0, 1, 0.05] };
    a.curl = 0.12; a.thumb = 0.05; a.spread = 0.18; a.wrist = 0.12;
  });
  Object.assign(p.face, { lookX: 0, lookY: 0.2, smile: 0.55, brow: 0.2, cheek: 0.2, lid: 1 });
  if (!moving) return finish(p);
  return p;
}

/* ============================ WORK ============================ */
export function work(t, ctx = {}) {
  const loop = ctx.opts?.loop !== false, tt = loop ? t % TOTAL : Math.min(t, HOLD + 0.3);
  const p = idle(t * 0.7 + 7.7), lean = 0.36 * sstep(prog(tt, 0, 0.5)) * (1 - sstep(prog(tt, HOLD, HOLD + 0.45)));
  const w = sstep(prog(tt, 0, 0.5)) * (1 - sstep(prog(tt, HOLD, HOLD + 0.45)));
  p.root.z = 0.1 * w; p.spine[0] += lean; p.neck[0] += -0.02 * w; p.head[0] += 0.02 * w - 0.02;
  p.legs.forEach((l, i) => { l.flex = 0.08 * w; l.knee += 0.14 * w; });
  p.arms.forEach((a, i) => {
    const h = handTarget(i, tt), sd = side(i), gr = h.g;
    a.ikS = { w: w, t: h.p, pole: [sd * 0.8, -0.55, -0.35], palm: [0, -1, 0.1] };
    a.curl = lerp(a.curl, 0.12 + 0.5 * gr, w); a.thumb = lerp(a.thumb, 0.1 + 0.6 * gr, w); a.spread = lerp(a.spread, 0.25, w); a.wrist = lerp(a.wrist, 0.1, w);
  });
  // regard : suit la main active, sourire concentré
  const act = handTarget(0, tt).p[1] < handTarget(1, tt).p[1] ? 0 : 1, tgt = handTarget(act, tt).p;
  Object.assign(p.face, { lookX: clamp(tgt[0] * 1.6, -0.6, 0.6) * w, lookY: lerp(p.face.lookY, -0.34, w), smile: 0.45 + 0.15 * w, brow: -0.1 * w, browTilt: -0.15 * w, lid: 0.92, cheek: 0.2 });
  p.head[1] += clamp(tgt[0] * 0.5, -0.25, 0.25) * w;
  return finish(p);
}

/* ============================ HAPPY ============================ */
export function happy(t, ctx = {}) {
  const T = 2.7, tt = ctx.opts?.loop === false ? Math.min(t, T) : t % T, p = idle(t * 0.9);
  const crouch = sstep(prog(tt, 0, 0.3)) * (1 - sstep(prog(tt, 0.3, 0.36)));
  const air = prog(tt, 0.36, 0.98), jump = Math.sin(Math.PI * air) * (air > 0 && air < 1 ? 1 : 0);
  const land = sstep(prog(tt, 0.98, 1.14)) * (1 - sstep(prog(tt, 1.14, 1.4)));
  const shim = sstep(prog(tt, 1.3, 1.6)) * (1 - sstep(prog(tt, 2.4, 2.7)));
  const sh = Math.sin(TAU * 2.1 * (tt - 1.3)) * shim, pump = (Math.sin(TAU * 2.1 * (tt - 1.3) + 0.8)) * shim;
  const bend = 0.55 * crouch + 0.5 * land + 0.14 * shim * (0.5 + 0.5 * Math.cos(TAU * 4.2 * (tt - 1.3)));
  p.legs.forEach((l, i) => { l.flex = 0.55 * bend / 0.55 * 0.5 + (jump > 0 ? -0.1 + 0.35 * jump : 0); l.knee = 0.03 + bend * 1.25 + (jump > 0 ? 0.45 * jump : 0); l.abd = 0.07 + 0.05 * jump; l.toe = jump > 0 ? 0.35 * jump : 0; });
  p.lift = 0.42 * jump;
  const up = Math.max(sstep(prog(tt, 0.3, 0.6)) * (1 - sstep(prog(tt, 1.1, 1.3))), shim);
  p.arms.forEach((a, i) => {
    const s = side(i), alt = i === 0 ? pump : -pump;
    const raised = Math.max(up, 0);
    const backSwing = crouch * 1.0;
    a.u = mixv(armDir(s, 0.05 - backSwing * 0.6, 0.17), norm3([s * 0.5, 0.88, 0.22 + 0.15 * alt * shim]), raised);
    a.f = mixv(armDir(s, 0.5, 0.12), norm3([s * (0.3 + 0.18 * alt * shim), 0.93, 0.2]), raised);
    a.curl = lerp(0.3, 1.0, sstep(prog(tt, 0.3, 0.5))); a.thumb = lerp(0.2, 0.7, raised); a.palm = norm3([-s * 0.4, 0.3, 0.9]); a.wrist = 0.0;
  });
  p.hips[1] += 0.2 * sh; p.hips[2] += 0.12 * sh; p.spine[1] -= 0.28 * sh; p.spine[2] += -0.08 * sh; p.spine[0] += 0.15 * crouch - 0.12 * jump - 0.05 * shim; p.head[2] += 0.14 * sh; p.head[0] += -0.08 * (jump + shim);
  p.root.x = 0.03 * sh;
  Object.assign(p.face, { smile: 1, wide: 0.8, open: 0.55 + 0.35 * Math.max(jump, shim), brow: 0.9, cheek: 1, squint: 0.8, lid: 0.55 + 0.1 * jump, tongue: 0.5, lookY: 0.3 });
  return finish(p);
}

export const ANIMS = {
  idle: { fn: idle, loop: true, label: "Idle", desc: "Il respire, change d'appui et regarde autour de lui." },
  walk: { fn: walk, loop: true, label: "Walk", desc: "Marche sans glissement des pieds (cinématique inverse des jambes)." },
  wave: { fn: wave, loop: false, dur: 3.0, label: "Wave", desc: "Il salue de la main et lance un « Salut ! »." },
  carry: { fn: carry, loop: true, label: "Carry", desc: "Il porte un plateau (burger, frites, boisson) des deux mains." },
  work: { fn: work, loop: true, dur: TOTAL, label: "Work", desc: "Il assemble une commande : pain, steak, fromage, salade, frites, boisson." },
  happy: { fn: happy, loop: true, dur: 2.7, label: "Happy", desc: "Saut de joie, poings levés et petit déhanché." },
};
