import NARR from '../data/narration.json';
import VOD from '../data/vo_durations.json';

/* =========================================================================
 * COUCHE DE TEXTES ANIMÉS (HTML + GSAP, timeline en pause pilotée par Hyperframes).
 * Titre d'ouverture, chapitres, légendes de liaisons, sous-titres de la voix off, message final.
 * ========================================================================= */
const gsap = window.gsap;
export const TOTAL = 93.5;

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function buildOverlay(root) {
  const tl = gsap.timeline({ paused: true });
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
    tl.to(dots[i], { opacity: 1, scale: 1.0, duration: 0.3 }, c.t0).to(dots[i], { opacity: 0.38, scale: 0.9, duration: 0.3 }, c.t1 + 0.3);
    tl.set(dots[i], { opacity: 0.38 }, 0);
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
    const dur = (VOD[l.id] ?? words * 0.42) + 0.25;
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
  return tl;
}
