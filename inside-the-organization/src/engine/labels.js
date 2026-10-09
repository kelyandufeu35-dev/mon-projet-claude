import * as THREE from 'three';
import { seg, smooth, easeOutCubic, clamp } from '../util/math.js';
import { css } from './palette.js';
import { W, H } from './stage.js';
import { SAFE, LBL, LBLD, PORTRAIT } from '../format.js';

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
    el.style.setProperty('--s', String(scale * LBL));
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
    const live = [];                                   // étiquettes visibles à cette image
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
        dx = rx * it.radial.len * LBLD + (it.radial.ox || 0); dy = ry * it.radial.len * LBLD * (it.radial.sy ?? 0.8) + (it.radial.oy || 0);
      } else { dx *= LBLD; dy *= LBLD; }
      // ancre hors champ => on n'affiche rien (évite les cartes qui flottent hors cadre)
      if (v.x < -160 || v.x > W + 160 || v.y < -160 || v.y > H + 160) { if (it.shown) { it.el.style.display = 'none'; it.shown = false; } continue; }
      // zone sûre : la carte ne doit pas recouvrir les sous-titres (bas) ni le titre de chapitre (haut)
      const bw = it.box.offsetWidth, bh = it.box.offsetHeight;
      const bx = v.x + dx, by = v.y + dy;               // point d'ancrage de la boîte
      const x0 = it.align === 'center' ? bx - bw / 2 : it.align === 'right' ? bx - bw : bx;
      const y0 = by - bh / 2;
      const r = it._r || (it._r = {});
      r.x = Math.min(Math.max(x0, SAFE.left), SAFE.right - bw); r.y = Math.min(Math.max(y0, SAFE.top(x0)), SAFE.bottom - bh);
      r.w = bw; r.h = bh; r.x0 = x0; r.y0 = y0; r.dx = dx; r.dy = dy; r.vx = v.x; r.vy = v.y; r.pin = pin; r.p = p;
      live.push(it);
    }
    if (PORTRAIT) this._separate(live);
    for (const it of live) {
      const r = it._r;
      const dx = r.dx + (r.x - r.x0), dy = r.dy + (r.y - r.y0);
      it.dist = Math.hypot(dx, dy); it.ang = Math.atan2(dy, dx);
      it.el.style.transform = `translate(${r.vx.toFixed(1)}px, ${r.vy.toFixed(1)}px)`;
      it.el.style.opacity = r.p.toFixed(3);
      if (it.hasStem) {
        it.stemEl.style.width = `${(it.dist * r.pin).toFixed(1)}px`;
        it.stemEl.style.transform = `rotate(${it.ang}rad)`;
      }
      const slide = (1 - r.pin) * 14;
      it.box.style.transform = `translate(${dx.toFixed(1)}px, ${(dy + slide).toFixed(1)}px) scale(${(0.9 + 0.1 * r.pin).toFixed(3)})`;
    }
  }

  /** Portrait : les cartes sont plus grandes et la largeur est étroite ; on place les boîtes une à une (ordre de création =
   *  priorité) à la position libre la plus proche de leur position voulue. Fonction pure de l'image courante : déterministe. */
  _separate(live) {
    const G = 12;
    const placed = [];
    const clampR = (r, x, y) => [Math.min(Math.max(x, SAFE.left), SAFE.right - r.w), Math.min(Math.max(y, SAFE.top(x)), SAFE.bottom - r.h)];
    const overlap = (r, x, y, b) => {
      const ox = Math.min(x + r.w, b.x + b.w) + G - Math.max(x, b.x), oy = Math.min(y + r.h, b.y + b.h) + G - Math.max(y, b.y);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    };
    const cost = (r, x, y) => { let c = 0; for (const b of placed) c += overlap(r, x, y, b); return c; };
    for (const it of live) {
      const r = it._r; const wx = r.x, wy = r.y;           // position voulue (déjà dans la zone sûre)
      if (cost(r, wx, wy) > 0) {
        let best = [wx, wy], bc = Infinity, bd = Infinity;
        const tryPos = (cx, cy) => {
          const [x, y] = clampR(r, cx, cy); const c = cost(r, x, y), d = Math.hypot(x - wx, (y - wy) * 1.6);
          if (c < bc || (c === bc && d < bd)) { bc = c; bd = d; best = [x, y]; }
        };
        for (const b of placed) {
          tryPos(wx, b.y - r.h - G); tryPos(wx, b.y + b.h + G);
          tryPos(b.x - r.w - G, wy); tryPos(b.x + b.w + G, wy);
          tryPos(b.x, b.y - r.h - G); tryPos(b.x, b.y + b.h + G);
        }
        r.x = best[0]; r.y = best[1];
      }
      placed.push(r);
    }
  }
}
