/* Surcouche HTML : chapitres, étiquettes ancrées au monde 3D, chiffres, texte final */
(function () {
  const E = window.ENG;
  const { clamp, lerp, sm, sm5, prog, eoutB } = E;
  const $ = (s) => document.querySelector(s);
  const CH = [[0.6, 10], [11.2, 25], [26.0, 40], [41.0, 55], [56.0, 70], [71.0, 80]];

  window.buildHudTimeline = function (tl) {
    tl.fromTo("#fade", { opacity: 1 }, { opacity: 0, duration: 0.9, ease: "power2.out" }, 0);
    tl.to("#fade", { opacity: 1, duration: 0.01 }, 84.99);
    tl.fromTo("#chips", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.8);
    CH.forEach((w, i) => {
      const sel = "#c" + (i + 1);
      tl.fromTo(sel, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, w[0]);
      tl.fromTo(sel + " .t", { y: 26 }, { y: 0, duration: 0.8, ease: "power3.out" }, w[0]);
      tl.fromTo(sel + " .bar", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.out" }, w[0] + 0.4);
      tl.to(sel, { opacity: 0, x: 40, duration: 0.5, ease: "power2.in" }, w[1] - 0.5);
    });
    // scène 1 : statistiques
    tl.fromTo("#st1", { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.7, ease: "back.out(1.4)" }, 2.6);
    tl.fromTo("#st2", { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.7, ease: "back.out(1.4)" }, 3.6);
    tl.fromTo("#st3", { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.7, ease: "back.out(1.4)" }, 5.0);
    tl.to("#stats", { opacity: 0, x: -50, duration: 0.5, ease: "power2.in" }, 9.0);
    tl.fromTo("#src", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 3.0); tl.to("#src", { opacity: 0, duration: 0.4 }, 9.0);
    // bannières
    tl.fromTo("#ban3", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "back.out(1.4)" }, 33.2); tl.to("#ban3", { opacity: 0, y: 20, duration: 0.5 }, 38.2);
    tl.fromTo("#ban5", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "back.out(1.4)" }, 67.8); tl.to("#ban5", { opacity: 0, y: 20, duration: 0.5 }, 69.6);
    tl.fromTo("#pct", { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.7, ease: "back.out(1.3)" }, 60.2); tl.to("#pct", { opacity: 0, x: 60, duration: 0.5 }, 66.0);
    // final
    tl.fromTo("#fin .m", { opacity: 0, y: 40, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "back.out(1.5)" }, 81.2);
    tl.fromTo("#fin .t", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 81.9);
    tl.set("#fin", { opacity: 1 }, 81.1);
    tl.fromTo("#disc", { opacity: 0 }, { opacity: 1, duration: 0.8 }, 82.8);
    tl.to("#chips", { opacity: 0, duration: 0.5 }, 79.0);
    tl.to("#fin", { opacity: 0, duration: 0.5 }, 84.5);
  };

  /* étiquettes ancrées : [id, t0, t1, getAnchor, titre, sous-titre, classe, dx, dy] */
  const ST = () => window.SUPPLY_TAGS, LG = () => window.LOGI_TAGS, RS = () => window.RESTO_TAGS, FR = () => window.FRANCH_TAGS;
  const TAGS = [
    // scène 2
    ["pot", 13.8, 17.8, () => ST().potato, "Pommes de terre", "Exploitations agricoles partenaires", "y", 40, -150],
    ["whe", 15.6, 19.2, () => ST().wheat, "Blé", "Pour les pains", "y", 40, -150],
    ["cat", 16.8, 20.2, () => ST().cattle, "Élevages", "Fournisseurs partenaires", "y", 40, -150],
    ["bak", 17.8, 21.6, () => ST().bakery, "Boulangerie industrielle", "Préparation des pains", "y", 30, -150],
    ["fry", 19.4, 23.2, () => ST().fries, "Usine de transformation", "De la pomme de terre à la frite", "", 30, -170],
    ["qc", 22.2, 25.0, () => ST().qc, "Contrôle qualité", "Et sécurité alimentaire", "b", -330, -150],
    // scène 3
    ["dc", 26.2, 29.2, () => LG().dc, "Centre de distribution", "Stockage et préparation des livraisons", "", 30, -170],
    ["cold", 28.8, 31.4, () => LG().cold, "Chambres froides", "Surgelé et frais, températures suivies", "b", 30, -160],
    ["stk", 30.8, 33.8, () => LG().stock, "Gestion des stocks", "Suivi en temps réel", "y", -40, -190],
    ["tmp", 32.6, 35.8, () => LG().truck, "Températures contrôlées", "Pendant le transport vers les restaurants", "b", 20, -160],
    ["r2", 35.4, 38.8, () => LG().r2, "Réseau régional", "Fournisseurs · distribution · restaurants", "", 20, -190],
    ["r3", 37.2, 39.0, () => LG().r3, "Une autre région", "Son propre réseau d’approvisionnement", "y", 20, -190],
    // scène 4
    ["trk", 41.8, 44.6, () => RS().truck, "Réception des marchandises", "Livraison par camion", "", -380, -120],
    ["sto", 43.8, 46.4, () => RS().storage, "Stockage des ingrédients", "Réserve et chambre froide", "b", 30, -130],
    ["kio", 45.6, 48.2, () => RS().kiosk, "Bornes de commande", "Le client compose sa commande", "y", 40, -170],
    ["kit", 47.2, 50.0, () => RS().kitchen, "Cuisine", "Préparation, frites, assemblage", "", 30, -190],
    ["cnt", 50.6, 53.0, () => RS().counter, "Remise de la commande", "Au comptoir", "y", 30, -150],
    ["drv", 51.8, 54.2, () => RS().drive, "Drive", "Commande remise à la fenêtre", "b", 30, -130],
    ["dlv", 53.0, 54.9, () => RS().deliv, "Livraison", "Prête pour les coursiers", "", 30, -120],
    // scène 5
    ["hq", 58.8, 62.2, () => FR().hq, "McDonald’s Corporation", "Marque, standards, grandes orientations", "", 40, -170],
    ["eu", 62.0, 65.0, () => FR().eu, "Franchisés indépendants", "Exploitent la majorité des restaurants", "y", 40, -190],
    ["sup", 65.0, 66.9, () => FR().sup, "Fournisseurs partenaires", "Approvisionnent les restaurants", "b", 40, -170],
    ["cre", 67.0, 69.0, () => FR().crew, "Équipes locales", "Assurent le service", "y", 50, -150],
    ["loc", 68.0, 69.8, () => FR().local, "Menus adaptés", "Aux marchés locaux", "", -300, -130],
  ];
  const holder = $("#tags");
  const els = TAGS.map((t) => {
    const d = document.createElement("div"); d.className = "tg " + (t[6] || ""); d.innerHTML = '<div class="ln"></div><div class="dot"></div><div class="cd"><div class="a">' + t[4] + '</div><div class="b">' + t[5] + "</div></div>";
    holder.appendChild(d); return { d, ln: d.querySelector(".ln"), cd: d.querySelector(".cd") };
  });
  els.forEach((e, i) => { const t = TAGS[i], dx = t[7], dy = t[8]; e.cd.style.left = dx + "px"; e.cd.style.top = dy + "px"; const L = Math.hypot(dx, dy); e.ln.style.height = L + "px"; e.ln.style.top = "0px"; e.ln.style.transformOrigin = "0 0"; e.ln.style.transform = "rotate(" + (Math.atan2(dy, dx) + Math.PI / 2) + "rad)"; });

  const chips = Array.from(document.querySelectorAll(".chip"));
  const tchips = Array.from(document.querySelectorAll(".tilechip"));
  const v1 = $("#v1n"), v2 = $("#v2n"), pn = $("#pctn");
  const fmt = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  window.HUD = function (t) {
    // chiffres
    v1.textContent = fmt(45000 * sm5(prog(t, 2.8, 5.0))); v2.textContent = fmt(100 * sm5(prog(t, 3.8, 5.6)));
    pn.textContent = String(Math.round(95 * sm5(prog(t, 60.6, 62.4))));
    // chapitres
    const sc = t < 10.5 ? 0 : t < 25.5 ? 1 : t < 40.5 ? 2 : t < 55.5 ? 3 : t < 70.5 ? 4 : 5;
    chips.forEach((c, i) => { const on = i === sc; if (c._on !== on) { c._on = on; c.classList.toggle("on", on); } });
    // étiquettes
    TAGS.forEach((tg, i) => {
      const e = els[i], o = sm(prog(t, tg[1], tg[1] + 0.5)) * (1 - sm(prog(t, tg[2] - 0.45, tg[2])));
      if (o < 0.003) { if (e.vis) { e.d.style.opacity = "0"; e.vis = false; } return; }
      const a = tg[3](); if (!a) return; E.P(a[0], a[1], a[2]);
      e.d.style.transform = "translate(" + E.px().toFixed(1) + "px," + E.py().toFixed(1) + "px) scale(" + (0.85 + 0.15 * o).toFixed(3) + ")";
      e.d.style.opacity = o.toFixed(3); e.vis = true;
    });
    // pastilles de la scène finale
    const tiles = window.FIN_TILES;
    tchips.forEach((c, k) => {
      const o = tiles ? sm(prog(t, 75.0 + k * 0.45, 75.6 + k * 0.45)) * (1 - sm(prog(t, 79.4, 80.0))) : 0;
      if (o < 0.003) { if (c._v) { c.style.opacity = "0"; c._v = false; } return; }
      const q = tiles[k]; E.P(q.cx, q.cy, 80); c.style.transform = "translate(" + (E.px() - 56).toFixed(1) + "px," + (E.py() - 90 - 8 * Math.sin(t * 3 + k)).toFixed(1) + "px)"; c.style.opacity = o.toFixed(3); c._v = true;
    });
  };
})();
