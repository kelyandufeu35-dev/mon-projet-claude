// SCÈNES 5 et 6 — La banque : coffre (milliardaire ≠ argent liquide) puis prêt garanti par des titres.
// Mécanisme GÉNÉRAL : exemples hypothétiques, aucune opération particulière d'Elon Musk n'est présentée comme un fait.
import * as THREE from "three";
import { applyBuild } from "../core/builder.js";
import { mat, colored, C } from "../core/palette.js";
import { labelTexture } from "../core/world.js";
import { Platform, makeBankShell, makeBankInterior } from "../components/buildings.js";
import { Vault, makeShareBlock, makeCashPile, makePadlock, LineRibbon, Gauge } from "../components/finance.js";
import { Figure, POSES, blend, idle, walk, carry } from "../components/figure.js";
import { FlowLine, FlowCoins, Burst } from "../components/fx.js";
import { ease, inv, clamp, lerp, track, TAU } from "../core/util.js";
import { SC, when } from "../timing.js";
import { POS, at as atLayout } from "../layout.js";

export const T5 = {
  t0: SC.s5.t0,
  t1: SC.s5.t1,
  arrive: SC.s5.t0 + 1.4,
  open: when("s5b", "Ouvrons") - 0.2,
  doorOpen: when("s5b", "Ouvrons") + 0.5,
  tray: when("s5b", "Ouvrons") + 2.0,
  net: when("s5b", "Patrimoine net") - 0.2,
  gains: when("s5b", "Plus-values") - 0.15,
  sell: when("s5c", "Tout vendre") - 0.1,
  tax: when("s5c", "impôts") - 0.15,
  drop: when("s5c", "chuter") - 0.2,
  end: SC.s5.t1,
};
export const T6 = {
  t0: SC.s6.t0,
  t1: SC.s6.t1,
  portfolio: SC.s6.t0 + 1.2,
  pledge: when("s6b", "On dépose") - 0.1,
  lend: when("s6b", "la banque prête") - 0.15,
  interest: when("s6b", "intérêts") - 0.2,
  repay: when("s6b", "puis on rembourse") - 0.2,
  fall: when("s6c", "garanties perdent") - 0.2,
  call: when("s6c", "appel de marge") - 0.3,
  general: when("s6c", "Mécanisme général") - 0.1,
  end: SC.s6.t1,
};

export function buildBank(ctx) {
  const { world, hud } = ctx;
  const root = new THREE.Group();
  root.position.copy(POS.bank);
  world.add(root);

  const platform = new Platform(66, 66, { accent: C.gold });
  root.add(platform.group);

  // --- banque : coque démontable + intérieur --------------------------------------------------------------
  const shell = makeBankShell({ label: "BANQUE" });
  shell.position.set(0, 0.3, 0);
  root.add(shell);
  const interior = makeBankInterior();
  interior.position.set(0, 0.3, 0);
  root.add(interior);

  // --- coffre-fort + plateau coulissant ------------------------------------------------------------------------
  const vault = new Vault(4.4);
  vault.group.position.set(-6, 7.8, -11.7);
  root.add(vault.group);
  const glowRoom = new THREE.Mesh(new THREE.BoxGeometry(11, 11, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(0.8), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glowRoom.position.set(-6, 7.8, -19);
  root.add(glowRoom);
  const tray = new THREE.Group();
  tray.position.set(-6, 1.8, -15);
  root.add(tray);
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 12), mat("metalDark"));
  trayBase.position.y = -0.3;
  trayBase.castShadow = true;
  tray.add(trayBase);
  const trayEdge = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.2, 12.4), mat("goldGlow"));
  trayEdge.position.y = -0.62;
  tray.add(trayEdge);
  const blkT = makeShareBlock("TESLA", { scale: 0.62 });
  blkT.position.set(-3.6, 2.2, -1.6);
  const blkS = makeShareBlock("SPACEX", { scale: 0.62, accent: "#39e0ff" });
  blkS.position.set(3.2, 2.2, -1.6);
  const blkO = makeShareBlock("AUTRES", { scale: 0.46, accent: "#ffd978" });
  blkO.position.set(-0.2, 1.6, 2.2);
  blkT.rotation.y = blkS.rotation.y = blkO.rotation.y = -0.15;
  tray.add(blkT, blkS, blkO);
  // piles de certificats
  const certMat = colored(0xf7f3e8);
  for (let i = 0; i < 3; i++) {
    const pile = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9 + i * 0.5, 1.6), certMat);
    pile.position.set(-5.2 + i * 1.0, 0.45 + i * 0.25, 3.6);
    pile.castShadow = true;
    tray.add(pile);
  }
  // le petit tas de billets (liquidités)
  const cash = makeCashPile({ cols: 2, rows: 2, layers: 1, scale: 0.8 });
  cash.position.set(5.0, 0.1, 3.2);
  tray.add(cash);
  const cashLabel = new THREE.Object3D();
  cashLabel.position.set(5.0, 2.2, 3.2);
  tray.add(cashLabel);

  // --- schéma patrimoine net / dettes -----------------------------------------------------------------------------------
  const bal = new THREE.Group();
  const colA = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 3.4), new THREE.MeshLambertMaterial({ color: 0x2b5fc8 }));
  const colAghost = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.2), transparent: true, opacity: 0.28, depthWrite: false }));
  const colAghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.8) }));
  const colCash = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 3.4), new THREE.MeshLambertMaterial({ color: 0x4fcf8a }));
  const colD = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 3.4), new THREE.MeshLambertMaterial({ color: 0xd94455 }));
  const colN = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(1.4) }));
  colA.position.x = -6; colAghost.position.x = -6; colAghostEdges.position.x = -6; colCash.position.x = -6; colD.position.x = 0; colN.position.x = 6;
  for (const m of [colA, colCash, colD, colN]) m.castShadow = true;
  bal.add(colA, colAghost, colAghostEdges, colCash, colD, colN);
  const base = new THREE.Mesh(new THREE.BoxGeometry(17, 0.3, 5), mat("metalDark"));
  base.position.set(0, -0.15, 0);
  bal.add(base);
  bal.position.set(10, 1.6, 5);
  bal.rotation.y = 0;
  root.add(bal);

  // --- vente massive : bloc, taxe, mini-écran -----------------------------------------------------------------------------
  const sellBlock = makeShareBlock("TITRES", { scale: 0.7, accent: "#58b4ff" });
  root.add(sellBlock);
  const taxChunk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.red).multiplyScalar(1.5) }));
  root.add(taxChunk);
  const worker = new Figure({ scale: 2.3, shirt: 0x1a2236, jacket: 0x1a2236, pants: 0x1b2030, tie: 0xffb81c });
  root.add(worker.root);
  const monitor = new THREE.Group();
  monitor.position.set(-14, 9, -11.3);
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.4), new THREE.MeshBasicMaterial({ color: 0x050b18 }));
  monitor.add(mon);
  const monLine = new LineRibbon(60, { width: 11.6, depth: 0.2, thick: 0.28, color: C.red, fill: C.red, fillOpacity: 0.14 });
  monLine.group.position.z = 0.1;
  monitor.add(monLine.group);
  root.add(monitor);
  const taxBurst = new Burst(50, { size: 0.45, color: 0xff4d5e, gravity: 8, speed: 9, life: 1.5, seed: 12 });
  root.add(taxBurst.mesh);

  // --- SCÈNE 6 : portefeuille, coffre-garantie, emprunteur, flux ------------------------------------------------------------
  const P = (a, b, y = 0) => atLayout(a, b, y);
  const portPos = P(-36, 2), safePos = P(-13, 6), bankFront = P(4, 20), borrowerPos = P(31, 4), bankPos = P(2, 31);
  const portfolio = new THREE.Group();
  portfolio.position.copy(portPos);
  portfolio.rotation.y = Math.PI / 4;
  root.add(portfolio);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 7), mat("metalDark"));
  shelf.position.y = 1.3;
  portfolio.add(shelf);
  const pBlocks = [];
  const accents = ["#58b4ff", "#39e0ff", "#ffd978", "#2bd67b", "#ff8a3d", "#c08bff"];
  for (let i = 0; i < 6; i++) {
    const b = makeShareBlock("ACTION " + "ABCDEF"[i], { scale: 0.62, accent: accents[i] });
    b.position.set(-7.6 + (i % 3) * 7.6, 4.2 + Math.floor(i / 3) * 4.0, 0.2);
    portfolio.add(b);
    pBlocks.push(b);
  }
  const safe = new THREE.Group();
  safe.position.copy(safePos);
  safe.rotation.y = Math.PI / 4;
  root.add(safe);
  const safeGlass = new THREE.Mesh(new THREE.BoxGeometry(18, 9.5, 6.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(0.7), transparent: true, opacity: 0.16, depthWrite: false }));
  safeGlass.position.y = 5.2;
  safe.add(safeGlass);
  safe.add(Object.assign(new THREE.LineSegments(new THREE.EdgesGeometry(safeGlass.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.8) })), {}));
  safe.children[1].position.y = 5.2;
  const safeBase = new THREE.Mesh(new THREE.BoxGeometry(19, 0.8, 7.5), mat("metalDark"));
  safeBase.position.y = 0.4;
  safe.add(safeBase);
  const locks = [];
  for (let i = 0; i < 4; i++) {
    const l = makePadlock(0.7);
    l.position.set(-6.6 + i * 4.4, 5.2, 3.5);
    safe.add(l);
    locks.push(l);
  }
  const collateral = [];
  for (let i = 0; i < 4; i++) {
    const b = makeShareBlock("ACTION " + "ABCD"[i], { scale: 0.62, accent: accents[i] });
    b.visible = false;
    root.add(b);
    collateral.push(b);
  }
  const borrower = new Figure({ scale: 2.0, shirt: 0x3a5a9a, pants: 0x1b2030, hair: "hair", tie: null });
  borrower.place(borrowerPos.x, 0.3, borrowerPos.z, -Math.PI / 4 + Math.PI / 2 + 0.2);
  root.add(borrower.root);
  const safeS7 = new THREE.Vector3(0, 0.3, 31);
  const bankDoor = bankFront.clone();
  // flux : titres -> coffre ; banque -> emprunteur (prêt) ; emprunteur -> banque (intérêts, remboursement)
  const flowLoan = new FlowLine([P(2, 22, 5), P(12, 14, 9), P(24, 8, 8), P(30, 4, 6)], { color: 0x2bd67b, radius: 0.5, speed: 0.26, pulses: 4 });
  const flowBack = new FlowLine([P(31, 4, 4), P(26, 10, 6), P(14, 18, 6), P(5, 22, 4)], { color: 0xffb81c, radius: 0.45, speed: 0.3, pulses: 5 });
  const flowPledge = new FlowLine([P(-36, 2, 7), P(-28, 4, 11), P(-20, 6, 11), P(-13, 6, 8)], { color: 0x58b4ff, radius: 0.5, speed: 0.3, pulses: 4 });
  root.add(flowLoan.mesh, flowBack.mesh, flowPledge.mesh);
  const coinsLoan = new FlowCoins(flowLoan.curve, { count: 12, size: 1.1, color: 0x78d99a, shape: "bill", speed: 0.25, lift: 0 });
  const coinsInt = new FlowCoins(flowBack.curve, { count: 9, size: 0.8, speed: 0.22, lift: 0 });
  const coinsRepay = new FlowCoins(flowBack.curve, { count: 14, size: 1.2, color: 0x78d99a, shape: "bill", speed: 0.28, lift: 0 });
  root.add(coinsLoan.mesh, coinsInt.mesh, coinsRepay.mesh);
  const gauge = new Gauge(5.2);
  gauge.group.position.copy(safePos).add(new THREE.Vector3(0, 17, 0));
  gauge.group.rotation.y = Math.PI / 4;
  root.add(gauge.group);
  const alarm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.red).multiplyScalar(1.8) }));
  alarm.position.copy(safePos).add(new THREE.Vector3(11, 11, 0));
  root.add(alarm);
  const alarmCone = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.red).multiplyScalar(0.9), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  alarmCone.position.copy(alarm.position).add(new THREE.Vector3(0, -6, 0));
  alarmCone.rotation.x = Math.PI;
  root.add(alarmCone);
  const miniChart = new THREE.Group();
  miniChart.position.copy(safePos).add(new THREE.Vector3(-13, 14, -6));
  miniChart.rotation.y = Math.PI / 4;
  const mcBack = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ color: 0x050b18, transparent: true, opacity: 0.8 }));
  miniChart.add(mcBack);
  const mcLine = new LineRibbon(60, { width: 14, depth: 0.2, thick: 0.35, color: C.cyan, fill: C.blue, fillOpacity: 0.15 });
  mcLine.group.position.z = 0.1;
  miniChart.add(mcLine.group);
  root.add(miniChart);
  const marginBurst = new Burst(60, { size: 0.5, color: 0xff4d5e, gravity: 6, speed: 10, life: 1.6, seed: 31 });
  root.add(marginBurst.mesh);

  // valeur des garanties (hypothétique) : 100 -> 100 -> 62 (chute), seuil d'appel de marge à 72
  const collat = track([[T6.t0, 100], [T6.fall, 100], [T6.fall + 2.4, 62, ease.io3], [T6.end, 62]]);
  const ltv = (v) => 25 / v; // prêt 25 / valeur
  const gaugeK = (v) => clamp((ltv(v) - 0.2) / 0.2); // 0.25 -> 0.25 ; 25/62=0.40 -> 1

  // --- caméra --------------------------------------------------------------------------------------------------------------------------
  const kx = POS.bank.x, kz = POS.bank.z;
  const sh = (x, z, d) => ({ x: x + -d * 0.7071, z: z + d * 0.7071 });
  const at6 = (a, b) => ({ x: kx + (a - b) * 0.7071, z: kz + (-a - b) * 0.7071 });
  const cam = [
    { t: T5.t0, x: POS.bourse.x + 1 - 0.0, y: 12, z: POS.bourse.z + 12, az: 46, el: 31, zoom: 1.26, e: "io3" },
    { t: T5.t0 + 0.7, x: (POS.bourse.x + kx) / 2, y: 20, z: (POS.bourse.z + kz) / 2, az: 45, el: 33, zoom: 0.45, e: "io3" },
    { t: T5.arrive, x: kx, y: 10, z: kz + 3, az: 45, el: 31, zoom: 0.95, e: "io3" },
    { t: T5.open - 0.1, x: kx, y: 10, z: kz + 3, az: 44, el: 31, zoom: 1.0, e: "io3" },
    { t: T5.doorOpen + 0.2, x: kx - 6, y: 8, z: kz - 7, az: 26, el: 27, zoom: 2.3, e: "io3" },
    { t: T5.tray + 1.0, x: kx - 3, y: 5, z: kz - 2, az: 30, el: 29, zoom: 2.0, e: "io3" },
    { t: T5.net, ...sh(kx + 3, kz + 0, 6), y: 5, az: 34, el: 31, zoom: 1.85, e: "io3" },
    { t: T5.gains + 1.2, ...sh(kx + 6, kz + 2, 6), y: 6, az: 38, el: 32, zoom: 2.0, e: "io3" },
    { t: T5.sell, ...sh(kx - 1, kz - 2, 2), y: 5, az: 30, el: 30, zoom: 1.95, e: "io3" },
    { t: T5.end, ...sh(kx - 3, kz - 2, 1), y: 5, az: 30, el: 30, zoom: 1.95, e: "io3" },
    // scène 6
    { t: T6.t0, x: kx - 8, y: 9, z: kz - 8, az: 45, el: 33, zoom: 0.92, e: "io3" },
    { t: T6.pledge - 0.4, x: kx - 8, y: 9, z: kz - 8, az: 45, el: 33, zoom: 0.96, e: "io3" },
    { t: T6.pledge + 1.2, ...at6(-18, 5), y: 9, az: 45, el: 33, zoom: 1.2, e: "io3" },
    { t: T6.lend, ...at6(0, 10), y: 9, az: 45, el: 33, zoom: 1.0, e: "io3" },
    { t: T6.repay + 1.0, ...at6(8, 10), y: 9, az: 46, el: 33, zoom: 1.0, e: "io3" },
    { t: T6.fall, ...at6(-14, 6), y: 12, az: 42, el: 32, zoom: 1.3, e: "io3" },
    { t: T6.end, ...at6(-14, 6), y: 13, az: 40, el: 31, zoom: 1.38, e: "io3" },
  ];

  // --- HUD scène 5 ---------------------------------------------------------------------------------------------------------------------------
  const A = (v) => () => v.clone().add(POS.bank);
  const balAnchor = (dx, y) => () => new THREE.Vector3(POS.bank.x + 10 + dx, 1.6 + y, POS.bank.z + 5);
  hud.card({
    id: "s5-q", cls: "pill", t0: T5.arrive + 0.2, t1: T5.open + 0.4, x: 960, y: 200, enter: "down",
    html: `Qu'y a-t-il dans le coffre ?<br><span>des montagnes de billets…</span>`,
  });
  hud.card({
    id: "s5-actions", cls: "tag", t0: T5.tray + 0.8, t1: T5.sell - 0.2, enter: "up",
    anchor: () => new THREE.Vector3(POS.bank.x - 6, 9, POS.bank.z + 2), offset: [-30, -170],
    html: `<b>Surtout des actions et des participations</b><br><span>des titres valorisés, pas des billets</span>`,
  });
  hud.card({
    id: "s5-cash", cls: "tag green", t0: T5.tray + 1.4, t1: T5.sell - 0.2, enter: "right",
    anchor: () => cashLabel.getWorldPosition(new THREE.Vector3()), offset: [190, -20],
    html: `<b>Liquidités</b><br><span>aucun chiffre fiable trouvé pour Elon Musk :<br>rien d'affiché</span>`,
  });
  hud.card({
    id: "s5-defA", cls: "tag", t0: T5.net - 0.6, t1: T5.sell - 0.2, enter: "left",
    anchor: balAnchor(-6, 9), offset: [-200, -30],
    html: `<b>Actions et participations</b><br><span>valeur estimée au cours du jour</span>`,
  });
  hud.card({
    id: "s5-defD", cls: "tag red", t0: T5.net, t1: T5.sell - 0.2, enter: "up",
    anchor: balAnchor(0, 7), offset: [40, -90],
    html: `<b>Dettes</b><br><span>ce que l'on doit</span>`,
  });
  hud.card({
    id: "s5-defN", cls: "tag gold", t0: T5.net + 0.5, t1: T5.sell - 0.2, enter: "right",
    anchor: balAnchor(6, 7), offset: [180, -40],
    html: `<b>Patrimoine net</b><br><span>= ce que l'on possède − ce que l'on doit</span>`,
  });
  hud.card({
    id: "s5-gain", cls: "tag cyan", t0: T5.gains, t1: T5.sell - 0.2, enter: "left",
    anchor: balAnchor(-6, 15), offset: [-220, -20],
    html: `<b>Plus-values non réalisées</b><br><span>gains « sur le papier » tant que les titres ne sont pas vendus</span>`,
  });
  hud.card({
    id: "s5-tax", cls: "tag red", t0: T5.tax, t1: T5.end - 0.1, enter: "up",
    anchor: () => new THREE.Vector3(POS.bank.x - 6, 11, POS.bank.z + 8), offset: [240, -30],
    html: `<b>Impôts</b> sur les plus-values<br><span>une vente massive a un coût fiscal</span>`,
  });
  hud.card({
    id: "s5-drop", cls: "tag red", t0: T5.drop, t1: T5.end - 0.1, enter: "left",
    anchor: () => new THREE.Vector3(POS.bank.x - 14, 12, POS.bank.z - 11), offset: [-260, 60],
    html: `<b>Le cours chute</b><br><span>vendre en masse pèse sur le marché</span>`,
  });

  // --- HUD scène 6 -----------------------------------------------------------------------------------------------------------------------------
  hud.card({
    id: "s6-gen", cls: "pill card-left", t0: T6.t0 + 0.6, t1: T6.end - 0.2, x: 56, y: 168, align: "left", enter: "right",
    html: `<b>Mécanisme général</b> · exemple hypothétique<br><span>aucune opération particulière d'Elon Musk<br>n'est présentée ici comme un fait</span>`,
  });
  hud.card({
    id: "s6-port", cls: "tag", t0: T6.portfolio + 0.6, t1: T6.pledge + 1.2, enter: "right",
    anchor: () => portPos.clone().add(POS.bank).add(new THREE.Vector3(0, 12, 0)), offset: [-20, -60],
    html: `<b>Portefeuille d'actions</b><br><span>valeur des titres : <i>100</i> (hypothétique)</span>`,
  });
  hud.card({
    id: "s6-collat", cls: "tag", t0: T6.pledge + 0.9, t1: T6.end - 0.2, enter: "up",
    anchor: () => safePos.clone().add(POS.bank).add(new THREE.Vector3(0, 11, 0)), offset: [-40, 90],
    html: `<b>1 · Actions en garantie</b><br><span>déposées chez la banque</span>`,
    dyn: (t, el) => { const v = collat(t); el.querySelector("span").innerHTML = `valeur des garanties : <i>${v.toFixed(0)}</i>`; },
  });
  hud.card({
    id: "s6-loan", cls: "tag green", t0: T6.lend, t1: T6.end - 0.2, enter: "left",
    anchor: () => borrowerPos.clone().add(POS.bank).add(new THREE.Vector3(0, 10, 0)), offset: [-10, -60],
    html: `<b>2 · L'argent emprunté</b><br><span>prêt : <i>25</i> = 25 % de la valeur des titres</span>`,
  });
  hud.card({
    id: "s6-int", cls: "tag gold", t0: T6.interest, t1: T6.end - 0.2, enter: "left",
    anchor: () => P(20, 12, 6).clone().add(POS.bank), offset: [90, 40],
    html: `<b>3 · Les intérêts</b><br><span>versés régulièrement à la banque</span>`,
  });
  hud.card({
    id: "s6-repay", cls: "tag cyan", t0: T6.repay, t1: T6.fall - 0.3, enter: "up",
    anchor: () => P(10, 18, 7).clone().add(POS.bank), offset: [-60, 40],
    html: `<b>4 · Le remboursement</b><br><span>les actions sont libérées</span>`,
  });
  hud.card({
    id: "s6-call", cls: "margincall", t0: T6.call, t1: T6.end - 0.2, x: 960, y: 190, enter: "scale",
    html: `<div class="mc-t">⚠ APPEL DE MARGE</div><div class="mc-s">si la valeur des garanties tombe trop bas, la banque exige<br>des titres supplémentaires ou un remboursement</div>`,
  });

  // --- mise à jour ---------------------------------------------------------------------------------------------------------------------------------
  const update = (t) => {
    const in5 = t < T5.end + 0.2;
    const inRange = t < T6.end + 1.2;
    platform.setPower(ease.out2(inv(T5.t0 + 0.3, T5.t0 + 1.8, t)));
    // coque : apparaît, puis se démonte (ouverture), puis se remonte (scène 6)
    const build = ease.io2(inv(T5.t0 + 0.7, T5.t0 + 2.0, t));
    const undo = ease.io2(inv(T5.open, T5.open + 1.6, t));
    const redo = ease.io2(inv(T6.t0 + 0.2, T6.t0 + 1.9, t));
    const hold = t > T6.t0 ? lerp(0.2, 1, redo) : lerp(1, 0.2, undo);
    const s6 = t >= T6.t0 - 0.05 && t < SC.s7.t0 - 0.05;
    shell.position.set(s6 ? bankPos.x : 0, 0.3, s6 ? bankPos.z : 0);
    shell.scale.setScalar(s6 ? 0.62 : 1);
    applyBuild(shell, Math.min(build, hold), { overlap: 0.45, dropHeight: 50 });
    interior.visible = t > T5.open - 0.4 && t < T6.t0 - 0.05;
    // coffre
    const vk = ease.io3(inv(T5.doorOpen - 0.2, T5.doorOpen + 1.8, t));
    vault.set(vk);
    vault.group.visible = t < T6.t0 - 0.05;
    glowRoom.visible = t < T6.t0 - 0.05;
    glowRoom.material.opacity = 0.2 * ease.smooth(inv(T5.doorOpen + 0.6, T5.doorOpen + 1.4, t)) * (1 - ease.smooth(inv(T5.sell, T5.sell + 1, t)));
    // plateau : sort du coffre
    const tk = ease.io3(inv(T5.tray, T5.tray + 1.7, t));
    tray.position.z = lerp(-15, 1.5, tk);
    tray.visible = t > T5.doorOpen && in5 && t < T5.sell + 2.5;
    [blkT, blkS, blkO].forEach((b, i) => { b.position.y = (i === 2 ? 1.6 : 2.2) + Math.sin(t * 1.6 + i) * 0.12; });
    // schéma
    const bk = ease.outBack(clamp((t - T5.net + 0.5) * 1.6), 1.1);
    const gk = ease.io3(inv(T5.gains, T5.gains + 1.4, t));
    bal.visible = in5 && bk > 0.01 && t < T5.sell + 0.4;
    const hA = 10 * bk, hCash = 0.9 * bk, hD = 4.2 * bk, hGain = 4.6 * gk * bk;
    colA.scale.y = Math.max(1e-3, hA); colA.position.y = hA / 2;
    colCash.scale.y = Math.max(1e-3, hCash); colCash.position.set(-6, hA + hCash / 2, 0); colCash.position.x = -6; colCash.scale.set(0.7, Math.max(1e-3, hCash), 0.7);
    colAghost.scale.y = Math.max(1e-3, hGain); colAghost.position.y = hA + hCash + hGain / 2;
    colAghostEdges.scale.set(3.4, Math.max(1e-3, hGain), 3.4); colAghostEdges.position.y = hA + hCash + hGain / 2;
    colD.scale.y = Math.max(1e-3, hD); colD.position.y = hD / 2;
    const hN = Math.max(0.01, (hA - hD) * ease.out3(inv(T5.net + 0.2, T5.net + 1.4, t)));
    colN.scale.y = hN; colN.position.y = hN / 2;

    // vente massive
    const sk = inv(T5.sell, T5.sell + 2.2, t);
    sellBlock.visible = worker.root.visible = in5 && sk > 0 && sk < 1.2 || (in5 && t >= T5.sell);
    const wx = lerp(-14, -5, ease.io2(sk)), wz = lerp(1, 6, ease.io2(sk));
    worker.root.position.set(wx, 0.3, wz + 3);
    worker.root.rotation.y = Math.PI / 3;
    worker.apply(t > T5.sell ? carry(t, 0) : { ...POSES.stand });
    sellBlock.position.set(wx + 2.4, 5.4, wz + 4.4);
    sellBlock.rotation.y = 0.8;
    const shrink = 1 - 0.35 * ease.io2(inv(T5.tax, T5.tax + 0.8, t)) - 0.25 * ease.io2(inv(T5.drop, T5.drop + 1.0, t));
    sellBlock.scale.setScalar(0.62 * shrink);
    const tx = ease.out2(inv(T5.tax, T5.tax + 1.2, t));
    taxChunk.visible = in5 && tx > 0.001;
    taxChunk.position.set(wx + 4.6 + tx * 6, 6.0 + tx * 4, wz + 4.4 - tx * 5);
    taxChunk.rotation.set(tx * 3, tx * 4, 0);
    taxChunk.scale.setScalar(1 - 0.6 * inv(T5.tax + 1.2, T5.tax + 2.4, t));
    taxBurst.update(t, T5.tax + 0.1, [wx + 4, 6, wz + 4.4]);
    monitor.visible = t > T5.sell - 0.6 && in5;
    monLine.update((u) => 2.4 - 4.0 * ease.io2(clamp((u - 0.35) / 0.5)) * ease.smooth(inv(T5.drop - 0.6, T5.drop + 0.8, t)) + Math.sin(u * 40 + t * 3) * 0.12, clamp((t - (T5.sell - 0.4)) * 0.9));
    monLine.group.position.x = -5.8;

    // ===== scène 6 =====
    const k6 = t >= T6.t0 - 0.2;
    // portefeuille
    const pk = ease.outBack(clamp((t - T6.portfolio) * 1.5), 1.1);
    portfolio.visible = k6 && inRange && t < T6.end + 1.0 && pk > 0.01;
    portfolio.scale.setScalar(Math.max(1e-3, pk));
    const inS7 = t >= SC.s7.t0 - 0.05;
    safe.visible = (k6 && inRange && pk > 0.01) || inS7;
    safe.position.copy(inS7 ? safeS7 : safePos);
    const sa = ease.outBack(clamp((t - T6.portfolio - 0.3) * 1.5), 1.1);
    safe.scale.setScalar(Math.max(1e-3, inS7 ? 1 : sa));
    // garanties : 4 blocs glissent du portefeuille vers le coffre vitré ; rendus au remboursement ; redéposés
    // juste avant la chute de valeur (le prêt est alors en cours : c'est là que l'appel de marge peut survenir)
    const val = collat(t);
    const eOf = (i) => {
      const s1 = inv(T6.pledge + i * 0.28, T6.pledge + 1.2 + i * 0.28, t);
      const back = ease.io3(inv(T6.repay + 0.2 + i * 0.2, T6.repay + 1.2 + i * 0.2, t));
      const e1 = ease.io3(s1) * (1 - back);
      const e2 = ease.io3(inv(T6.fall - 1.1 + i * 0.12, T6.fall - 0.35 + i * 0.12, t));
      return inS7 ? 1 : Math.max(e1, e2);
    };
    collateral.forEach((b, i) => {
      const e = eOf(i);
      b.visible = k6 && (inRange || inS7) && e > 0.001;
      const from = portPos.clone().add(new THREE.Vector3(-7.6 + (i % 3) * 7.6, 6 + Math.floor(i / 3) * 4.0, 0));
      const lx = -6.6 + i * 4.4;
      const to = (inS7 ? safeS7 : safePos).clone().add(new THREE.Vector3(lx * 0.7071, 5.6, -lx * 0.7071));
      b.position.set(lerp(from.x, to.x, e), lerp(from.y, to.y, e) + Math.sin(e * Math.PI) * 4, lerp(from.z, to.z, e));
      const sc = 0.62 * (inS7 ? 1 : clamp(val / 100, 0.55, 1));
      b.scale.setScalar(Math.max(1e-3, sc));
      b.rotation.y = e * 1.2 + Math.PI / 4 * (1 - e);
    });
    locks.forEach((l, i) => {
      const kk1 = ease.outBack(clamp((t - T6.pledge - 0.9 - i * 0.2) * 3)) * (1 - ease.io3(inv(T6.repay + 0.8, T6.repay + 1.4, t)));
      const kk2 = ease.outBack(clamp((t - (T6.fall - 0.4) - i * 0.1) * 3));
      const kk = inS7 ? 1 : Math.max(kk1, kk2);
      l.scale.setScalar(Math.max(1e-3, 0.7 * kk));
      l.visible = kk > 0.01 && (k6 || inS7);
    });
    pBlocks.forEach((b, i) => { b.visible = i < 4 ? eOf(i) < 0.5 : true; });
    // flux
    const fP = ease.io2(inv(T6.pledge - 0.2, T6.pledge + 1.4, t)) * (1 - ease.io2(inv(T6.pledge + 1.8, T6.pledge + 2.6, t)));
    flowPledge.update(t, 1, k6 ? fP : 0, 0.5);
    const fL = ease.io2(inv(T6.lend, T6.lend + 1.2, t));
    flowLoan.update(t, k6 ? fL : 0.0001, k6 ? 1 - ease.io2(inv(T6.repay + 1.6, T6.repay + 2.4, t)) : 0, 0.8);
    coinsLoan.update(t, { alpha: k6 ? clamp((t - T6.lend - 0.3) * 2) * (1 - clamp((t - T6.repay - 0.6) * 2)) : 0 });
    const fB = ease.io2(inv(T6.interest, T6.interest + 1.0, t));
    flowBack.update(t, k6 ? fB : 0.0001, k6 ? 1 - ease.io2(inv(T6.fall - 0.4, T6.fall + 0.3, t)) : 0, 0.6);
    coinsInt.update(t, { alpha: k6 ? clamp((t - T6.interest - 0.2) * 2) * (1 - clamp((t - T6.repay) * 3)) : 0 });
    coinsRepay.update(t, { alpha: k6 ? clamp((t - T6.repay - 0.2) * 2) * (1 - clamp((t - T6.fall + 0.2) * 2)) : 0 });
    // appel de marge
    const gk6 = ease.out3(inv(T6.fall - 0.4, T6.fall + 0.6, t));
    gauge.group.visible = k6 && gk6 > 0.01 && inRange;
    gauge.group.scale.setScalar(Math.max(1e-3, gk6));
    gauge.set(clamp(lerp(0.12, gaugeK(val), 1)));
    const danger = ease.smooth(inv(T6.call - 0.8, T6.call + 0.2, t));
    const blink = 0.5 + 0.5 * Math.sin(t * 14);
    alarm.visible = k6 && danger > 0.01 && inRange;
    alarm.scale.setScalar(Math.max(1e-3, danger * (0.8 + 0.4 * blink)));
    alarmCone.material.opacity = danger * 0.28 * (0.4 + 0.6 * blink);
    alarmCone.visible = alarm.visible;
    miniChart.visible = k6 && gk6 > 0.01 && inRange;
    miniChart.scale.setScalar(Math.max(1e-3, gk6));
    mcLine.update((u) => (collat(T6.fall - 1.5 + u * 4.5) - 80) * 0.18, 1);
    marginBurst.update(t, T6.call + 0.1, [safePos.x + 8, 9, safePos.z]);
    borrower.apply({ ...blend(POSES.stand, POSES.cheer, 0), ...idle(t, 0.3) });
    borrower.root.visible = k6 && inRange && sa > 0.01;
    const bor = blend({}, POSES.shrug, danger);
    borrower.apply({ ...bor, bob: idle(t).bob });
  };

  world.register({ id: "bank", windows: [[T5.t0 - 0.2, T6.end + 1.2], [SC.s7.t0, SC.s7.t1]], pad: 1.2, root, update });
  return { cam, T5, T6 };
}
