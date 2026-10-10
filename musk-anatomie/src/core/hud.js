// HUD déterministe : cartes DOM dont l'état est une pure fonction de t.
// Chaque carte a une fenêtre [t0, t1], une entrée/sortie animée et éventuellement un point d'ancrage 3D.
import { clamp, ease, inv } from "./util.js";
import { PORTRAIT } from "./format.js";

export class Hud {
  constructor(layer, world) {
    this.layer = layer;
    this.world = world;
    this.items = [];
  }

  /**
   * @param {object} o
   *  id, html, cls            contenu et classes CSS
   *  x, y                     position écran (px, centre de l'élément) si pas d'ancre
   *  anchor: () => Vector3    ancre monde ; offset: [dx, dy] en px
   *  t0, t1                   fenêtre de visibilité
   *  inD, outD                durées d'entrée/sortie
   *  enter: 'up'|'down'|'left'|'right'|'scale'|'fade'
   *  dyn: (t, el, k) => void  mise à jour dynamique du contenu (compteurs…)
   *  anchorAlign: 'center'|'left'|'right'
   */
  card(o) {
    // portrait : skipP = carte non affichée ; htmlP = texte condensé ; p = placement fixe { x, y, align } (sinon empilement auto)
    if (PORTRAIT && o.skipP) return null;
    if (!PORTRAIT && o.onlyP) return null;
    const el = document.createElement("div");
    el.className = "hc " + (o.cls || "");
    const html = PORTRAIT && o.htmlP ? o.htmlP : o.html || "";
    el.innerHTML = PORTRAIT ? `<div class="hz">${html}</div>` : html;
    el.style.opacity = "0";
    this.layer.appendChild(el);
    const it = { inD: 0.5, outD: 0.4, enter: "up", offset: [0, 0], ...o, el };
    if (PORTRAIT) {
      if (o.p) Object.assign(it, { anchor: null }, o.p);
      else it.auto = true;
    }
    this.items.push(it);
    return it;
  }

  /**
   * Portrait : place chaque carte non fixée dans une bande haute ou basse, empilée sans chevauchement temporel
   * ni vertical (algorithme glouton sur les intervalles [t0, t1]). La zone centrale reste libre pour la 3D.
   */
  layoutPortrait({ top = [250, 800], bottom = [1090, 1490], gap = 16, pad = 0.2 } = {}) {
    const cards = this.items.filter((it) => it.auto).sort((a, b) => a.t0 - b.t0);
    const placed = [];
    for (const it of cards) {
      const el = it.el;
      const saved = { d: el.style.display, v: el.style.visibility, o: el.style.opacity, t: el.style.transform };
      el.style.display = ""; el.style.visibility = "hidden"; el.style.opacity = "1"; el.style.transform = "none";
      const h = el.offsetHeight;
      el.style.display = saved.d || "none"; el.style.visibility = saved.v; el.style.opacity = saved.o; el.style.transform = saved.t;
      const T0 = it.t0 - pad, T1 = it.t1 + pad;
      const order = it.zone === "bottom" ? [["bottom", bottom], ["top", top]] : [["top", top], ["bottom", bottom]];
      let pos = null;
      for (const [name, [zs, ze]] of order) {
        const fits = (y0) => !placed.some((p) => p.t0 < T1 && p.t1 > T0 && p.y0 < y0 + h + gap && p.y1 + gap > y0);
        if (name === "bottom") for (let y0 = ze - h; y0 >= zs; y0 -= 6) { if (fits(y0)) { pos = y0; break; } }
        else for (let y0 = zs; y0 + h <= ze; y0 += 6) { if (fits(y0)) { pos = y0; break; } }
        if (pos !== null) break;
      }
      if (pos === null) { console.warn("[hud] aucune place pour", it.id); pos = top[0]; }
      placed.push({ y0: pos, y1: pos + h, t0: T0, t1: T1 });
      it.anchor = null; it.x = 540; it.y = pos + h / 2; it.align = "center";
    }
  }

  update(t) {
    for (const it of this.items) {
      const a = ease.out3(inv(it.t0, it.t0 + it.inD, t));
      const b = 1 - ease.io2(inv(it.t1 - it.outD, it.t1, t));
      const k = a * b;
      const el = it.el;
      if (k <= 0.002) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      if (el.style.display === "none") el.style.display = "";
      let x = it.x ?? 0, y = it.y ?? 0, z = 1;
      if (it.anchor) {
        const s = this.world.toScreen(it.anchor(t));
        x = s.x + it.offset[0];
        y = s.y + it.offset[1];
        z = 1;
      }
      const slide = (1 - a) * 36 + (1 - b) * -18;
      let tx = 0, ty = 0, sc = 1;
      switch (it.enter) {
        case "up": ty = slide; break;
        case "down": ty = -slide; break;
        case "left": tx = slide * 1.6; break;
        case "right": tx = -slide * 1.6; break;
        case "scale": sc = 0.82 + 0.18 * a * b; break;
        default: break;
      }
      el.style.opacity = String(clamp(k));
      const ax = it.align === "left" ? "0%" : it.align === "right" ? "-100%" : "-50%";
      el.style.transform = `translate(${(x + tx).toFixed(1)}px, ${(y + ty).toFixed(1)}px) translate(${ax}, -50%) scale(${sc.toFixed(3)})`;
      if (it.dyn) it.dyn(t, el, k);
    }
  }
}

/** sous-titres : un segment de narration visible entre start et end */
export class Subtitles {
  constructor(el, segments) {
    this.el = el;
    this.segs = segments;
    this.cur = null;
  }
  update(t) {
    let s = null;
    for (const g of this.segs) if (t >= g.start - 0.05 && t <= g.end - 0.1) { s = g; break; }
    if (s === this.cur) return;
    this.cur = s;
    if (!s) { this.el.style.opacity = "0"; return; }
    this.el.textContent = s.text;
    this.el.style.opacity = "1";
  }
}

/** voile (flash blanc/bleu) et fondu noir : liste d'événements { t, up, hold, down } */
export function veil(el, events, t) {
  let k = 0;
  for (const e of events) {
    const a = ease.io2(inv(e.t - e.up, e.t, t));
    const b = 1 - ease.io2(inv(e.t + e.hold, e.t + e.hold + e.down, t));
    k = Math.max(k, a * b);
  }
  el.style.opacity = String(clamp(k));
}
