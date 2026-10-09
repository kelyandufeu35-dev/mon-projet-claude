import * as THREE from 'three';
import { seg, smooth, easeOutCubic, clamp } from '../util/math.js';
import { css } from './palette.js';
import { W, H } from './stage.js';

/* =========================================================================
 * Étiquettes HTML ancrées dans la 3D (texte net, polices locales).
 * kind : 'card' (titre + sous-titre), 'tag' (pastille de rôle), 'chip' (note)
 * ========================================================================= */
export class Labels {
  constructor(root, rig) { this.root = root; this.rig = rig; this.items = []; this._v = new THREE.Vector3(); this._c = new THREE.Vector3(); }

  add({ kind = 'tag', title, sub = '', color = 0xffc72c, anchor, dx = 0, dy = -60, t0, t1 = Infinity, inDur = 0.5, outDur = 0.4, align = 'center', num = null, scale = 1, stem = true, className = '', radial = null }) {
    const el = document.createElement('div');
    el.className = `lbl ${kind} ${className}`.trim();
    el.style.setProperty('--accent', css(color));
    el.style.setProperty('--s', String(scale));
    const hasStem = stem && (dx !== 0 || dy !== 0 || !!radial);
    el.innerHTML =
      (hasStem ? '<i class="stem"></i>' : '') + '<i class="dot"></i>' +
      `<div class="box a-${align}">${num ? `<em>${num}</em>` : ''}<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    el.style.display = 'none';
    this.root.appendChild(el);
    const it = { kind, align, el, anchor, dx, dy, radial, t0, t1, inDur, outDur, hasStem, box: el.querySelector('.box'), stemEl: el.querySelector('.stem'), dist: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) };
    this.items.push(it);
    return it;
  }

  update(t) {
    const v = this._v;
    for (const it of this.items) {
      const pin = seg(t, it.t0, it.t0 + it.inDur, easeOutCubic);
      const pout = it.t1 === Infinity ? 0 : seg(t, it.t1, it.t1 + it.outDur, smooth);
      const p = pin * (1 - pout);
      if (p <= 0.001) { if (it.shown) { it.el.style.display = 'none'; it.shown = false; } continue; }
      if (!it.shown) { it.el.style.display = ''; it.shown = true; }
      const a = typeof it.anchor === 'function' ? it.anchor(t, v) : it.anchor;
      v.copy(a);
      this.rig.project(v, v, W, H);
      let dx = it.dx, dy = it.dy;
      if (it.radial) {
        // décalage radial : à l'opposé du centre (projeté) pour éviter les chevauchements
        const c = this._c.copy(it.radial.center); this.rig.project(c, c, W, H);
        let rx = v.x - c.x, ry = v.y - c.y; const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;
        dx = rx * it.radial.len + (it.radial.ox || 0); dy = ry * it.radial.len * (it.radial.sy ?? 0.8) + (it.radial.oy || 0);
        it.dist = Math.hypot(dx, dy); it.ang = Math.atan2(dy, dx);
      }
      // ancre hors champ => on n'affiche rien (évite les cartes qui flottent hors cadre)
      if (v.x < -160 || v.x > W + 160 || v.y < -160 || v.y > H + 160) { if (it.shown) { it.el.style.display = 'none'; it.shown = false; } continue; }
      // zone sûre : la carte ne doit pas recouvrir les sous-titres (bas) ni le titre de chapitre (haut gauche)
      if (it.kind !== 'tag' || true) {
        const bw = it.box.offsetWidth * (0.9 + 0.1 * pin), bh = it.box.offsetHeight;
        let bx = v.x + dx, by = v.y + dy;               // point d'ancrage de la boîte
        const x0 = it.align === 'center' ? bx - bw / 2 : it.align === 'right' ? bx - bw : bx;
        const y0 = by - bh / 2;
        let nx = x0, ny = y0;
        const minY = x0 < 1010 ? 168 : 44, maxY = 884 - bh;
        ny = Math.min(Math.max(ny, minY), maxY); nx = Math.min(Math.max(nx, 40), W - 40 - bw);
        if (Math.abs(nx - x0) > 0.5 || Math.abs(ny - y0) > 0.5) {
          dx += nx - x0; dy += ny - y0;
          it.dist = Math.hypot(dx, dy); it.ang = Math.atan2(dy, dx);
        }
      }
      it.el.style.transform = `translate(${v.x.toFixed(1)}px, ${v.y.toFixed(1)}px)`;
      it.el.style.opacity = p.toFixed(3);
      if (it.hasStem) {
        it.stemEl.style.width = `${(it.dist * pin).toFixed(1)}px`;
        it.stemEl.style.transform = `rotate(${it.ang}rad)`;
      }
      const slide = (1 - pin) * 14;
      it.box.style.transform = `translate(${dx.toFixed(1)}px, ${(dy + slide).toFixed(1)}px) scale(${(0.9 + 0.1 * pin).toFixed(3)})`;
    }
  }
}
