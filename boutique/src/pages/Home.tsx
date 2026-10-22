import { useState } from 'react';
import { config, fill } from '../config';
import { Clock, Drop, Mail, Nose, Paw, Return, Spark, Star, Truck } from '../components/Icons';
import { Link } from '../components/Layout';
import { BuyBox, ProductVisual, StickyBuy } from '../components/Product';
import { formatCents, toCents } from '../lib/pricing';
import { useSeo } from '../lib/util';

const ICONS = { nez: Nose, horloge: Clock, etincelle: Spark, goutte: Drop, patte: Paw, camion: Truck } as const;
const { page } = config;

function Benefits() {
  return (
    <section className="section" aria-labelledby="t-benefits">
      <div className="wrap">
        <p className="eyebrow">Pourquoi ça marche</p>
        <h2 id="t-benefits" className="h2">
          {page.benefitsTitle}
        </h2>
        <div className="benefits">
          {page.benefits.map(({ icon, title, text }) => {
            const Icon = ICONS[icon as keyof typeof ICONS] ?? Paw;
            return (
              <article key={title} className="benefit">
                <span className="benefit__icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="section section--cobalt" id="comment" aria-labelledby="t-steps">
      <div className="wrap">
        <p className="eyebrow">Comment ça marche</p>
        <h2 id="t-steps" className="h2">
          {page.stepsTitle}
        </h2>
        <ol className="steps">
          {page.steps.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step__num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Specs() {
  return (
    <section className="section" id="le-jouet" aria-labelledby="t-specs">
      <div className="wrap split">
        <div>
          <p className="eyebrow">Fiche technique</p>
          <h2 id="t-specs" className="h2">
            {page.specsTitle}
          </h2>
          <p className="lead">Une question qui n’est pas ici ? Écris-nous, on répond {config.contact.responseTime}.</p>
        </div>
        <dl className="specs">
          {config.product.specs.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          <div>
            <dt>Pour</dt>
            <dd>{config.product.pets.join(' et ')}</dd>
          </div>
          <div>
            <dt>Couleurs</dt>
            <dd>{config.product.variants.map((v) => v.label).join(', ')}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Comparison() {
  return (
    <section className="section section--tint" aria-labelledby="t-compare">
      <div className="wrap">
        <p className="eyebrow">Comparatif</p>
        <h2 id="t-compare" className="h2">
          {page.comparisonTitle}
        </h2>
        <div className="table-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Critère</span>
                </th>
                <th scope="col">{config.brand.name}</th>
                <th scope="col">{page.comparisonOther}</th>
              </tr>
            </thead>
            <tbody>
              {page.comparison.map(([label, a, b]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{a ? <span className="yes">Oui</span> : <span className="no">Non</span>}</td>
                  <td>{b ? <span className="yes">Oui</span> : <span className="no">Non</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const { reviews } = config;
  if (reviews.length === 0) return null;
  const avg = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;
  return (
    <section className="section" aria-labelledby="t-reviews">
      <div className="wrap">
        <p className="eyebrow">Avis clients</p>
        <h2 id="t-reviews" className="h2">
          {avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}/5 sur {reviews.length} avis
        </h2>
        <div className="reviews">
          {reviews.map((r) => (
            <figure key={r.name + r.date} className="review">
              <p className="review__stars" aria-label={`${r.rating} sur 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={i < r.rating ? 'on' : ''} />
                ))}
              </p>
              <blockquote>{r.text}</blockquote>
              <figcaption>
                {r.name} · {r.pet} · {r.date}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Promise_() {
  const { shipping } = config;
  return (
    <section className="section promise" aria-labelledby="t-promise">
      <div className="wrap">
        <h2 id="t-promise" className="sr-only">
          Nos engagements
        </h2>
        <ul className="promise__grid">
          <li>
            <Truck />
            <h3>{shipping.freeThreshold > 0 ? `Livraison offerte dès ${formatCents(toCents(shipping.freeThreshold))}` : 'Livraison offerte'}</h3>
            <p>
              Livré en {shipping.delay} avec numéro de suivi. <Link href="/livraison">Détails</Link>
            </p>
          </li>
          <li>
            <Return />
            <h3>14 jours pour changer d’avis</h3>
            <p>
              Tu peux te rétracter sans justification. <Link href="/retractation">Comment faire</Link>
            </p>
          </li>
          <li>
            <Mail />
            <h3>Une vraie personne répond</h3>
            <p>
              Écris à <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>, réponse {config.contact.responseTime}.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="t-faq">
      <div className="wrap split">
        <div>
          <p className="eyebrow">Questions fréquentes</p>
          <h2 id="t-faq" className="h2">
            Avant de te décider.
          </h2>
        </div>
        <div className="faq">
          {config.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{fill(f.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="section final" aria-labelledby="t-final">
      <div className="wrap final__inner">
        <h2 id="t-final" className="final__title">
          {page.finalTitle}
        </h2>
        <a
          href="#acheter"
          className="btn btn--sun btn--lg"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('acheter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {page.finalButton}
        </a>
      </div>
    </section>
  );
}

export default function Home() {
  const [variantId, setVariantId] = useState(config.product.variants[0].id);
  const color = config.product.variants.find((v) => v.id === variantId)!.hex;
  useSeo('', config.product.subtitle);
  return (
    <>
      <section className="hero" aria-label="Produit">
        <div className="wrap hero__grid">
          <div className="hero__visual" style={{ ['--c' as string]: color }}>
            <ProductVisual color={color} />
          </div>
          <BuyBox variantId={variantId} setVariantId={setVariantId} />
        </div>
      </section>
      <Benefits />
      <Steps />
      <Specs />
      <Comparison />
      <Reviews />
      <Promise_ />
      <Faq />
      <FinalCta />
      <StickyBuy variantId={variantId} />
    </>
  );
}
