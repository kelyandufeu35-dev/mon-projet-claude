import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { config, type Offer } from '../config';
import { cart } from '../lib/cart';
import { track } from '../lib/consent';
import { formatCents, offerPrice, toCents } from '../lib/pricing';
import { deliveryWindow, useReducedMotion } from '../lib/util';
import { Check, Lock, Return, Truck } from './Icons';

const Toy3D = lazy(() => import('../three/Toy3D'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Flat drawing of the toy: loading state and no-WebGL fallback. */
function ToySketch({ color }: { color: string }) {
  return (
    <div className="toy-sketch" style={{ ['--c' as string]: color }} aria-hidden="true">
      <span className="toy-sketch__ball" />
      <span className="toy-sketch__shadow" />
    </div>
  );
}

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="gallery">
      <div className="gallery__main">
        <img src={images[i]} alt={`${name}, photo ${i + 1} sur ${images.length}`} />
      </div>
      {images.length > 1 && (
        <div className="gallery__thumbs" role="group" aria-label="Choisir une photo">
          {images.map((src, k) => (
            <button key={src} type="button" aria-pressed={k === i} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductVisual({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const [gl] = useState(hasWebGL);
  const { images, name } = config.product;
  if (images.length > 0) return <Gallery images={images} name={name} />;
  return (
    <div className="visual">
      <div className="visual__stage">
        {gl ? (
          <Boundary fallback={<ToySketch color={color} />}>
            <Suspense fallback={<ToySketch color={color} />}>
              <Toy3D color={color} motion={!reduced} label={`${name}, illustration en 3D`} />
            </Suspense>
          </Boundary>
        ) : (
          <ToySketch color={color} />
        )}
      </div>
      <p className="visual__note">Illustration. Photos du produit à venir.</p>
    </div>
  );
}

function OfferCard({ offer, selected, onSelect }: { offer: Offer; selected: boolean; onSelect: () => void }) {
  const p = offerPrice(offer);
  return (
    <label className="offer" data-selected={selected ? '' : undefined}>
      <input type="radio" name="offer" value={offer.id} checked={selected} onChange={onSelect} />
      <span className="offer__body">
        <span className="offer__top">
          <span className="offer__label">{offer.label}</span>
          {offer.badge && <span className="offer__badge">{offer.badge}</span>}
        </span>
        <span className="offer__price">
          <strong>{formatCents(p.total)}</strong>
          {offer.discount > 0 && <s>{formatCents(p.full)}</s>}
        </span>
        <span className="offer__unit">
          {offer.quantity > 1 ? `${formatCents(p.perUnit)} le jouet` : 'Prix unitaire'}
          {offer.discount > 0 && <em> · −{offer.discount} %</em>}
        </span>
      </span>
    </label>
  );
}

export function BuyBox({ variantId, setVariantId }: { variantId: string; setVariantId: (v: string) => void }) {
  const { product, offers, shipping } = config;
  const [offerId, setOfferId] = useState(offers.find((o) => o.preselected)?.id ?? offers[0].id);
  const [added, setAdded] = useState(false);
  const offer = offers.find((o) => o.id === offerId)!;
  const variant = product.variants.find((v) => v.id === variantId)!;
  const window_ = deliveryWindow();
  const timer = useRef(0);

  useEffect(() => {
    track('ViewContent', { value: product.price });
    return () => window.clearTimeout(timer.current);
  }, [product.price]);

  const add = () => {
    cart.add(variantId, offer.quantity);
    track('AddToCart', { value: offerPrice(offer).total / 100 });
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 2400);
  };

  return (
    <div className="buybox" id="acheter">
      <p className="buybox__pets">
        {product.pets.map((p) => (
          <span key={p} className="chip">
            {p}
          </span>
        ))}
      </p>
      <h1 className="buybox__title">{product.name}</h1>
      <p className="buybox__sub">{product.subtitle}</p>

      <p className="buybox__price">
        <span className="buybox__amount">{formatCents(toCents(product.price))}</span>
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <>
            <s>{formatCents(toCents(product.compareAtPrice))}</s>
            <span className="tag">−{Math.round((1 - product.price / product.compareAtPrice) * 100)} %</span>
          </>
        )}
        <span className="buybox__ttc">TTC</span>
      </p>

      <fieldset className="field">
        <legend>
          Couleur : <strong>{variant.label}</strong>
        </legend>
        <div className="swatches">
          {product.variants.map((v) => (
            <label key={v.id} className="swatch" title={v.label}>
              <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} />
              <span style={{ background: v.hex }} />
              <span className="sr-only">{v.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Quantité</legend>
        <div className="offers">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} selected={o.id === offerId} onSelect={() => setOfferId(o.id)} />
          ))}
        </div>
      </fieldset>

      <button type="button" className="btn btn--sun btn--block btn--lg add-btn" onClick={add} data-added={added ? '' : undefined}>
        {added ? (
          <>
            <Check /> Ajouté au panier
          </>
        ) : (
          <>Ajouter au panier · {formatCents(offerPrice(offer).total)}</>
        )}
      </button>
      <p className="sr-only" role="status">
        {added ? `${offer.quantity} ${product.name}, ${variant.label}, ajouté au panier.` : ''}
      </p>

      <ul className="buybox__highlights">
        {product.highlights.map((h) => (
          <li key={h}>
            <Check /> {h}
          </li>
        ))}
      </ul>

      <ul className="trust">
        <li>
          <Truck />
          <span>
            {window_ ? (
              <>
                Livraison estimée entre le <strong>{window_.from}</strong> et le <strong>{window_.to}</strong>
              </>
            ) : (
              <>Livraison en {shipping.delay}</>
            )}
          </span>
        </li>
        <li>
          <Return />
          <span>14 jours pour changer d’avis</span>
        </li>
        <li>
          <Lock />
          <span>Paiement sécurisé</span>
        </li>
      </ul>
    </div>
  );
}

/** Compact bar on phones once the main button has scrolled away. */
export function StickyBuy({ variantId }: { variantId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.querySelector('.add-btn');
    const footer = document.querySelector('.footer');
    if (!target) return;
    let pastButton = false;
    let atFooter = false;
    const update = () => setShow(pastButton && !atFooter);
    const io = new IntersectionObserver(([e]) => {
      pastButton = !e.isIntersecting && e.boundingClientRect.top < 0;
      update();
    });
    const io2 = new IntersectionObserver(([e]) => {
      atFooter = e.isIntersecting;
      update();
    });
    io.observe(target);
    if (footer) io2.observe(footer);
    return () => {
      io.disconnect();
      io2.disconnect();
    };
  }, []);
  const v = config.product.variants.find((x) => x.id === variantId)!;
  return (
    <div className="sticky-buy" data-show={show ? '' : undefined} aria-hidden={!show}>
      <div>
        <p className="sticky-buy__name">{config.product.name}</p>
        <p className="sticky-buy__price">
          {formatCents(toCents(config.product.price))} · {v.label}
        </p>
      </div>
      <button
        type="button"
        className="btn btn--sun"
        tabIndex={show ? 0 : -1}
        onClick={() => document.getElementById('acheter')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      >
        Choisir
      </button>
    </div>
  );
}
