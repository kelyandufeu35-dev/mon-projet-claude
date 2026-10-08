/* NEXALOG — routes temporelles, camions, AGV, déchargement, navettes de stockage */
(function () {
  const E = window.ENG, Wd = window.WORLD;
  const { Box, clamp, lerp, sm, sm5, prog, eio, eout, rng } = E;
  const { PAL, UP, OV, G, box, PATH, CH } = Wd;
  const { mkPath, pathAt, PA, setB, partAt, newBox } = PATH;
  const GD = (Wd.GD = []);

  /* ---------- itinéraires temporels ---------- */
  function mkRoute(t0, speed, wps) {
    const T = [t0], Te = [t0 + (wps[0][2] || 0)];
    for (let i = 1; i < wps.length; i++) {
      const d = Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
      T.push(Te[i - 1] + d / speed);
      Te.push(T[i] + (wps[i][2] || 0));
    }
    return { wps, T, Te, speed, end: Te[Te.length - 1], t0 };
  }
  const RP = { x: 0, y: 0, ang: 0, mov: false, seg: 0 };
  function rawAt(R, t, out) {
    const n = R.wps.length;
    if (t <= R.Te[0]) { out.x = R.wps[0][0]; out.y = R.wps[0][1]; out.seg = 0; out.mov = false; return; }
    if (t >= R.T[n - 1]) { out.x = R.wps[n - 1][0]; out.y = R.wps[n - 1][1]; out.seg = n - 1; out.mov = false; return; }
    let i = 1;
    while (i < n - 1 && t > R.Te[i]) i++;
    // entre Te[i-1] et T[i]
    if (t >= R.T[i] && t <= R.Te[i]) { out.x = R.wps[i][0]; out.y = R.wps[i][1]; out.seg = i; out.mov = false; return; }
    const u = (t - R.Te[i - 1]) / (R.T[i] - R.Te[i - 1]);
    out.x = lerp(R.wps[i - 1][0], R.wps[i][0], u); out.y = lerp(R.wps[i - 1][1], R.wps[i][1], u);
    out.seg = i; out.mov = true;
  }
  const _a = { x: 0, y: 0, seg: 0, mov: false }, _b = { x: 0, y: 0, seg: 0, mov: false }, _c = { x: 0, y: 0, seg: 0, mov: false };
  function routeAt(R, t, out) {
    out = out || RP;
    const dt = 0.1;
    rawAt(R, t - dt, _a); rawAt(R, t + dt, _b); rawAt(R, t, _c);
    out.x = (_a.x + _b.x) / 2; out.y = (_a.y + _b.y) / 2;
    const vx = _b.x - _a.x, vy = _b.y - _a.y;
    if (vx * vx + vy * vy > 1) { out.ang = Math.atan2(vy, vx); out.last = out.ang; }
    else if (out.last == null) { const i = Math.min(R.wps.length - 1, 1); out.ang = Math.atan2(R.wps[i][1] - R.wps[0][1], R.wps[i][0] - R.wps[0][0]); }
    else out.ang = out.last;
    out.mov = _c.mov; out.seg = _c.seg;
    return out;
  }
  // heading mémorisé par route
  function routeAtH(R, t) { const o = routeAt(R, t, R._o || (R._o = { last: null })); return o; }

  /* ---------- repères de quai ---------- */
  function dockXf(kind, idx) {
    if (kind === "S") { const xd = Wd.SDOCK[idx]; return { map: (a, b) => [xd + b, 905 + a], ang0: Math.PI / 2, kind, idx }; }
    const yd = Wd.WDOCK[idx]; return { map: (a, b) => [-5 - a, yd + b], ang0: Math.PI, kind, idx };
  }
  function wAng(xf, psi) { const o = xf.map(0, 0), p = xf.map(Math.cos(psi), Math.sin(psi)); return Math.atan2(p[1] - o[1], p[0] - o[0]); }

  /* ---------- camion ---------- */
  const TR_L = 420;
  class Truck {
    constructor(o) {
      Object.assign(this, { color: "#ff8a1f", trailerC: "#e4ecf9", stripe: "#22e1ff", lidOff: 0, lidOn: 0 }, o);
      this.parts = [];
      const mk = (spec) => { const b = newBox(spec.o); this.parts.push(Object.assign({ b }, spec)); return b; };
      this.mk = mk;
      // plancher + parois
      mk({ la: [4, TR_L], lb: [-60, 60], z: [14, 22], o: { c: "#20386f", top: "#2b4a8e", edge: "rgba(255,255,255,0.25)" } });
      for (const sgn of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const a0 = 4 + k * (TR_L - 4) / 4, a1 = 4 + (k + 1) * (TR_L - 4) / 4;
          mk({ la: [a0, a1], lb: sgn < 0 ? [-62, -58] : [58, 62], z: [22, 124], o: { c: this.trailerC, top: "#ffffff", edge: "rgba(255,255,255,0.4)", band: [this.stripe, 0.22, 0.34] } });
        }
      }
      mk({ la: [TR_L - 4, TR_L], lb: [-62, 62], z: [22, 124], o: { c: this.trailerC, top: "#ffffff", edge: "rgba(255,255,255,0.4)" } });
      // toit amovible
      this.lid = mk({ la: [4, TR_L], lb: [-64, 64], z: [124, 130], o: { c: "#f3f7ff", top: "#ffffff", edge: "rgba(255,255,255,0.5)", band: [this.color, 0.0, 1.0] }, lid: true, bias: 30 });
      // cabine
      mk({ la: [TR_L + 10, TR_L + 142], lb: [-58, 58], z: [14, 60], o: { c: this.color, top: E.mix(this.color, "#fff", 0.2), edge: "rgba(255,255,255,0.35)" } });
      mk({ la: [TR_L + 20, TR_L + 100], lb: [-56, 56], z: [60, 106], o: { c: this.color, top: E.mix(this.color, "#fff", 0.15), edge: "rgba(255,255,255,0.35)", band: ["#0c1c42", 0.35, 0.85] } });
      mk({ la: [TR_L + 98, TR_L + 142], lb: [-40, 40], z: [30, 40], o: { c: "#0c1c42", top: "#162c60" } });
      // roues
      for (const sgn of [-1, 1]) for (const a of [50, 112, TR_L + 30, TR_L + 100]) {
        mk({ la: [a - 20, a + 20], lb: sgn < 0 ? [-70, -56] : [56, 70], z: [0, 34], o: { c: "#0a1124", top: "#141f3e" } });
      }
      // marchandise : palettes dans la remorque
      this.pallets = [];
    }
    place(ox, oy, hd, t, lidAlpha, lidZ) {
      // (ox,oy) = arrière de la remorque (sol) ; hd = cap monde
      const c = Math.cos(hd), s = Math.sin(hd);
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i], b = p.b;
        const la = (p.la[0] + p.la[1]) / 2, lb = (p.lb[0] + p.lb[1]) / 2;
        setB(b, ox + c * la - s * lb, oy + s * la + c * lb, p.z[0], p.la[1] - p.la[0], p.lb[1] - p.lb[0], p.z[1] - p.z[0], hd);
        if (p.lid) { b.a = lidAlpha; b.z = p.z[0] + lidZ; }
      }
    }
    push(frame) { for (let i = 0; i < this.parts.length; i++) { const b = this.parts[i].b; if (b.a > 0.01) frame.push(b); } }
  }
  const trucks = [];

  /* ---------- palette (charge) ---------- */
  function makePallet(ci) {
    const col = ["#d79a52", "#e8edf7", "#2c63e0", "#27d6a0", "#c98a45", "#ff8a1f"][ci % 6];
    const pb = newBox({ c: PAL.pallet, top: "#b98550", edge: "rgba(255,255,255,0.18)", bias: 8 });
    const cb = newBox({ c: col, top: E.mix(col, "#ffffff", 0.2), edge: "rgba(255,255,255,0.3)", band: ["rgba(255,255,255,0.5)", 0.45, 0.58], bias: 10 });
    return { pb, cb, h: 34 + (ci * 7) % 18 };
  }
  function setPallet(p, cx, cy, z, hd) {
    setB(p.pb, cx, cy, z, 50, 50, 8, hd || 0);
    setB(p.cb, cx, cy, z + 8, 44, 44, p.h, hd || 0);
  }
  function pushPallet(p, frame) { frame.push(p.pb); frame.push(p.cb); }

  /* ---------- AGV ---------- */
  class AGV {
    constructor(o) {
      Object.assign(this, { body: "#ff8a1f" }, o);
      this.b1 = newBox({ c: this.body, top: E.mix(this.body, "#ffffff", 0.25), edge: "rgba(255,255,255,0.4)", bias: 12, band: ["rgba(34,225,255,0.95)", 0.45, 0.6] });
      this.b2 = newBox({ c: "#0d1c42", top: "#1a2f66", edge: "rgba(34,225,255,0.5)", bias: 13 });
      this.b3 = newBox({ c: "#0d1c42", top: "#223a7a", bias: 13 });
      this.b4 = newBox({ c: "#6c90e0", top: "#a9c4ff", bias: 14 });
    }
    pose(x, y, z, hd) {
      this.x = x; this.y = y; this.z = z; this.hd = hd;
      setB(this.b1, x, y, z + 4, 80, 46, 14, hd);
      partAt(this.b2, x, y, hd, 6, 0, z + 18, 58, 38, 4);
      partAt(this.b3, x, y, hd, 34, 0, z + 4, 8, 40, 10); // bumper
    }
    push(frame) { frame.push(this.b1); frame.push(this.b2); frame.push(this.b3); }
  }
  const agvs = [];
  function agvGlow(a, col) { OV.push(() => { if (a.vis && a.x != null && Wd.interiorOn) { E.glow(a.x, a.y, a.z + 28, 46, col || "#ff9a3c", 0.45); } }); }

  /* ============ CAMIONS DE RÉCEPTION (quais sud) ============ */
  const Q_START = [-5.0, 0.0, 4.5, 8.0];
  const Q_DOCK = Q_START.map((s) => s + 8.15);
  const Q_LEAVE = [15.8, 20.6, 24.6, 28.6];
  const recvTrucks = [];
  const staging = []; // palettes en attente : {p, tDrop, x,y}
  const unloadAGV = [];
  const HERO = { pallet: null, tDrop: 0, x: 0, y: 0 };

  function arrivalPose(t, t0, xf) {
    // retourne {a,b,psi,lidAlpha, state}
    const F1 = 3.2, PA_ = 0.35, RV = 4.6;
    const L1 = 1400, ARC = 420 * Math.PI / 2, ST = 175, REV = ARC + ST;
    const tt = t - t0;
    if (tt < 0) return { a: 595, b: 420 - L1 - 400, psi: Math.PI / 2, st: "pre" };
    if (tt < F1) { const u = tt / F1, e = 1 - Math.pow(1 - u, 2.2); return { a: 595, b: 420 - L1 + L1 * e, psi: Math.PI / 2, st: "fwd" }; }
    if (tt < F1 + PA_) return { a: 595, b: 420, psi: Math.PI / 2, st: "stop" };
    if (tt < F1 + PA_ + RV) {
      const u = (tt - F1 - PA_) / RV, s = REV * eio(u);
      if (s < ARC) { const th = s / 420; return { a: 175 + 420 * Math.cos(th), b: 420 - 420 * Math.sin(th), psi: Math.PI / 2 - th, st: "rev" }; }
      return { a: ST - (s - ARC), b: 0, psi: 0, st: "rev" };
    }
    return { a: 0, b: 0, psi: 0, st: "docked" };
  }
  function departPose(t, tL, speed, dist) {
    const tau = Math.max(0, t - tL);
    return tau * speed + (Math.exp(-tau * 1.4) - 1) * speed / 1.4;
  }

  for (let i = 0; i < 4; i++) {
    const xf = dockXf("S", i);
    const tk = new Truck({ trailerC: "#e4ecf9", stripe: i % 2 ? "#22e1ff" : "#ff8a1f" });
    tk.idx = i; tk.xf = xf;
    // palettes : 6 par camion (2 colonnes × 3 rangées)
    tk.pal = [];
    for (let k = 0; k < 6; k++) {
      const col = k % 2, row = Math.floor(k / 2);
      tk.pal.push({ p: makePallet(i * 6 + k), a: 330 - 110 * row, b: col ? 32 : -32, col, row, k });
    }
    recvTrucks.push(tk);
    trucks.push(tk);
  }
  // unloading
  const B0 = [-32, 32], BS = [-105, 105];
  const unloadInfo = [];
  recvTrucks.forEach((tk, i) => {
    const xf = tk.xf, td = Q_DOCK[i] + 0.9;
    tk.routes = [];
    for (let c = 0; c < 2; c++) {
      const wps = [[...xf.map(-330, B0[c]), 0.2]];
      let events = [];
      for (let r = 0; r < 3; r++) {
        const pal = tk.pal.find((q) => q.col === c && q.row === r);
        const aRow = pal.a, aSt = -140 - r * 80;
        const door = xf.map(-60, B0[c]), load = xf.map(aRow - 12, B0[c]);
        const door2 = xf.map(-60, BS[c]), drop = xf.map(aSt, BS[c]);
        wps.push([door[0], door[1], 0]);
        wps.push([load[0], load[1], 0.55]); const iLoad = wps.length - 1;
        wps.push([door[0], door[1], 0]);
        wps.push([door2[0], door2[1], 0]);
        wps.push([drop[0], drop[1], 0.5]); const iDrop = wps.length - 1;
        wps.push([door2[0], door2[1], 0]);
        wps.push([door[0], door[1], 0]);
        events.push({ pal, iLoad, iDrop, r, aSt });
      }
      const park = xf.map(-330, B0[c]);
      wps.push([park[0], park[1], 0]);
      const R = mkRoute(td + c * 0.7, 340, wps);
      R.events = events; R.tk = tk; R.c = c;
      tk.routes.push(R);
      events.forEach((ev) => {
        ev.tLoad = R.Te[ev.iLoad]; ev.tDrop = R.T[ev.iDrop] + 0.25;
        const w = xf.map(ev.aSt, BS[c]);
        ev.sx = w[0]; ev.sy = w[1];
        staging.push({ p: ev.pal.p, tDrop: ev.tDrop, x: w[0], y: w[1], tk, ev, hd: wAng(xf, 0) });
      });
      const agv = new AGV({ body: "#ff8a1f" }); agv.R = R; agv.vis = true; agvs.push(agv); agvGlow(agv);
      unloadAGV.push(agv);
    }
  });

  /* ============ NAVETTES DE STOCKAGE ============ */
  const shuttle = [];
  const A_Y = Wd.AISLE_Y;
  const rr2 = rng(777);
  const xsBase = [Wd.SDOCK[0] - 0, Wd.SDOCK[1] - 0, Wd.SDOCK[2] - 0, Wd.SDOCK[3] - 0];
  const used = new Set();
  function takeSlot(aisle, pref) {
    const list = Wd.reserved[aisle];
    for (let i = 0; i < list.length; i++) { const s = list[(i + pref) % list.length]; if (!used.has(s)) { used.add(s); return s; } }
    return list[0];
  }
  // la navette héro est traitée à part ; on la prépare après le déchargement du quai 3
  const heroTk = recvTrucks[2], heroEv = heroTk.routes[0].events[0];
  heroTk.pal[0].p.cb.c = "#ff8a1f"; heroTk.pal[0].p.cb.top = "#ffc27a"; heroTk.pal[0].p.cb.band = ["rgba(255,255,255,0.85)", 0.45, 0.6];
  HERO.tRet0 = 1e9;
  HERO.tDrop = heroEv.tDrop; HERO.x = heroEv.sx; HERO.y = heroEv.sy; HERO.pallet = heroEv.pal.p;
  const heroSlot = (function () {
    // créneau visible : allée 0, rangée sud du groupe 0 (face +y), baie 3, niveau 1
    const s = Wd.slots.find((q) => q.g === 0 && q.row === 1 && q.b === 3 && q.l === 1);
    s.full = false; s.fillT = -1; used.add(s); return s;
  })();
  function slotCenter(s) { return [s.x + s.w / 2, s.y + s.d / 2]; }

  function buildShuttle(opts) {
    const { aisle, t0, xs, ys, slot, speed = 250, loadDwell = 0.9, slotDwell = 2.6, tag } = opts;
    const sc = slotCenter(slot);
    const corridorY = 635;
    const wps = [[xs, ys, loadDwell], [xs, corridorY, 0], [205, corridorY, 0], [205, A_Y[aisle], 0], [sc[0], A_Y[aisle], slotDwell],
      [205, A_Y[aisle], 0], [205, corridorY, 0], [xs, corridorY, 0], [xs, ys, 0.3]];
    const R = mkRoute(t0, speed, wps);
    const o = { R, slot, aisle, agv: new AGV({ body: "#ff8a1f" }), p: makePallet(slot.b + slot.l * 3), tPick: R.Te[0], tArr: R.T[4], tIns: R.Te[4], sc, tag };
    o.agv.vis = true; agvGlow(o.agv);
    slot.fillT = R.Te[4] - 0.2; // le slot reçoit sa palette à la fin de l'insertion
    shuttle.push(o); agvs.push(o.agv);
    return o;
  }
  // navette héro
  const heroShuttle = buildShuttle({ aisle: 0, t0: HERO.tDrop + 0.2, xs: HERO.x, ys: HERO.y, slot: heroSlot, speed: 300, tag: "hero" });
  heroShuttle.p = HERO.pallet; // la palette du héros est celle du camion
  HERO.shuttle = heroShuttle;
  // flottille décorative
  const decoCfg = [
    { aisle: 0, xi: 0, t0: 11.0 }, { aisle: 0, xi: 3, t0: 27.0 }, { aisle: 1, xi: 1, t0: 14.0 }, { aisle: 1, xi: 2, t0: 30.0 },
    { aisle: 1, xi: 0, t0: 40.0 }, { aisle: 2, xi: 3, t0: 12.5 }, { aisle: 2, xi: 1, t0: 28.0 }, { aisle: 0, xi: 2, t0: 38.0 }, { aisle: 2, xi: 0, t0: 44.0 },
  ];
  decoCfg.forEach((c, i) => {
    const s = takeSlot(c.aisle, i * 5);
    const o = buildShuttle({ aisle: c.aisle, t0: c.t0, xs: xsBase[c.xi] - 105, ys: 740, slot: s, speed: 245, loadDwell: 0.4, tag: "deco" });
  });
  UP.push((t, frame) => {
    // AGV de déchargement
    unloadAGV.forEach((agv) => {
      const R = agv.R, o = routeAtH(R, t);
      // heading mémoire
      agv.pose(o.x, o.y, 0, o.ang);
      agv.push(frame);
    });
    shuttle.forEach((sh) => {
      const R = sh.R;
      if (t < R.t0 - 0.5) { sh.agv.vis = false; return; }
      sh.agv.vis = true;
      const o = routeAtH(R, t);
      sh.agv.pose(o.x, o.y, 0, o.ang);
      sh.agv.push(frame);
      // palette transportée
      let carry = false, px = o.x, py = o.y, pz = 18, shown = false;
      const tLoad = R.Te[0], tIns0 = R.T[4];
      if (t >= tLoad - 0.05 && t < tIns0) { carry = true; shown = true; }
      else if (t >= tIns0 && t < R.Te[4]) {
        // levage + insertion dans le rack
        shown = true;
        const u = t - tIns0, rise = sm(clamp(u / 1.3, 0, 1)), push = sm(clamp((u - 1.3) / 0.9, 0, 1));
        pz = lerp(18, sh.slot.z + 2, rise);
        px = sh.sc[0]; py = lerp(A_Y[sh.aisle], sh.sc[1], push);
        // mât de levage
        const ag = sh.agv;
        const m = sh.agv.b4; setB(m, o.x - 22, o.y, 8, 7, 7, pz - 2, 0); frame.push(m);
      } else if (t >= R.Te[4]) shown = false;
      if (shown && sh.tag !== "hero") {
        setPallet(sh.p, px, py, pz, 0); pushPallet(sh.p, frame);
      }
      if (shown && sh.tag === "hero") { sh.carryX = px; sh.carryY = py; sh.carryZ = pz; }
      else if (sh.tag === "hero") { sh.carryX = null; }
    });
  });

  /* ---------- rendu des camions de réception + palettes ---------- */
  UP.push((t, frame) => {
    recvTrucks.forEach((tk, i) => {
      const xf = tk.xf;
      const pose = arrivalPose(t, Q_START[i], xf);
      let a = pose.a, b = pose.b, psi = pose.psi;
      let dep = 0;
      if (t > Q_LEAVE[i]) { dep = departPose(t, Q_LEAVE[i], 380); a = dep; b = 0; psi = 0; }
      const w = xf.map(a, b), hd = wAng(xf, psi);
      // toit : présent à l'arrivée, retiré après l'accostage, remis avant le départ
      const tD = Q_DOCK[i];
      let lidA = 1, lidZ = 0;
      const open = sm(prog(t, tD - 1.0, tD + 0.2));
      const close = sm(prog(t, Q_LEAVE[i] - 2.0, Q_LEAVE[i] - 0.4));
      const o = open * (1 - close);
      lidA = 1 - o; lidZ = o * 160;
      tk.place(w[0], w[1], hd, t, lidA, lidZ);
      tk.push(frame);
      tk.curA = a; tk.curB = b; tk.curHd = hd; tk.curW = w;
      // palettes
      tk.pal.forEach((pq) => {
        const ev = tk.routes[pq.col].events[pq.row];
        const st = staging.find((q) => q.p === pq.p);
        if (t < ev.tLoad) {
          // dans la remorque
          const c = Math.cos(hd), s = Math.sin(hd);
          setPallet(pq.p, w[0] + c * pq.a - s * pq.b, w[1] + s * pq.a + c * pq.b, 24, hd);
          pushPallet(pq.p, frame);
        } else if (t < ev.tDrop) {
          // portée par l'AGV
          const agv = tk.routes[pq.col] && unloadAGV.find((q) => q.R === tk.routes[pq.col]);
          setPallet(pq.p, agv.x, agv.y, 18, 0);
          pushPallet(pq.p, frame);
          if (tk === heroTk && pq === heroTk.pal[0]) { HERO.cx = agv.x; HERO.cy = agv.y; HERO.cz = 18; }
        } else {
          // posée au sol, jusqu'à ce que la navette héro l'emporte
          if (pq.p === HERO.pallet) {
            if (t < HERO.shuttle.R.Te[0]) { setPallet(pq.p, st.x, st.y, 0.5, 0); pushPallet(pq.p, frame); HERO.cx = st.x; HERO.cy = st.y; HERO.cz = 0.5; }
            else if (t < HERO.shuttle.R.Te[4]) { /* porté par la navette */ setPallet(pq.p, HERO.shuttle.carryX ?? st.x, HERO.shuttle.carryY ?? st.y, HERO.shuttle.carryZ ?? 18, 0); pushPallet(pq.p, frame); }
            else if (t < HERO.tRet0) { /* dans le rack */ setPallet(pq.p, HERO.shuttle.sc[0], HERO.shuttle.sc[1], HERO.shuttle.slot.z + 2, 0); pushPallet(pq.p, frame); }
          } else { setPallet(pq.p, st.x, st.y, 0.5, 0); pushPallet(pq.p, frame); }
        }
      });
    });
  });
  // cônes de phares + voyants (pass sol)
  GD.push((t) => {
    recvTrucks.forEach((tk) => {
      if (tk.curW == null) return;
      const hd = tk.curHd, c = Math.cos(hd), s = Math.sin(hd);
      const fx = tk.curW[0] + c * (TR_L + 150), fy = tk.curW[1] + s * (TR_L + 150);
      if (tk.curA > 8) { E.pool(fx + c * 150, fy + s * 150, 1.5, 190, "#cfe8ff", 0.2); }
    });
  });

  Object.assign(Wd, { Truck, trucks, mkRoute, routeAt, routeAtH, dockXf, wAng, makePallet, setPallet, pushPallet, AGV, agvs, recvTrucks, staging, HERO, shuttle,
    Q_DOCK, Q_START, Q_LEAVE, arrivalPose, departPose, TR_L, agvGlow });
})();
