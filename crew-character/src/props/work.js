/* Plan de travail « préparer une commande » : emplacements (espace scène : le personnage est en 0,0 face à +z),
   planning des gestes (mains) et trajectoires des ingrédients. Partagé par l'animation Work et par le décor. */
import { clamp, lerp, sstep, prog } from "../core/util.js";

export const TOP = 0.84;                    // hauteur du plan de travail
export const TRAY_HOME = [0, 0.64];         // plateau (centre x,z) sur le plan
export const SLOT = { BUNS: [0.52, 0.38], PATTY: [0.52, 0.62], CHEESE: [-0.52, 0.38], LETTUCE: [-0.52, 0.62], FRIES: [0.27, 0.33], CUP: [-0.27, 0.33], ASM: [0.0, 0.57] };
export const TRAY_TOP = TOP + 0.03;         // dessus du plateau
export const PAN_H = 0.05;                  // hauteur des bacs
export const TOTAL = 9.4;                   // durée du cycle complet
export const HOLD = 8.9;                    // fin des gestes (le plateau est prêt)
export const TRAY_SLOTS = { FRIES: [0.205, 0.575], CUP: [-0.205, 0.575] };

const ITEM = {   // h : hauteur ; y : base dans la pile ; src : bac d'origine ; hand : 0 gauche (+x) / 1 droite (-x) ; t0 : début du geste
  bunB: { h: 0.036, y: 0.0, src: "BUNS", hand: 0, t0: 0.3, dst: SLOT.ASM, supply: 0.036 },
  patty: { h: 0.026, y: 0.036, src: "PATTY", hand: 0, t0: 1.45, dst: SLOT.ASM, supply: 0.08 },
  cheese: { h: 0.008, y: 0.062, src: "CHEESE", hand: 1, t0: 2.6, dst: SLOT.ASM, supply: 0.05 },
  lettuce: { h: 0.02, y: 0.07, src: "LETTUCE", hand: 1, t0: 3.75, dst: SLOT.ASM, supply: 0.06 },
  topBun: { h: 0.075, y: 0.09, src: "BUNS", hand: 0, t0: 4.9, dst: SLOT.ASM, supply: 0.075 },
  fries: { h: 0.13, y: 0, src: "FRIES", hand: 0, t0: 6.75, dst: TRAY_SLOTS.FRIES, supply: 0, free: true },
  cup: { h: 0.15, y: 0, src: "CUP", hand: 1, t0: 7.75, dst: TRAY_SLOTS.CUP, supply: 0, free: true },
};
export const ITEMS = ITEM;
const REST = [[0.3, 1.0, 0.33], [-0.3, 1.0, 0.33]];
const GRIP_OFF = 0.115;                      // poignet au-dessus de l'objet saisi

/* position (base) d'un objet à sa source / destination (espace scène) */
function dstPos(n) { const it = ITEM[n], d = it.dst; return [d[0], TRAY_TOP + it.y, d[1]]; }
/* Pour les ingrédients : base du dessus du « stock » du bac (pour que l'objet saisi émerge du tas) */
function supplyBase(n) { const it = ITEM[n], s = SLOT[it.src]; return [s[0], TOP + PAN_H + (it.free ? -PAN_H : it.supply), s[1]]; }

const KEYS = [[], []];
(function build() {
  const add = (h, t, p, g) => KEYS[h].push({ t, p, g });
  [0, 1].forEach((h) => add(h, 0, REST[h], 0.2));
  Object.entries(ITEM).forEach(([n, it]) => {
    const h = it.hand, s = it.free ? [SLOT[it.src][0], TOP, SLOT[it.src][1]] : supplyBase(n), d = dstPos(n), t0 = it.t0;
    const wr = (b, dy = 0) => [b[0], b[1] + it.h * 0.5 + GRIP_OFF + dy, b[2] - 0.02];
    add(h, t0, REST[h], 0.2);
    add(h, t0 + 0.2, wr(s, 0.11), 0.1);
    add(h, t0 + 0.4, wr(s), 0.75);     // saisie
    add(h, t0 + 0.56, wr(s, 0.1), 0.75);
    add(h, t0 + 0.8, wr(d, 0.11), 0.75);
    add(h, t0 + 0.97, wr(d), 0.75);    // dépose
    add(h, t0 + 1.12, wr(d, 0.08), 0.1);
    add(h, t0 + 1.3, REST[h], 0.2);
  });
  // appui sur le pain du dessus (les deux mains)
  const topY = TRAY_TOP + ITEM.topBun.y + ITEM.topBun.h;
  [0, 1].forEach((h) => { const sx = h === 0 ? 0.075 : -0.075; add(h, 6.0, [sx, topY + 0.2, SLOT.ASM[1] - 0.04], 0.2); add(h, 6.22, [sx, topY + 0.115, SLOT.ASM[1] - 0.03], 0.4); add(h, 6.4, [sx, topY + 0.095, SLOT.ASM[1] - 0.03], 0.4); add(h, 6.6, [sx, topY + 0.2, SLOT.ASM[1] - 0.04], 0.2); });
  KEYS.forEach((k, h) => {
    k.sort((x, y) => x.t - y.t);
    const clean = []; k.forEach((x) => { const l = clean[clean.length - 1]; if (l && Math.abs(l.t - x.t) < 1e-6) clean[clean.length - 1] = x; else clean.push(x); });
    clean.push({ t: 99, p: REST[h], g: 0.2 }); k.length = 0; k.push(...clean);
  });
})();

function sample(keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], u = sstep((t - a.t) / Math.max(1e-6, b.t - a.t));
  return { p: [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)], g: lerp(a.g, b.g, u) };
}
/* cible du poignet de la main h (0 gauche, 1 droite) à l'instant τ (espace scène) */
export function handTarget(h, tau) { return sample(KEYS[h], clamp(tau, 0, HOLD + 0.4)); }

/* état d'un objet à l'instant τ : { pos, vis, scale, onTray } */
export function itemState(name, tau) {
  const it = ITEM[name], h = it.hand, t0 = it.t0, pick = t0 + 0.4, place = t0 + 0.97;
  const src = it.free ? [SLOT[it.src][0], TOP, SLOT[it.src][1]] : supplyBase(name), dst = dstPos(name);
  let pos, onTray = false;
  if (tau < pick) pos = src;
  else if (tau <= place) { const ht = handTarget(h, tau).p; pos = [ht[0], ht[1] - it.h * 0.5 - GRIP_OFF, ht[2] + 0.02]; }
  else { pos = dst; onTray = true; }
  // léger écrasement du burger pendant l'appui
  let squash = 1; if (name !== "fries" && name !== "cup") squash = 1 - 0.1 * sstep(prog(tau, 6.22, 6.4)) * (1 - sstep(prog(tau, 6.45, 6.7)));
  return { pos, onTray, squash };
}
