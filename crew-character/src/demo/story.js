/* Scénario de la vidéo de démonstration : tous les temps sont calculés à partir des distances et des vitesses de marche. */
import { walkParams } from "../character/anims.js";
import { sstep, sstep5, prog, lerp, wrapAngle } from "../core/util.js";
import { TOTAL, HOLD, ITEMS } from "../props/work.js";

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function motionFn(P, Y) {
  return (t) => {
    let x = P[0].x, z = P[0].z;
    for (let i = 0; i < P.length - 1; i++) if (t >= P[i].t && t <= P[i + 1].t) { const u = (t - P[i].t) / (P[i + 1].t - P[i].t); x = lerp(P[i].x, P[i + 1].x, u); z = lerp(P[i].z, P[i + 1].z, u); }
    if (t > P[P.length - 1].t) { x = P[P.length - 1].x; z = P[P.length - 1].z; }
    let yaw = Y[0].yaw;
    for (let i = 0; i < Y.length - 1; i++) if (t >= Y[i].t && t <= Y[i + 1].t) yaw = lerp(Y[i].yaw, Y[i + 1].yaw, sstep((t - Y[i].t) / (Y[i + 1].t - Y[i].t)));
    if (t > Y[Y.length - 1].t) yaw = Y[Y.length - 1].yaw;
    return { x, z, yaw };
  };
}
function catmull(keys) {
  return (t) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const u = Math.max(0, Math.min(1, (t - k1.t) / (k2.t - k1.t))), u2 = u * u, u3 = u2 * u, o = {};
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    o.target = [0, 1, 2].map((j) => f(k0.target[j], k1.target[j], k2.target[j], k3.target[j])); o.half = f(k0.half, k1.half, k2.half, k3.half);
    return o;
  };
}

export function buildStory(show) {
  const c = show.crew, V = walkParams().speed, VC = walkParams({ zmax: 0.2, T: 0.8 }).speed;
  const P = [], Y = [], HUD = [], CAM = [];
  const PREP = [-2.3, -0.7], SERVE = [2.3, -0.7];
  const A = [0.6, -2.75], B = [0.6, 0.15];

  /* 1. entrée en marchant (face caméra) */
  let t = 0;
  const tArr = dist(A, B) / V;
  P.push({ t: 0, x: A[0], z: A[1] }, { t: tArr, x: B[0], z: B[1] }); Y.push({ t: 0, yaw: 0 }, { t: tArr - 0.1, yaw: 0 }, { t: tArr + 0.8, yaw: Math.PI / 4 });
  c.play("walk", { at: 0, blend: 0.2 }); c.play("idle", { at: tArr - 0.12, blend: 0.5 });
  HUD.push({ id: "walk", t0: 0, t1: tArr - 0.1, title: "WALK", sub: "Marche naturelle · pieds sans glissement" });

  /* 2. salut */
  const tW = tArr + 0.55, tWe = tW + 3.0;
  c.play("wave", { at: tW, opts: { hand: "R" }, blend: 0.35 }); c.play("idle", { at: tWe, blend: 0.4 });
  HUD.push({ id: "idle", t0: tArr - 0.1, t1: tW, title: "IDLE", sub: "Il respire, cligne des yeux, change d'appui" });
  HUD.push({ id: "wave", t0: tW, t1: tWe, title: "WAVE", sub: "Il salue — bouche synchronisée, mains détaillées" });

  /* 3. marche vers le poste de préparation */
  const tP0 = tWe + 0.25, dP = dist(B, PREP), tP1 = tP0 + dP / V, H1 = Math.atan2(PREP[0] - B[0], PREP[1] - B[1]);
  P.push({ t: tP0, x: B[0], z: B[1] }, { t: tP1, x: PREP[0], z: PREP[1] });
  Y.push({ t: tP0, yaw: Math.PI / 4 }, { t: tP0 + 0.55, yaw: H1 }, { t: tP1 - 0.7, yaw: H1 }, { t: tP1, yaw: 0 });
  c.play("walk", { at: tP0, blend: 0.3 });
  HUD.push({ id: "walk", t0: tP0, t1: tP1, title: "WALK", sub: "Il se tourne et rejoint son poste" });

  /* 4. préparation de la commande (comptoir posé à son poste) */
  show.placeStation({ x: PREP[0], z: PREP[1], yaw: 0 });
  const tK = tP1 - 0.05, tKe = tK + HOLD + 0.3;
  c.play("work", { at: tK, blend: 0.45, opts: { loop: false }, speed: 1 });
  HUD.push({ id: "work", t0: tK, t1: tKe, title: "WORK", sub: "Il assemble la commande : pain, steak, fromage, salade, frites, boisson" });

  /* 5. il prend le plateau et le porte jusqu'au comptoir de retrait */
  const tC0 = tKe + 0.05;
  c.play("carry", { at: tC0, blend: 0.4, opts: { moving: false } });
  show.events.push({ kind: "grab", t: tC0 + 0.05, dur: 0.6 });
  const tCw = tC0 + 0.6, dC = dist(PREP, SERVE), tCe = tCw + dC / VC;
  P.push({ t: tCw, x: PREP[0], z: PREP[1] }, { t: tCe, x: SERVE[0], z: SERVE[1] });
  Y.push({ t: tC0, yaw: 0 }, { t: tC0 + 0.55, yaw: Math.PI / 2 }, { t: tCe - 0.75, yaw: Math.PI / 2 }, { t: tCe, yaw: 0 });
  c.play("carry", { at: tCw, blend: 0.35, opts: { moving: true } });
  HUD.push({ id: "carry", t0: tC0, t1: tCe, title: "CARRY", sub: "Il porte le plateau : burger, frites, boisson" });

  /* 6. dépose du plateau */
  const place = [0.3, 1.9], tD = tCe - 0.1;
  c.play("carry", { at: tD, blend: 0.35, opts: { moving: false, place } });
  show.serve.group.position.set(SERVE[0], 0, SERVE[1]);
  show.events.push({ kind: "release", t: tD + place[1] - 0.42, dur: 0.3, to: [SERVE[0], 0.84, SERVE[1] + 0.58, 0] });
  const tH = tD + place[1] + 0.1;

  /* 7. joie */
  c.play("happy", { at: tH, blend: 0.3, opts: { loop: false } });
  const tHe = tH + 2.7; c.play("idle", { at: tHe, blend: 0.4 });
  HUD.push({ id: "happy", t0: tH, t1: tHe, title: "HAPPY", sub: "Saut de joie, poings levés, grand sourire" });

  /* 8. tour de caméra à 360° (preuve du volume) + salut final */
  const tO0 = tH + 0.3, tO1 = tO0 + 7.2, tF = tO1 - 3.3;
  c.play("wave", { at: tF, opts: { hand: "R" }, blend: 0.4 }); c.play("idle", { at: tF + 3.0, blend: 0.4 });
  const duration = tO1 + 2.2;
  c.setMotion(motionFn(P, Y));
  const motion = c.motion;
  HUD.push({ id: "orbit", t0: tHe, t1: tO1 + 0.5, title: "360°", sub: "Vraie 3D : la caméra isométrique tourne autour du personnage" });

  /* caméra : suivi lissé + plans de détail */
  const follow = (tt, off = [0, 0.95, 0.0]) => { const m = motion(tt + 0.25); return [m.x + off[0], off[1], m.z + off[2]]; };
  const K = (tt, target, half) => CAM.push({ t: tt, target, half });
  K(0, [0.2, 0.9, -1.6], 3.1);
  for (let tt = 0.6; tt < tArr; tt += 0.6) K(tt, follow(tt), 2.9 - 0.4 * (tt / tArr));
  K(tArr + 0.1, [B[0], 0.95, B[1]], 2.3); K(tW + 1.5, [B[0], 1.0, B[1] - 0.05], 2.05); K(tWe + 0.1, [B[0], 0.95, B[1]], 2.3);
  for (let tt = tP0 + 0.5; tt < tP1 - 0.2; tt += 0.55) K(tt, follow(tt), 2.55);
  K(tP1 + 0.3, [PREP[0], 1.0, PREP[1] + 0.1], 2.15); K(tK + 3.0, [PREP[0], 1.0, PREP[1] + 0.35], 1.8); K(tKe - 1.5, [PREP[0], 1.0, PREP[1] + 0.4], 1.8);
  K(tC0 + 0.3, [PREP[0] + 0.1, 1.0, PREP[1] + 0.25], 2.2);
  for (let tt = tCw + 0.4; tt < tCe - 0.3; tt += 0.55) K(tt, follow(tt, [0, 0.95, 0.15]), 2.5);
  K(tD + 1.0, [SERVE[0], 1.0, SERVE[1] + 0.2], 2.0); K(tH + 1.0, [SERVE[0], 0.95, SERVE[1] + 0.1], 2.0);
  K(tO0 + 3.5, [SERVE[0] - 0.4, 0.95, SERVE[1] + 0.1], 2.2); K(tO1 - 1.2, [0.2, 0.8, -0.2], 3.0); K(duration + 1, [0.2, 0.75, -0.2], 3.4);
  CAM.sort((a, b) => a.t - b.t);
  const cam = catmull(CAM);
  show.cameraFn = (tt) => { const o = cam(Math.min(tt, CAM[CAM.length - 1].t)); const yaw = 45 + 360 * sstep5(prog(tt, tO0, tO1)); return { target: o.target, half: o.half, yaw }; };

  /* événements sonores déduits du scénario (pas, saisies, dépose, saut…) */
  const SFX = [], walkSpans = [{ a: 0, b: tArr - 0.1, T: walkParams().T }, { a: tP0, b: tP1, T: walkParams().T }, { a: tCw, b: tCe, T: 0.8 }];
  walkSpans.forEach((w) => { for (let k = 0; ; k++) { const tt = w.a + (k * w.T) / 2; if (tt > w.b) break; if (tt > w.a + 0.05) SFX.push({ t: tt, k: "step", v: k % 2 }); } });
  Object.entries(ITEMS).forEach(([n, it]) => { SFX.push({ t: tK + it.t0 + 0.4, k: "pick" }); SFX.push({ t: tK + it.t0 + 0.97, k: "place" }); });
  SFX.push({ t: tK + 6.22, k: "press" }, { t: tC0 + 0.05, k: "lift" }, { t: tD + place[1] - 0.12, k: "set" }, { t: tD + place[1] + 0.05, k: "bell" }, { t: tH + 0.36, k: "jump" }, { t: tH + 0.98, k: "land" }, { t: 0.5, k: "chime" }, { t: duration - 4.0, k: "chime2" });
  SFX.sort((a, b) => a.t - b.t);
  return { duration, hud: HUD, sfx: SFX, times: { tArr, tW, tP0, tP1, tK, tKe, tC0, tCe, tD, tH, tO0, tO1, tF } };
}
