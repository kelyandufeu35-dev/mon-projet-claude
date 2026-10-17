import { describe, expect, it } from 'vitest';
import { computeTotals, offerPrice, tierFor } from './pricing';
import { planCheckout } from './checkout';

const offers = [
  { id: 'x1', quantity: 1, label: '1', discount: 0, badge: '', preselected: false },
  { id: 'x2', quantity: 2, label: '2', discount: 15, badge: '', preselected: false },
  { id: 'x3', quantity: 3, label: '3', discount: 25, badge: '', preselected: false },
];
const opts = { price: 24.9, offers, freeThreshold: 35, shippingCost: 4.9 };

describe('computeTotals', () => {
  it('returns zeros for an empty cart', () => {
    const t = computeTotals([], opts);
    expect(t.total).toBe(0);
    expect(t.shipping).toBe(0);
    expect(t.toFreeShipping).toBe(3500);
  });

  it('charges shipping under the threshold', () => {
    const t = computeTotals([{ variantId: 'a', qty: 1 }], opts);
    expect(t.subtotal).toBe(2490);
    expect(t.discount).toBe(0);
    expect(t.shipping).toBe(490);
    expect(t.total).toBe(2980);
    expect(t.toFreeShipping).toBe(1010);
  });

  it('applies the bundle tier across mixed colours', () => {
    const t = computeTotals(
      [
        { variantId: 'a', qty: 1 },
        { variantId: 'b', qty: 1 },
      ],
      opts,
    );
    expect(t.discountRate).toBe(15);
    expect(t.discount).toBe(747);
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(4233);
  });

  it('keeps the top tier above the biggest offer', () => {
    const t = computeTotals([{ variantId: 'a', qty: 5 }], opts);
    expect(t.discountRate).toBe(25);
    expect(t.total).toBe(9337); // remise de 31,13 € arrondie en faveur du client
    expect(t.nextTier).toBeNull();
  });

  it('ignores negative and fractional quantities', () => {
    expect(
      computeTotals(
        [
          { variantId: 'a', qty: -2 },
          { variantId: 'b', qty: 1.7 },
        ],
        opts,
      ).units,
    ).toBe(1);
  });

  it('treats a zero threshold as always free', () => {
    expect(computeTotals([{ variantId: 'a', qty: 1 }], { ...opts, freeThreshold: 0 }).shipping).toBe(0);
  });
});

describe('offers', () => {
  it('shows exactly what the cart charges, for every offer', () => {
    for (const o of offers) {
      const t = computeTotals([{ variantId: 'a', qty: o.quantity }], { ...opts, freeThreshold: 0 });
      expect(offerPrice(o, 24.9).total).toBe(t.total);
    }
  });
  it('finds the right tier', () => {
    expect(tierFor(0, offers)).toBeNull();
    expect(tierFor(2, offers)?.id).toBe('x2');
    expect(tierFor(9, offers)?.id).toBe('x3');
  });
  it('prices a bundle', () => {
    expect(offerPrice(offers[2], 24.9)).toEqual({ full: 7470, total: 5602, perUnit: 1867 });
  });
});

describe('planCheckout', () => {
  const variants = [
    { id: 'bleu', label: 'Bleu', hex: '#00f', shopifyVariantId: '111' },
    { id: 'rose', label: 'Rose', hex: '#f0f', shopifyVariantId: '' },
  ];
  const base = {
    mode: 'demo' as 'demo' | 'shopify' | 'stripe',
    shopifyDomain: '',
    stripeLinks: { x1: '', x2: 'https://buy.stripe.com/test_x2', x3: '' },
  };

  it('refuses an empty cart', () => {
    expect(planCheckout([], base, variants, offers).kind).toBe('error');
  });
  it('stays in demo mode by default', () => {
    expect(planCheckout([{ variantId: 'bleu', qty: 1 }], base, variants, offers)).toEqual({ kind: 'demo' });
  });
  it('builds a Shopify cart permalink', () => {
    const plan = planCheckout(
      [{ variantId: 'bleu', qty: 2 }],
      { ...base, mode: 'shopify', shopifyDomain: 'https://shop.myshopify.com/' },
      variants,
      offers,
    );
    expect(plan).toEqual({ kind: 'redirect', url: 'https://shop.myshopify.com/cart/111:2' });
  });
  it('reports a colour missing its Shopify id', () => {
    const plan = planCheckout([{ variantId: 'rose', qty: 1 }], { ...base, mode: 'shopify', shopifyDomain: 'shop.myshopify.com' }, variants, offers);
    expect(plan.kind).toBe('error');
  });
  it('maps the quantity to a Stripe link and passes colours', () => {
    const plan = planCheckout(
      [
        { variantId: 'bleu', qty: 1 },
        { variantId: 'rose', qty: 1 },
      ],
      { ...base, mode: 'stripe' },
      variants,
      offers,
    );
    expect(plan).toEqual({ kind: 'redirect', url: 'https://buy.stripe.com/test_x2?client_reference_id=bleu-1_rose-1' });
  });
  it('rejects a Stripe quantity with no offer', () => {
    expect(planCheckout([{ variantId: 'bleu', qty: 4 }], { ...base, mode: 'stripe' }, variants, offers).kind).toBe('error');
  });
});
