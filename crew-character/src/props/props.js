/* Accessoires procéduraux : plateau, ingrédients du burger, frites, boisson, comptoirs de préparation / retrait. */
import * as THREE from "three";
import { mesh, sphere, rbox, cyl, lathe, tube, archesMark } from "../character/builders.js";
import { rng, clamp } from "../core/util.js";
import { Phys } from "../character/materials.js";
import { SLOT, TOP, PAN_H, TRAY_HOME, TRAY_TOP } from "./work.js";

const R = 0.085; // rayon du burger

/* Les parties ont leur origine au centre de leur base. */
export function makeBurgerParts(M) {
  const P = {};
  P.bunB = lathe([[0, 0], [R * 0.95, 0], [R, 0.008], [R * 1.01, 0.022], [R * 0.95, 0.034], [R * 0.8, 0.0365], [0, 0.0365]], M.bunLight, {}, 40);
  P.patty = lathe([[0, 0], [R * 0.98, 0], [R * 1.03, 0.006], [R * 1.04, 0.018], [R * 0.99, 0.025], [R * 0.9, 0.0265], [0, 0.0265]], M.patty, {}, 40);
  { const g = new THREE.Group(); g.add(rbox(0.178, 0.006, 0.178, 0.002, M.cheese, { pos: [0, 0.003, 0], rot: [0, Math.PI / 4, 0] })); for (const s of [-1, 1]) g.add(rbox(0.05, 0.006, 0.05, 0.002, M.cheese, { pos: [s * 0.075, -0.006, 0.075 * -s], rot: [0.5 * s, Math.PI / 4, 0.4 * s] })); P.cheese = g; }
  { const geo = new THREE.TorusGeometry(R * 1.05, 0.013, 10, 56); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)); p.setZ(i, p.getZ(i) + 0.009 * Math.sin(a * 7) + 0.004 * Math.sin(a * 13)); } geo.computeVertexNormals(); const g = new THREE.Group(); const m1 = new THREE.Mesh(geo, M.lettuce); m1.rotation.x = Math.PI / 2; m1.position.y = 0.012; m1.castShadow = true; g.add(m1); const m2 = m1.clone(); m2.scale.setScalar(0.82); m2.position.y = 0.017; m2.rotation.z = 0.5; g.add(m2); P.lettuce = g; }
  P.topBun = (() => { const g = new THREE.Group(); const prof = []; for (let i = 0; i <= 20; i++) { const a = (Math.PI / 2) * (i / 20); prof.push([R * 1.04 * Math.cos(a) * (1 + 0.04 * Math.sin(a * 2)), 0.012 + 0.066 * Math.sin(a)]); } prof.unshift([R * 0.9, 0], [R * 1.04, 0.002], [R * 1.05, 0.012]); g.add(lathe(prof, M.bun, {}, 44)); const r = rng(7); for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, e = 0.15 + r() * 1.1, rr = R * 1.0 * Math.cos(e), y = 0.012 + 0.066 * Math.sin(e) + 0.001; g.add(sphere(0.0042, M.seed, { pos: [rr * 0.99 * Math.cos(a), y, rr * 0.99 * Math.sin(a)], scale: [1.5, 0.7, 0.9], rot: [0, -a, 0.2], cast: false })); } return g; })();
  P.tomato = (() => { const g = new THREE.Group(); g.add(cyl(R * 0.92, R * 0.92, 0.009, M.tomato, { pos: [0, 0.0045, 0] }, 36)); return g; })();
  return P;
}

export function makeFries(M) {
  const g = new THREE.Group(), c = new THREE.Group(); g.add(c);
  const geo = new THREE.BoxGeometry(0.1, 0.125, 0.07, 1, 1, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 1.25); p.setZ(i, p.getZ(i) * 1.25); } geo.computeVertexNormals();
  const carton = new THREE.Mesh(geo, M.redShiny); carton.position.y = 0.0625; carton.castShadow = true; c.add(carton);
  const logo = archesMark(M.yellowShiny, 0.055); logo.position.set(0, 0.065, 0.0375 + 0.0035); logo.rotation.x = -0.1; c.add(logo);
  const scal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), M.redDeep); scal.position.set(0, 0.123, 0.044); c.add(scal);
  const r = rng(21); for (let i = 0; i < 30; i++) { const len = 0.05 + r() * 0.05, x = (r() - 0.5) * 0.09, z = (r() - 0.5) * 0.05; const s = rbox(0.012, len, 0.012, 0.004, i % 3 ? M.fries : M.friesLight, { pos: [x, 0.115 + len / 2 - 0.012 + r() * 0.01, z], rot: [(r() - 0.5) * 0.35, r() * 3, (r() - 0.5) * 0.35] }); c.add(s); }
  return g;
}

export function makeCup(M) {
  const g = new THREE.Group();
  g.add(cyl(0.055, 0.041, 0.15, M.cup, { pos: [0, 0.075, 0] }, 40));
  g.add(cyl(0.0505, 0.0445, 0.06, M.redShiny, { pos: [0, 0.07, 0] }, 40));
  const lg = archesMark(M.yellowShiny, 0.04); lg.position.set(0, 0.07, 0.0495); g.add(lg);
  g.add(cyl(0.058, 0.058, 0.01, M.white, { pos: [0, 0.153, 0] }, 40)); g.add(sphere(0.054, M.white, { pos: [0, 0.153, 0], scale: [1, 0.3, 1] }));
  const st = cyl(0.0048, 0.0048, 0.11, M.redShiny, { pos: [0.014, 0.205, 0], rot: [0, 0, -0.16] }, 12); g.add(st);
  return g;
}

export function makeTray(M) {
  const g = new THREE.Group();
  g.add(rbox(0.62, 0.026, 0.42, 0.012, M.redShiny, { pos: [0, 0.013, 0] }));
  const rim = (w, d, x, z) => g.add(rbox(w, 0.018, d, 0.006, M.redDeep, { pos: [x, 0.03, z] }));
  rim(0.62, 0.018, 0, 0.201); rim(0.62, 0.018, 0, -0.201); rim(0.018, 0.42, 0.301, 0); rim(0.018, 0.42, -0.301, 0);
  g.add(rbox(0.56, 0.004, 0.37, 0.002, M.paper, { pos: [0, 0.028, 0], cast: false }));
  const lg = archesMark(M.yellowShiny, 0.07); lg.position.set(0, 0.0295, -0.14); lg.rotation.x = -Math.PI / 2; g.add(lg);
  g.userData.top = 0.03;
  return g;
}

function steel(M, w, h, d, o) { return rbox(w, h, d, 0.012, M.steel, o); }

/* Comptoir de préparation : les coordonnées locales = espace « scène » du personnage (origine à ses pieds, face à +z). */
export class PrepCounter {
  constructor(M) {
    this.M = M; this.group = new THREE.Group();
    const g = this.group;
    // meuble : le côté +z (vers la caméra) est la façade « client »
    g.add(rbox(2.5, 0.78, 0.92, 0.03, M.white, { pos: [0, 0.39, 0.72] }));
    g.add(rbox(2.52, 0.12, 0.94, 0.02, M.redShiny, { pos: [0, 0.56, 0.72] }));
    g.add(rbox(2.54, 0.028, 0.96, 0.012, M.yellowShiny, { pos: [0, 0.47, 0.72] }));
    g.add(rbox(2.56, 0.06, 0.98, 0.022, M.steel, { pos: [0, TOP - 0.03, 0.72] }));
    g.add(rbox(2.4, 0.07, 0.8, 0.02, M.ink, { pos: [0, 0.035, 0.72] }));
    const lg = archesMark(M.yellowShiny, 0.5); lg.position.set(0, 0.6, 1.195); lg.rotation.x = 0; g.add(lg);
    // bacs d'ingrédients
    this.pan = {}; const decor = makeBurgerParts(M);
    const pan = (name, [x, z]) => { const b = new THREE.Group(); b.position.set(x, TOP, z); b.add(steel(M, 0.21, PAN_H, 0.21, { pos: [0, PAN_H / 2, 0] })); g.add(b); this.pan[name] = b; return b; };
    const b1 = pan("BUNS", SLOT.BUNS), b2 = pan("PATTY", SLOT.PATTY), b3 = pan("CHEESE", SLOT.CHEESE), b4 = pan("LETTUCE", SLOT.LETTUCE);
    const put = (grp, mk, y, rot = 0, dx = 0, dz = 0) => { const o = mk(); o.position.set(dx, y, dz); o.rotation.y = rot; grp.add(o); return o; };
    put(b1, () => decor.bunB.clone(), PAN_H); put(b1, () => decor.bunB.clone(), PAN_H + 0.0365, 0.4);
    put(b2, () => decor.patty.clone(), PAN_H); put(b2, () => decor.patty.clone(), PAN_H + 0.027, 0.7); put(b2, () => decor.patty.clone(), PAN_H + 0.054, 1.3);
    for (let i = 0; i < 6; i++) put(b3, () => decor.cheese.clone(), PAN_H + i * 0.007, i * 0.35);
    put(b4, () => decor.lettuce.clone(), PAN_H); put(b4, () => decor.lettuce.clone(), PAN_H + 0.02, 1.1);
    // petit décor : bouteilles de sauce + distributeur
    [[-1.0, 0.98, "#E8402B"], [-0.9, 1.0, "#FFC72C"]].forEach(([x, z, c]) => { const m = new Phys({ color: c, roughness: 0.35, clearcoat: 0.4 }); const b = new THREE.Group(); b.position.set(x, TOP, z); b.add(cyl(0.032, 0.036, 0.15, m, { pos: [0, 0.075, 0] })); b.add(cyl(0.006, 0.026, 0.04, m, { pos: [0, 0.17, 0] })); g.add(b); });
    g.add(rbox(0.16, 0.2, 0.09, 0.015, M.white, { pos: [0.98, TOP + 0.1, 1.0] })); g.add(rbox(0.12, 0.05, 0.095, 0.01, M.redShiny, { pos: [0.98, TOP + 0.15, 1.0] }));
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  }
}

/* Comptoir de retrait (côté client) avec cloche et enseigne. */
export class ServeCounter {
  constructor(M) {
    this.group = new THREE.Group(); const g = this.group;
    g.add(rbox(1.7, 0.78, 0.84, 0.03, M.white, { pos: [0, 0.39, 0.72] }));
    g.add(rbox(1.72, 0.12, 0.86, 0.02, M.yellowShiny, { pos: [0, 0.56, 0.72] }));
    g.add(rbox(1.74, 0.028, 0.88, 0.012, M.redShiny, { pos: [0, 0.47, 0.72] }));
    g.add(rbox(1.78, 0.06, 0.9, 0.022, M.white, { pos: [0, TOP - 0.03, 0.72] }));
    const bell = new THREE.Group(); bell.position.set(0.62, TOP, 0.95); bell.add(cyl(0.05, 0.05, 0.012, M.yellowShiny, { pos: [0, 0.006, 0] })); bell.add(sphere(0.045, M.yellowShiny, { pos: [0, 0.012, 0], scale: [1, 0.85, 1] })); bell.add(sphere(0.011, M.yellowShiny, { pos: [0, 0.056, 0] })); g.add(bell);
    const c = document.createElement("canvas"); c.width = 512; c.height = 160; const x = c.getContext("2d"); x.fillStyle = "#DA291C"; x.fillRect(0, 0, 512, 160); x.fillStyle = "#FFC72C"; x.fillRect(0, 128, 512, 32); x.fillStyle = "#fff"; x.font = "900 66px Montserrat, Arial, sans-serif"; x.textAlign = "center"; x.fillText("COMMANDE", 256, 76); x.font = "800 42px Montserrat, Arial, sans-serif"; x.fillText("PRÊTE", 256, 120);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.19, 0.03), [M.redShiny, M.redShiny, M.redShiny, M.redShiny, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), M.redShiny]); sign.position.set(-0.45, TOP + 0.12, 1.02); sign.castShadow = true; g.add(sign);
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  }
}
