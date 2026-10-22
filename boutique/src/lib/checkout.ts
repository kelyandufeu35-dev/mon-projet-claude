import { config } from '../config';
import type { CartLine } from './pricing';

export type CheckoutPlan = { kind: 'redirect'; url: string } | { kind: 'demo' } | { kind: 'error'; message: string };

/**
 * Decides where the "Commander" button sends the visitor, from the payment
 * mode chosen in config.ts. No network call is made here.
 */
export function planCheckout(
  lines: readonly CartLine[],
  checkout = config.checkout,
  variants = config.product.variants,
  offers = config.offers,
): CheckoutPlan {
  const items = lines.filter((l) => l.qty > 0);
  if (items.length === 0) return { kind: 'error', message: 'Ton panier est vide.' };

  if (checkout.mode === 'shopify') {
    const domain = checkout.shopifyDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!domain) return { kind: 'error', message: 'Le paiement Shopify n’est pas encore configuré.' };
    const parts: string[] = [];
    for (const l of items) {
      const v = variants.find((x) => x.id === l.variantId);
      if (!v?.shopifyVariantId) return { kind: 'error', message: `La couleur « ${v?.label ?? l.variantId} » n’est pas reliée à Shopify.` };
      parts.push(`${v.shopifyVariantId}:${l.qty}`);
    }
    return { kind: 'redirect', url: `https://${domain}/cart/${parts.join(',')}` };
  }

  if (checkout.mode === 'stripe') {
    const units = items.reduce((n, l) => n + l.qty, 0);
    const offer = offers.find((o) => o.quantity === units);
    if (!offer) {
      const max = Math.max(...offers.map((o) => o.quantity));
      return {
        kind: 'error',
        message: `Le paiement en ligne accepte 1 à ${max} jouets par commande. Ajuste les quantités ou écris-nous pour une commande plus importante.`,
      };
    }
    const link = checkout.stripeLinks[offer.id];
    if (!link) return { kind: 'error', message: 'Le lien de paiement de cette offre n’est pas encore configuré.' };
    // Colours travel in client_reference_id (letters, digits, - and _ only).
    const ref = items
      .map((l) => `${l.variantId}-${l.qty}`)
      .join('_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 200);
    const url = new URL(link);
    url.searchParams.set('client_reference_id', ref);
    return { kind: 'redirect', url: url.toString() };
  }

  return { kind: 'demo' };
}
