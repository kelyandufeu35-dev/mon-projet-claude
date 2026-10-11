# Guide de la boutique

Ce guide part de zéro. Suis les étapes dans l’ordre : compte une à deux heures pour tout brancher, sans compter le choix du produit.

> Ce guide n’est pas un conseil juridique. Pour un doute sur ton statut, la TVA ou une obligation légale, demande à un expert-comptable ou à la CCI de ta région.

---

## 1. Ce que contient la boutique

Une boutique d’**un seul produit**, le format le plus courant en dropshipping :

- une page produit avec choix de la couleur, offres groupées (1, 2 ou 3 jouets avec remise), estimation de la date de livraison, arguments, mode d’emploi, fiche technique, comparatif, avis clients (masqués tant qu’il n’y en a pas) et questions fréquentes ;
- un **panier** qui calcule les remises, les frais de port et la livraison offerte, et qui reste en mémoire si le visiteur revient ;
- un bouton **Commander** qui envoie vers le paiement de Shopify ou de Stripe ;
- les pages **Livraison et retours**, **Contact**, **Merci** (après paiement) et les quatre pages **légales** (mentions légales, CGV, rétractation, confidentialité) ;
- un **bandeau cookies** qui ne s’affiche que si tu ajoutes un pixel Meta ou Google Analytics ;
- un **jouet 3D d’illustration** qui prend la couleur choisie. Il disparaît dès que tu ajoutes tes vraies photos.

**Tout se règle dans un seul fichier : `src/config.ts`.** Tu n’as pas besoin de toucher au reste du code.

---

## 2. Voir la boutique sur ton ordinateur

1. Installe **Node.js** (version 20 ou plus récente) depuis [nodejs.org](https://nodejs.org). Prends la version « LTS ».
2. Ouvre un terminal dans le dossier `boutique` :
   - Windows : clic droit dans le dossier → « Ouvrir dans le Terminal » ;
   - Mac : clic droit sur le dossier → « Nouveau terminal au dossier ».
3. Tape ces deux commandes :

```bash
npm install
npm run dev
```

4. Ouvre **http://localhost:5173** dans ton navigateur.

Laisse le terminal ouvert. Chaque fois que tu enregistres `src/config.ts`, la page se met à jour toute seule.

Pour éditer `src/config.ts`, utilise un éditeur de code gratuit comme [Visual Studio Code](https://code.visualstudio.com). Évite Word ou le Bloc-notes, qui peuvent abîmer les guillemets.

---

## 3. Adapter la boutique à ton produit

Ouvre `src/config.ts`. Chaque réglage est expliqué juste au-dessus de sa ligne. Remplace seulement ce qui est **entre guillemets** et les **nombres**.

### Règles à respecter dans ce fichier

- Garde les guillemets simples `'...'` autour des textes.
- Pour une apostrophe dans un texte, utilise l’apostrophe typographique `’` (comme dans « l’eau »), pas `'`. Sinon le fichier casse.
- Les prix s’écrivent avec un **point** : `24.9` pour 24,90 €.
- Ne supprime pas les virgules en fin de ligne.

Si la page devient blanche après une modification, regarde le terminal : il indique la ligne en erreur.

### Ce qu’il faut changer

| Partie | Quoi |
| --- | --- |
| `brand` | Nom de la boutique, slogan, adresse du site, phrase d’annonce en haut |
| `contact` | Ton e-mail, tes réseaux sociaux |
| `legal` | Tes informations d’entreprise (obligatoires, voir la partie 7) |
| `product` | Nom, phrase d’accroche, prix, couleurs, points forts, caractéristiques |
| `offers` | Les offres 1, 2, 3 jouets et leurs remises |
| `shipping` | Frais de port, seuil de livraison offerte, **vrai** délai de livraison, pays |
| `checkout` | Le mode de paiement (partie 5) |
| `page` | Les titres et textes de la page d’accueil, le titre Google |
| `faq` | Les questions fréquentes |
| `reviews` | Les avis clients, uniquement de vrais avis (partie 7) |

### Le nom du produit dans les textes

Les textes parlent de « croquettes » et de « balle » parce que le produit d’exemple est une balle à friandises. Quand tu auras choisi ton jouet, relis `product`, `page` et `faq` et adapte chaque phrase. **N’écris aucune caractéristique que tu ne peux pas vérifier** (matière, « non toxique », « indestructible »…) : demande les fiches techniques à ton fournisseur.

---

## 4. Ajouter tes photos

1. Mets tes photos dans le dossier `public/produit/` (format `.jpg` ou `.webp`, carrées de préférence, 1200 × 1200 pixels, moins de 300 Ko chacune).
2. Dans `src/config.ts`, liste-les dans `images` :

```ts
images: ['/produit/photo-1.jpg', '/produit/photo-2.jpg', '/produit/photo-3.jpg'] as string[],
```

La première photo sert aussi d’aperçu quand quelqu’un partage ton lien sur les réseaux. Tant que la liste est vide, c’est l’image `public/og.jpg` qui est utilisée.

Les photos des fournisseurs sont souvent protégées par le droit d’auteur et identiques sur des dizaines de boutiques. Commande un échantillon et fais tes propres photos et vidéos : c’est plus sûr et ça vend mieux.

---

## 5. Brancher le paiement

Par défaut, la boutique est en mode **démonstration** (`mode: 'demo'`) : le bouton Commander affiche un message et aucun paiement n’est possible. Choisis **une** des deux options ci-dessous.

### Option A — Shopify (recommandé si tu veux gérer commandes, stock et fournisseurs)

Shopify gère le paiement, les e-mails de confirmation, les commandes et se connecte aux applications de dropshipping (DSers, CJ Dropshipping…). Le plan le moins cher suffit.

1. Crée ta boutique sur [shopify.com](https://www.shopify.com/fr) et active **Shopify Payments**.
2. Crée ton produit avec une **variante par couleur**. Utilise exactement le même prix que dans `config.ts`.
3. Récupère l’**identifiant de chaque variante** : dans l’administration Shopify, ouvre le produit puis clique sur une variante. L’adresse se termine par `/variants/123456789` : ce nombre est l’identifiant.
4. Crée les **remises automatiques** qui correspondent à tes offres. Dans « Réductions », ajoute une « Réduction automatique » de type « Montant de la commande ou quantité » :
   - 15 % dès 2 articles ;
   - 25 % dès 3 articles.

   C’est Shopify qui applique la remise au moment de payer : sans cette étape, le client paierait plein tarif.
5. Dans `src/config.ts` :

```ts
checkout: {
  mode: 'shopify' as 'demo' | 'shopify' | 'stripe',
  shopifyDomain: 'ta-boutique.myshopify.com',
  ...
},
```

   et remplis `shopifyVariantId` pour chaque couleur :

```ts
{ id: 'bleu', label: 'Bleu cobalt', hex: '#2f4bff', shopifyVariantId: '123456789' },
```

6. Teste une commande avec le [mode test de Shopify Payments](https://help.shopify.com/fr/manual/checkout-settings/test-orders).

Le bouton Commander envoie alors le panier complet vers le paiement Shopify.

### Option B — Stripe (plus simple, sans abonnement mensuel)

Stripe encaisse le paiement ; tu gères les commandes toi-même depuis le tableau de bord Stripe.

1. Crée un compte sur [stripe.com](https://stripe.com/fr) et active-le.
2. Crée **un lien de paiement par offre** (« Liens de paiement » → « Nouveau ») :
   - un produit « 1 jouet » au prix de l’offre 1 ;
   - un produit « 2 jouets » au prix de l’offre 2 (déjà remisé, par exemple 42,33 €) ;
   - un produit « 3 jouets » au prix de l’offre 3.

   Les prix exacts sont affichés sur ta page produit. Dans chaque lien :
   - active la collecte de l’**adresse de livraison** ;
   - ajoute les **frais de port** si le montant est sous le seuil de livraison offerte ;
   - dans « Après le paiement », choisis « Ne pas afficher la page de confirmation » et mets l’adresse `https://ton-site.fr/merci`.
3. Colle les trois liens dans `src/config.ts` :

```ts
checkout: {
  mode: 'stripe' as 'demo' | 'shopify' | 'stripe',
  shopifyDomain: '',
  stripeLinks: { x1: 'https://buy.stripe.com/...', x2: 'https://buy.stripe.com/...', x3: 'https://buy.stripe.com/...' } as Record<string, string>,
},
```

Les **couleurs choisies** te parviennent dans le champ « Référence client » (`client_reference_id`) de chaque paiement, par exemple `bleu-1_rose-1`. En mode Stripe, une commande contient 1, 2 ou 3 jouets ; au-delà, le site invite le client à t’écrire.

---

## 6. Mettre le site en ligne

### Le plus simple : Netlify (gratuit pour démarrer)

1. Dans le terminal, arrête le serveur (Ctrl + C) puis tape :

```bash
npm run build
```

   Un dossier `dist` est créé.
2. Va sur [app.netlify.com/drop](https://app.netlify.com/drop), crée un compte et **glisse le dossier `dist`** dans la page.
3. Ton site est en ligne à une adresse du type `nom-au-hasard.netlify.app`.
4. Pour ton propre nom de domaine (par exemple `pattoune.fr`), achète-le chez un registraire (OVH, Gandi…) puis suis « Domain management » dans Netlify.
5. Mets la vraie adresse dans `brand.url` de `src/config.ts`, refais `npm run build` et glisse à nouveau `dist`.

À chaque modification de `config.ts` : `npm run build`, puis glisse le nouveau dossier `dist` sur Netlify.

Le fichier `public/_redirects` est déjà prêt : les pages comme `/cgv` fonctionnent aussi quand on les ouvre directement. Le fichier `vercel.json` fait la même chose si tu préfères [Vercel](https://vercel.com).

---

## 7. Avant de vendre : les obligations légales

Coche chaque point avant d’accepter un premier paiement.

- [ ] **Avoir un statut** : la micro-entreprise suffit pour démarrer ([autoentrepreneur.urssaf.fr](https://www.autoentrepreneur.urssaf.fr)). Vendre de façon régulière sans être déclaré est interdit.
- [ ] **Remplir toute la partie `legal`** de `config.ts` : nom, adresse, SIRET, TVA, directeur ou directrice de publication.
- [ ] **Adhérer à un médiateur de la consommation** : c’est obligatoire pour vendre à des particuliers. La liste officielle est sur [economie.gouv.fr/mediation-conso](https://www.economie.gouv.fr/mediation-conso). Les tarifs varient selon l’organisme : compare-les avant de choisir. Écris son nom et son site dans `legal.mediator`.
- [ ] **Relire les CGV** (page `/cgv`) et les adapter à ta situation réelle (moyens de paiement, transporteur, pays).
- [ ] **Annoncer le vrai délai de livraison** dans `shipping.delay`. En dropshipping depuis l’Asie, c’est souvent 7 à 20 jours. Annoncer « 48 h » sans pouvoir le tenir est une pratique commerciale trompeuse.
- [ ] **Prix barré** : laisse `compareAtPrice: null` tant que tu n’as pas réellement vendu à l’ancien prix. La loi impose que le prix barré soit le plus bas pratiqué dans les 30 jours avant la promo.
- [ ] **Aucun faux avis, aucun faux compteur** (« 12 personnes regardent ce produit », minuteur qui redémarre…). C’est puni jusqu’à 300 000 € d’amende. La boutique n’en contient aucun et masque la section avis tant qu’elle est vide.
- [ ] **Sécurité du produit** : depuis décembre 2024, le règlement européen sur la sécurité générale des produits (RGSP / GPSR) s’applique aux produits vendus dans l’UE. Le produit doit avoir un **responsable établi dans l’UE**, et sa fiche doit indiquer le fabricant et les consignes de sécurité. Quand tu importes toi-même hors UE, cette responsabilité peut te revenir. Demande à ton fournisseur les documents de conformité et garde-les.
- [ ] **Facturation** : tu dois pouvoir fournir une facture pour chaque vente. Shopify et Stripe peuvent les générer.
- [ ] **Cookies** : si tu ajoutes un pixel Meta ou Google Analytics dans `analytics`, le bandeau de consentement s’affiche automatiquement et rien n’est chargé avant l’accord du visiteur. Ne contourne pas ce bandeau.

---

## 8. Publicité et suivi des ventes

Dans `src/config.ts`, partie `analytics` :

- `metaPixelId` : l’identifiant de ton pixel Meta (Facebook et Instagram), trouvé dans le Gestionnaire d’événements ;
- `googleAnalyticsId` : l’identifiant Google Analytics 4, qui commence par `G-`.

Une fois le visiteur d’accord, la boutique envoie automatiquement ces événements :

| Événement | Quand |
| --- | --- |
| `ViewContent` | Affichage du produit |
| `AddToCart` | Ajout au panier |
| `InitiateCheckout` | Clic sur Commander |

L’achat final (`Purchase`) est enregistré par Shopify ou Stripe : connecte ton pixel dans leurs paramètres.

---

## 9. Liste finale avant lancement

- [ ] Tous les « À COMPLÉTER » de `src/config.ts` sont remplis.
- [ ] Les photos sont dans `public/produit/` et listées dans `images`.
- [ ] Le nom du produit, l’accroche, les points forts, les caractéristiques et la FAQ décrivent **ton** produit.
- [ ] Le mode de paiement est `shopify` ou `stripe`, et une commande test a réussi de bout en bout.
- [ ] La page `/merci` s’affiche après un paiement test.
- [ ] Les prix du site et ceux de Shopify ou Stripe sont identiques, remises comprises.
- [ ] `brand.url` contient la vraie adresse du site.
- [ ] Le site s’affiche bien sur ton téléphone.
- [ ] Tu as commandé et reçu un échantillon du produit pour vérifier sa qualité et le délai réel.

---

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run dev` | Lance le site sur ton ordinateur |
| `npm run build` | Prépare le dossier `dist` à mettre en ligne |
| `npm run preview` | Affiche la version `dist` comme en ligne |
| `npm test` | Vérifie les calculs de prix, remises et paiements |
