/* NEXALOG — préparation (bras robotisés), expédition, ouvriers, trafic, produit héros */
(function () {
  const E = window.ENG, Wd = window.WORLD;
  const { Box, clamp, lerp, sm, sm5, prog, eio, eout, rng } = E;
  const { PAL, UP, OV, G, box, PATH, CH, GD } = Wd;
  const { mkPath, pathAt, PA, setB, partAt, newBox, join, chamfer } = PATH;
  const { mkRoute, routeAtH, dockXf, wAng, Truck, trucks, TR_L, agvGlow, AGV, HERO } = Wd;
  const KRAFT = Wd.KRAFT;

  /* =================== CELLULES DE PRÉPARATION =================== */
  const CELLS = [520, 400, 280, 160];
  const FEED_Y = 585, BASE_Y = 650, TABLE_Y = 722, OUT_Y = 770;
  const PERIOD = 2.8, L1 = 78, L2 = 74, SH_Z = 56;
  const cells = [];
  // dock assignment
  const pend = []; // paquets sortants
  CELLS.forEach((xc, ci) => {
    // table de conditionnement + embase du bras
    box({ x: xc - 34, y: TABLE_Y - 26, w: 68, d: 52, z: 0, h: 24, c: "#2d4f98", top: "#16275a", edge: "rgba(34,225,255,0.6)", sideC: "#2a56ab" });
    box({ x: xc - 12, y: BASE_Y - 12, w: 24, d: 24, z: 0, h: 38, c: "#0e1d45", top: "#1d3470", edge: "rgba(34,225,255,0.55)", band: ["rgba(34,225,255,0.95)", 0.15, 0.25] });
    box({ x: xc - 22, y: BASE_Y - 22, w: 44, d: 44, z: 0, h: 8, c: "#0a1636", top: "#1c3166" });
    // cadre de la cellule (portique de sécurité)
    box({ x: xc - 60, y: FEED_Y + 28, w: 6, d: 6, z: 0, h: 30, c: "#ffd23f", top: "#ffe58a" });
    box({ x: xc + 54, y: FEED_Y + 28, w: 6, d: 6, z: 0, h: 30, c: "#ffd23f", top: "#ffe58a" });
    const cell = { xc, ci, parcels: [], packs: [] };
    cells.push(cell);
  });
  // planning des arrivées (pour chaque cellule)
  const T_ARR0 = [35.2, 34.6, 34.0, 33.5];
  const TOUT = 56;
  const feedRoute = (ci) => (ci % 2 ? Wd.route.R1 : Wd.route.R1);
  cells.forEach((cell, ci) => {
    cell.arr = [];
    for (let k = 0; ; k++) {
      const tk = T_ARR0[ci] + k * PERIOD;
      if (tk > TOUT + 2) break;
      cell.arr.push(tk);
    }
    // point d'arrêt sur la route R1 (x = xc, y = FEED_Y)
    const path = Wd.route.R1;
    let best = 0, bd = 1e9;
    for (let s = 0; s < path.len; s += 1) { pathAt(path, s); const d = Math.hypot(PA.x - cell.xc, PA.y - FEED_Y); if (d < bd) { bd = d; best = s; } }
    cell.stopS = best;
  });
  // colis d'entrée
  const HERO_CELL = 0, HERO_K = 1;
  cells.forEach((cell, ci) => {
    cell.arr.forEach((tk, k) => {
      const speed = 165;
      const t0 = tk - cell.stopS / speed;
      const par = Wd.addParcel(Wd.route.R1, t0, speed, 0, { stopS: cell.stopS, until: tk + 0.3 });
      par.cell = ci; par.k = k; par.tk = tk;
      if (ci === HERO_CELL && k === HERO_K) { par.hero = true; par.b.c = "#ff8a1f"; par.b.top = "#ffc27a"; par.b.w = 30; par.b.d = 26; par.b.h = 22; }
    });
  });
  const hero = { par: null };
  hero.par = Wd.parcels.find((p) => p.hero);
  HERO.parcel = hero.par;
  HERO.tConv0 = hero.par.t0;
  HERO.tPick = cells[0].arr[HERO_K];

  /* ---------- bras ---------- */
  function armPose(ph, cell) {
    // ph : temps relatif à l'arrivée du colis ; retourne r, z, yaw
    const K = [
      [-0.9, 78, 44, Math.PI / 2], [-0.3, 66, 104, -Math.PI / 2 + 0.05], [0.12, 66, 36, -Math.PI / 2], [0.35, 66, 36, -Math.PI / 2],
      [0.85, 70, 108, -Math.PI / 2 + 0.2], [1.35, 78, 104, Math.PI / 2 - 0.25], [1.75, 78, 44, Math.PI / 2], [1.95, 78, 44, Math.PI / 2],
    ];
    let i = 0;
    while (i < K.length - 2 && ph > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1];
    const u = clamp((ph - a[0]) / (b[0] - a[0]), 0, 1), e = eio(u);
    return { r: lerp(a[1], b[1], e), z: lerp(a[2], b[2], e), yaw: lerp(a[3], b[3], e) };
  }
  class Arm {
    constructor(xc) {
      this.xc = xc;
      this.base = newBox({ c: "#1f3d86", top: "#3a62c4", edge: "rgba(34,225,255,0.7)", bias: 30 });
      this.grip = newBox({ c: "#0e1d45", top: "#22e1ff", edge: "rgba(255,255,255,0.7)", bias: 60 });
      this.segs = [];
      this.carry = null;
    }
  }
  const arms = CELLS.map((xc) => new Arm(xc));
  // dessin personnalisé du bras
  class ArmDraw {
    constructor(arm, ci) { this.arm = arm; this.ci = ci; this.k = 0; }
    draw(t) {
      const arm = this.arm, a = arm.pose; if (!a) return;
      const ctx = E.ctx;
      const dx = Math.cos(a.yaw), dy = Math.sin(a.yaw);
      const bx = arm.xc, by = BASE_Y;
      const tr = a.r, tz = a.z - SH_Z;
      let d = Math.hypot(tr, tz); d = Math.min(d, L1 + L2 - 2);
      const sa = Math.atan2(tz, tr) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const ex = bx + dx * Math.cos(sa) * L1, ey = by + dy * Math.cos(sa) * L1, ez = SH_Z + Math.sin(sa) * L1;
      const wx = bx + dx * tr, wy = by + dy * tr, wz = a.z;
      // épaule
      E.limb(bx, by, 36, bx, by, SH_Z, 14, "#2a5fe0");
      E.ball(bx, by, SH_Z, 11, "#22e1ff");
      E.limb(bx, by, SH_Z, ex, ey, ez, 11, "#ff8a1f");
      E.ball(ex, ey, ez, 9, "#22e1ff");
      E.limb(ex, ey, ez, wx, wy, wz + 8, 9, "#ffa246");
      // préhenseur
      E.limb(wx, wy, wz + 8, wx, wy, wz - 2, 14, "#0e1d45");
      E.ball(wx, wy, wz - 3, 6, "#22e1ff");
      arm.tip = [wx, wy, wz];
      if (arm.vacuum) E.glow(wx, wy, wz - 4, 38, "#22e1ff", 0.5);
    }
    key() { E.P(this.arm.xc, BASE_Y, 90); return E.pd() + 150; }
  }
  const armDraws = arms.map((a, i) => new ArmDraw(a, i));

  // paquets conditionnés → vers les quais
  const packs = [];
  const E_DOCK_TIMES = []; // sera rempli ci-dessous
  const eStart = [26.0, 31.0, 36.5];
  const eDock = eStart.map((s) => s + 8.15);
  const eLeave = [46.5, 49.4, 53.6];
  // attribution des quais
  function pickDock(tArr, n, isHero) {
    if (isHero) return 1;
    if (tArr < 44.6) return n % 2 ? 1 : 0;
    if (tArr < 46.4) return n % 2 ? 1 : 2;
    if (tArr < 49.0) return n % 2 ? 1 : 2;
    return 2;
  }
  let packN = 0;
  const paths = {};
  function packPath(xc, dock) {
    const key = xc + "_" + dock;
    if (!paths[key]) {
      const yd = Wd.WDOCK[dock];
      paths[key] = mkPath([[xc, TABLE_Y], [xc, OUT_Y], [100, OUT_Y], [100, yd], [34, yd], [-70, yd]], 30);
    }
    return paths[key];
  }
  const loadN = [0, 0, 0];
  cells.forEach((cell, ci) => {
    cell.arr.forEach((tk, k) => {
      const tRel = tk + 1.95; // dépôt sur la table
      const tOut = tk + 3.0;
      const isHero = ci === HERO_CELL && k === HERO_K;
      const speed = 190;
      // estimation de l'arrivée pour l'attribution du quai
      const tArrGuess = tOut + 1100 / speed;
      const dock = pickDock(tArrGuess, packN++, isHero);
      const path = packPath(cell.xc, dock);
      const b = newBox({ c: "#cf9442", top: "#e8b46a", edge: "rgba(255,255,255,0.45)", band: ["rgba(255,255,255,0.7)", 0.4, 0.62], bias: 25, w: 36, d: 30, h: 26 });
      const tEnd = tOut + path.len / speed;
      const pk = { cell: ci, k, tRel, tOut, path, b, speed, dock, tEnd, hero: isHero, tk };
      if (isHero) { b.c = "#ff8a1f"; b.top = "#ffc27a"; pk.big = true; }
      // slot de chargement dans la remorque
      pk.slot = loadN[dock]++;
      packs.push(pk);
    });
  });
  HERO.pack = packs.find((p) => p.hero);

  /* ---------- logique des cellules (bras + colis) ---------- */
  UP.push((t, frame) => {
    cells.forEach((cell, ci) => {
      const arm = arms[ci];
      // phase courante
      let cur = null;
      for (let k = 0; k < cell.arr.length; k++) { const ph = t - cell.arr[k]; if (ph >= -0.9 && ph < 1.95) { cur = k; break; } }
      let pose = null, ph = 0;
      if (cur != null) { ph = t - cell.arr[cur]; pose = armPose(ph, cell); }
      else {
        // repos : au-dessus de la table, ou position d'attente avant le premier cycle
        const k0 = cell.arr[0];
        pose = t < k0 - 0.9 ? { r: 78, z: 90, yaw: Math.PI / 2 } : { r: 78, z: 90, yaw: Math.PI / 2 };
        if (t >= k0 - 0.9 && cell.arr.length && t > cell.arr[cell.arr.length - 1]) pose = { r: 78, z: 100, yaw: Math.PI / 2 };
      }
      arm.pose = pose;
      arm.vacuum = cur != null && ph > 0.1 && ph < 1.9;
      armDraws[ci].k = armDraws[ci].key();
      frame.push(armDraws[ci]);
    });
    // colis portés par le bras
    packs.forEach((pk) => {
      const cell = cells[pk.cell], arm = arms[pk.cell];
      const tk = cell.arr[pk.k];
      const ph = t - tk;
      const b = pk.b;
      if (ph >= 0.3 && ph < 1.95 && arm.tip) {
        // porté : suit le préhenseur
        b.w = pk.hero ? 30 : 26; b.d = pk.hero ? 26 : 22; b.h = pk.hero ? 22 : 18;
        b.x = arm.tip[0] - b.w / 2; b.y = arm.tip[1] - b.d / 2; b.z = arm.tip[2] - b.h - 2; b.ang = 0; b.a = 1;
        b.bias = 65;
        frame.push(b);
      } else if (ph >= 1.95 && t < pk.tOut) {
        // posé sur la table : conditionné (scotché)
        const u = clamp((t - pk.tRel) / 0.4, 0, 1);
        b.w = lerp(26, 38, sm(u)); b.d = lerp(22, 32, sm(u)); b.h = lerp(18, 26, sm(u));
        b.x = cell.xc - b.w / 2; b.y = TABLE_Y - b.d / 2; b.z = 24; b.ang = 0; b.a = 1; b.bias = 30;
        frame.push(b);
        if (pk.hero) pk.heroOn = true;
      } else if (t >= pk.tOut && t < pk.tEnd) {
        const s = (t - pk.tOut) * pk.speed;
        pathAt(pk.path, s);
        b.w = 36; b.d = 30; b.h = 26;
        b.x = PA.x - 18; b.y = PA.y - 15; b.z = CH; b.ang = 0; b.a = 1; b.bias = 28;
        frame.push(b);
      }
    });
  });
  // le colis d'entrée disparaît quand le bras le saisit
  Wd.parcels.forEach((p) => { if (p.cell != null) p.until = p.tk + 0.3; });

  /* =================== EXPÉDITION : camions sortants =================== */
  const outTrucks = [];
  const loadBoxes = [[], [], []];
  const LOAD_COLS = [-36, 0, 36];
  const depart = [];
  for (let j = 0; j < 3; j++) {
    const xf = dockXf("W", j);
    const tk = new Truck({ trailerC: "#e4ecf9", stripe: j % 2 ? "#ff8a1f" : "#22e1ff", color: "#2c63e0" });
    tk.xf = xf; tk.j = j;
    outTrucks.push(tk); trucks.push(tk);
    // extension de convoyeur dans la remorque
    tk.ext = [];
    for (let k = 0; k < 3; k++) {
      const b = newBox({ c: "#24488f", top: "#0e1c40", edge: "rgba(34,225,255,0.5)", sideC: "#2a56ab", bias: 20 });
      setB(b, -22 - k * 40, Wd.WDOCK[j], 0, 40.5, 36, 20, 0);
      tk.ext.push(b);
    }
    const yd = Wd.WDOCK[j];
    depart[j] = mkPath([[-5, yd], [-1135, yd], [-1135, 1065], [-2020, 1065]], 170);
  }
  // charge dans les remorques
  packs.forEach((pk) => {
    const n = pk.slot;
    pk.load = { col: n % 3, row: Math.floor(n / 3) % 7, layer: Math.floor(n / 21) };
    pk.lb = newBox({ c: pk.hero ? "#ff8a1f" : "#cf9442", top: pk.hero ? "#ffc27a" : "#e8b46a", edge: "rgba(255,255,255,0.45)", band: ["rgba(255,255,255,0.7)", 0.4, 0.62], bias: 34, w: 28, d: 26, h: 18 });
  });
  const dockedPose = (j) => dockXf("W", j);

  function outTruckPose(t, j) {
    const xf = outTrucks[j].xf;
    const ps = Wd.arrivalPose(t, eStart[j], xf);
    if (t < eLeave[j]) {
      const w = xf.map(ps.a, ps.b), hd = wAng(xf, ps.psi);
      return { x: w[0], y: w[1], hd, a: ps.a, st: ps.st };
    }
    const sd = Wd.departPose(t, eLeave[j], 420);
    const o = pathAt(depart[j], sd);
    return { x: o.x, y: o.y, hd: o.ang, a: 999, st: "dep" };
  }
  UP.push((t, frame) => {
    outTrucks.forEach((tk, j) => {
      const P0 = outTruckPose(t, j);
      const tD = eDock[j];
      const open = sm(prog(t, tD - 1.0, tD + 0.2)), close = sm(prog(t, eLeave[j] - 2.0, eLeave[j] - 0.5));
      const o = open * (1 - close);
      tk.place(P0.x, P0.y, P0.hd, t, 1 - o, o * 160);
      tk.push(frame);
      tk.curW = [P0.x, P0.y]; tk.curHd = P0.hd; tk.curA = P0.a;
      // extension de convoyeur (quand le camion est à quai)
      const docked = t > tD - 0.4 && t < eLeave[j] - 0.4;
      if (docked) tk.ext.forEach((b) => frame.push(b));
    });
    // colis chargés
    packs.forEach((pk) => {
      if (t < pk.tEnd) return;
      const tk = outTrucks[pk.dock];
      if (!tk.curW) return;
      const L = pk.load, hd = tk.curHd, c = Math.cos(hd), s = Math.sin(hd);
      const la = 24 + L.row * 36 + 14, lb = LOAD_COLS[L.col];
      const x = tk.curW[0] + c * la - s * lb, y = tk.curW[1] + s * la + c * lb;
      const u = clamp((t - pk.tEnd) / 0.25, 0, 1);
      setB(pk.lb, x, y, 22 + L.layer * 20 + (1 - u) * 18, 28, 26, 18, hd);
      pk.lb.a = u;
      frame.push(pk.lb);
    });
  });
  GD.push((t) => {
    outTrucks.forEach((tk) => {
      if (!tk.curW || tk.curA < 8) return;
      const hd = tk.curHd, c = Math.cos(hd), s = Math.sin(hd);
      E.pool(tk.curW[0] + c * (TR_L + 300), tk.curW[1] + s * (TR_L + 300), 1.5, 190, "#cfe8ff", 0.2);
    });
  });

  /* =================== RÉCUPÉRATION DU HÉROS EN RACK =================== */
  (function heroRetrieval() {
    const sh = HERO.shuttle, sc = sh.sc, slot = sh.slot;
    const tIns = sh.R.Te[4]; // palette en rack
    const t0 = tIns + 1.2;
    const wps = [[205, 220, 0.3], [sc[0], 220, 1.6], [1000, 220, 0], [1022, 220, 0.8], [200, 220, 0]];
    const R = mkRoute(t0, 280, wps);
    const agv = new AGV({ body: "#ff8a1f" }); agv.vis = true; agvGlow(agv);
    HERO.tRet0 = R.Te[1] - 0.6; // la palette quitte son alvéole
    HERO.tHandoff = R.Te[3];
    HERO.retR = R;
    // la palette est descendue sur l'AGV puis transportée
    UP.push((t, frame) => {
      if (t < R.t0 - 0.5) return;
      const o = routeAtH(R, t);
      agv.pose(o.x, o.y, 0, o.ang); agv.push(frame);
      const p = HERO.pallet;
      if (t >= HERO.tRet0 && t < HERO.tHandoff) {
        const dz = sm(clamp((t - HERO.tRet0) / 1.2, 0, 1));
        let px = o.x, py = o.y, pz = lerp(slot.z + 2, 18, dz);
        if (t < R.Te[1]) { px = sc[0]; py = lerp(sc[1], 220, sm(clamp((t - HERO.tRet0) / 0.6, 0, 1))); }
        Wd.setPallet(p, px, py, pz, 0);
        if (t >= R.Te[1] - 0.2) Wd.setPallet(p, o.x, o.y, 18, 0);
        Wd.pushPallet(p, frame);
        HERO.cx = px; HERO.cy = py; HERO.cz = pz + 30;
      }
    });
    // dépalettisation : le colis héros naît sur le convoyeur
    HERO.parcel.t0 = HERO.tHandoff + 0.2;
    // ajuste l'heure d'arrivée sur la cellule
    HERO.tPick = cells[HERO_CELL].arr[HERO_K];
  })();
  // recale : le colis héros doit arriver à tPick ; on fixe sa vitesse en conséquence
  (function fixHeroSpeed() {
    const par = HERO.parcel, T = HERO.tPick - par.t0;
    par.v = par.stopS / T;
  })();

  /* =================== OUVRIERS =================== */
  const wr = rng(4242);
  const workers = [];
  function worker(route, vest, helmet, tag) {
    const w = { route, parts: [], vest, helmet, tag };
    const mk = (o) => { const b = newBox(o); w.parts.push(b); return b; };
    w.legL = mk({ c: "#0b1530", top: "#16264f", bias: 12 });
    w.legR = mk({ c: "#0b1530", top: "#16264f", bias: 12 });
    w.torso = mk({ c: vest, top: E.mix(vest, "#fff", 0.25), band: ["rgba(255,255,255,0.8)", 0.5, 0.6], bias: 13 });
    w.head = mk({ c: "#d9a77a", top: "#f0c397", bias: 14 });
    w.hat = mk({ c: helmet, top: E.mix(helmet, "#fff", 0.3), bias: 15 });
    w.tab = mk({ c: "#0a1a40", top: "#22e1ff", edge: "rgba(255,255,255,0.7)", bias: 16 });
    workers.push(w);
    return w;
  }
  function patrol(pts, t0, speed, dwell) {
    const wps = [];
    let t = t0;
    // aller-retour répété
    for (let rep = 0; rep < 14; rep++) {
      const seq = rep % 2 ? pts.slice().reverse() : pts;
      seq.forEach((p, i) => wps.push([p[0], p[1], i === 0 || i === seq.length - 1 ? dwell : 0]));
    }
    return mkRoute(t0, speed, wps);
  }
  const wDefs = [
    [[[700, 700], [1120, 700], [1120, 830], [700, 830]], "#ffd23f", "#ffffff"],
    [[[240, 634], [900, 634]], "#ff8a1f", "#ffd23f"],
    [[[1110, 560], [1110, 90]], "#22e1ff", "#ffffff"],
    [[[80, 840], [600, 840]], "#ff8a1f", "#ffffff"],
    [[[170, 120], [170, 540]], "#ffd23f", "#22e1ff"],
    [[[640, 868], [1260, 868]], "#22e1ff", "#ffd23f"],
    [[[300, 690], [610, 690]], "#27d6a0", "#ffffff"],
    [[[1010, 40], [1010, 200]], "#ff8a1f", "#ffffff"],
  ];
  wDefs.forEach((d, i) => {
    const R = patrol(d[0], 0 + i * 1.7, 38, 2.6 + (i % 3) * 0.7);
    const w = worker(R, d[1], d[2]);
  });
  UP.push((t, frame) => {
    workers.forEach((w) => {
      const o = routeAtH(w.route, t);
      const hd = o.ang, walking = o.mov;
      const ph = t * 7 + w.route.t0 * 3, sw = walking ? Math.sin(ph) * 3.2 : 0, bob = walking ? Math.abs(Math.sin(ph)) * 0.8 : 0;
      partAt(w.legL, o.x, o.y, hd, sw, -3, 0, 5, 5, 15);
      partAt(w.legR, o.x, o.y, hd, -sw, 3, 0, 5, 5, 15);
      partAt(w.torso, o.x, o.y, hd, 0, 0, 15 + bob, 8, 14, 17);
      partAt(w.head, o.x, o.y, hd, 0, 0, 32 + bob, 8, 8, 8);
      partAt(w.hat, o.x, o.y, hd, 0, 0, 40 + bob, 10, 10, 4);
      w.parts.forEach((b, i) => { if (i < 5) frame.push(b); });
      if (!walking) { partAt(w.tab, o.x, o.y, hd, 8, 0, 22, 4, 11, 8); frame.push(w.tab); }
    });
  });
  // gilets réfléchissants : aura légère
  OV.push((t) => { if (!Wd.interiorOn) return; workers.forEach((w) => { const o = routeAtH(w.route, t); E.glow(o.x, o.y, 28, 26, w.vest, 0.22); }); });

  /* =================== TRAFIC / DRONE =================== */
  const cars = [];
  const cr = rng(909);
  const carCols = ["#e9f1ff", "#ff8a1f", "#22e1ff", "#ff4d5e", "#27d6a0"];
  function roadCar(x0, y0, x1, y1, off, v, col, long) {
    const b1 = newBox({ c: col, top: E.mix(col, "#fff", 0.2), edge: "rgba(255,255,255,0.35)", bias: 6 });
    const b2 = newBox({ c: E.mix(col, "#000", 0.5), top: "#0d1730", bias: 7 });
    cars.push({ x0, y0, x1, y1, off, v, b1, b2, ang: Math.atan2(y1 - y0, x1 - x0), L: Math.hypot(x1 - x0, y1 - y0), long: long ? 2.4 : 1 });
  }
  for (let i = 0; i < 7; i++) roadCar(-3000, 1935, 4300, 1935, 400 + i * 950, 420, carCols[i % 5], i % 3 === 0);
  for (let i = 0; i < 5; i++) roadCar(4300, 1895, -3000, 1895, 250 + i * 1400, 380, carCols[(i + 2) % 5], i % 2 === 0);
  for (let i = 0; i < 5; i++) roadCar(1835, -2500, 1835, 1900, 300 + i * 1100, 360, carCols[(i + 1) % 5], false);
  for (let i = 0; i < 4; i++) roadCar(-1135, 900, -1135, -2500, 200 + i * 1200, 340, carCols[(i + 3) % 5], i % 2 === 0);
  UP.push((t, frame) => {
    cars.forEach((c) => {
      const s = (c.off + t * c.v) % (c.L + 600) - 300;
      if (s < 0 || s > c.L) return;
      const x = c.x0 + (c.x1 - c.x0) * s / c.L, y = c.y0 + (c.y1 - c.y0) * s / c.L;
      const len = 62 * c.long, wd = 30;
      setB(c.b1, x, y, 4, len, wd, 14, c.ang);
      partAt(c.b2, x, y, c.ang, -4 * c.long, 0, 18, len * 0.5, wd - 4, 9);
      frame.push(c.b1); frame.push(c.b2);
    });
  });
  GD.push((t) => {
    cars.forEach((c) => {
      const s = (c.off + t * c.v) % (c.L + 600) - 300;
      if (s < 0 || s > c.L) return;
      const x = c.x0 + (c.x1 - c.x0) * s / c.L, y = c.y0 + (c.y1 - c.y0) * s / c.L;
      E.pool(x + Math.cos(c.ang) * 90, y + Math.sin(c.ang) * 90, 1, 110, "#cfe8ff", 0.2);
    });
  });
  // drone
  class Drone {
    key() { return 1e6; }
    constructor() { this.k = 99999; }
    draw(t) {
      const ctx = E.ctx;
      const u = clamp(t / 7.0, 0, 1);
      const x = lerp(-300, 1700, u), y = lerp(1500, -200, u) + Math.sin(t * 1.3) * 40, z = 330 + Math.sin(t * 2) * 8;
      E.P(x, y, 0); const sx = E.px(), sy = E.py();
      E.P(x, y, z);
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(sx, sy, 16 * E.cam.scale * 2, 8 * E.cam.scale * 2, 0, 0, 6.28); ctx.fill();
      E.limb(x, y, z - 14, x, y, z - 4, 14, "#ff8a1f");
      for (const [ox, oy] of [[-16, -16], [16, -16], [16, 16], [-16, 16]]) {
        E.limb(x, y, z, x + ox, y + oy, z + 2, 3, "#8da2c4");
        E.P(x + ox, y + oy, z + 4);
        ctx.fillStyle = "rgba(180,230,255,0.45)"; ctx.beginPath(); ctx.ellipse(E.px(), E.py(), 12 * E.cam.scale * 1.7, 5 * E.cam.scale * 1.7, 0, 0, 6.28); ctx.fill();
      }
      E.glow(x, y, z - 10, 50, "#ffa246", 0.5);
      E.limb(x, y, z - 14, x, y, z - 34, 16, "#cf9442");
    }
  }
  const drone = new Drone();
  UP.push((t, frame) => { if (t < 8) { drone.k = 99999; frame.push(drone); } });

  /* =================== MARQUEUR HÉROS (anneau + faisceau) =================== */
  HERO.pos = (t) => {
    // position monde du héros
    if (HERO.pack && t >= HERO.pack.tOut - 0.1 && t < HERO.pack.tEnd) { pathAt(HERO.pack.path, (t - HERO.pack.tOut) * HERO.pack.speed); return [PA.x, PA.y, CH + 20]; }
    if (HERO.pack && t >= HERO.pack.tEnd) {
      const tk = outTrucks[HERO.pack.dock];
      if (tk.curW) { const L = HERO.pack.load, hd = tk.curHd, c = Math.cos(hd), s = Math.sin(hd), la = 24 + L.row * 36 + 14, lb = LOAD_COLS[L.col]; return [tk.curW[0] + c * la - s * lb, tk.curW[1] + s * la + c * lb, 22 + L.layer * 20 + 20]; }
    }
    if (HERO.pack && t >= HERO.pack.tRel) { return [CELLS[HERO_CELL], TABLE_Y, 56]; }
    const par = HERO.parcel;
    if (t >= par.t0 && t < HERO.tPick + 0.3) {
      const s = Math.min((t - par.t0) * par.v, par.stopS); pathAt(par.path, s); return [PA.x, PA.y, CH + 20];
    }
    if (t >= HERO.tPick + 0.3 && arms[HERO_CELL].tip && t < HERO.pack.tRel) { const tp = arms[HERO_CELL].tip; return [tp[0], tp[1], tp[2] - 10]; }
    if (HERO.cx != null) return [HERO.cx, HERO.cy, (HERO.cz || 0) + 28];
    return [0, 0, 0];
  };
  // le colis héros sur le convoyeur : lueur
  OV.push((t) => {
    const T0 = 12.8;
    if (t < T0 || t > 52.6) return;
    const p = HERO.pos(t);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    E.glow(p[0], p[1], p[2], 90 + pulse * 20, "#ff8a1f", 0.55);
    // anneau au sol
    const ctx = E.ctx;
    const ph = (t * 1.2) % 1;
    ctx.save();
    ctx.lineWidth = 2.5;
    for (const q of [ph, (ph + 0.5) % 1]) {
      const r = 20 + q * 60;
      ctx.strokeStyle = "rgba(255,138,31," + (0.9 * (1 - q)) + ")";
      ctx.beginPath();
      for (let a = 0; a <= 32; a++) { const an = a / 32 * 6.2832; E.P(p[0] + Math.cos(an) * r, p[1] + Math.sin(an) * r, Math.max(0.5, p[2] - 20)); if (a) ctx.lineTo(E.px(), E.py()); else ctx.moveTo(E.px(), E.py()); }
      ctx.stroke();
    }
    ctx.restore();
  });

  Object.assign(Wd, { cells, arms, packs, outTrucks, eStart, eDock, eLeave, workers, HERO });
})();
