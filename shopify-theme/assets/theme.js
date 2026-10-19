/* Thème Pattoune : panier latéral, choix des options, offres groupées,
   galerie, estimation de livraison, barre d’achat mobile. Sans dépendance.
   Le mouvement (révélations, balle vers le panier, en-tête…) est dans assets/motion.js. */
(() => {
  const routes = () => (window.theme && window.theme.routes) || { cartAdd: '/cart/add.js', cartChange: '/cart/change.js', cart: '/cart' };
  const drawer = () => document.getElementById('cart-drawer');
  const DRAWER_SECTION = 'cart-drawer';

  /* ------------------------------------------------------------ Money */
  // Format natif Shopify de la devise, lu sur un exemple rendu par le filtre money (window.theme.money.sample,
  // montant 1 234 567,89) : symbole, séparateurs et décimales. null si l'exemple est illisible.
  function nativeFormat(sample) {
    const m = typeof sample === 'string' && sample.match(/^([\s\S]*?)(\d[\d.,'\s\u00a0\u202f]*\d)([\s\S]*)$/);
    if (!m) return null;
    const [, pre, num, post] = m;
    const digits = num.replace(/\D/g, '');
    let decimals = 0, dec = '', int = num;
    if (digits === '123456789') {
      const d = num.match(/([.,])\d{2}$/);
      if (!d) return null;
      decimals = 2;
      dec = d[1];
      int = num.slice(0, -3);
    } else if (digits !== '1234568') return null;
    const g = int.match(/^1(\D?)234/);
    return { pre, post, decimals, dec, group: g ? g[1] : '' };
  }
  function formatMoney(cents) {
    // Euro : « 14,99 € » (format français, comme snippets/pt-money.liquid), quelle que soit la langue.
    // Autre devise : même format que le filtre money de Shopify (snippets/pt-money.liquid), sinon
    // Intl.NumberFormat avec la langue et le pays du visiteur (window.theme.money, layout/theme.liquid).
    const m = (window.theme && window.theme.money) || {};
    const currency = m.currency || 'EUR';
    const amount = (Number(cents) || 0) / 100;
    const group = (int, sep) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    if (currency !== 'EUR') {
      const f = nativeFormat(m.sample);
      if (f) {
        const [int, frac] = amount.toFixed(f.decimals).split('.');
        return f.pre + group(int, f.group) + (f.decimals ? f.dec + frac : '') + f.post;
      }
      for (const loc of [m.locale, document.documentElement.lang, 'fr']) {
        try {
          if (loc) return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(amount);
        } catch {
          /* langue ou devise refusée : essai suivant */
        }
      }
    }
    const [int, dec] = amount.toFixed(2).split('.');
    return `${group(int, ' ')},${dec} ${currency === 'EUR' ? '€' : currency}`;
  }

  /* ------------------------------------------------------------ Textes */
  // Textes traduits exposés par layout/theme.liquid (window.PattouneStrings), repli sur le français.
  const str = (key, fallback) => {
    const s = window.PattouneStrings && window.PattouneStrings[key];
    return typeof s === 'string' && s ? s : fallback;
  };
  const plural = (n) => {
    try {
      return new Intl.PluralRules(document.documentElement.lang || 'fr').select(n);
    } catch {
      return n > 1 ? 'other' : 'one';
    }
  };

  /* ------------------------------------------------------- Cart drawer */
  function openDrawer() {
    const d = drawer();
    if (!d) return false;
    if (!d.open) d.showModal();
    document.documentElement.classList.add('is-locked');
    return true;
  }
  function closeDrawer() {
    const d = drawer();
    if (d && d.open) d.close();
  }

  function renderSections(sections) {
    if (!sections) return;
    const html = sections[DRAWER_SECTION];
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-cart-drawer-content]');
      const current = document.querySelector('#cart-drawer [data-cart-drawer-content]');
      if (fresh && current) current.replaceWith(fresh);
    }
  }

  async function refreshCount() {
    try {
      const cart = await (await fetch(`${routes().cart}.js`, { headers: { Accept: 'application/json' } })).json();
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = cart.item_count;
        el.toggleAttribute('data-empty', cart.item_count === 0);
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      });
      document.querySelectorAll('[data-cart-open]').forEach((el) => {
        const n = cart.item_count;
        const one = plural(n) === 'one';
        const tpl = one ? str('cartLabelOne', 'Panier, [count] article') : str('cartLabelOther', 'Panier, [count] articles');
        el.setAttribute('aria-label', tpl.replace('[count]', n));
      });
    } catch {
      /* the count refreshes on next page load */
    }
  }

  async function changeLine(line, quantity) {
    const onCartPage = !!document.querySelector('[data-cart-page]');
    if (onCartPage) {
      // Simple and robust on the cart page: let Shopify re-render it.
      await fetch(routes().cartChange, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line, quantity }),
      });
      window.location.reload();
      return;
    }
    const res = await fetch(routes().cartChange, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line, quantity, sections: [DRAWER_SECTION], sections_url: window.location.pathname }),
    });
    const data = await res.json();
    renderSections(data.sections);
    refreshCount();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cart-open], [data-cart-close], [data-line], [data-scroll-buy]');
    if (!t) {
      const d = drawer();
      if (d && e.target === d) closeDrawer(); // backdrop
      return;
    }
    if (t.matches('[data-cart-open]')) {
      if (openDrawer()) e.preventDefault();
    } else if (t.matches('[data-cart-close]')) {
      closeDrawer();
    } else if (t.matches('[data-line]')) {
      e.preventDefault();
      t.disabled = true;
      changeLine(Number(t.dataset.line), Math.max(0, Number(t.dataset.qty))).catch(() => window.location.reload());
    } else if (t.matches('[data-scroll-buy]') && t.getAttribute('href') === '#contenu') {
      const buy = document.querySelector('[data-product-form]');
      if (buy) {
        e.preventDefault();
        buy.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  document.addEventListener('close', (e) => {
    if (e.target && e.target.id === 'cart-drawer') document.documentElement.classList.remove('is-locked');
  }, true);

  /* --------------------------------------------------------- Product */
  function initProduct(root) {
    const dataEl = root.querySelector('[data-product-json]');
    const form = root.querySelector('[data-product-form]');
    if (!dataEl || !form) return;
    const data = JSON.parse(dataEl.textContent);
    const variantInput = form.querySelector('[data-variant-input]');
    const addTotal = form.querySelector('[data-add-total]');
    // Quantité : celle de l’offre cochée (radios name="quantity"), sinon le champ caché.
    const qty = () => Number((form.querySelector('[data-offer]:checked') || form.querySelector('[name="quantity"]') || { value: 1 }).value) || 1;
    const addBtn = form.querySelector('[data-add-button]');
    const addLabel = form.querySelector('[data-add-label]');
    const errorEl = form.querySelector('[data-form-error]');
    const priceEl = root.querySelector('[data-price]');
    const compareEl = root.querySelector('[data-compare]');
    const stickyPrice = document.querySelector('[data-sticky-price]');
    const addText = addLabel ? addLabel.textContent.trim() : str('addToCart', 'Ajouter au panier');
    // Espace insécable entre le montant et « € » (jamais de « € » seul en début de ligne).
    const money = (c) => formatMoney(c).replace(/ /g, '\u00a0');

    let variant = data.variants.find((v) => String(v.id) === variantInput.value) || data.variants[0];

    const selectedOptions = () =>
      [...form.querySelectorAll('[data-option]')].map((fs) => {
        const checked = fs.querySelector('input:checked');
        return checked ? checked.value : null;
      });

    function updateOffers() {
      root.querySelectorAll('[data-offer]').forEach((input) => {
        const qty = Number(input.value);
        const discount = Number(input.dataset.discount || 0);
        const full = variant.price * qty;
        // Montant fixe par article s'il existe, sinon pourcentage arrondi à
        // l'inférieur unité par unité (comme Shopify).
        const unitOff = input.dataset.unitOff ? Number(input.dataset.unitOff) : Math.floor((variant.price * discount) / 100);
        const total = full - unitOff * qty;
        const card = input.closest('[data-offer-card], .offer');
        const totalEl = card.querySelector('[data-offer-total]');
        const fullEl = card.querySelector('[data-offer-full]');
        const unitEl = card.querySelector('[data-offer-unit]');
        if (totalEl) totalEl.textContent = money(total);
        if (fullEl) fullEl.textContent = money(full);
        if (unitEl) unitEl.textContent = money(Math.floor(total / qty));
      });
      // Total du bouton = offre cochée (motion.js ne fait que l’animer). La valeur précédente est
      // gardée dans ptOdo pour que l’odomètre de motion.js roule de l’ancien au nouveau total.
      const offer = root.querySelector('[data-offer]:checked');
      const card = offer && offer.closest('[data-offer-card], .offer');
      const total = card && card.querySelector('[data-offer-total]');
      // Sans offres groupées (réglage show_offers), le total suit la variante choisie.
      if ((total || !offer) && addTotal) {
        const text = total ? total.textContent.trim() : money(variant.price * qty());
        const sr = addTotal.querySelector('.pt-sr');
        if (addTotal.ptOdo == null) addTotal.ptOdo = addTotal.textContent.trim();
        if (sr) sr.textContent = text;
        else addTotal.textContent = text;
      }
    }

    function showMedia(id) {
      if (!id) return;
      root.querySelectorAll('[data-media-id]').forEach((slide) => {
        slide.hidden = slide.dataset.mediaId !== String(id);
        // Vidéo produit : lue quand on la choisit (jamais en mouvement réduit), en pause et
        // muette une fois cachée. Les boucles [data-step-video] sont gérées par motion.js.
        slide.querySelectorAll('[data-video] video').forEach((v) => {
          if (slide.hidden) { v.pause(); v.muted = true; } else if (!calm()) v.play().catch(() => {});
        });
      });
      root.querySelectorAll('[data-thumb]').forEach((b) => {
        const on = b.dataset.thumb === String(id);
        b.setAttribute('aria-pressed', String(on));
        // Vignette active ramenée dans la bande défilante (mobile), sans faire bouger la page.
        if (on && b.parentElement.scrollWidth > b.parentElement.clientWidth) {
          const strip = b.parentElement;
          strip.scrollTo({ left: b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2, behavior: calm() ? 'auto' : 'smooth' });
        }
      });
      const ids = mediaIds();
      const index = root.querySelector('[data-gallery-index]');
      if (index && ids.includes(String(id))) index.textContent = ids.indexOf(String(id)) + 1;
    }

    // Carrousel : ordre des vignettes, flèches, glisser au doigt, flèches du clavier.
    function mediaIds() {
      return [...root.querySelectorAll('[data-thumb]')].map((b) => b.dataset.thumb);
    }
    function step(dir) {
      const ids = mediaIds();
      if (ids.length < 2) return;
      const current = root.querySelector('[data-thumb][aria-pressed="true"]');
      const i = current ? ids.indexOf(current.dataset.thumb) : 0;
      root.querySelector('[data-gallery]')?.classList.add('is-touched');
      showMedia(ids[(i + dir + ids.length) % ids.length]);
    }

    function updateVariant() {
      const opts = selectedOptions();
      const match = data.variants.find((v) => v.options.every((o, i) => o === opts[i]));
      form.querySelectorAll('[data-option]').forEach((fs, i) => {
        const label = fs.querySelector('[data-option-label]');
        if (label) label.textContent = opts[i] || '';
      });
      if (!match) {
        addBtn.disabled = true;
        if (addLabel) addLabel.textContent = str('unavailable', 'Indisponible');
        return;
      }
      variant = match;
      variantInput.value = match.id;
      addBtn.disabled = !match.available;
      if (addLabel) addLabel.textContent = match.available ? addText : str('soldOut', 'Épuisé');
      if (priceEl) priceEl.textContent = money(match.price);
      if (stickyPrice) stickyPrice.textContent = money(match.price);
      if (compareEl) {
        compareEl.hidden = !(match.compare > match.price);
        compareEl.textContent = money(match.compare);
      }
      if (match.media) showMedia(match.media);
      updateOffers();
      const url = new URL(window.location.href);
      if (url.pathname.includes('/products/')) {
        url.searchParams.set('variant', match.id);
        window.history.replaceState({}, '', url);
      }
    }

    form.addEventListener('change', (e) => {
      if (e.target.matches('[data-option] input')) updateVariant();
      if (e.target.matches('[data-offer]')) updateOffers();
    });

    root.querySelectorAll('[data-thumb]').forEach((b) => b.addEventListener('click', () => showMedia(b.dataset.thumb)));
    root.querySelector('[data-gallery-prev]')?.addEventListener('click', () => step(-1));
    root.querySelector('[data-gallery-next]')?.addEventListener('click', () => step(1));
    const startThumb = root.querySelector('[data-thumb][aria-pressed="true"]');
    const startIndex = root.querySelector('[data-gallery-index]');
    if (startThumb && startIndex) startIndex.textContent = mediaIds().indexOf(startThumb.dataset.thumb) + 1;
    const galleryMain = root.querySelector('[data-gallery-main]');
    if (galleryMain) {
      let x0 = null;
      let y0 = 0;
      galleryMain.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || e.target.closest('video, model-viewer, button')) return;
        x0 = e.clientX;
        y0 = e.clientY;
      });
      galleryMain.addEventListener('pointerup', (e) => {
        if (x0 == null) return;
        const dx = e.clientX - x0;
        const dy = e.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
      });
      galleryMain.addEventListener('pointercancel', () => { x0 = null; });
      root.querySelector('[data-gallery]').addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (!e.target.closest('[data-thumb], [data-gallery-prev], [data-gallery-next]')) return;
        e.preventDefault();
        step(e.key === 'ArrowRight' ? 1 : -1);
        root.querySelector('[data-thumb][aria-pressed="true"]')?.focus({ preventScroll: true });
      });
    }

    form.addEventListener('submit', async (e) => {
      if (!drawer()) return; // no drawer: normal form post to /cart/add
      e.preventDefault();
      errorEl.hidden = true;
      addBtn.disabled = true;
      const body = new FormData(form);
      body.append('sections', DRAWER_SECTION);
      body.append('sections_url', window.location.pathname);
      try {
        const res = await fetch(routes().cartAdd, { method: 'POST', body, headers: { Accept: 'application/json' } });
        const json = await res.json();
        if (!res.ok || json.status) {
          errorEl.textContent = json.description || json.message || str('addError', 'Impossible d’ajouter ce produit au panier.');
          errorEl.hidden = false;
          return;
        }
        renderSections(json.sections);
        // motion.js fait voler la balle jusqu’au panier (650 ms) : le compteur change à l’arrivée,
        // puis le panier s’ouvre.
        document.dispatchEvent(new CustomEvent('pattoune:cart-added', { detail: { button: addBtn, quantity: qty() } }));
        setTimeout(refreshCount, calm() ? 0 : 650);
        setTimeout(openDrawer, calm() ? 0 : 650);
        if (addLabel) {
          addLabel.textContent = str('added', 'Ajouté au panier');
          addBtn.setAttribute('data-added', '');
          setTimeout(() => {
            addLabel.textContent = addText;
            addBtn.removeAttribute('data-added');
          }, 2400);
        }
      } catch {
        errorEl.textContent = str('networkError', 'La connexion a échoué. Réessaie dans un instant.');
        errorEl.hidden = false;
      } finally {
        addBtn.disabled = !variant.available;
      }
    });

    updateOffers();
    // Retour arrière (bfcache ou formulaire restauré) : le total suit l’offre réellement cochée.
    addEventListener('pageshow', updateOffers);
  }

  /* -------------------------------------------------- Delivery window */
  function addBusinessDays(from, n) {
    const d = new Date(from);
    let left = n;
    while (left > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) left--;
    }
    return d;
  }
  function initDelivery() {
    const processing = Number((window.theme && window.theme.processingDays) || 0);
    const fmt = new Intl.DateTimeFormat(document.documentElement.lang || 'fr', { day: 'numeric', month: 'long' });
    document.querySelectorAll('[data-delivery]').forEach((el) => {
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      if (!min || !max || max < min) return;
      const now = new Date();
      el.innerHTML = str('delivery', 'Livraison estimée entre le <strong>[start]</strong> et le <strong>[end]</strong>')
        .replace('[start]', fmt.format(addBusinessDays(now, min + processing)))
        .replace('[end]', fmt.format(addBusinessDays(now, max + processing)));
    });
  }

  /* --------------------------------------------- Sticky buy (mobile) */
  // Visible une fois le haut de page (ou le bloc d’achat de la page produit) dépassé, cachée
  // sur la zone d’achat, la clôture et le pied de page. Sans écouteur de défilement.
  function initSticky() {
    const bar = document.querySelector('[data-sticky-buy]');
    if (!bar || bar.ptSticky || !('IntersectionObserver' in window)) return;
    const start = document.querySelector('[data-sticky-start]') || document.querySelector('[data-product-root]');
    const zone = document.querySelector('[data-product-root]');
    if (!start) return;
    bar.ptSticky = true;
    const stops = new Set();
    let past = false, inZone = false;
    const link = bar.querySelector('a');
    const update = () => {
      const show = past && !inZone && stops.size === 0;
      bar.toggleAttribute('data-show', show);
      bar.setAttribute('aria-hidden', String(!show));
      if (link) link.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(start);
    if (zone && zone !== start) new IntersectionObserver(([e]) => { inZone = e.isIntersecting; update(); }).observe(zone);
    const so = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? stops.add(e.target) : stops.delete(e.target))); update(); });
    document.querySelectorAll('[data-sticky-stop], [data-footer], .footer').forEach((s) => so.observe(s));
  }

  /* ---------------------------------------------- Réduire les animations */
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------- Son des vidéos */
  function setSound(video, on) {
    if (!video) return;
    video.muted = !on;
    if (on) video.play().catch(() => {});
    const wrap = video.closest('[data-video]');
    const btn = wrap && wrap.querySelector('[data-sound]');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      const label = btn.querySelector('[data-sound-label]');
      if (label) label.textContent = on ? str('soundOff', 'Couper le son') : str('soundOn', 'Activer le son');
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sound]');
    if (!btn) return;
    const video = btn.closest('[data-video]').querySelector('video');
    const on = video.muted;
    // Une seule vidéo avec le son à la fois.
    if (on) document.querySelectorAll('[data-video] video').forEach((v) => v !== video && setSound(v, false));
    setSound(video, on);
  });

  /* -------------------------------------------- Address country select */
  function initCountrySelects() {
    document.querySelectorAll('select[data-default]').forEach((s) => {
      const v = s.dataset.default;
      if (v) [...s.options].forEach((o) => (o.selected = o.value === v || o.textContent === v));
    });
  }

  function init() {
    document.querySelectorAll('[data-product-root]').forEach(initProduct);
    initDelivery();
    initSticky();
    initCountrySelects();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Theme editor: re-run when a section is reloaded.
  document.addEventListener('shopify:section:load', init);
})();

// Sélecteur de langue : se referme au clic à l’extérieur ou avec Échap.
document.addEventListener('click', (e) => {
  document.querySelectorAll('[data-lang][open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('[data-lang][open]').forEach((d) => { d.removeAttribute('open'); d.querySelector('summary')?.focus(); });
});
