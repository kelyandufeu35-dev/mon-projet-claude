/* Bibliothèque : palette, cadre de scène, caméra, constructeurs (arbres, personnages, camions, voitures…) */
(function () {
  const E = window.ENG;
  const { Box, Cyl, Roof, clamp, lerp, sm, sm5, prog, eio, eout, rng, mix, newBox, setB, partAt, mkPath, pathAt, PA } = E;

  const C = {
    red: "#DA291C", red2: "#B71C14", yellow: "#FFC72C", yellow2: "#F5A800", white: "#FFFFFF", cream: "#FFF3D0", ink: "#27251F",
    grass: "#7CC24F", grass2: "#66AD3E", grass3: "#8ED35C", soil: "#8B5A32", soil2: "#6D4426", sand: "#E9D6A3", wheat: "#E8B84A", wheat2: "#D49A2A",
    road: "#59606B", roadL: "#E8ECEF", water: "#5DB7E8", conc: "#C9CED6", concD: "#9AA2AE", steel: "#B8C2CF", steelD: "#7F8B9B",
    blue: "#2E7DD1", teal: "#22B2A4", green: "#2FA24A", orange: "#F28C28", brown: "#9A6B3B", skin: "#F1C9A0", skin2: "#C98B5E", skin3: "#8D5A3B",
    ice: "#CFEFFF", ice2: "#8ED0F5", pink: "#E85D8A", purple: "#7A5CC8",
  };

  /* ---------- cadre de scène ---------- */
  class Scene {
    constructor(id, t0, t1) { this.id = id; this.t0 = t0; this.t1 = t1; this.S = []; this.G = []; this.UP = []; this.OV = []; this.keys = []; this.sky = ["#8FD4FF", "#EAF7FF"]; }
    box(o) { const b = new Box(o); this.S.push(b); return b; }
    cyl(o) { const b = new Cyl(o); this.S.push(b); return b; }
    roof(o) { const b = new Roof(o); this.S.push(b); return b; }
    add(o) { this.S.push(o); return o; }
    ground(f) { this.G.push(f); }
    dyn(f) { this.UP.push(f); }
    over(f) { this.OV.push(f); }
  }

  /* ---------- caméra : jalons [t, tx, ty, tz, scale, yaw°, el°, ox, oy], Catmull-Rom ---------- */
  function camAt(keys, t) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const u = clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1), out = [];
    for (let p = 1; p < 9; p++) {
      const m1 = i === 0 ? 0 : (k2[p] - k0[p]) / (k2[0] - k0[0]) * (k2[0] - k1[0]);
      const m2 = i === keys.length - 2 ? 0 : (k3[p] - k1[p]) / (k3[0] - k1[0]) * (k2[0] - k1[0]);
      const u2 = u * u, u3 = u2 * u;
      out.push((2 * u3 - 3 * u2 + 1) * k1[p] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[p] + (u3 - u2) * m2);
    }
    return out;
  }
  function applyCam(c) {
    const cam = E.cam, D = Math.PI / 180;
    cam.tx = c[0]; cam.ty = c[1]; cam.tz = c[2]; cam.scale = c[3]; cam.yaw = c[4] * D; cam.el = c[5] * D; cam.ox = c[6]; cam.oy = c[7];
    E.camUpdate();
  }

  /* ---------- itinéraires temporels ---------- */
  function mkRoute(t0, speed, wps) {
    const T = [t0], Te = [t0 + (wps[0][2] || 0)];
    for (let i = 1; i < wps.length; i++) {
      const d = Math.hypot(wps[i][0] - wps[i - 1][0], wps[i][1] - wps[i - 1][1]);
      T.push(Te[i - 1] + d / speed); Te.push(T[i] + (wps[i][2] || 0));
    }
    return { wps, T, Te, speed, end: Te[Te.length - 1], t0 };
  }
  function rawAt(R, t, out) {
    const n = R.wps.length;
    if (t <= R.Te[0]) { out.x = R.wps[0][0]; out.y = R.wps[0][1]; out.mov = false; return; }
    if (t >= R.T[n - 1]) { out.x = R.wps[n - 1][0]; out.y = R.wps[n - 1][1]; out.mov = false; return; }
    let i = 1; while (i < n - 1 && t > R.Te[i]) i++;
    if (t >= R.T[i] && t <= R.Te[i]) { out.x = R.wps[i][0]; out.y = R.wps[i][1]; out.mov = false; return; }
    const u = (t - R.Te[i - 1]) / (R.T[i] - R.Te[i - 1]);
    out.x = lerp(R.wps[i - 1][0], R.wps[i][0], u); out.y = lerp(R.wps[i - 1][1], R.wps[i][1], u); out.mov = true;
  }
  const _a = {}, _b = {}, _c = {};
  function routeAt(R, t, out) {
    out = out || (R._o = R._o || { last: null });
    rawAt(R, t - 0.1, _a); rawAt(R, t + 0.1, _b); rawAt(R, t, _c);
    out.x = (_a.x + _b.x) / 2; out.y = (_a.y + _b.y) / 2;
    const vx = _b.x - _a.x, vy = _b.y - _a.y;
    if (vx * vx + vy * vy > 1) { out.ang = Math.atan2(vy, vx); out.last = out.ang; }
    else if (out.last == null) out.ang = Math.atan2(R.wps[1][1] - R.wps[0][1], R.wps[1][0] - R.wps[0][0]);
    else out.ang = out.last;
    out.mov = _c.mov; return out;
  }
  // ping-pong répété
  function patrol(pts, t0, speed, dwell, reps) {
    const wps = [];
    for (let r = 0; r < (reps || 20); r++) { const seq = r % 2 ? pts.slice().reverse() : pts; seq.forEach((p, i) => wps.push([p[0], p[1], i === 0 || i === seq.length - 1 ? dwell : 0])); }
    return mkRoute(t0, speed, wps);
  }

  /* ---------- personnages ---------- */
  class Person {
    constructor(o) {
      Object.assign(this, { shirt: C.red, pants: "#2B3447", skin: C.skin, hair: "#3A2A1E", cap: null, scale: 1, apron: null }, o);
      const nb = (c, top) => newBox({ c, top: top || mix(c, "#ffffff", 0.2), bias: 14 });
      this.legL = nb(this.pants); this.legR = nb(this.pants); this.torso = nb(this.shirt); this.head = nb(this.skin);
      this.hairB = nb(this.cap || this.hair); this.armL = nb(this.shirt); this.armR = nb(this.shirt);
      this.parts = [this.legL, this.legR, this.torso, this.head, this.hairB, this.armL, this.armR];
      if (this.apron) { this.ap = nb(this.apron); this.parts.push(this.ap); }
      this.x = 0; this.y = 0; this.z = 0; this.hd = 0; this.carry = null;
    }
    pose(x, y, hd, walk, t, z) {
      const s = this.scale, ph = t * 7, sw = walk ? Math.sin(ph) * 3.4 * s : 0, bob = walk ? Math.abs(Math.sin(ph)) * 0.9 * s : 0; z = z || 0;
      this.x = x; this.y = y; this.z = z; this.hd = hd;
      partAt(this.legL, x, y, hd, sw, -3 * s, z, 5 * s, 5 * s, 14 * s);
      partAt(this.legR, x, y, hd, -sw, 3 * s, z, 5 * s, 5 * s, 14 * s);
      partAt(this.torso, x, y, hd, 0, 0, z + 14 * s + bob, 8 * s, 14 * s, 17 * s);
      partAt(this.armL, x, y, hd, -sw * 0.7 + 1, -9 * s, z + 15 * s + bob, 4 * s, 4 * s, 14 * s);
      partAt(this.armR, x, y, hd, sw * 0.7 + 1, 9 * s, z + 15 * s + bob, 4 * s, 4 * s, 14 * s);
      partAt(this.head, x, y, hd, 0, 0, z + 31 * s + bob, 8 * s, 8 * s, 8 * s);
      partAt(this.hairB, x, y, hd, -0.5 * s, 0, z + 38 * s + bob, 9 * s, 9 * s, 3 * s);
      if (this.ap) partAt(this.ap, x, y, hd, 4.5 * s, 0, z + 14 * s + bob, 2 * s, 11 * s, 11 * s);
    }
    push(frame) { for (let i = 0; i < this.parts.length; i++) frame.push(this.parts[i]); }
  }

  /* ---------- arbres, maisons, voitures ---------- */
  function tree(sc, x, y, s, kind) {
    s = s || 1;
    sc.box({ x: x - 3 * s, y: y - 3 * s, w: 6 * s, d: 6 * s, h: 14 * s, c: C.soil2, noShadow: true, flat: true });
    const g = kind === 1 ? ["#4FA33A", "#68BC48"] : ["#3E9A3A", "#5BB546"];
    sc.cyl({ x, y, z: 12 * s, r: 17 * s, h: 20 * s, c: g[0], top: g[1] });
    sc.cyl({ x, y, z: 28 * s, r: 11 * s, h: 18 * s, c: g[0], top: mix(g[1], "#ffffff", 0.15) });
  }
  function house(sc, x, y, w, d, h, wall, roofC) {
    sc.box({ x, y, w, d, h, c: wall || C.cream });
    sc.roof({ x, y, z: h, w, d, rh: Math.min(w, d) * 0.4, axis: w >= d ? "x" : "y", c: roofC || C.red2, gable: wall || C.cream });
    sc.box({ x: x + w * 0.35, y: y + d - 1, w: w * 0.2, d: 2, h: h * 0.55, c: C.soil2, noShadow: true, flat: true });
  }
  class Car {
    constructor(col, long) { this.b1 = newBox({ c: col, top: mix(col, "#fff", 0.22), edge: "rgba(255,255,255,0.35)", bias: 6 }); this.b2 = newBox({ c: "#1F2A44", top: "#5C7596", bias: 7 }); this.l = long ? 1.7 : 1; }
    pose(x, y, hd) { setB(this.b1, x, y, 4, 60 * this.l, 28, 13, hd); partAt(this.b2, x, y, hd, -3 * this.l, 0, 17, 32 * this.l, 24, 9); }
    push(f) { f.push(this.b1); f.push(this.b2); }
  }

  /* ---------- camions McDonald's (remorque blanche, bandes rouge/jaune) ---------- */
  class Truck {
    constructor(o) {
      Object.assign(this, { L: 300, cab: C.red, stripe: C.yellow, cold: false, lid: false }, o);
      this.parts = [];
      const mk = (la, lb, z, o2) => { const b = newBox(o2); this.parts.push({ b, la, lb, z }); return b; };
      mk([4, this.L], [-45, 45], [12, 18], { c: "#5A6472", top: "#6C7886" });
      const nseg = Math.max(3, Math.round(this.L / 75));
      for (const sgn of [-1, 1]) for (let k = 0; k < nseg; k++) {
        const a0 = 4 + k * (this.L - 4) / nseg, a1 = 4 + (k + 1) * (this.L - 4) / nseg;
        mk([a0, a1], sgn < 0 ? [-47, -43] : [43, 47], [18, 96], { c: this.cold ? "#F4FBFF" : C.white, top: "#ffffff", edge: "rgba(0,0,0,0.12)", band: [this.stripe, 0.18, 0.3], noShadow: false });
        mk([a0, a1], sgn < 0 ? [-48, -47] : [47, 48], [58, 70], { c: C.red, top: C.red, noShadow: true, flat: true, noTop: true });
      }
      mk([this.L - 4, this.L], [-47, 47], [18, 96], { c: C.white, top: "#fff" });
      this.lidB = mk([4, this.L], [-49, 49], [96, 101], { c: C.white, top: "#ffffff", edge: "rgba(0,0,0,0.12)", band: [C.red, 0, 1] });
      mk([this.L + 8, this.L + 108], [-45, 45], [12, 46], { c: this.cab, top: mix(this.cab, "#fff", 0.2) });
      mk([this.L + 14, this.L + 74], [-43, 43], [46, 82], { c: this.cab, top: mix(this.cab, "#fff", 0.15), band: ["#23364F", 0.3, 0.85] });
      mk([this.L + 76, this.L + 108], [-30, 30], [24, 32], { c: "#222", top: "#333" });
      if (this.cold) mk([this.L - 40, this.L], [-26, 26], [96, 112], { c: C.ice2, top: "#B8E6FF" });
      for (const sgn of [-1, 1]) for (const a of [40, 90, this.L + 30, this.L + 85]) mk([a - 16, a + 16], sgn < 0 ? [-54, -42] : [42, 54], [0, 26], { c: "#14181F", top: "#2A303A", noShadow: true });
    }
    place(ox, oy, hd, lidA, lidZ, k) {
      const c = Math.cos(hd), s = Math.sin(hd); k = k || 1;
      for (const p of this.parts) {
        const b = p.b, la = (p.la[0] + p.la[1]) / 2 * k, lb = (p.lb[0] + p.lb[1]) / 2 * k;
        setB(b, ox + c * la - s * lb, oy + s * la + c * lb, p.z[0] * k, (p.la[1] - p.la[0]) * k, (p.lb[1] - p.lb[0]) * k, (p.z[1] - p.z[0]) * k, hd);
      }
      this.lidB.a = this.lid ? (lidA == null ? 1 : lidA) : 0; this.lidB.z = 96 + (lidZ || 0);
    }
    push(f) { for (const p of this.parts) if (p.b.a > 0.01) f.push(p.b); }
  }

  /* ---------- palettes / caisses ---------- */
  function crate(sc, x, y, z, col) { return sc.box({ x, y, z, w: 22, d: 22, h: 14, c: col || C.brown, edge: "rgba(255,255,255,0.25)" }); }

  /* ---------- panneaux d'arches dorées (logo stylisé) ---------- */
  function archesPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-58, 62); ctx.lineTo(-58, -2); ctx.bezierCurveTo(-58, -58, -6, -58, -6, -2); ctx.lineTo(0, 62);
    ctx.moveTo(58, 62); ctx.lineTo(58, -2); ctx.bezierCurveTo(58, -58, 6, -58, 6, -2); ctx.lineTo(0, 62);
  }
  function drawArches(ctx, cx, cy, s, col, line) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.lineJoin = "round"; ctx.lineCap = "round";
    archesPath(ctx);
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = 26; ctx.stroke(); }
    ctx.strokeStyle = col || C.yellow; ctx.lineWidth = 19; ctx.stroke();
    ctx.restore();
  }

    window.SCENES = window.SCENES || [];
  window.LIB = { C, Scene, camAt, applyCam, mkRoute, routeAt, patrol, Person, tree, house, Car, Truck, crate, drawArches, archesPath };
})();
