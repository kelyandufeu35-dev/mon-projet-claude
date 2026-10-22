/* SquishyTime : interactions de la boutique (sans dépendance). */
(() => {
  const config = window.SquishyTime || {};

  /* ---------- Prix ---------- */
  function formatMoney(cents) {
    const format = config.moneyFormat || '{{amount_with_comma_separator}} €';
    const group = (value, decimals, thousands, decimal) => {
      const fixed = (value / 100).toFixed(decimals);
      const [whole, frac] = fixed.split('.');
      const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return frac ? withSep + decimal + frac : withSep;
    };
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount': return group(cents, 2, ',', '.');
        case 'amount_no_decimals': return group(cents, 0, ',', '.');
        case 'amount_with_comma_separator': return group(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return group(cents, 0, '.', ',');
        case 'amount_with_space_separator': return group(cents, 2, ' ', ',');
        case 'amount_with_apostrophe_separator': return group(cents, 2, "'", '.');
        default: return group(cents, 2, ' ', ',');
      }
    });
  }

  // Même calcul que dans product-buy.liquid, pour afficher le même montant.
  const bundleTotal = (price, qty, pct) => Math.floor((price * qty * (100 - pct) + 50) / 100);

  /* ---------- Panier coulissant ---------- */
  const drawer = () => document.querySelector('[data-cart-drawer]');
  let lastFocus = null;

  function openDrawer() {
    const el = drawer();
    if (!el) return;
    lastFocus = document.activeElement;
    el.classList.add('is-open');
    document.body.classList.add('is-locked');
    el.querySelector('.drawer__panel').focus();
  }

  function closeDrawer() {
    const el = drawer();
    if (!el) return;
    el.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (lastFocus) lastFocus.focus();
  }

  function updateCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.textContent = count;
      badge.hidden = count === 0;
    });
    document.querySelectorAll('[data-cart-open]').forEach((link) => {
      link.setAttribute('aria-label', `Panier, ${count} article${count > 1 ? 's' : ''}`);
      link.classList.remove('is-bumped');
      void link.offsetWidth;
      link.classList.add('is-bumped');
    });
  }

  // Remplace le contenu du tiroir (et de la page panier) par le HTML renvoyé par Shopify.
  function renderCart(sections) {
    const html = sections && sections['cart-drawer'];
    if (!html) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fresh = doc.querySelector('[data-drawer-body]');
    const body = document.querySelector('[data-drawer-body]');
    if (fresh && body) body.innerHTML = fresh.innerHTML;

    const pageBody = document.querySelector('[data-cart-page-body]');
    const contents = doc.querySelector('[data-cart-contents]');
    if (pageBody && contents) {
      contents.querySelectorAll('.cart__page-link').forEach((link) => link.remove());
      pageBody.innerHTML = '';
      pageBody.appendChild(document.importNode(contents, true));
    }
    if (contents) updateCount(Number(contents.dataset.count || 0));
  }

  async function postJSON(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.status) throw new Error(data.description || data.message || 'Erreur');
    return data;
  }

  async function changeLine(line, quantity) {
    const box = document.querySelectorAll('[data-cart-contents]');
    box.forEach((el) => el.classList.add('is-busy'));
    try {
      const data = await postJSON(`${config.cartChangeUrl || '/cart/change'}.js`, { line, quantity, sections: ['cart-drawer'] });
      renderCart(data.sections);
    } catch (error) {
      window.location.reload();
    }
  }

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-cart-open]');
    if (opener && drawer() && !document.querySelector('[data-cart-page]')) {
      event.preventDefault();
      openDrawer();
      return;
    }
    if (event.target.closest('[data-cart-close]')) {
      closeDrawer();
      return;
    }
    const remove = event.target.closest('[data-line-remove]');
    if (remove) {
      event.preventDefault();
      changeLine(Number(remove.dataset.lineRemove), 0);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const el = drawer();
    if (el && el.classList.contains('is-open')) closeDrawer();
    document.querySelectorAll('[data-mobile-nav][open]').forEach((nav) => nav.removeAttribute('open'));
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-line-qty]');
    if (input) changeLine(Number(input.dataset.lineQty), Math.max(0, parseInt(input.value, 10) || 0));
    const sort = event.target.closest('[data-autosubmit]');
    if (sort) sort.form.submit();
  });

  /* ---------- Sélecteur de quantité ---------- */
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.querySelectorAll('[data-step]').forEach((button) => {
        button.addEventListener('click', () => {
          const min = Number(this.input.min || 0);
          const next = Math.max(min, (parseInt(this.input.value, 10) || 0) + Number(button.dataset.step));
          if (String(next) === this.input.value) return;
          this.input.value = next;
          this.input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    }
  }
  customElements.define('quantity-input', QuantityInput);

  /* ---------- Galerie produit ---------- */
  class MediaGallery extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-track]');
      this.thumbs = [...this.querySelectorAll('[data-thumb]')];
      this.thumbs.forEach((thumb) => thumb.addEventListener('click', () => this.show(thumb.dataset.thumb)));
      if (this.track && this.thumbs.length) {
        let ticking = false;
        this.track.addEventListener('scroll', () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const index = Math.round(this.track.scrollLeft / this.track.clientWidth);
            this.setActive(this.thumbs[index] && this.thumbs[index].dataset.thumb);
            ticking = false;
          });
        });
      }
      const featured = this.querySelector('.gallery__thumb.is-active');
      if (featured) this.show(featured.dataset.thumb, false);
    }

    show(mediaId, smooth = true) {
      const slide = this.track && this.track.querySelector(`[data-media-id="${mediaId}"]`);
      if (!slide) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.track.scrollTo({ left: slide.offsetLeft - this.track.offsetLeft, behavior: smooth && !reduce ? 'smooth' : 'auto' });
      this.setActive(String(mediaId));
    }

    setActive(mediaId) {
      this.thumbs.forEach((thumb) => thumb.classList.toggle('is-active', thumb.dataset.thumb === mediaId));
    }
  }
  customElements.define('media-gallery', MediaGallery);

  /* ---------- Bloc d'achat ---------- */
  class ProductBuy extends HTMLElement {
    connectedCallback() {
      this.variants = JSON.parse(this.querySelector('[data-variants]').textContent);
      this.form = this.querySelector('[data-product-form]');
      this.idInput = this.querySelector('[data-variant-id]');
      this.qtyInput = this.querySelector('[data-quantity]');
      this.addButton = this.querySelector('[data-add]');
      this.error = this.querySelector('[data-error]');
      this.variant = this.variants.find((v) => String(v.id) === this.idInput.value) || this.variants[0];
      this.isMain = !!this.closest('.section-main-product');

      this.querySelectorAll('.picker__input').forEach((input) => input.addEventListener('change', () => this.onOptionChange()));
      this.querySelectorAll('.bundles__input').forEach((input) => input.addEventListener('change', () => {
        if (this.qtyInput) this.qtyInput.value = input.value;
      }));
      this.form.addEventListener('submit', (event) => this.onSubmit(event));
      this.markAvailability();
    }

    selectedOptions() {
      return [...this.querySelectorAll('.picker')].map((fieldset) => {
        const checked = fieldset.querySelector('.picker__input:checked');
        return checked ? checked.value : null;
      });
    }

    onOptionChange() {
      const options = this.selectedOptions();
      const variant = this.variants.find((v) => v.options.every((value, i) => value === options[i]));
      this.querySelectorAll('.picker').forEach((fieldset, i) => {
        const label = fieldset.querySelector('[data-option-value]');
        if (label) label.textContent = options[i];
      });
      this.variant = variant || null;
      this.update();
    }

    markAvailability() {
      const options = this.selectedOptions();
      this.querySelectorAll('.picker').forEach((fieldset, index) => {
        fieldset.querySelectorAll('.picker__input').forEach((input) => {
          const candidate = options.slice();
          candidate[index] = input.value;
          const match = this.variants.find((v) => v.options.every((value, i) => value === candidate[i]));
          input.classList.toggle('is-unavailable', !match || !match.available);
        });
      });
    }

    update() {
      const v = this.variant;
      const label = this.querySelector('[data-add-label]');
      this.error.hidden = true;
      this.markAvailability();

      if (!v) {
        this.addButton.disabled = true;
        label.textContent = 'Indisponible';
        this.syncSticky(null);
        return;
      }

      this.idInput.value = v.id;
      this.addButton.disabled = !v.available;
      label.textContent = v.available ? 'Ajouter au panier' : 'Épuisé';

      this.querySelector('[data-price]').textContent = formatMoney(v.price);
      const compare = this.querySelector('[data-compare]');
      if (compare) {
        compare.hidden = !(v.compare_at_price > v.price);
        compare.textContent = v.compare_at_price ? formatMoney(v.compare_at_price) : '';
      }

      this.querySelectorAll('.bundles__input').forEach((input) => {
        const card = input.nextElementSibling;
        const qty = Number(input.value);
        const pct = Number(input.dataset.pct || 0);
        const price = card.querySelector('[data-bundle-price]');
        const full = card.querySelector('[data-bundle-full]');
        if (price) price.textContent = formatMoney(bundleTotal(v.price, qty, pct));
        if (full) full.textContent = formatMoney(v.price * qty);
      });

      if (v.featured_media) {
        const gallery = this.closest('.product') && this.closest('.product').querySelector('media-gallery');
        if (gallery) gallery.show(v.featured_media.id);
      }

      if (this.isMain && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', v.id);
        window.history.replaceState({}, '', url.toString());
      }
      this.syncSticky(v);
    }

    syncSticky(v) {
      const sticky = document.querySelector(`sticky-buy[data-section-id="${this.dataset.sectionId}"]`);
      if (!sticky) return;
      const button = sticky.querySelector('[data-sticky-add]');
      button.disabled = !v || !v.available;
      if (v) sticky.querySelector('[data-sticky-price]').textContent = formatMoney(v.price);
    }

    async onSubmit(event) {
      if (!drawer()) return;
      event.preventDefault();
      if (this.addButton.disabled) return;
      this.addButton.classList.add('is-loading');
      this.addButton.setAttribute('aria-busy', 'true');
      this.error.hidden = true;
      try {
        const items = [{ id: Number(this.idInput.value), quantity: Math.max(1, parseInt(this.qtyInput.value, 10) || 1) }];
        const data = await postJSON(`${config.cartAddUrl || '/cart/add'}.js`, { items, sections: ['cart-drawer'] });
        renderCart(data.sections);
        openDrawer();
      } catch (error) {
        this.error.textContent = error.message;
        this.error.hidden = false;
      } finally {
        this.addButton.classList.remove('is-loading');
        this.addButton.removeAttribute('aria-busy');
      }
    }
  }
  customElements.define('product-buy', ProductBuy);

  /* ---------- Barre d'achat collante (téléphone) ---------- */
  class StickyBuy extends HTMLElement {
    connectedCallback() {
      const section = this.dataset.sectionId;
      const buy = document.querySelector(`product-buy[data-section-id="${section}"]`);
      const target = buy && buy.querySelector('[data-add]');
      if (!target || !('IntersectionObserver' in window)) return;
      this.hidden = false;
      const observer = new IntersectionObserver(([entry]) => {
        const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        this.classList.toggle('is-visible', passed);
      });
      observer.observe(target);
      this.querySelector('[data-sticky-add]').addEventListener('click', () => target.click());
    }
  }
  customElements.define('sticky-buy', StickyBuy);

  /* ---------- Recommandations produit ---------- */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (this.children.length || !this.dataset.url) return;
      const load = () => fetch(this.dataset.url)
        .then((response) => response.text())
        .then((text) => {
          const html = new DOMParser().parseFromString(text, 'text/html').querySelector('product-recommendations');
          if (html && html.innerHTML.trim()) this.innerHTML = html.innerHTML;
        })
        .catch(() => {});
      if (!('IntersectionObserver' in window)) return load();
      const observer = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        load();
      }, { rootMargin: '0px 0px 400px 0px' });
      observer.observe(this);
    }
  }
  customElements.define('product-recommendations', ProductRecommendations);

  /* ---------- Menu mobile : se ferme après un clic ---------- */
  document.querySelectorAll('[data-mobile-nav] a').forEach((link) => {
    link.addEventListener('click', () => link.closest('[data-mobile-nav]').removeAttribute('open'));
  });
})();
