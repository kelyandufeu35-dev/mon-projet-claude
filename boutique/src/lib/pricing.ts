import { config, type Offer } from '../config';

export interface CartLine {
  variantId: string;
  qty: number;
}

export interface Totals {
  units: number;
  /** All amounts in cents to avoid floating point drift. */
  subtotal: number;
  discountRate: number;
  discount: number;
  shipping: number;
  total: number;
  /** Cents still missing for free shipping (0 when reached). */
  toFreeShipping: number;
  tier: Offer | null;
  nextTier: Offer | null;
}

export const toCents = (euros: number) => Math.round(euros * 100);

/** Bundle tier reached for a number of units: the biggest offer not above it. */
export function tierFor(units: number, offers: readonly Offer[] = config.offers): Offer | null {
  let best: Offer | null = null;
  for (const o of offers) if (o.quantity <= units && (!best || o.quantity > best.quantity)) best = o;
  return best;
}

export function computeTotals(
  lines: readonly CartLine[],
  opts: { price?: number; offers?: readonly Offer[]; freeThreshold?: number; shippingCost?: number } = {},
): Totals {
  const price = toCents(opts.price ?? config.product.price);
  const offers = opts.offers ?? config.offers;
  const threshold = toCents(opts.freeThreshold ?? config.shipping.freeThreshold);
  const shippingCost = toCents(opts.shippingCost ?? config.shipping.cost);

  const units = lines.reduce((n, l) => n + Math.max(0, Math.floor(l.qty)), 0);
  const subtotal = units * price;
  const tier = tierFor(units, offers);
  const discountRate = tier?.discount ?? 0;
  const discount = discountCents(subtotal, discountRate);
  const merch = subtotal - discount;
  const free = units > 0 && (threshold === 0 || merch >= threshold);
  const shipping = units === 0 || free ? 0 : shippingCost;
  const nextTier = offers.filter((o) => o.quantity > units).sort((a, b) => a.quantity - b.quantity)[0] ?? null;

  return {
    units,
    subtotal,
    discountRate,
    discount,
    shipping,
    total: merch + shipping,
    toFreeShipping: units === 0 ? threshold : Math.max(0, threshold - merch),
    tier,
    nextTier,
  };
}

/** Single rounding rule shared by the product page and the cart. */
export const discountCents = (subtotal: number, rate: number) => Math.round((subtotal * rate) / 100);

/** Price of an offer as displayed on the product page (cents). */
export function offerPrice(offer: Offer, price = config.product.price) {
  const full = offer.quantity * toCents(price);
  const total = full - discountCents(full, offer.discount);
  return { full, total, perUnit: Math.round(total / offer.quantity) };
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const formatCents = (cents: number) => eur.format(cents / 100);
