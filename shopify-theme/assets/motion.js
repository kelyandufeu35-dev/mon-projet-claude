/* Pattoune v9 « Cinéma » · mouvement (chantier A). JS vanilla, sans dépendance, sans écouteur « scroll »
   (IntersectionObserver et animations CSS). Mise en page lue seulement au survol ou sur un événement
   ponctuel. Modules relançables sur une racine (éditeur) et idempotents (drapeau pt* par élément).
   API : data-reveal(-group), data-count-to, data-story, data-magnetic, data-hero(-pause), data-hd,
   data-hd-sentinel, data-add-total, data-offer-card, événement « pattoune:cart-added » (theme.js). */
(() => {
  const h = document.documentElement;
  // Échec au démarrage : états cachés retirés (tout visible), pt-js non posé.
  const off = (err) => { h.classList.remove('pt-motion'); throw err; };
  try {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animated = h.classList.contains('pt-motion'); // faux si calme, ou si le filet de 4 s est passé
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const IO = 'IntersectionObserver' in window;
  const WAAPI = !!Element.prototype.animate;

  const E = { out: 'cubic-bezier(.16, 1, .3, 1)', inout: 'cubic-bezier(.76, 0, .24, 1)', spring: 'cubic-bezier(.34, 1.56, .64, 1)' };
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  /** Éléments correspondant à sel dans root, root compris. */
  const within = (root, sel) => (root.matches && root.matches(sel) ? [root] : []).concat($$(sel, root));

  /* ---------- Reveal */
  const show = (el) => {
    if (el.classList.contains('is-in')) return;
    el.classList.add('is-in');
    if (animated) within(el, '[data-count-to]').forEach((c) => count(c, el));
  };
  const once = (margin) => (IO && animated
    ? new IntersectionObserver((entries, io) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      if (e.target.hasAttribute('data-reveal')) show(e.target); else count(e.target);
    }), { rootMargin: margin })
    : null);
  const ioMain = once('0px 0px -12% 0px');
  const ioLit = once('0px 0px -30% 0px');

  function bindReveals(root) {
    // Décalages de groupe : --pt-d = 0…5 dans l’ordre du document (le groupe le plus proche l’emporte).
    within(root, '[data-reveal-group]').reverse().forEach((g) => {
      $$('[data-reveal]', g).forEach((el, i) => {
        if (!el.style.getPropertyValue('--pt-d')) el.style.setProperty('--pt-d', Math.min(i, 5));
      });
    });
    within(root, '[data-reveal]').forEach((el) => {
      if (el.ptReveal) return;
      el.ptReveal = true;
      if (!ioMain) return show(el);
      (el.dataset.reveal === 'lit' ? ioLit : ioMain).observe(el);
    });
  }

  /* ---------- Shine */
  // Reflet des mots mis en valeur (motion.css § 5) : calque vide caché aux lecteurs d’écran,
  // texte clair rendu par ::after depuis data-t.
  function bindShine(root) {
    if (!animated) return;
    within(root, '.pt-hl .pt-w > span').forEach((s) => {
      if (s.ptShine || !s.closest('[data-reveal="mask"], .pt-hero__title')) return;
      s.ptShine = true;
      const i = document.createElement('i');
      i.className = 'pt-shine';
      i.setAttribute('aria-hidden', 'true');
      i.dataset.t = s.textContent;
      s.appendChild(i);
    });
  }

  /* ---------- Count */
  // Le HTML porte la valeur finale (juste sans JS) ; le comptage part avec la révélation du bloc
  // (même décalage) et s’arrête exactement sur la valeur finale.
  function count(el, host) {
    if (el.ptCounted || !animated) return;
    el.ptCounted = true;
    const to = parseFloat(el.dataset.countTo);
    if (!isFinite(to)) return;
    const from = parseFloat(el.dataset.countFrom || 0) || 0;
    const dec = Math.max(0, parseInt(el.dataset.countDecimals || 0, 10) || 0);
    const dur = parseFloat(el.dataset.countDuration || 1200) || 1200;
    const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const final = el.textContent;
    const d = host && host !== el ? parseFloat(host.style.getPropertyValue('--pt-d')) || 0 : 0;
    el.textContent = fmt.format(from);
    const start = performance.now() + d * 80 + 120;
    const tick = (now) => {
      const p = Math.max(0, Math.min(1, (now - start) / dur));
      el.textContent = p === 1 ? final : fmt.format(from + (to - from) * (1 - Math.pow(2, -10 * p)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function bindCounts(root) {
    // Compteurs hors d’un bloc révélé : observés pour eux-mêmes.
    within(root, '[data-count-to]').forEach((el) => {
      if (el.ptCountBound || el.closest('[data-reveal]')) return;
      el.ptCountBound = true;
      if (ioMain) ioMain.observe(el);
    });
  }

  /* ---------- Odometer */
  // Texte de el → copie lisible (.pt-sr) + version animée cachée aux lecteurs d’écran, un caractère
  // par fenêtre ; les caractères changés (alignés à droite) montent, l’ancien sort par le haut.
  const span = (cls, txt) => {
    const e = document.createElement('span');
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  function odometer(el, text) {
    if (!el) return;
    const prev = el.ptOdo != null ? el.ptOdo : el.textContent.trim();
    el.ptOdo = text;
    const sr = span('pt-sr', text);
    const odo = span('pt-odo');
    odo.setAttribute('aria-hidden', 'true');
    const chars = Array.from(text), old = Array.from(prev);
    const shift = chars.length - old.length;
    const roll = !calm && WAAPI && prev !== text;
    let k = 0;
    chars.forEach((ch, i) => {
      const c = odo.appendChild(span('pt-odo__c'));
      const s = c.appendChild(span('', ch));
      const was = old[i - shift];
      if (!roll || ch === was) return;
      const opts = { duration: 420, delay: k++ * 30, easing: E.out, fill: 'backwards' };
      s.animate([{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], opts);
      if (was && was.trim()) {
        const o = c.appendChild(span('pt-odo__old', was));
        o.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }], { ...opts, fill: 'forwards' }).finished.then(() => o.remove(), () => o.remove());
      }
    });
    el.replaceChildren(sr, odo);
  }

  /* ---------- Story */
  function bindStory(root) {
    within(root, '[data-story]').forEach((story) => {
      if (story.ptStory) return;
      story.ptStory = true;
      const steps = $$('[data-story-step]', story);
      const media = $$('[data-story-media]', story);
      const counter = story.querySelector('[data-story-count]');
      // Les étapes comptent dans l’ordre du document ; les médias par leur attribut, base 0 ou 1.
      const base = media.length ? Math.min(...media.map((m) => Number(m.dataset.storyMedia) || 0)) : 0;
      let cur = -1;
      const set = (i) => {
        if (i === cur) return;
        cur = i;
        steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
        media.forEach((m) => {
          const k = (Number(m.dataset.storyMedia) || 0) - base;
          m.classList.toggle('is-on', k <= i);
          m.classList.toggle('is-current', k === i);
        });
        story.dataset.active = String(i);
        story.style.setProperty('--pt-story', i);
        if (counter) odometer(counter, String(i + 1).padStart(2, '0'));
      };
      set(0);
      if (!IO) return;
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) set(steps.indexOf(e.target));
      }), { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach((s) => io.observe(s));
    });
  }

  /* ---------- OfferTotal */
  // Après theme.js (écouteur du formulaire), le total de l’offre cochée roule dans le bouton.
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.matches || !t.matches('[data-offer], [data-option] input')) return;
    const root = t.closest('[data-product-root]') || t.form || document;
    const checked = root.querySelector('[data-offer]:checked');
    const card = checked && (checked.closest('[data-offer-card]') || checked.parentElement);
    const total = card && card.querySelector('[data-offer-total]');
    const target = root.querySelector('[data-add-total]');
    if (total && target) odometer(target, total.textContent.trim());
  });

  /* ---------- HeaderPill */
  function bindHeader() {
    const hd = document.querySelector('[data-hd]');
    if (!hd || hd.ptHd) return;
    hd.ptHd = true;
    const sentinel = document.querySelector('[data-hd-sentinel]');
    if (sentinel && IO) new IntersectionObserver(([e]) => hd.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
    // Place réservée au bouton « Je commande » : tant qu’il est caché, la navigation glisse dedans.
    const cta = hd.querySelector('.pt-hd__cta');
    const bar = hd.querySelector('.pt-hd__bar');
    if (cta && bar && 'ResizeObserver' in window) {
      const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      new ResizeObserver(([e]) => {
        const w = e.borderBoxSize && e.borderBoxSize[0] ? e.borderBoxSize[0].inlineSize : e.contentRect.width;
        hd.style.setProperty('--pt-cta-shift', w ? `${Math.round(w + gap)}px` : '0px');
      }).observe(cta);
    }
    if (!IO) return;
    // Page produit : bouton « Je commande » seulement une fois la zone d’achat dépassée.
    const buy = document.body.classList.contains('template-product') && document.querySelector('[data-product-root]');
    if (buy) new IntersectionObserver(([e]) => hd.classList.toggle('is-past-buy', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(buy);
    // Fondu mobile au-dessus de la pastille : encre sur les sections sombres, crème ailleurs.
    const dark = new Set();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? dark.add(e.target) : dark.delete(e.target)));
      hd.classList.toggle('is-over-dark', dark.size > 0);
    }, { rootMargin: '0px 0px -94% 0px' });
    $$('.pt-dark, .pt-footer').forEach((el) => io.observe(el));
  }

  /* ---------- Hero */
  function bindHero(root) {
    within(root, '[data-hero]').forEach((hero) => {
      if (hero.ptHero) return;
      hero.ptHero = true;
      const video = hero.querySelector('video');
      const btn = hero.querySelector('[data-hero-pause]');
      const lite = !!(navigator.connection && navigator.connection.saveData);
      // Première lecture seulement une fois l’intro finie ou passée (elle recouvre la vidéo).
      const intro = () => h.classList.contains('has-intro') && !h.classList.contains('intro-done') && !h.classList.contains('intro-skip');
      let paused = false, visible = true, ready = !intro();
      const sync = () => {
        hero.classList.toggle('is-paused', paused);
        if (!video) return;
        if (!calm && !lite && ready && visible && !paused) {
          const p = video.play();
          if (p && p.catch) p.catch(() => {});
        } else video.pause();
      };
      if (video) {
        video.muted = true;
        video.playsInline = true;
        video.removeAttribute('autoplay');
        if (!calm && !lite) video.preload = 'auto';
        if (!ready) document.addEventListener('pt:intro-end', () => { ready = true; sync(); }, { once: true });
        video.addEventListener('playing', () => hero.classList.add('is-playing'));
        if (calm) video.pause();
      }
      if (btn) {
        if (calm) btn.hidden = true;
        else btn.addEventListener('click', () => {
          paused = !paused;
          btn.setAttribute('aria-pressed', String(paused));
          btn.setAttribute('aria-label', paused ? 'Relancer l’animation' : 'Mettre en pause l’animation');
          sync();
        });
      }
      if (IO) new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        hero.classList.toggle('is-offscreen', !visible);
        sync();
      }).observe(hero);
      else sync();
      if (fine && animated) bindLight(hero);
    });
  }
  // Lumière vivante : --pt-px / --pt-py (−0,5 à 0,5), au plus une fois par image, sans mesure.
  function bindLight(hero) {
    let raf = 0, x = 0, y = 0;
    const write = () => {
      raf = 0;
      hero.style.setProperty('--pt-px', x.toFixed(3));
      hero.style.setProperty('--pt-py', y.toFixed(3));
    };
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX / innerWidth - 0.5;
      y = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(write);
    });
    hero.addEventListener('pointerleave', () => {
      x = y = 0;
      if (!raf) raf = requestAnimationFrame(write);
    });
  }

  /* ---------- Magnetic */
  function bindMagnets(root) {
    if (!(fine && animated)) return;
    within(root, '[data-magnetic]').forEach((el) => {
      if (el.ptMagnet) return;
      el.ptMagnet = true;
      let r = null, raf = 0, tx = 0, ty = 0;
      const write = () => {
        raf = 0;
        el.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
      };
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        r = el.getBoundingClientRect(); // lu une seule fois, à l’entrée
        el.classList.add('is-magnet');
      });
      el.addEventListener('pointermove', (e) => {
        if (!r) return;
        tx = ((e.clientX - r.left) / r.width - 0.5) * 12; // ±6 px
        ty = ((e.clientY - r.top) / r.height - 0.5) * 8; // ±4 px
        if (!raf) raf = requestAnimationFrame(write);
      });
      el.addEventListener('pointerleave', () => {
        r = null;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        el.classList.remove('is-magnet');
        el.style.translate = '';
      });
    });
  }

  /* ---------- Cart */
  const bump = () => {
    if (calm || !WAAPI) return;
    $$('[data-cart-count]').forEach((c) => c.animate([{ scale: 1 }, { scale: 1.35 }, { scale: 1 }], { duration: 500, easing: E.spring }));
  };
  // Balle du bouton d’achat au panier de l’en-tête : x linéaire sur le conteneur ; montée de 120 px,
  // plongée, rotation et réduction sur l’image.
  function fly(from, to) {
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    const x0 = a.left + a.width / 2 - 20, y0 = a.top + a.height / 2 - 20;
    const x1 = b.left + b.width / 2 - 20, y1 = b.top + b.height / 2 - 20;
    const wrap = document.body.appendChild(span('pt-fly'));
    wrap.setAttribute('aria-hidden', 'true');
    const img = wrap.appendChild(new Image(40, 40));
    img.alt = '';
    img.src = window.theme.ballSrc;
    const dur = 650;
    wrap.animate([{ transform: `translateX(${x0}px)` }, { transform: `translateX(${x1}px)` }], { duration: dur, easing: 'linear', fill: 'both' });
    return img.animate([
      { transform: `translateY(${y0}px) rotate(0deg) scale(1)`, easing: 'cubic-bezier(.22, .9, .36, 1)' },
      { transform: `translateY(${y0 - 120}px) rotate(-150deg) scale(.9)`, offset: 0.35, easing: 'cubic-bezier(.6, 0, .9, .55)' },
      { transform: `translateY(${y1}px) rotate(-400deg) scale(.45)` },
    ], { duration: dur, fill: 'both' }).finished.then(() => wrap.remove(), () => wrap.remove());
  }
  document.addEventListener('pattoune:cart-added', (e) => {
    const btn = e.detail && e.detail.button;
    const cart = document.querySelector('[data-hd] [data-cart-open]');
    if (calm || !WAAPI || !btn || !cart || !(window.theme && window.theme.ballSrc)) return bump();
    fly(btn, cart).then(bump);
  });
  // Chaque ouverture du panier latéral (ajout ou clic) : .is-opening 1,2 s pour la cascade des lignes.
  function bindDrawer() {
    const d = document.getElementById('cart-drawer');
    if (!d || d.ptDrawer || !('MutationObserver' in window)) return;
    d.ptDrawer = true;
    let timer = 0;
    new MutationObserver(() => {
      if (!d.open) return d.classList.remove('is-opening');
      d.classList.add('is-opening');
      clearTimeout(timer);
      timer = setTimeout(() => d.classList.remove('is-opening'), 1200);
    }).observe(d, { attributes: true, attributeFilter: ['open'] });
  }

  /* ---------- Editor */
  const init = (root = document) => {
    bindShine(root);
    bindReveals(root);
    bindCounts(root);
    bindStory(root);
    bindMagnets(root);
    bindHero(root);
    bindHeader();
    bindDrawer();
  };
  document.addEventListener('shopify:section:load', (e) => {
    e.target.classList.add('pt-static');
    init(e.target);
    within(e.target, '[data-reveal]').forEach(show);
  });
  // Dans l’éditeur, la section ou le bloc choisi s’affiche aussitôt en entier.
  const reveal = (e) => within(e.target, '[data-reveal]').forEach(show);
  document.addEventListener('shopify:section:select', reveal);
  document.addEventListener('shopify:block:select', reveal);

  // Défilement doux seulement après le chargement (l’arrivée sur /#ancre saute directement).
  const loaded = () => requestAnimationFrame(() => h.classList.add('pt-loaded'));
  if (document.readyState === 'complete') loaded(); else addEventListener('load', loaded, { once: true });

  // pt-js seulement une fois tout branché (sinon le filet de 4 s du <head> joue).
  const start = () => { try { init(); h.classList.add('pt-js'); } catch (e) { off(e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  } catch (e) { off(e); }
})();
