import { useEffect, useState, type ReactNode } from 'react';
import { config } from '../config';
import { cart, useCart } from '../lib/cart';
import { analyticsConfigured, loadAnalytics, readConsent, saveConsent } from '../lib/consent';
import { onLinkClick } from '../lib/router';
import { Bag, Paw } from './Icons';

export function Link({ href, children, className, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return (
    <a href={href} className={className} onClick={onLinkClick} {...rest}>
      {children}
    </a>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${config.brand.name}, accueil`}>
      <span className="logo__mark">
        <Paw />
      </span>
      <span className="logo__name">{config.brand.name}</span>
    </Link>
  );
}

export function Header() {
  const units = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const pulse = useCart((s) => s.pulse);
  return (
    <>
      {config.brand.announcement && <p className="announce">{config.brand.announcement}</p>}
      <header className="header">
        <div className="header__inner wrap">
          <Logo />
          <nav className="header__nav" aria-label="Navigation principale">
            <Link href="/#le-jouet">Le jouet</Link>
            <Link href="/#comment">Comment ça marche</Link>
            <Link href="/#faq">Questions</Link>
            <Link href="/livraison">Livraison</Link>
          </nav>
          <button type="button" className="cart-btn" onClick={() => cart.open()} aria-label={`Panier, ${units} article${units > 1 ? 's' : ''}`}>
            <Bag />
            <span className="cart-btn__label">Panier</span>
            <span className="cart-btn__count" key={pulse} data-empty={units === 0 ? '' : undefined}>
              {units}
            </span>
          </button>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div className="footer__brand">
          <Logo />
          <p>{config.brand.tagline}.</p>
          <p className="footer__mail">
            Une question ? <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>
            <br />
            Réponse {config.contact.responseTime}.
          </p>
        </div>
        <nav aria-label="Aide">
          <h2>Aide</h2>
          <ul>
            <li>
              <Link href="/livraison">Livraison et retours</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
            <li>
              <Link href="/#faq">Questions fréquentes</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Informations légales">
          <h2>Légal</h2>
          <ul>
            <li>
              <Link href="/cgv">Conditions générales de vente</Link>
            </li>
            <li>
              <Link href="/retractation">Droit de rétractation</Link>
            </li>
            <li>
              <Link href="/mentions-legales">Mentions légales</Link>
            </li>
            <li>
              <Link href="/confidentialite">Confidentialité et cookies</Link>
            </li>
          </ul>
        </nav>
        {(config.contact.instagram || config.contact.tiktok) && (
          <nav aria-label="Réseaux sociaux">
            <h2>Suivre</h2>
            <ul>
              {config.contact.instagram && (
                <li>
                  <a href={config.contact.instagram} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                </li>
              )}
              {config.contact.tiktok && (
                <li>
                  <a href={config.contact.tiktok} target="_blank" rel="noreferrer">
                    TikTok
                  </a>
                </li>
              )}
            </ul>
          </nav>
        )}
      </div>
      <div className="wrap footer__bottom">
        <span>
          © {year} {config.brand.name}
        </span>
        <span>Paiement sécurisé · Prix TTC en euros</span>
      </div>
    </footer>
  );
}

/** Shown only when an analytics id is configured; nothing loads before "Accepter". */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!analyticsConfigured()) return;
    const c = readConsent();
    if (c === 'accepted') loadAnalytics();
    else if (c === null) setVisible(true);
  }, []);
  if (!visible) return null;
  const choose = (v: 'accepted' | 'refused') => {
    saveConsent(v);
    setVisible(false);
  };
  return (
    <div className="consent" role="dialog" aria-label="Cookies" aria-live="polite">
      <p>
        Nous utilisons des cookies de mesure d’audience et de publicité pour améliorer la boutique. Ils ne sont déposés qu’avec ton accord.{' '}
        <Link href="/confidentialite">En savoir plus</Link>
      </p>
      <div className="consent__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => choose('refused')}>
          Refuser
        </button>
        <button type="button" className="btn btn--ink btn--sm" onClick={() => choose('accepted')}>
          Accepter
        </button>
      </div>
    </div>
  );
}
