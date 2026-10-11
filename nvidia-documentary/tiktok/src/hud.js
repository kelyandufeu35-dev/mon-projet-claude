// Interface de la vidéo verticale : deux mots seulement, pas de sous-titres.
//   « CUDA »   en hologramme, retenu par un fil sur la couche logicielle, quand la voix le prononce (plan 5) ;
//   « NVIDIA » composé en texte sur la fin (plan 7), sur un voile sombre. Le logo officiel n'est pas reproduit.
// Tout est une fonction pure du temps (déterministe). Zones de sécurité TikTok : on évite le bas (≈ 20 %) et le
// bord droit (≈ 12 %).

import * as THREE from 'three';
import { smoothstep, clamp } from '../../engine/rng.js';
import { cue, DURATION } from './timing.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FONT = '"Inter", "Inter Display", system-ui, sans-serif';

function el(tag, style = {}, text = null, parent = null) {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createHud({ root, world, width = 1080, height = 1920 }) {
  root.style.fontFamily = FONT;

  // --- CUDA ---------------------------------------------------------------------------------------------------
  const T_CUDA = cue('software.cuda') - 0.12;
  const T_CUDA_END = cue('software.why') + 0.2;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' });
  root.appendChild(svg);
  const leader = document.createElementNS(SVG_NS, 'line');
  leader.setAttribute('stroke', 'rgba(190,235,110,0.9)');
  leader.setAttribute('stroke-width', '2');
  svg.appendChild(leader);
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', '9');
  dot.setAttribute('fill', 'rgba(118,185,0,0.3)');
  dot.setAttribute('stroke', 'rgba(210,245,150,0.95)');
  dot.setAttribute('stroke-width', '2.5');
  svg.appendChild(dot);
  const cuda = el('div', { position: 'absolute', left: 0, top: 0, width: `${width}px`, textAlign: 'center', opacity: 0 }, null, root);
  el('div', { fontWeight: 700, fontSize: '176px', lineHeight: '1', letterSpacing: '0.16em', paddingLeft: '0.16em', color: '#f2f9e4', textShadow: '0 0 30px rgba(118,185,0,0.8), 0 0 90px rgba(118,185,0,0.4), 0 4px 22px rgba(0,0,0,0.65)' }, 'CUDA', cuda);
  const rule = el('div', { height: '3px', margin: '20px auto 0', width: '0px', background: 'linear-gradient(90deg, rgba(118,185,0,0), #76b900 20%, #76b900 80%, rgba(118,185,0,0))' }, null, cuda);

  // --- NVIDIA ----------------------------------------------------------------------------------------------------
  const T_BRAND = cue('close.sells') - 0.15;
  const T_BRAND_END = DURATION - 0.55;
  const veil = el('div', { position: 'absolute', left: 0, top: 0, width: `${width}px`, height: `${height}px`, opacity: 0, background: 'radial-gradient(ellipse 70% 30% at 50% 44%, rgba(0,0,0,0.7), rgba(0,0,0,0) 100%)' }, null, root);
  const brand = el('div', { position: 'absolute', left: 0, top: '780px', width: `${width}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0 }, null, root);
  el('div', { fontFamily: '"Inter Display", "Inter", sans-serif', fontWeight: 700, fontSize: '150px', lineHeight: '1', letterSpacing: '0.3em', paddingLeft: '0.3em', color: '#f4f8ec', textShadow: '0 0 44px rgba(118,185,0,0.55), 0 4px 30px rgba(0,0,0,0.7)' }, 'NVIDIA', brand);
  const brandRule = el('div', { height: '3px', width: '0px', marginTop: '30px', background: 'linear-gradient(90deg, rgba(118,185,0,0), #76b900 20%, #76b900 80%, rgba(118,185,0,0))' }, null, brand);

  const v = new THREE.Vector3();

  function update(t) {
    // CUDA.
    const a = smoothstep(T_CUDA, T_CUDA + 0.35, t) * (1 - smoothstep(T_CUDA_END - 0.5, T_CUDA_END, t));
    const flick = t < T_CUDA + 0.45 ? 0.6 + 0.4 * Math.sin(t * 95) : 1;
    cuda.style.opacity = String(a * flick);
    svg.style.opacity = String(a);
    if (a > 0.001) {
      const { camera, point } = world.anchor('cuda');
      v.copy(point).project(camera);
      const ax = (v.x * 0.5 + 0.5) * width, ay = (-v.y * 0.5 + 0.5) * height;
      const ty = clamp(ay - 330, 330, 760);
      cuda.style.transform = `translateY(${ty}px) scale(${0.96 + 0.04 * a})`;
      rule.style.width = `${Math.round(clamp((t - T_CUDA - 0.1) / 0.5, 0, 1) * 520)}px`;
      leader.setAttribute('x1', String(width / 2));
      leader.setAttribute('y1', String(ty + 232));
      leader.setAttribute('x2', ax.toFixed(1));
      leader.setAttribute('y2', ay.toFixed(1));
      dot.setAttribute('cx', ax.toFixed(1));
      dot.setAttribute('cy', ay.toFixed(1));
    }
    // NVIDIA.
    const b = smoothstep(T_BRAND, T_BRAND + 0.5, t) * (1 - smoothstep(T_BRAND_END - 0.2, T_BRAND_END, t));
    brand.style.opacity = String(b);
    veil.style.opacity = String(b);
    brandRule.style.width = `${Math.round(clamp((t - T_BRAND - 0.2) / 0.7, 0, 1) * 640)}px`;
  }

  return { update };
}
