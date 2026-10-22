import { useEffect, useSyncExternalStore } from 'react';
import { config } from '../config';

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export function useReducedMotion() {
  return useSyncExternalStore(
    (l) => {
      mq?.addEventListener('change', l);
      return () => mq?.removeEventListener('change', l);
    },
    () => !!mq?.matches,
  );
}

/** Sets the tab title and meta description for the current page. */
export function useSeo(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${config.brand.name}` : `${config.product.name} · ${config.brand.name}`;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

/** Adds n business days (Mon–Fri) to a date. */
export function addBusinessDays(from: Date, n: number) {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/**
 * Turns "7 à 14 jours ouvrés" + processing "1 à 3 jours" into a delivery
 * window. Returns null when the text cannot be parsed.
 */
export function deliveryWindow(now = new Date(), delay = config.shipping.delay, processing = config.shipping.processing) {
  const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
  const [dMin, dMax = dMin] = nums(delay);
  const [pMin = 0, pMax = pMin] = nums(processing);
  if (!dMin) return null;
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  return {
    from: fmt.format(addBusinessDays(now, dMin + pMin)),
    to: fmt.format(addBusinessDays(now, dMax + pMax)),
  };
}
