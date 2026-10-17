import type { ReactNode } from 'react';
import { config } from '../config';
import { Link } from '../components/Layout';
import { formatCents, toCents } from '../lib/pricing';
import { useSeo } from '../lib/util';

const { legal, brand, contact, shipping } = config;

function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  useSeo(title, intro);
  return (
    <article className="page wrap">
      <header className="page__head">
        <p className="eyebrow">{brand.name}</p>
        <h1 className="h1">{title}</h1>
        {intro && <p className="lead">{intro}</p>}
      </header>
      <div className="prose">{children}</div>
    </article>
  );
}

const Updated = () => <p className="prose__date">Dernière mise à jour : {legal.lastUpdate}</p>;

export function MentionsLegales() {
  return (
    <Page title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        {legal.companyName}, {legal.legalForm}
        <br />
        {legal.address}
        <br />
        SIRET : {legal.siret}
        <br />
        {legal.vat}
        <br />
        E-mail : <a href={`mailto:${contact.email}`}>{contact.email}</a>
        {legal.phone && (
          <>
            <br />
            Téléphone : {legal.phone}
          </>
        )}
      </p>
      <p>Directeur ou directrice de la publication : {legal.publicationDirector}</p>
      <h2>Hébergement</h2>
      <p>{legal.host}</p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, visuels et éléments graphiques de ce site appartiennent à {legal.companyName} ou sont utilisés avec autorisation. Toute
        reproduction sans accord écrit est interdite.
      </p>
      <h2>Médiation</h2>
      <p>En cas de litige non résolu avec notre service client, tu peux saisir gratuitement le médiateur de la consommation : {legal.mediator}.</p>
      <Updated />
    </Page>
  );
}

export function Cgv() {
  return (
    <Page
      title="Conditions générales de vente"
      intro={`Ces conditions s’appliquent à toute commande passée sur ${brand.url.replace(/^https?:\/\//, '')}.`}
    >
      <h2>1. Vendeur</h2>
      <p>
        Le site est exploité par {legal.companyName}, {legal.legalForm}, {legal.address}, SIRET {legal.siret}. Contact :{' '}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
      <h2>2. Produits</h2>
      <p>
        Les caractéristiques essentielles des produits sont présentées sur leur fiche. Les photos et illustrations sont aussi fidèles que possible
        mais n’ont pas de valeur contractuelle pour les nuances de couleur.
      </p>
      <h2>3. Prix</h2>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises. Les frais de livraison sont indiqués avant la validation de la commande :{' '}
        {shipping.freeThreshold > 0
          ? `${formatCents(toCents(shipping.cost))}, offerts dès ${formatCents(toCents(shipping.freeThreshold))} d’achat`
          : 'livraison offerte'}
        . Les remises sur les lots sont appliquées automatiquement dans le panier.
      </p>
      <h2>4. Commande</h2>
      <p>
        La commande est validée après acceptation des présentes conditions et confirmation du paiement. Un e-mail de confirmation récapitulant la
        commande est envoyé au client. Nous pouvons refuser une commande en cas de litige antérieur ou de suspicion de fraude.
      </p>
      <h2>5. Paiement</h2>
      <p>
        Le paiement s’effectue en ligne par carte bancaire ou par les moyens proposés au moment du paiement, via un prestataire sécurisé. Nous n’avons
        jamais accès à tes coordonnées bancaires.
      </p>
      <h2>6. Livraison</h2>
      <p>
        Nous livrons en {shipping.countries}. Les commandes sont préparées en {shipping.processing} et livrées en {shipping.delay} à compter de
        l’expédition. Les produits peuvent être expédiés directement par notre fournisseur. Si le produit n’est pas livré dans le délai annoncé, tu
        peux nous demander de livrer dans un délai supplémentaire raisonnable ; à défaut, tu peux annuler la commande et être remboursé (articles
        L216-6 et suivants du Code de la consommation).
      </p>
      <h2>7. Droit de rétractation</h2>
      <p>
        Tu disposes de 14 jours à compter de la réception pour te rétracter, sans justification. Les conditions et le formulaire sont détaillés sur la
        page <Link href="/retractation">Droit de rétractation</Link>. Les frais de retour sont à ta charge, sauf produit non conforme. Le
        remboursement intervient au plus tard 14 jours après ta demande, et peut être différé jusqu’à la réception du produit retourné.
      </p>
      <h2>8. Garanties légales</h2>
      <p>
        Tous nos produits bénéficient de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation), valable 2 ans à
        compter de la livraison, et de la garantie des vices cachés (articles 1641 et suivants du Code civil). Pour la mettre en œuvre, écris-nous
        avec ton numéro de commande et une photo du défaut.
      </p>
      <h2>9. Utilisation des jouets</h2>
      <p>
        Les jouets pour animaux doivent être utilisés sous surveillance, au moins au début. Retire le jouet s’il est abîmé ou si ton animal le mâche.
        Aucun jouet n’est indestructible.
      </p>
      <h2>10. Données personnelles</h2>
      <p>
        Les données collectées servent à traiter les commandes. Voir la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
      <h2>11. Litiges</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de litige, contacte-nous d’abord : nous cherchons toujours une solution
        amiable. À défaut, tu peux saisir gratuitement le médiateur de la consommation : {legal.mediator}.
      </p>
      <Updated />
    </Page>
  );
}

export function Retractation() {
  return (
    <Page title="Droit de rétractation" intro="Tu as 14 jours après réception pour changer d’avis, sans avoir à te justifier.">
      <h2>Comment faire</h2>
      <ol>
        <li>
          Envoie-nous ta demande à <a href={`mailto:${contact.email}`}>{contact.email}</a> avec ton numéro de commande, ou utilise le formulaire
          ci-dessous.
        </li>
        <li>Nous te répondons avec l’adresse de retour.</li>
        <li>Renvoie le produit dans les 14 jours suivant ta demande, dans son état d’origine.</li>
        <li>Nous te remboursons au plus tard 14 jours après ta demande, par le même moyen de paiement.</li>
      </ol>
      <p>
        Les frais de retour restent à ta charge. Si le produit a été utilisé au-delà de ce qui est nécessaire pour l’essayer, une somme correspondant
        à sa dépréciation peut être retenue (article L221-23 du Code de la consommation).
      </p>
      <h2>Formulaire de rétractation</h2>
      <p>À recopier dans un e-mail ou un courrier :</p>
      <blockquote className="form-letter">
        À l’attention de {legal.companyName}, {legal.address}, {contact.email} :
        <br />
        <br />
        Je vous notifie par la présente ma rétractation du contrat portant sur la vente du bien ci-dessous :
        <br />
        Commandé le : … / Reçu le : …
        <br />
        Numéro de commande : …
        <br />
        Nom : …
        <br />
        Adresse : …
        <br />
        Date : …
        <br />
        Signature (en cas de courrier papier) : …
      </blockquote>
      <Updated />
    </Page>
  );
}

export function Confidentialite() {
  return (
    <Page title="Confidentialité et cookies">
      <h2>Responsable du traitement</h2>
      <p>
        {legal.companyName}, {legal.address}. Contact : <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
      <h2>Données collectées</h2>
      <ul>
        <li>Pour les commandes : nom, adresse de livraison, e-mail, téléphone éventuel, contenu de la commande.</li>
        <li>Pour le contact : nom, e-mail et message.</li>
        <li>Le panier est conservé dans ton navigateur (stockage local), pas sur nos serveurs.</li>
      </ul>
      <h2>Finalités et durées</h2>
      <p>
        Les données servent à traiter et livrer les commandes, répondre aux demandes et respecter nos obligations comptables. Elles sont conservées 3
        ans après le dernier contact, et 10 ans pour les pièces comptables.
      </p>
      <h2>Destinataires</h2>
      <p>Le prestataire de paiement, le transporteur et notre fournisseur, uniquement pour exécuter la commande. Aucune donnée n’est revendue.</p>
      <h2>Cookies</h2>
      <p>
        Le site n’utilise pas de cookie publicitaire sans ton accord. Si des outils de mesure d’audience ou de publicité sont activés, un bandeau te
        demande ton consentement, et ils ne se chargent qu’après ton accord. Tu peux le retirer en vidant les données du site dans ton navigateur.
      </p>
      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les rectifier, les effacer, t’opposer à leur traitement ou demander leur portabilité en écrivant à{' '}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>. Tu peux aussi saisir la CNIL (
        <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
          cnil.fr
        </a>
        ).
      </p>
      <Updated />
    </Page>
  );
}

export function Livraison() {
  return (
    <Page title="Livraison et retours" intro={`Livraison en ${shipping.delay}, suivie de bout en bout.`}>
      <dl className="specs specs--page">
        <div>
          <dt>Préparation</dt>
          <dd>{shipping.processing}</dd>
        </div>
        <div>
          <dt>Délai de livraison</dt>
          <dd>{shipping.delay}</dd>
        </div>
        <div>
          <dt>Frais</dt>
          <dd>
            {shipping.freeThreshold > 0
              ? `${formatCents(toCents(shipping.cost))}, offerts dès ${formatCents(toCents(shipping.freeThreshold))}`
              : 'Offerts'}
          </dd>
        </div>
        <div>
          <dt>Pays</dt>
          <dd>{shipping.countries}</dd>
        </div>
      </dl>
      <h2>Suivi</h2>
      <p>Dès l’expédition, tu reçois un e-mail avec ton numéro de suivi. Il peut mettre 24 à 48 h à s’activer.</p>
      <h2>Colis en retard ou abîmé</h2>
      <p>
        Écris-nous à <a href={`mailto:${contact.email}`}>{contact.email}</a> avec ton numéro de commande. Si le produit arrive endommagé, joins une
        photo : nous le remplaçons ou te remboursons.
      </p>
      <h2>Retours</h2>
      <p>
        Tu as 14 jours après réception pour changer d’avis. Toutes les étapes sont sur la page <Link href="/retractation">Droit de rétractation</Link>
        .
      </p>
    </Page>
  );
}

export function Merci() {
  return (
    <Page title="Merci pour ta commande" intro="Ton paiement est validé. Un e-mail de confirmation arrive dans quelques minutes.">
      <p>
        Ta commande est préparée en {shipping.processing}, puis livrée en {shipping.delay}. Tu recevras le numéro de suivi par e-mail.
      </p>
      <p>
        Une question ? <a href={`mailto:${contact.email}`}>{contact.email}</a>
      </p>
      <p>
        <Link href="/" className="btn btn--ink">
          Retour à la boutique
        </Link>
      </p>
    </Page>
  );
}

export function NotFound() {
  return (
    <Page title="Page introuvable" intro="Cette page n’existe pas ou a été déplacée.">
      <p>
        <Link href="/" className="btn btn--ink">
          Retour à la boutique
        </Link>
      </p>
    </Page>
  );
}
