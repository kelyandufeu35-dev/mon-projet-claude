import NARR from '../data/narration.json';
import VOD from '../data/vo_durations.json';
import { HOOK, CUTS } from './timeline.js';
import { PORTRAIT } from './format.js';

/* =========================================================================
 * COUCHE DE TEXTES ANIMÉS (HTML + GSAP, timeline en pause pilotée par Hyperframes).
 * Titre d'ouverture, chapitres, légendes de liaisons, sous-titres de la voix off, message final.
 * ========================================================================= */
const gsap = window.gsap;
export const TOTAL = 93.5;

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function buildOverlay(root) {
  const master = gsap.timeline({ paused: true });   // temps VIDEO : hook (0..HOOK) puis la scène décalée de HOOK
  const tl = gsap.timeline();                       // temps de SCÈNE (imbriquée dans master à HOOK)
  const layer = el('div', ''); layer.id = 'overlay'; root.appendChild(layer);
  const fx = el('div', ''); fx.id = 'fx'; root.appendChild(fx);
  fx.innerHTML = '<div class="vignette"></div><div class="pulse"></div><div class="flash"></div>';
  // l'assombrissement du final vit DANS la couche de textes, sous le message (sinon il le ternit)
  const scrimEl = el('div', 'scrim'); layer.prepend(scrimEl);

  // ---------- Titre d'ouverture ----------
  const intro = el('div', 'intro', `<div class="k"><i></i>INSIDE THE ORGANIZATION</div><h1>McDonald’s</h1><p>Qui dirige, comment l’entreprise s’organise, comment franchisés et équipes locales s’y intègrent.</p>`);
  layer.appendChild(intro);
  tl.set(intro, { opacity: 0 }, 0)
    .fromTo(intro, { opacity: 0 }, { opacity: 1, duration: 0.01 }, 0.25)
    .fromTo(intro.querySelector('.k'), { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.3)
    .fromTo(intro.querySelector('.k i'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.out' }, 0.35)
    .fromTo(intro.querySelector('h1'), { y: 70, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'power4.out' }, 0.45)
    .fromTo(intro.querySelector('p'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.95)
    .to(intro, { opacity: 0, x: -50, duration: 0.7, ease: 'power2.in' }, 3.8)
    .set(intro, { visibility: 'hidden' }, 4.6);

  // ---------- Chapitres (haut gauche) + repère de progression ----------
  const prog = el('div', 'progress'); layer.appendChild(prog);
  const dots = NARR.chapters.map((c) => { const d = el('div', 'pd', `<b>${c.n}</b>`); prog.appendChild(d); return d; });
  tl.fromTo(prog, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.6 }, 4.4);
  NARR.chapters.forEach((c, i) => {
    const ch = el('div', 'chapter', `<div class="kk"><span>${c.n}</span><i></i><em>${c.kicker}</em></div><h2>${c.title}</h2>`);
    layer.appendChild(ch);
    tl.set(ch, { opacity: 0 }, 0)
      .fromTo(ch, { opacity: 0 }, { opacity: 1, duration: 0.01 }, c.t0)
      .fromTo(ch.querySelector('.kk span'), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.4)' }, c.t0)
      .fromTo(ch.querySelector('.kk i'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power3.out' }, c.t0 + 0.1)
      .fromTo(ch.querySelector('.kk em'), { x: -28, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, c.t0 + 0.2)
      .fromTo(ch.querySelector('h2'), { y: 36, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'power4.out' }, c.t0 + 0.3)
      .to(ch, { opacity: 0, y: -14, duration: 0.5, ease: 'power2.in' }, c.t1)
      .set(ch, { visibility: 'hidden' }, c.t1 + 0.6);
    tl.to(dots[i], { opacity: 1, scale: 1.0, duration: 0.3 }, c.t0).to(dots[i], { opacity: 0.55, scale: 0.9, duration: 0.3 }, c.t1 + 0.3);
    tl.set(dots[i], { opacity: 0.55 }, 0);
  });

  // ---------- Légendes ----------
  const legend = (cfg) => {
    const box = el('div', 'legend ' + (cfg.cls || ''), cfg.title ? `<h4>${cfg.title}</h4>` : '');
    cfg.rows.forEach((r) => {
      const row = el('div', 'row', `<span class="sw ${r.style || ''}" style="--c:${r.color}"></span><b>${r.label}</b>${r.sub ? `<small>${r.sub}</small>` : ''}`);
      box.appendChild(row);
    });
    if (cfg.foot) box.appendChild(el('div', 'foot', cfg.foot));
    layer.appendChild(box);
    tl.set(box, { opacity: 0 }, 0);
    tl.fromTo(box, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, cfg.t0);
    box.querySelectorAll('.row').forEach((row, i) => {
      tl.fromTo(row, { opacity: 0, x: -22 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' }, cfg.t0 + 0.15 * i);
      tl.to(row.querySelector('.sw'), { backgroundPosition: '-640px 0', duration: cfg.t1 - cfg.t0, ease: 'none' }, cfg.t0);
    });
    if (cfg.t1 < TOTAL) tl.to(box, { opacity: 0, x: -20, duration: 0.5, ease: 'power2.in' }, cfg.t1);
    return box;
  };
  legend({ t0: 36.6, t1: 44.4, title: 'STRUCTURES (EXEMPLES)', cls: 'bl', rows: [
    { color: '#ff4638', label: 'Marché exploité par McDonald’s' },
    { color: '#ffc72c', label: 'Licencié de développement', sub: 'partenaire' },
    { color: '#ffffff', label: 'Société affiliée', sub: 'participation', style: 'dash' },
  ] });
  legend({ t0: 51.6, t1: 55.6, title: 'RELATIONS', cls: 'bl hi', rows: [
    { color: '#ffc72c', label: 'Contrat de franchise' },
    { color: '#ffe6a0', label: 'Standards de marque', style: 'dash' },
    { color: '#ff4638', label: 'Hiérarchie du franchisé' },
  ] });
  legend({ t0: 85.7, t1: 88.3, title: 'LES QUATRE RELATIONS', cls: 'mid-l big', rows: [
    { color: '#ffffff', label: 'Gouvernance' },
    { color: '#ff4638', label: 'Hiérarchie interne' },
    { color: '#ffc72c', label: 'Contrats', sub: 'franchisés' },
    { color: '#74d7ff', label: 'Coordination', sub: 'fonctions', style: 'dash' },
  ] });

  // ---------- Notes de prudence ----------
  const note = (text, t0, t1, cls = '') => {
    const n = el('div', 'note ' + cls, `<i>i</i><span>${text}</span>`);
    layer.appendChild(n);
    tl.set(n, { opacity: 0 }, 0).fromTo(n, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, t0);
    if (t1 < TOTAL) tl.to(n, { opacity: 0, y: 10, duration: 0.5 }, t1);
  };
  note('Organisation simplifiée à des fins pédagogiques — non officielle.', 16.4, 29.0, 'tr');
  note('Illustration pédagogique : ce n’est pas l’organigramme officiel de McDonald’s.', 85.9, 88.3, 'bl');
  note('Exemples illustratifs : les structures réelles diffèrent selon les marchés.', 37.8, 44.2, 'tr');
  note('Selon le pays, le restaurant et son mode d’exploitation, l’organisation précise varie.', 72.4, 74.4, 'mid');

  // ---------- Sous-titres (voix off) ----------
  NARR.lines.forEach((l, i) => {
    if (l.caption === false) return;
    const words = l.text.split(/\s+/).length;
    let dur = (VOD[l.id] ?? words * 0.42) + 0.25;
    if (PORTRAIT && l.id === 'n20') dur = Math.min(dur, 85.4 - l.t);   // en portrait, la légende des 4 relations prend la place du sous-titre
    const c = el('div', 'cap', `<span>${l.text}</span>`);
    layer.appendChild(c);
    tl.set(c, { opacity: 0 }, 0)
      .fromTo(c, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, l.t)
      .to(c, { opacity: 0, y: -8, duration: 0.3, ease: 'power2.in' }, l.t + dur);
  });

  // ---------- Éclair de transition (plongeon dans le marché → ville) ----------
  const flash = fx.querySelector('.flash');
  tl.set(flash, { opacity: 0 }, 0)
    .to(flash, { opacity: 1, duration: 0.55, ease: 'power2.in' }, 44.45)
    .to(flash, { opacity: 0, duration: 0.7, ease: 'power2.out' }, 45.0);
  // petit pouls de lumière entre scènes 1 → 2 et 2 → 3
  const pulse = fx.querySelector('.pulse');
  tl.set(pulse, { opacity: 0 }, 0);
  [[15.0, 0.34], [30.4, 0.4], [60.2, 0.3], [75.2, 0.38]].forEach(([t, a]) => {
    tl.to(pulse, { opacity: a, duration: 0.25, ease: 'power2.out' }, t).to(pulse, { opacity: 0, duration: 0.7, ease: 'power2.in' }, t + 0.25);
  });

  // ---------- Message final ----------
  const fin = el('div', 'final', `<div class="mark"></div><p>McDonald’s&nbsp;: une <em>organisation mondiale</em>,<br>des <em>milliers d’entrepreneurs</em> et d’<em>équipes locales</em>.</p>`);
  layer.appendChild(fin);
  const scrim = scrimEl;
  tl.set(fin, { opacity: 0 }, 0).set(scrim, { opacity: 0 }, 0)
    .to(scrim, { opacity: 1, duration: 1.1, ease: 'power2.inOut' }, 88.0)
    .fromTo(fin, { opacity: 0 }, { opacity: 1, duration: 0.01 }, 88.5)
    .fromTo(fin.querySelector('.mark'), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.8, ease: 'power3.out' }, 88.6)
    .fromTo(fin.querySelector('p'), { y: 40, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power4.out' }, 88.8);
  fin.querySelectorAll('em').forEach((e, i) => tl.fromTo(e, { color: '#f4f3ef' }, { color: '#ffc72c', duration: 0.6 }, 89.9 + i * 0.45));
  tl.to(fx.querySelector('.vignette'), { opacity: 1, duration: 0.01 }, 0);
  // maintien jusqu'à la fin
  tl.to({}, { duration: 0.001 }, TOTAL - 0.001);

  // ---------- HOOK d'ouverture : « Comment McDo fonctionne ? » ----------
  const hook = el('div', 'hook', `
    <div class="hk-scrim"></div>
    <div class="hk-top"><i></i>DANS LES COULISSES</div>
    <div class="hk-q"><span class="w1">COMMENT</span><span class="w2">McDo</span><span class="w3">FONCTIONNE&nbsp;?</span></div>
    <div class="hk-sub"><span class="s1">Qui dirige ?</span><span class="s2">Qui décide ?</span><span class="s3">Et qui est derrière<i class="br"></i> <b>le comptoir</b> ?</span></div>`);
  layer.appendChild(hook);
  const q = (sel) => hook.querySelector(sel);
  master.set(hook, { opacity: 1 }, 0);
  master.fromTo(q('.hk-scrim'), { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0)
    .fromTo(q('.hk-top'), { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.1)
    .fromTo(q('.w1'), { y: 70, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { y: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.5, ease: 'power4.out' }, 0.2)
    .fromTo(q('.w2'), { scale: 0.3, rotate: -6, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.65, ease: 'back.out(2.4)' }, 0.42)
    .fromTo(q('.w3'), { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power4.out' }, 0.85)
    .to(q('.w3'), { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 1.4)
    // le titre remonte et rétrécit pour laisser la place aux trois questions
    .to(q('.hk-q'), { y: PORTRAIT ? -300 : -90, scale: PORTRAIT ? 0.62 : 0.7, duration: 0.55, ease: 'power3.inOut' }, 1.85)
    .fromTo(q('.s1'), { y: 40, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 2.2)
    .fromTo(q('.s2'), { y: 40, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 3.1)
    .fromTo(q('.s3'), { y: 40, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 3.95)
    .to(hook, { opacity: 0, y: -30, duration: 0.3, ease: 'power2.in' }, HOOK - 0.32);
  // coupes du montage : flash blanc court + « punch » de caméra
  const gl = document.getElementById('gl');
  const pulseEl = fx.querySelector('.pulse');
  CUTS.forEach((c, i) => {
    master.set(gl, { scale: 1.09 }, c.a).to(gl, { scale: 1, duration: 0.55, ease: 'power3.out' }, c.a);   // set + to (pas fromTo) : reste correct quand on remonte dans le temps
    if (i > 0) master.to(pulseEl, { opacity: 0.55, duration: 0.07, ease: 'power1.out' }, c.a - 0.02).to(pulseEl, { opacity: 0, duration: 0.3, ease: 'power2.in' }, c.a + 0.05);
  });
  master.to(pulseEl, { opacity: 0.7, duration: 0.18, ease: 'power2.in' }, HOOK - 0.2).to(pulseEl, { opacity: 0, duration: 0.5, ease: 'power2.out' }, HOOK - 0.02);
  master.set(gl, { scale: 1.12 }, HOOK).to(gl, { scale: 1, duration: 0.7, ease: 'power3.out' }, HOOK);

  master.add(tl, HOOK);
  return master;
}
