// SCÈNE 7 — La structure complète de sa richesse : tout se rejoint autour de Musk ; organigramme lumineux
// (propriété, contrôle, valorisation, dettes, patrimoine net) ; phrase finale ; zoom de clôture.
import * as THREE from "three";
import { C } from "../core/palette.js";
import { makeSkyline } from "../components/buildings.js";
import { FlowLine, FlowCoins, makeDust } from "../components/fx.js";
import { ease, inv, clamp, lerp } from "../core/util.js";
import { SC, when, DURATION } from "../timing.js";
import { POS } from "../layout.js";
import { fmt } from "../core/util.js";

export const T7 = {
  t0: SC.s7.t0,
  t1: SC.s7.t1,
  rise: SC.s7.t0 + 2.4,
  tesla: when("s7a", "Tesla") - 0.1,
  spacex: when("s7a", "SpaceX") - 0.15,
  ai: when("s7a", "intelligence artificielle") - 0.2,
  others: when("s7a", "d'autres participations") - 0.2,
  debts: when("s7a", "dettes documentées") - 0.4,
  own: when("s7b", "Propriété") - 0.1,
  control: when("s7b", "contrôle") - 0.1,
  value: when("s7b", "valorisation") - 0.1,
  net: when("s7b", "patrimoine net") - 0.2,
  line1: when("s7c", "La richesse") - 0.1,
  line2: when("s7c", "C'est principalement") - 0.2,
  zoom: when("s7c", "C'est principalement") + 0.2,
  end: SC.s7.t1,
};

export function buildFinale(ctx) {
  const { world, hud, facts } = ctx;
  const root = new THREE.Group();
  world.add(root);
  const H = POS.hub, TS = POS.tesla, SP = POS.spacex, BO = POS.bourse, BA = POS.bank;
  const up = (v, y) => v.clone().add(new THREE.Vector3(0, y, 0));
  const arc = (a, b, h, ya = 4, yb = 4) => {
    const A = up(a, ya), B = up(b, yb);
    return [A, A.clone().lerp(B, 0.3).add(new THREE.Vector3(0, h, 0)), A.clone().lerp(B, 0.7).add(new THREE.Vector3(0, h, 0)), B];
  };

  // --- lignes lumineuses de l'organigramme ----------------------------------------------------------------------------
  const L = {
    ownT: new FlowLine(arc(H, TS, 14, 5, 12), { color: 0x2b7bff, radius: 0.75, speed: 0.22, pulses: 5 }),
    ownS: new FlowLine(arc(H, SP, 14, 5, 12), { color: 0x2b7bff, radius: 0.75, speed: 0.22, pulses: 5 }),
    ctlS: new FlowLine(arc(H, SP, 28, 7, 22), { color: 0xffb81c, radius: 0.55, speed: 0.18, pulses: 3 }),
    valT: new FlowLine(arc(BO, TS, 12, 8, 14), { color: 0xffffff, radius: 0.4, speed: 0.3, pulses: 6 }),
    valS: new FlowLine(arc(BO, SP, 12, 8, 14), { color: 0xffffff, radius: 0.4, speed: 0.3, pulses: 6 }),
    valH: new FlowLine(arc(BO, H, 10, 8, 10), { color: 0xcfe6ff, radius: 0.5, speed: 0.25, pulses: 5 }),
    debt: new FlowLine(arc(H, BA, 10, 5, 8), { color: 0xff4d5e, radius: 0.65, speed: 0.2, pulses: 4 }),
  };
  Object.values(L).forEach((l) => root.add(l.mesh));
  const debtCoins = new FlowCoins(L.debt.curve, { count: 8, size: 0.9, speed: 0.18, lift: 0.5, shape: "bill", color: 0xff8a94 });
  root.add(debtCoins.mesh);

  // autres participations (fantômes, non chiffrées) + liquidités (non documentées) autour du hub
  const ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.2), transparent: true, opacity: 0.14, depthWrite: false });
  const ghosts = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), ghostMat);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.6) }));
    g.add(e);
    g.position.set(H.x + (i ? 13 : -13), 5, H.z + (i ? -13 : 13) * 0.0 + (i ? 4 : -4));
    root.add(g);
    ghosts.push(g);
  }
  const skyline = makeSkyline({ count: 260, inner: 170, outer: 360 });
  root.add(skyline);
  const dust = makeDust(320, { radius: 200, height: 80, seed: 41 });
  root.add(dust);
  const halo = new THREE.Mesh(new THREE.RingGeometry(120, 123, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.blue).multiplyScalar(0.9), transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.2;
  root.add(halo);

  // --- caméra ---------------------------------------------------------------------------------------------------------------
  const kx = POS.bank.x, kz = POS.bank.z;
  const cam = [
    { t: T7.t0 - 0.0, x: kx - 3.8, y: 13, z: kz - 4.2, az: 40, el: 31, zoom: 1.38, e: "io3" },
    { t: T7.t0 + 1.2, x: kx * 0.8, y: 18, z: kz * 0.8, az: 44, el: 33, zoom: 0.78, e: "io3" },
    { t: T7.rise, x: 0, y: 12, z: 26, az: 46, el: 37, zoom: 0.43, e: "io3" },
    { t: T7.net, x: 0, y: 14, z: 24, az: 50, el: 38, zoom: 0.43, e: "io3" },
    { t: T7.line1, x: 0, y: 16, z: 24, az: 55, el: 39, zoom: 0.43, e: "io3" },
    { t: T7.zoom, x: 0, y: 16, z: 22, az: 60, el: 40, zoom: 0.43, e: "io2" },
    { t: T7.end, x: 0, y: 4, z: 0, az: 140, el: 58, zoom: 0.17, e: "io3" },
  ];

  // --- HUD (organigramme animé) -----------------------------------------------------------------------------------------------
  const tag = (id, cls, html, anchor, offset, t0, t1 = T7.zoom + 0.4, enter = "scale") => hud.card({ id, cls, html, anchor, offset, t0, t1, enter });
  const P = (v, y) => () => up(v, y);
  tag("s7-hub", "tag gold bigtag", `<b>ELON MUSK</b><br><span>au centre : possède, contrôle, emprunte</span>`, P(H, 20), [0, -40], T7.rise - 0.3);
  const nw = facts.net_worth;
  const md = (v) => fmt.int(v).replace(/\u202f/g, " ");
  const dt = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  tag("s7-net", "tag gold netag", `<b>Patrimoine net ≈ ${md(nw.headline.value_usd_billions)} Md$</b><br><span>Forbes, ${dt(nw.headline.as_of)} · Bloomberg ≈ ${md(nw.bloomberg.value_usd_billions)} Md$ (${dt(nw.bloomberg.as_of)}) · estimations</span>`, P(H, 42), [0, -62], T7.net);
  tag("s7-tesla", "tag", `<b>TESLA</b><br><span>≈ 11 % des actions (hors restreintes)</span>`, P(TS, 30), [0, -40], T7.tesla);
  tag("s7-spacex", "tag cyan", `<b>SPACEX + IA (xAI)</b><br><span>≈ 38 à 42 % du capital · ≈ 82 % des voix</span>`, P(SP, 44), [0, -40], T7.spacex);
  tag("s7-ai", "tag cyan small", `<b>xAI : intégrée à SpaceX</b><br><span>comptée une seule fois</span>`, P(SP, 22), [150, 44], T7.ai);
  tag("s7-bourse", "tag", `<b>BOURSE</b><br><span>le prix du jour valorise les titres</span>`, P(BO, 32), [-300, 20], T7.value);
  tag("s7-bank", "tag red", `<b>BANQUE · dettes</b><br><span>actions Tesla nanties ≈ 236 M (29 août 2025) ;<br>montant des prêts non publié ; plafond 3,5 Md$</span>`, P(BA, 20), [-470, -150], T7.debts);
  tag("s7-others", "tag cyan small", `<b>Autres participations</b><br><span>Neuralink, The Boring Co. : non chiffrées</span>`, () => up(H, 8).add(new THREE.Vector3(-13, 0, -4)), [-210, 30], T7.others);
  tag("s7-cash", "tag green small", `<b>Liquidités</b><br><span>non documentées de façon fiable</span>`, () => up(H, 8).add(new THREE.Vector3(13, 0, 4)), [200, 40], T7.others + 0.5);

  // légende des lignes
  const leg = [
    ["#2b7bff", "Propriété", "part du capital détenue", T7.own],
    ["#ffb81c", "Contrôle", "droits de vote", T7.control],
    ["#ffffff", "Valorisation", "prix de marché", T7.value],
    ["#ff4d5e", "Dettes", "titres nantis, prêts", T7.debts],
    ["#ffd978", "Patrimoine net", "possédé − dû", T7.net],
  ];
  leg.forEach(([col, name, sub, t0], i) => hud.card({
    id: "s7-leg" + i, cls: "legrow", t0, t1: T7.line1 - 0.3, x: 56, y: 735 + i * 52, align: "left", enter: "right",
    html: `<i style="background:${col}"></i><b>${name}</b> <span>${sub}</span>`,
  }));

  // phrase finale
  hud.card({ id: "s7-final1", cls: "finale", t0: T7.line1, t1: T7.end - 0.9, x: 960, y: 800, enter: "up", inD: 0.8, outD: 0.6, html: `La richesse d'Elon Musk n'est pas un coffre rempli de dollars.` });
  hud.card({ id: "s7-final2", cls: "finale gold", t0: T7.line2, t1: T7.end - 0.9, x: 960, y: 880, enter: "up", inD: 0.8, outD: 0.6, html: `C'est principalement la valeur de ce qu'il possède.` });

  // --- mise à jour -----------------------------------------------------------------------------------------------------------------------
  const update = (t) => {
    const on = t >= T7.t0 - 0.2;
    const drawOf = (t0, d = 1.6) => ease.io2(inv(t0, t0 + d, t));
    const pulseAll = 1;
    L.ownT.update(t, drawOf(T7.tesla), on ? 1 : 0, 0.5);
    L.ownS.update(t, drawOf(T7.spacex), on ? 1 : 0, 0.5);
    L.ctlS.update(t, drawOf(T7.control - 0.4, 2.0), on ? 1 : 0, 0.5);
    L.valT.update(t, drawOf(T7.value, 1.6), on ? 0.9 : 0, 0.5);
    L.valS.update(t, drawOf(T7.value + 0.2, 1.6), on ? 0.9 : 0, 0.5);
    L.valH.update(t, drawOf(T7.value + 0.4, 1.8), on ? 0.9 : 0, 0.5);
    L.debt.update(t, drawOf(T7.debts, 1.8), on ? 1 : 0, 0.5);
    debtCoins.update(t, { alpha: clamp((t - T7.debts - 1.0) * 1.5) * (on ? 1 : 0) });
    ghosts.forEach((g, i) => { const k = ease.outBack(clamp((t - T7.others - i * 0.5) * 1.6)); g.scale.setScalar(Math.max(1e-3, k)); g.rotation.y = t * 0.4 + i; g.visible = on && k > 0.01; });
    skyline.visible = on;
    dust.visible = on;
    dust.position.y = Math.sin(t * 0.3) * 0.6;
    halo.visible = on;
    halo.material.opacity = 0.45 * ease.out2(inv(T7.rise - 1, T7.rise + 1, t));
    root.visible = on;
  };

  world.register({ id: "finale", windows: [[T7.t0 - 0.2, T7.end + 0.5]], pad: 0.3, root, update });
  return { cam, T: T7 };
}
