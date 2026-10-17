/**
 * ============================================================================
 *  FICHIER DE CONFIGURATION DE LA BOUTIQUE
 * ============================================================================
 *  C'est le SEUL fichier à modifier pour adapter la boutique à ton produit.
 *  Remplace les textes entre guillemets, les prix et les liens.
 *  Tout ce qui est marqué « À COMPLÉTER » doit être rempli avant de vendre.
 *  Le guide complet est dans GUIDE.md.
 * ============================================================================
 */

export const config = {
  /* ------------------------------------------------------------------ Marque */
  brand: {
    name: 'Pattoune',
    tagline: 'Des jouets qui occupent vraiment',
    /** Adresse du site une fois en ligne (sans « / » final). */
    url: 'https://www.exemple-boutique.fr',
    /** Phrase d'annonce en haut du site. Laisse '' pour la masquer. */
    announcement: 'Livraison offerte dès 35 € · Retours sous 14 jours',
  },

  /* ----------------------------------------------------------------- Contact */
  contact: {
    email: 'contact@exemple-boutique.fr', // À COMPLÉTER
    /** Délai de réponse affiché aux clients. */
    responseTime: 'sous 48 h ouvrées',
    /** Instagram / TikTok : laisse '' si tu n'en as pas. */
    instagram: '',
    tiktok: '',
    /**
     * Adresse d'envoi du formulaire de contact (ex. un formulaire Formspree :
     * 'https://formspree.io/f/xxxxxxx'). Vide = le formulaire ouvre la
     * messagerie du visiteur avec le message pré-rempli.
     */
    formEndpoint: '',
  },

  /* ------------------------------------------- Informations légales (France) */
  legal: {
    companyName: '[Nom ou raison sociale]', // À COMPLÉTER
    legalForm: '[Micro-entreprise / SASU / EURL…]', // À COMPLÉTER
    address: '[Adresse postale complète]', // À COMPLÉTER
    siret: '[Numéro SIRET]', // À COMPLÉTER
    vat: '[TVA intracommunautaire, ou « TVA non applicable, art. 293 B du CGI »]', // À COMPLÉTER
    publicationDirector: '[Prénom Nom]', // À COMPLÉTER
    phone: '', // facultatif
    /** Hébergeur du site : Netlify par défaut (voir GUIDE.md). */
    host: 'Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis',
    /** Médiateur de la consommation : obligatoire pour vendre aux particuliers. */
    mediator: '[Nom du médiateur et site web]', // À COMPLÉTER
    lastUpdate: '11 octobre 2026',
  },

  /* ------------------------------------------------------------------ Produit */
  product: {
    /** Identifiant technique, sans espace ni accent. */
    id: 'balle-friandises',
    name: 'Balle à friandises Pattoune',
    /** Petite phrase sous le titre. */
    subtitle: 'Le jouet qui occupe ton chien ou ton chat pendant que tu n’es pas là.',
    /** Prix unitaire en euros TTC. */
    price: 24.9,
    /**
     * Ancien prix barré. Laisse null tant que tu n'as pas réellement vendu à ce
     * prix : la loi impose que le prix barré soit le prix le plus bas pratiqué
     * dans les 30 jours précédant la promotion.
     */
    compareAtPrice: null as number | null,
    /** Pour qui. */
    pets: ['Chien', 'Chat'],
    /**
     * Photos du produit : place les fichiers dans le dossier public/produit/
     * puis écris leurs noms ici, ex. ['/produit/photo-1.jpg', '/produit/photo-2.jpg'].
     * Tant que la liste est vide, le site affiche un jouet 3D d'illustration.
     */
    images: [] as string[],
    /** Couleurs proposées. `hex` colore aussi le jouet 3D d'illustration. */
    variants: [
      { id: 'bleu', label: 'Bleu cobalt', hex: '#2f4bff', shopifyVariantId: '' },
      { id: 'jaune', label: 'Jaune soleil', hex: '#ffc23a', shopifyVariantId: '' },
      { id: 'rose', label: 'Rose bonbon', hex: '#ff7aa8', shopifyVariantId: '' },
    ],
    /** Points forts affichés près du bouton d'achat (4 maximum conseillés). */
    highlights: [
      'Distribue les croquettes en roulant',
      'Difficulté réglable en 3 niveaux',
      'Se démonte et passe sous l’eau',
      'Convient aux chiens et aux chats',
    ],
    /**
     * Caractéristiques techniques. Vérifie chaque valeur auprès de ton
     * fournisseur : n'écris rien que tu ne peux pas prouver.
     */
    specs: [
      ['Diamètre', '7,5 cm'],
      ['Matière', 'Plastique alimentaire et caoutchouc souple (à vérifier)'],
      ['Poids', '95 g'],
      ['Entretien', 'Démontable, lavage à l’eau tiède'],
      ['Contenance', 'Environ 40 g de croquettes'],
    ] as [string, string][],
  },

  /**
   * Offres groupées : le client choisit 1, 2 ou 3 jouets.
   * `discount` = remise en % appliquée à chaque jouet de l'offre.
   * `preselected` = offre cochée par défaut (une seule).
   * Badges : n'écris « Le plus vendu » que si c'est vrai.
   */
  offers: [
    { id: 'x1', quantity: 1, label: '1 jouet', discount: 0, badge: '', preselected: false },
    { id: 'x2', quantity: 2, label: '2 jouets', discount: 15, badge: 'Duo', preselected: true },
    { id: 'x3', quantity: 3, label: '3 jouets', discount: 25, badge: 'Meilleur prix', preselected: false },
  ],

  /* -------------------------------------------------------------- Livraison */
  shipping: {
    /** Livraison offerte à partir de ce montant (0 = toujours offerte). */
    freeThreshold: 35,
    /** Frais de port sinon. */
    cost: 4.9,
    /**
     * Délai réel de livraison. En dropshipping, sois honnête : annoncer un
     * délai plus court que la réalité est une pratique commerciale trompeuse.
     */
    delay: '7 à 14 jours ouvrés',
    /** Pays livrés. */
    countries: 'France métropolitaine, Belgique, Suisse, Luxembourg',
    /** Délai de préparation avant expédition. */
    processing: '1 à 3 jours ouvrés',
  },

  /* ------------------------------------------------------------- Paiement */
  checkout: {
    /**
     * 'demo'    : aucun paiement, une fenêtre explique que la boutique n'est
     *             pas encore branchée (réglage par défaut, sans risque).
     * 'shopify' : le panier est envoyé vers le paiement de ta boutique Shopify.
     *             Remplis shopifyDomain et les shopifyVariantId des couleurs.
     * 'stripe'  : chaque offre (1, 2 ou 3 jouets) a son lien de paiement Stripe.
     */
    mode: 'demo' as 'demo' | 'shopify' | 'stripe',
    /** Ex. 'ma-boutique.myshopify.com' */
    shopifyDomain: '',
    /** Liens de paiement Stripe, un par offre (ex. 'https://buy.stripe.com/...'). */
    stripeLinks: { x1: '', x2: '', x3: '' } as Record<string, string>,
  },

  /* ------------------------------------------------- Textes de la page */
  page: {
    /** Titre et description pour Google et les partages sur les réseaux. */
    seoTitle: 'Balle à friandises Pattoune · Jouet interactif chien et chat',
    seoDescription: 'Le jouet qui occupe ton chien ou ton chat pendant que tu n’es pas là. Livraison offerte dès 35 €, retours sous 14 jours.',
    benefitsTitle: 'La gamelle se vide en dix secondes. La balle, elle, se mérite.',
    /** icon : 'nez', 'horloge', 'etincelle', 'goutte', 'patte' ou 'camion'. */
    benefits: [
      {
        icon: 'nez',
        title: 'Il cherche, il renifle, il gagne',
        text: 'Chaque croquette se mérite. Ton animal utilise son flair et ses pattes au lieu d’attendre devant la porte.',
      },
      {
        icon: 'horloge',
        title: 'Des repas moins pressés',
        text: 'Les croquettes tombent une à une : idéal pour les gloutons qui vident leur gamelle en dix secondes.',
      },
      {
        icon: 'etincelle',
        title: 'Moins d’ennui',
        text: 'Un animal occupé s’ennuie moins quand il reste seul. Glisse le jouet dans la routine avant de partir.',
      },
      {
        icon: 'goutte',
        title: 'Simple à laver',
        text: 'Les deux moitiés se dévissent et se rincent à l’eau tiède. Pas de recoin impossible à nettoyer.',
      },
    ],
    stepsTitle: 'Prêt en trente secondes.',
    steps: [
      { title: 'Remplis', text: 'Dévisse la balle et verse une poignée de croquettes sèches.' },
      { title: 'Règle', text: 'Tourne la molette : ouverture large pour débuter, étroite pour les experts.' },
      { title: 'Laisse jouer', text: 'Pose la balle au sol. Elle roule, tourne et libère les croquettes au hasard.' },
    ],
    specsTitle: 'Tout ce qu’il faut savoir avant de commander.',
    comparisonTitle: 'Balle à friandises ou gamelle classique ?',
    /** Nom de ce à quoi tu compares ton produit. */
    comparisonOther: 'Gamelle',
    /** [critère, ton produit, l'autre] — true = Oui, false = Non. */
    comparison: [
      ['Ralentit la prise des repas', true, false],
      ['Fait travailler le flair', true, false],
      ['Occupe pendant ton absence', true, false],
      ['Difficulté réglable', true, false],
      ['Passe sous l’eau', true, true],
    ] as [string, boolean, boolean][],
    finalTitle: 'Une balle, une poignée de croquettes, et le salon redevient calme.',
    finalButton: 'Choisir ma couleur',
  },

  /* ---------------------------------------------------------- Avis clients */
  /**
   * N'ajoute QUE de vrais avis de vrais clients : inventer des avis est
   * interdit et sanctionné (jusqu'à 300 000 € d'amende). La section reste
   * masquée tant que la liste est vide.
   */
  reviews: [] as { name: string; pet: string; rating: number; text: string; date: string }[],

  /* --------------------------------------------------------------- FAQ */
  faq: [
    {
      q: 'Mon animal peut-il l’utiliser sans surveillance ?',
      a: 'Surveille les premières séances pour voir comment il joue. Retire le jouet s’il commence à le mâchouiller ou s’il est abîmé. Aucun jouet n’est indestructible.',
    },
    {
      q: 'Quelles croquettes mettre dedans ?',
      a: 'Des croquettes sèches de petite ou moyenne taille. Le réglage de difficulté permet d’adapter l’ouverture à leur taille.',
    },
    {
      q: 'Comment le nettoyer ?',
      a: 'Dévisse les deux moitiés et rince-les à l’eau tiède avec un peu de liquide vaisselle. Laisse sécher avant de remonter.',
    },
    {
      q: 'Quand vais-je recevoir ma commande ?',
      a: 'Les commandes sont préparées en {processing} puis livrées en {delay}. Tu reçois un numéro de suivi par e-mail dès l’expédition.',
    },
    {
      q: 'Puis-je retourner le produit ?',
      a: 'Oui, tu disposes de 14 jours après réception pour te rétracter, sans avoir à te justifier. Écris-nous à {email} pour obtenir l’adresse de retour.',
    },
  ],

  /* ------------------------------------------------ Mesure d'audience */
  /**
   * Identifiants facultatifs. S'ils sont remplis, un bandeau de consentement
   * s'affiche et les outils ne se chargent qu'après l'accord du visiteur.
   */
  analytics: {
    metaPixelId: '',
    googleAnalyticsId: '',
  },
};

export type Config = typeof config;
export type Variant = Config['product']['variants'][number];
export type Offer = Config['offers'][number];

/** Remplace {delay}, {email}… dans les textes. */
export function fill(text: string) {
  return text
    .replace(/\{delay\}/g, config.shipping.delay)
    .replace(/\{processing\}/g, config.shipping.processing)
    .replace(/\{email\}/g, config.contact.email);
}
