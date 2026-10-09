/* NEXALOG — surcouche graphique (HTML) : titres, étapes, KPI, suivi produit */
(function () {
  const E = window.ENG, Wd = window.WORLD;
  const { clamp, lerp, sm, sm5, prog } = E;
  const $ = (id) => document.getElementById(id);

  // fenêtres des 5 étapes : [début, fin]
  const STEPS = [[10.6, 18.9], [19.9, 27.7], [28.5, 35.7], [36.4, 43.7], [44.4, 51.0]];
  const KPI = [[1840, 0], [48000, 0], [12000, 0], [99.98, 2], [1, 0]];

  window.buildHudTimeline = function (tl) {
    tl.fromTo("#hook", { opacity: 0, scale: 1.45 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.8)" }, 0.3);
    tl.to("#hook", { opacity: 0, y: -60, duration: 0.35, ease: "power2.in" }, 2.8);
    [6.6, 19.5, 28.2, 36.0, 44.0, 52.3].forEach((tt) => {
      tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.75, duration: 0.09, ease: "power1.out" }, tt - 0.05);
      tl.to("#flash", { opacity: 0, duration: 0.4, ease: "power2.out" }, tt + 0.04);
    });
    // fondu d'entrée / sortie
    tl.fromTo("#fade", { opacity: 1 }, { opacity: 0, duration: 1.0, ease: "power2.out" }, 0);
    tl.to("#fade", { opacity: 1, duration: 0.7, ease: "power2.in" }, 55.3);
    // titre d'ouverture
    tl.set("#open", { opacity: 1 }, 2.9);
    tl.fromTo("#open .eyebrow", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, 3.0);
    tl.fromTo("#openName span", { opacity: 0, y: 90, rotationX: -50 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.8, ease: "back.out(1.5)", stagger: 0.07 }, 3.2);
    tl.fromTo("#openTag", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 4.1);
    tl.to("#shadeL", { opacity: 1, duration: 0.8 }, 2.9);
    tl.to("#open", { opacity: 0, x: -80, duration: 0.8, ease: "power2.in" }, 6.0);
    tl.to("#shadeL", { opacity: 0, duration: 0.8 }, 6.2);
    tl.to("#shadeS", { opacity: 1, duration: 1.0 }, 10.2);
    tl.to("#shadeS", { opacity: 0, duration: 1.0 }, 51.0);
    // étapes
    STEPS.forEach((w, i) => {
      const sel = "#s" + (i + 1), k = "#k" + (i + 1);
      tl.fromTo(sel, { opacity: 0, x: -70 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, w[0]);
      tl.fromTo(sel + " .num", { y: 30 }, { y: 0, duration: 0.9, ease: "power3.out" }, w[0]);
      tl.fromTo(sel + " .bar", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out" }, w[0] + 0.5);
      tl.to(sel, { opacity: 0, x: 50, duration: 0.55, ease: "power2.in" }, w[1] - 0.55);
      tl.fromTo(k, { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, w[0] + 0.6);
      tl.to(k, { opacity: 0, y: -30, duration: 0.5, ease: "power2.in" }, w[1] - 0.5);
    });
    // rail de progression
    tl.fromTo("#rail", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 10.2);
    tl.to("#rail", { opacity: 0, y: 30, duration: 0.6, ease: "power2.in" }, 51.0);
    // fermeture
    tl.set("#outro", { opacity: 1 }, 52.6);
    tl.to("#shadeL", { opacity: 1, duration: 0.9 }, 52.4);
    tl.fromTo("#outro .eyebrow", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, 52.8);
    tl.fromTo("#outName span", { opacity: 0, y: 90, rotationX: -50 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.8, ease: "back.out(1.5)", stagger: 0.06 }, 53.0);
    tl.fromTo("#outro .tag", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 53.7);
    tl.fromTo("#outro .chip", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.12 }, 54.0);
  };

  const fmt = (v, d) => {
    const f = d ? v.toFixed(d).replace(".", ",") : String(Math.round(v));
    const parts = f.split(",");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.join(",");
  };
  const heroSt = $("heroSt"), heroSub = $("heroSub"), heroTag = $("heroTag"), railFill = $("railFill");
  const heroStages = [
    [13.0, "Réception", "Quai Q3 · déchargement"],
    [17.2, "Transfert", "Navette autonome N°7"],
    [22.5, "Stockage", "Allée A1 · niveau 2"],
    [28.4, "Déstockage", "Commande 7 316 reçue"],
    [30.6, "Tri intelligent", "Scan validé · flux 02"],
    [36.6, "Préparation", "Cellule robotisée C1"],
    [41.4, "Conditionné", "Colis scellé · étiqueté"],
    [46.2, "Expédition", "Quai E2 · chargement"],
    [49.6, "En route", "Livraison magasin J+1"],
  ];
  let lastStage = -1;
  const EQ = [
    { id: "e1", t0: 12.4, t1: 17.6, at: (t) => { const tk = Wd.recvTrucks[2]; return tk.curW ? [tk.curW[0], tk.curW[1] + 220, 120] : [1010, 1000, 120]; } },
    { id: "e2", t0: 21.4, t1: 26.2, at: (t) => { const sh = Wd.HERO.shuttle; const R = sh.R; const o = Wd.routeAtH(R, t); return [o.x, o.y, 50]; } },
    { id: "e3", t0: 29.2, t1: 34.0, at: () => [1200, 262, 78] },
    { id: "e4", t0: 37.2, t1: 42.4, at: () => [Wd.cells[2].xc, 660, 100] },
    { id: "e5", t0: 45.4, t1: 49.6, at: (t) => { const tk = Wd.outTrucks[1]; return tk.curW ? [tk.curW[0] - 40, tk.curW[1], 130] : [-120, 330, 130]; } },
  ];
  const eqEl = EQ.map((q) => $(q.id));
  const nodes = Array.from(document.querySelectorAll("#rail .n"));
  const kvals = [$("k1v"), $("k2v"), $("k3v"), $("k4v"), $("k5v")];

  const VT = [["Chaque jour, des milliers de produits traversent un seul endroit.", 0.9, 3.2], ["Bienvenue chez Nexalog.", 4.3, 1.5], ["Suivons le parcours d'un produit.", 7.1, 1.7],
    ["D'abord, la réception. Les camions arrivent, et chaque palette est identifiée en quelques secondes.", 11.0, 5.5],
    ["Puis le stockage automatisé. Des navettes autonomes rangent chaque palette, parmi des milliers d'emplacements.", 20.2, 5.8],
    ["Les colis sont triés à pleine vitesse, scannés sous tous les angles, puis aiguillés vers leur destination.", 28.8, 5.8],
    ["Des bras robotisés préparent chaque commande, avec une précision quasi parfaite.", 36.8, 4.4],
    ["Enfin, l'expédition. Les camions chargés partent livrer vos magasins, dès le lendemain.", 44.6, 4.7], ["Nexalog. La logistique, en mouvement intelligent.", 53.0, 2.7]];
  const WORDS = [];
  VT.forEach((s) => {
    const w = s[0].split(" "), tot = w.reduce((a, x) => a + x.length + 2, 0); let c = s[1];
    const chunks = [];
    for (let i = 0; i < w.length; i += 3) chunks.push(w.slice(i, i + 3));
    let idx = 0;
    chunks.forEach((ch) => {
      const t0 = c; const items = ch.map((x) => { const d = (x.length + 2) / tot * (s[2] - 0.1); const o = { x, a: c, b: c + d }; c += d; return o; });
      WORDS.push({ t0, t1: c, items });
    });
  });
  const capEl = document.getElementById("cap"), pfill = document.getElementById("pfill");
  let capKey = "";
  window.HUD = function (t) {
    pfill.style.width = (clamp(t / 56, 0, 1) * 100).toFixed(2) + "%";
    let key = "", ch = null;
    for (const c of WORDS) if (t >= c.t0 - 0.05 && t < c.t1 + 0.18) { ch = c; break; }
    if (ch) { let on = -1; ch.items.forEach((it, i) => { if (t >= it.a) on = i; }); key = ch.t0 + ":" + on; }
    if (key !== capKey) {
      capKey = key;
      capEl.innerHTML = ch ? ch.items.map((it, i) => '<span class="' + (i === (key.split(":")[1] | 0) ? "on" : "") + '">' + it.x + "</span>").join("") : "";
    }
    // compteurs
    for (let i = 0; i < 5; i++) {
      const w = STEPS[i], u = sm5(prog(t, w[0] + 0.5, w[0] + 2.6));
      if (t < w[0] - 0.2 || t > w[1] + 0.2) continue;
      if (i === 4) kvals[i].textContent = "+" + Math.round(u * 1);
      else kvals[i].textContent = fmt(KPI[i][0] * u, KPI[i][1]);
    }
    // rail
    const rp = clamp((t - 11.0) / (49.8 - 11.0), 0, 1);
    railFill.style.width = (rp * 100).toFixed(2) + "%";
    nodes.forEach((n, i) => {
      const on = rp >= i / 4 - 0.001;
      n.style.color = on ? "#eaf3ff" : "#8fa8d6";
      n.firstChild.style.borderColor = on ? "#22e1ff" : "#8fa8d6";
      n.firstChild.style.background = on ? "#22e1ff" : "#060d24";
      n.firstChild.style.boxShadow = on ? "0 0 14px rgba(34,225,255,0.9)" : "none";
    });
    // étiquette du produit héros
    let a = sm(prog(t, 13.0, 13.8)) * (1 - sm(prog(t, 51.2, 52.2)));
    if (a > 0.001) {
      const p = Wd.HERO.pos(t);
      E.P(p[0], p[1], p[2]);
      let x = E.px(), y = E.py();
      x = clamp(x, 70, 560); y = clamp(y, 330, 1000);
      heroTag.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      heroTag.style.opacity = a.toFixed(3);
      let st = 0; for (let i = 0; i < heroStages.length; i++) if (t >= heroStages[i][0]) st = i;
      if (st !== lastStage) { lastStage = st; heroSt.textContent = heroStages[st][1]; heroSub.textContent = heroStages[st][2]; }
    } else heroTag.style.opacity = "0";
    // bulles d'équipements
    EQ.forEach((q, i) => {
      const el = eqEl[i];
      const o = sm(prog(t, q.t0, q.t0 + 0.6)) * (1 - sm(prog(t, q.t1 - 0.5, q.t1)));
      if (o < 0.002) { el.style.opacity = "0"; return; }
      const p = q.at(t); E.P(p[0], p[1], p[2]);
      el.style.transform = "translate(" + E.px().toFixed(1) + "px," + E.py().toFixed(1) + "px)";
      el.style.opacity = o.toFixed(3);
    });
  };
})();
