import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { cart, MAX_LINE_QTY, useCart } from '../lib/cart';
import { planCheckout } from '../lib/checkout';
import { track } from '../lib/consent';
import { computeTotals, formatCents } from '../lib/pricing';
import { Arrow, Close, Lock, Minus, Plus, Truck } from './Icons';
import { Link } from './Layout';

function Swatch({ hex }: { hex: string }) {
  return <span className="swatch-dot" style={{ background: hex }} aria-hidden="true" />;
}

export function CartDrawer() {
  const open = useCart((s) => s.open);
  const lines = useCart((s) => s.lines);
  const ref = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const totals = computeTotals(lines);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add('is-locked');
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) {
      setNotice(null);
      setDemo(false);
    }
  }, [open]);

  const checkout = () => {
    const plan = planCheckout(lines);
    track('InitiateCheckout', { value: totals.total / 100 });
    if (plan.kind === 'redirect') window.location.assign(plan.url);
    else if (plan.kind === 'error') setNotice(plan.message);
    else setDemo(true);
  };

  const freeShippingPct =
    config.shipping.freeThreshold > 0 ? Math.min(100, 100 - (totals.toFreeShipping / (config.shipping.freeThreshold * 100)) * 100) : 100;

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="cart-title"
      onClose={() => {
        document.documentElement.classList.remove('is-locked');
        cart.close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) cart.close();
      }}
    >
      <div className="drawer__panel">
        <div className="drawer__head">
          <h2 id="cart-title">Ton panier</h2>
          <button type="button" className="icon-btn" onClick={() => cart.close()} aria-label="Fermer le panier">
            <Close />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="drawer__empty">
            <p>Ton panier est vide pour l’instant.</p>
            <button type="button" className="btn btn--ink" onClick={() => cart.close()}>
              Voir le jouet
            </button>
          </div>
        ) : demo ? (
          <div className="drawer__demo" role="status">
            <h3>Paiement pas encore branché</h3>
            <p>
              Cette boutique est en mode démonstration : aucune commande n’est enregistrée et aucun paiement n’est demandé. Le propriétaire doit
              relier Shopify ou Stripe dans le fichier de configuration.
            </p>
            <p className="drawer__demo-total">
              Montant qui aurait été payé : <strong>{formatCents(totals.total)}</strong>
            </p>
            <button type="button" className="btn btn--ghost" onClick={() => setDemo(false)}>
              Retour au panier
            </button>
          </div>
        ) : (
          <>
            <div className="ship-meter" aria-live="polite">
              <p>
                <Truck />{' '}
                {totals.toFreeShipping > 0 ? (
                  <>
                    Plus que <strong>{formatCents(totals.toFreeShipping)}</strong> pour la livraison offerte
                  </>
                ) : (
                  <strong>Livraison offerte</strong>
                )}
              </p>
              <span className="ship-meter__bar" aria-hidden="true">
                <span style={{ width: `${freeShippingPct}%` }} />
              </span>
            </div>

            <ul className="lines">
              {lines.map((l) => {
                const v = config.product.variants.find((x) => x.id === l.variantId)!;
                return (
                  <li key={l.variantId} className="line">
                    <div className="line__thumb" style={{ ['--c' as string]: v.hex }} aria-hidden="true">
                      {config.product.images[0] ? <img src={config.product.images[0]} alt="" /> : <span className="line__ball" />}
                    </div>
                    <div className="line__info">
                      <p className="line__name">{config.product.name}</p>
                      <p className="line__variant">
                        <Swatch hex={v.hex} /> {v.label}
                      </p>
                      <div className="stepper" role="group" aria-label={`Quantité, ${v.label}`}>
                        <button type="button" onClick={() => cart.setQty(l.variantId, l.qty - 1)} aria-label="Retirer un">
                          <Minus />
                        </button>
                        <span aria-live="polite">{l.qty}</span>
                        <button
                          type="button"
                          onClick={() => cart.setQty(l.variantId, l.qty + 1)}
                          disabled={l.qty >= MAX_LINE_QTY}
                          aria-label="Ajouter un"
                        >
                          <Plus />
                        </button>
                      </div>
                    </div>
                    <div className="line__side">
                      <p className="line__price">{formatCents(l.qty * Math.round(config.product.price * 100))}</p>
                      <button type="button" className="link-btn" onClick={() => cart.remove(l.variantId)}>
                        Retirer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {totals.nextTier && (
              <p className="upsell">
                Ajoute {totals.nextTier.quantity - totals.units} jouet{totals.nextTier.quantity - totals.units > 1 ? 's' : ''} pour profiter de{' '}
                <strong>−{totals.nextTier.discount} %</strong> sur toute la commande.
              </p>
            )}

            <dl className="totals">
              <div>
                <dt>Sous-total</dt>
                <dd>{formatCents(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="totals__discount">
                  <dt>Remise lot (−{totals.discountRate} %)</dt>
                  <dd>−{formatCents(totals.discount)}</dd>
                </div>
              )}
              <div>
                <dt>Livraison</dt>
                <dd>{totals.shipping === 0 ? 'Offerte' : formatCents(totals.shipping)}</dd>
              </div>
              <div className="totals__grand">
                <dt>Total TTC</dt>
                <dd>{formatCents(totals.total)}</dd>
              </div>
            </dl>

            {notice && (
              <p className="notice" role="alert">
                {notice}
              </p>
            )}

            <button type="button" className="btn btn--sun btn--block btn--lg" onClick={checkout}>
              Commander <Arrow />
            </button>
            <p className="drawer__fine">
              <Lock />
              <span>
                Paiement sécurisé. En commandant, tu acceptes les{' '}
                <Link href="/cgv" onClickCapture={() => cart.close()}>
                  conditions de vente
                </Link>
                .
              </span>
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
