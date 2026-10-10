// HUD déterministe : cartes DOM dont l'état est une pure fonction de t.
// Chaque carte a une fenêtre [t0, t1], une entrée/sortie animée et éventuellement un point d'ancrage 3D.
import { clamp, ease, inv } from "./util.js";

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
    const el = document.createElement("div");
    el.className = "hc " + (o.cls || "");
    el.innerHTML = o.html || "";
    el.style.opacity = "0";
    this.layer.appendChild(el);
    const it = { inD: 0.5, outD: 0.4, enter: "up", offset: [0, 0], ...o, el };
    this.items.push(it);
    return it;
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
