// Interface holographique sobre : légendes à ligne de rappel ancrées sur des points 3D projetés à
// l'écran, et carton de titre. Tout est une fonction pure du temps (déterministe).
//
// Aucune caractéristique chiffrée n'est affichée : les textes restent qualitatifs.

import * as THREE from 'three';
import { smoothstep, clamp } from '../../engine/rng.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const FONT = '"Inter", "Inter Display", system-ui, sans-serif';

function el(tag, style = {}, text = null, parent = null) {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

/**
 * @param {object} p
 * @param {HTMLElement} p.root     conteneur 1920x1080 (position: absolute)
 * @param {object} p.world         résultat de createWorld (camera, gpu, tray, L)
 * @param {number} p.width
 * @param {number} p.height
 */
export function createHud({ root, world, width = 1920, height = 1080 }) {
  root.style.fontFamily = FONT;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' });
  root.appendChild(svg);

  const dieWorld = world.gpu.localToWorld(new THREE.Vector3(0, 0.0016, 0));
  const hbmWorld = world.gpu.localToWorld(new THREE.Vector3(0.0194, 0.0016, 0));
  const trayWorld = new THREE.Vector3(world.P.x + 0.05, world.P.y + 0.02, world.P.z + 0.35);

  // Légendes ancrées : [début, fin] en secondes, ancre 3D, décalage (px) de l'étiquette.
  const anchored = [
    { t0: 1.6, t1: 4.6, anchor: dieWorld, off: [-300, -250], title: 'PUCE DE CALCUL', sub: 'Le cœur du calcul parallèle', align: 'right' },
    { t0: 3.0, t1: 6.0, anchor: hbmWorld, off: [250, -230], title: 'MÉMOIRE À HAUTE BANDE PASSANTE', sub: 'Des couches de DRAM empilées, au plus près de la puce', align: 'left' },
    { t0: 20.4, t1: 24.2, anchor: trayWorld, off: [220, -150], title: 'PLATEAU SERVEUR GPU', sub: 'Plusieurs accélérateurs réunis dans un seul châssis', align: 'left' },
  ];
  // Légendes fixes (bas gauche).
  const fixed = [
    { t0: 10.0, t1: 14.0, title: 'ARCHITECTURE DE CALCUL', sub: 'Des milliers de cœurs travaillent en parallèle' },
    { t0: 26.4, t1: 29.6, title: 'CENTRE DE DONNÉES', sub: 'Des milliers de machines, un seul calculateur' },
  ];

  const mk = (cfg, isFixed) => {
    const wrap = el('div', { position: 'absolute', opacity: 0, willChange: 'opacity, transform', textTransform: 'uppercase' }, null, root);
    el('div', { fontWeight: 400, fontSize: '20px', letterSpacing: '0.22em', color: '#f1f7e6', textShadow: '0 0 14px rgba(118,185,0,0.55), 0 1px 2px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }, cfg.title, wrap);
    el('div', { fontWeight: 300, fontSize: '15px', letterSpacing: '0.14em', color: 'rgba(222,234,204,0.88)', marginTop: '7px', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }, cfg.sub, wrap);
    const rule = el('div', { height: '1px', marginTop: '10px', background: 'linear-gradient(90deg, rgba(118,185,0,0.95), rgba(118,185,0,0))', width: '100%' }, null, wrap);
    if (cfg.align === 'right') rule.style.background = 'linear-gradient(270deg, rgba(118,185,0,0.95), rgba(118,185,0,0))';
    let poly = null, ring = null;
    if (!isFixed) {
      poly = document.createElementNS(SVG_NS, 'polyline');
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', 'rgba(190,235,110,0.85)');
      poly.setAttribute('stroke-width', '1.2');
      svg.appendChild(poly);
      ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('r', '5');
      ring.setAttribute('fill', 'rgba(118,185,0,0.25)');
      ring.setAttribute('stroke', 'rgba(210,245,150,0.95)');
      ring.setAttribute('stroke-width', '1.3');
      svg.appendChild(ring);
    }
    return { cfg, wrap, poly, ring };
  };
  const items = [...anchored.map((c) => mk(c, false)), ...fixed.map((c) => mk(c, true))];

  // Carton de titre.
  const veil = el('div', { position: 'absolute', left: 0, top: 0, width: `${width}px`, height: `${height}px`, opacity: 0, background: 'radial-gradient(ellipse 55% 42% at 50% 50%, rgba(0,0,0,0.62), rgba(0,0,0,0.0) 100%)' }, null, root);
  const title = el('div', { position: 'absolute', left: 0, top: 0, width: `${width}px`, height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0 }, null, root);
  el('div', { fontFamily: '"Inter Display", "Inter", sans-serif', fontWeight: 700, fontSize: '118px', letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#f4f8ec', textShadow: '0 0 40px rgba(118,185,0,0.45), 0 4px 30px rgba(0,0,0,0.65)' }, 'NVIDIA', title);
  const tline = el('div', { height: '2px', width: '0px', marginTop: '26px', background: 'linear-gradient(90deg, rgba(118,185,0,0), #76b900 20%, #76b900 80%, rgba(118,185,0,0))' }, null, title);
  el('div', { marginTop: '24px', fontWeight: 300, fontSize: '22px', letterSpacing: '0.62em', paddingLeft: '0.62em', color: 'rgba(232,240,220,0.9)', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }, 'Le documentaire', title);
  el('div', { marginTop: '12px', fontWeight: 300, fontSize: '14px', letterSpacing: '0.4em', paddingLeft: '0.4em', color: 'rgba(200,214,180,0.7)', textTransform: 'uppercase' }, 'Scène pilote · référence visuelle', title);

  const v = new THREE.Vector3();

  const alphaOf = (t, t0, t1) => smoothstep(t0, t0 + 0.7, t) * (1 - smoothstep(t1 - 0.7, t1, t));

  function update(t) {
    const cam = world.camera;
    for (const it of items) {
      const c = it.cfg;
      const a = alphaOf(t, c.t0, c.t1);
      it.wrap.style.opacity = String(a);
      if (!it.poly) {
        // Légende fixe : en bas à gauche, dérive très légère.
        const drift = (t - c.t0) * 2.0;
        it.wrap.style.transform = `translate(${96 + drift}px, ${height - 190}px)`;
        continue;
      }
      v.copy(c.anchor).project(cam);
      const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      const ax = (v.x * 0.5 + 0.5) * width;
      const ay = (-v.y * 0.5 + 0.5) * height;
      const k = visible ? a : 0;
      it.wrap.style.opacity = String(k);
      it.poly.setAttribute('opacity', String(k));
      it.ring.setAttribute('opacity', String(k));
      if (!visible) continue;
      // L'étiquette passe de l'autre côté de l'ancre quand celle-ci est trop près du bord droit.
      const flip = ax > width * 0.6 && c.align === 'left';
      const ox = flip ? -Math.abs(c.off[0]) : c.off[0];
      const bx = ax + ox * 0.55, by = ay + c.off[1];
      const cx = ax + ox, cy = ay + c.off[1];
      it.poly.setAttribute('points', `${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`);
      it.ring.setAttribute('cx', ax.toFixed(1));
      it.ring.setAttribute('cy', ay.toFixed(1));
      const w = it.wrap.offsetWidth || 340;
      const tx = (c.align === 'right' || flip) ? cx - w : cx;
      it.wrap.style.transform = `translate(${tx.toFixed(1)}px, ${(cy - 58).toFixed(1)}px)`;
    }
    // Titre : apparition douce en fin de séquence.
    const ta = smoothstep(29.4, 30.6, t);
    title.style.opacity = String(ta);
    veil.style.opacity = String(ta);
    tline.style.width = `${Math.round(clamp((t - 29.8) / 1.4, 0, 1) * 520)}px`;
  }

  return { update };
}
