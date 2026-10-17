# Audit technique et commercial : boutique Pattoune en ligne

- **Boutique** : https://pattounejouets.myshopify.com (thème publié : « Pattoune v9 (cinéma) », id 197372903757)
- **Date** : 14 octobre 2026
- **Mode** : lecture seule. Aucun fichier du dépôt modifié (sauf ce rapport). Aucune écriture dans Shopify. Aucun paiement lancé.

---

## Résumé (10 lignes)

1. **Limite de l’audit** : le proxy réseau de la session refuse l’accès à `pattounejouets.myshopify.com` (CONNECT 403, refus de politique). Aucun curl ni Playwright n’a donc pu tourner sur le site en ligne. Statuts HTTP, console JS, LCP et CLS **n’ont pas été mesurés** (scripts prêts à lancer, voir § 5).
2. L’audit repose sur les **vraies données de la boutique**, lues en lecture seule via l’API Admin : produit, remises, livraison, marchés, politiques, pages, menus, fichiers du thème publié. S’y ajoute l’analyse du code du thème. Les fichiers de code du thème publié sont **identiques au dépôt** (MD5) ; seuls les JSON de réglages diffèrent.
3. **Bloquant (sécurité et pratique trompeuse)** : le H1 de l’accueil et la meta description promettent un jouet « qui l’occupe quand tu pars ». La page Guide de la boutique dit « usage sous surveillance ».
4. **Bloquant (légal)** : la page *Coordonnées* affiche des champs vides (téléphone, e-mail, TVA, numéro d’entreprise). SIREN « en cours », aucun médiateur de la consommation.
5. **Bloquant (international)** : 4 marchés étrangers sont actifs (US, Royaume-Uni, Suisse, UE) avec 10 devises, mais le produit n’est livrable **qu’en France**. Un visiteur belge ou américain voit des prix, « livraison offerte », remplit son panier… puis il est bloqué au paiement.
6. **Prix et remises cohérents en France** : 14,99 € ; 2 balles 25,48 € (−15 %) ; 3 balles 35,97 € (−20 %). Le thème et les remises automatiques Shopify (−2,25 €/u et −3,00 €/u) donnent les mêmes montants. Aucune mention « dès 35 € » en ligne.
7. **Important** : bouton d’accueil « dès 14,99 € » inexact (le prix unitaire le plus bas est 11,99 €) ; offre 2 balles cochée par défaut ; format « €14,99 » sur /collections/all, la recherche, le checkout et les e-mails.
8. **SEO** : la description produit (H2, caractéristiques, lien vers le guide) n’est pas affichée sur la fiche ; le guide est orphelin ; le blog est vide. JSON-LD Product et FAQPage valides, mais pas d’Organization, pas de BreadcrumbList, pas de livraison ni de politique de retour.
9. **Aucune adresse e-mail** dans le thème, les pages ni les politiques. En revanche, l’e-mail de contact de la boutique est une **adresse Gmail personnelle** : elle apparaîtra dans les e-mails de commande et sur la page de statut de commande.
10. Pas de faux avis, de compte à rebours, de « stock limité » ni de « sans BPA ». « Indestructible » n’apparaît que sous la forme « aucun jouet n’est indestructible ». Les cibles tactiles font 44 px. Un seul H1 par modèle.

---

## 1. Méthode et couverture

| Point demandé | Statut | Source |
| --- | --- | --- |
| Statuts HTTP, redirections, sitemap, robots.txt | **Non vérifié en ligne** (hôte bloqué) | Déduit : données Admin et comportement standard Shopify |
| Erreurs console, ressources 404, liens cassés | **Non mesuré** ; liens internes déduits du code et des menus | Code du thème + menus Admin |
| Images sans alt | Vérifié sur le code et sur les médias produit | Thème + API Admin |
| SEO (title, description, H1, canonical, OG, JSON-LD) | Vérifié sur le code + réglages publiés | `layout/theme.liquid`, `snippets/meta-tags.liquid`, `snippets/product-buy.liquid`, `sections/faq.liquid` |
| Performance LCP / CLS / poids | **Non mesuré** ; estimation à partir du poids des fichiers publiés | Liste des fichiers du thème publié (tailles) |
| Parcours d’achat (prix, remises) | Calculé sur les vraies remises et le vrai prix | API Admin (remises automatiques, variante) + `product-buy.liquid`, `theme.js` |
| Textes incohérents, mentions trompeuses, e-mail | Vérifié sur tous les contenus publiés | Templates publiés, pages, politiques, fiche produit |
| Mobile | Vérifié sur le CSS (pas de rendu) | `motion.css`, `sections-v9.css`, `theme.css` |
| International | Vérifié sur la configuration réelle (marchés, devises, zones de livraison) | API Admin |

**Captures** : aucune n’a pu être faite (hôte inaccessible). Le script Playwright les produit dans le dossier scratchpad (§ 5).

**Thème publié et dépôt** : les sommes MD5 des 84 fichiers sont identiques, sauf pour les fichiers suivants.
- Réglages modifiés dans l’éditeur : `config/settings_data.json`, `templates/index.json`, `templates/product.json`, `sections/header-group.json`, `sections/footer-group.json`.
- `snippets/toy-scene.liquid` : présent seulement en ligne, jamais appelé.

Les numéros de ligne ci-dessous valent donc pour le code en ligne. Ce code en ligne est celui du **commit `689fcf4` (HEAD)**.

> **Attention** : pendant l’audit, une autre session a modifié la copie de travail. Vers 22:00, 35 fichiers de `shopify-theme/` ont été modifiés sans commit, par exemple la traduction des libellés de `hero-banner.liquid` via `'sections.hero.from' | t`. Ces modifications ne viennent pas de cet audit. Les numéros de ligne peuvent donc être légèrement décalés dans la copie de travail actuelle. Les constats restent valables tant que ces modifications ne sont pas publiées. Exemple : la logique « dès » de I1 existe toujours dans la copie de travail.

---

## 2. Bloquant

### B1. Promesse « quand tu pars » contredite par la boutique elle-même (sécurité et pratique trompeuse)

- **Pages** : accueil (H1, meta description), fiche produit et accueil (section « Le principe »), page Guide.
- **Constat (preuve)** :
  - H1 de l’accueil (`templates/index.json` publié, section `haut`) : `"title": "Le jouet qui l’occupe quand tu pars."`.
  - Meta description de l’accueil (défaut de `config/settings_schema.json`, `home_description`) : « … elle occupe ton chien ou ton chat **quand tu pars** et ralentit les repas. »
  - Étape 3 (`templates/index.json` et `templates/product.json`) : « l’ennui recule **quand il reste seul** ».
  - Page `/pages/guide-balle-friandises-chat-petit-chien`, H2 « Peut-on laisser la balle pendant son absence ? » : « Nous recommandons un **usage sous surveillance**. Aucun jouet n’est indestructible. »
  - FAQ : « Surveille les premières séances… ». Fiche produit : « Utilise ce jouet sous surveillance. »
- **Risques** :
  - Si un animal avale ou abîme la balle en l’absence du maître, la promesse principale du site est opposable.
  - La contradiction entre la publicité et les consignes peut constituer une pratique commerciale trompeuse (art. L121-2 du Code de la consommation).
- **Cause** : textes saisis dans l’éditeur (`templates/index.json` section `haut` ; étape `s3` des deux templates) et défaut du réglage `home_description` (`config/settings_schema.json`, groupe « Marque et référencement »).
- **Correctif** :
  - H1 proposé : « Le jouet qui le fait chercher ses croquettes. » ou « Il pousse, elle roule, il mange plus lentement. »
  - Étape 3 : « …le repas dure plus longtemps. »
  - Meta description : retirer « quand tu pars ».
  - Garder une seule consigne partout : « à utiliser sous surveillance ».

### B2. Informations légales incomplètes ou vides

- **Pages** : `/policies/contact-information`, `/policies/terms-of-sale`, `/policies/terms-of-service`.
- **Constat (preuve, corps publié de la politique « Coordonnées »)** :
  ```html
  <p>Numéro de téléphone&nbsp;:</p>
  <p>Adresse e-mail :&nbsp;</p>
  <p>Numéro de TVA&nbsp;:</p>
  <p>Numéro d’entreprise&nbsp;:</p>
  ```
  - CGV, article 1 : « Immatriculation **en cours** (numéro SIREN communiqué dès son attribution) ».
  - CGV, article 11 : médiateur « dont les coordonnées seront indiquées ici **dès notre adhésion** ».
- **Risques** :
  - Quatre libellés vides : effet « boutique pas finie » sur une page que les clients consultent pour se rassurer.
  - Légalement, un vendeur en ligne doit afficher son numéro d’immatriculation et ses moyens de contact (art. 6-III de la LCEN ; art. L221-5 et R111-1 du Code de la consommation).
  - Un médiateur de la consommation est obligatoire (art. L612-1 et L616-1). L’absence est sanctionnable par une amende administrative.
- **Cause** : contenu des politiques dans Shopify (pas le thème).
- **Correctif** :
  - Supprimer les lignes vides de la politique « Coordonnées » ; ne garder que ce qui est rempli, avec un lien vers la page Contact.
  - Adhérer à un médiateur (par exemple CM2C ou Medicys) et renseigner ses coordonnées.
  - Ne pas vendre avant d’avoir le SIREN.
  - *Note* : la consigne du projet est « aucune adresse e-mail ». Or la LCEN prévoit une adresse électronique. Ce point juridique est à arbitrer avec un professionnel (CCI ou expert-comptable). Si la consigne est maintenue, le formulaire Contact est le seul canal : il doit fonctionner et être visible partout.

### B3. Visiteurs étrangers : prix affichés, panier possible, livraison impossible

- **Pages** : toutes, avec `?country=BE`, `?country=US`, ou un visiteur géolocalisé hors de France.
- **Constat (configuration réelle)** :
  - Marchés actifs : France (principal), **États-Unis (USD), Royaume-Uni (GBP), Suisse (CHF), Union européenne (26 pays, devises locales activées)**. Devises de présentation : CHF, CZK, DKK, EUR, GBP, HUF, PLN, RON, SEK, USD. `shipsToCountries` liste 41 pays.
  - Le produit actif est dans le profil « General shipping profile ». Ce profil a **une seule zone : FR**, avec le tarif « Livraison offerte (12 à 18 jours) » à 0 €. Aucun tarif pour les autres pays.
  - La politique d’expédition dit « Pays livré : France métropolitaine ».
  - Le thème affiche partout « livraison offerte » (`snippets/product-buy.liquid` l. 143 et 292 ; `snippets/cart-summary.liquid` l. 30 et l. 111 « aucun frais ajouté au paiement »). Il n’y a aucun message « nous ne livrons qu’en France ».
- **Effet attendu** (à confirmer avec le script, § 5) :
  - Un visiteur US voit des prix en USD, ajoute au panier, puis le checkout répond « aucune méthode de livraison disponible ». Un visiteur belge voit des euros, avec le même blocage.
  - Les montants des offres sont faux hors euro. Le thème soustrait 225 et 300 « centimes » **d’euro** (`product-buy.liquid` l. 27 et 34, `theme.js` l. 162) à un prix converti en USD, GBP ou CHF. Shopify, de son côté, convertit la remise fixe en € avec son propre arrondi.
  - Langue : seul `fr` est publié. Un visiteur `Accept-Language: en/de` reste en français, sans redirection, et le thème n’a aucun sélecteur de pays ou de devise.
- **Cause** : configuration Shopify (Marchés + Expédition), plus des textes fixes dans le thème.
- **Correctif** (au choix) :
  - (a) **Vente France uniquement** : désactiver les marchés US, Royaume-Uni, Suisse et UE (Paramètres → Marchés). Le site reste alors en EUR pour tout le monde.
  - (b) **Vendre en UE** : ajouter les pays dans la zone du profil du produit, adapter la politique d’expédition et les textes « livraison offerte ».
  - Dans les deux cas, afficher « Livraison en France métropolitaine » à côté de « livraison offerte » (`product-buy.liquid` l. 143).

---

## 3. Important

### I1. Bouton de l’accueil « dès 14,99 € » inexact

- **Page** : accueil (bouton principal du haut de page).
- **Constat** : `sections/hero-banner.liquid` l. 69-70 affiche « dès » dès qu’une offre groupée existe (`settings.bundle1_qty > 1`), suivi de `featured.price` (14,99 €). Le bouton affiche donc « Je commande | dès 14,99 € ». Or 14,99 € est le prix unitaire **le plus haut** : le prix unitaire le plus bas est 11,99 € (lot de 3).
- **Correctif** : retirer « dès » (afficher simplement « 14,99 € »). Pour mettre l’offre en avant, écrire plutôt « 14,99 € · −20 % dès 3 ». Code : remplacer la condition l. 69 par `{%- if featured.price_varies -%}`.

### I2. Offre « 2 balles » cochée par défaut

- **Pages** : accueil (zone d’achat) et fiche produit.
- **Constat** : `"preselect_offer": 2` dans les deux templates publiés. Le bouton ajoute donc **2 balles (25,48 €)** au panier par défaut.
- **Risque** : le montant est visible sur le bouton, mais un acheteur pressé sur mobile peut commander 2 balles sans le vouloir. Cela donne des retours et des litiges, et peut être lu comme un « dark pattern » de présélection.
- **Correctif** : `preselect_offer: 1` dans l’éditeur (Zone d’achat / Produit) ; garder le badge « Duo » pour attirer l’œil sans forcer.

### I3. Contenu produit invisible, guide orphelin, pages vides indexées

- **Pages** : `/products/balle-a-friandises-pattoune-1`, `/pages/guide-balle-friandises-chat-petit-chien`, `/blogs/actualites`, `/collections/frontpage`.
- **Constat** :
  - `templates/product.json` publié : `"show_description": false`. La description Shopify (H2 « Un jouet à remplir de croquettes », « Caractéristiques », « Conseils », lien vers le guide) n’est **pas rendue** sur la fiche, alors que le JSON-LD Product reprend ce texte (`product-buy.liquid` l. 309). Le contenu indexable de la fiche se résume aux blocs de sections.
  - Le guide n’est lié que depuis cette description, qui est masquée. Aucun menu ni pied de page n’y mène (menus `main-menu` et `footer` vérifiés) : la page est **orpheline**.
  - Le blog « Actualités » n’a **aucun article** ; `/blogs/actualites` n’affiche qu’un H1 et ne prévoit pas de message pour un blog vide (`sections/main-blog.liquid`).
  - La collection « Page d’accueil » (`frontpage`) est indexable et sans description.
- **Correctif** :
  - Passer `show_description` à `true` (volet « Description »), ou ajouter un bloc « Pour aller plus loin » avec le lien vers le guide sur la fiche et dans le menu `footer`.
  - Publier au moins 2 articles (le dépôt en contient déjà : `shopify-kit/blog/*.html`), ou masquer le blog.
  - Ajouter `noindex` sur `frontpage` (via `{% if collection.handle == 'frontpage' %}<meta name="robots" content="noindex">{% endif %}` dans `layout/theme.liquid`), ou supprimer la collection.

### I4. Données structurées incomplètes

- **Pages** : accueil et fiche produit.
- **Constat** : `snippets/product-buy.liquid` l. 300-324 produit un `Product` correct, avec `name`, `url`, `image`, `description`, `brand`, et `offers[]` (`price` 14.99, `priceCurrency`, `availability`, `sku`, `url`). Il y a aussi un `FAQPage` correct (`sections/faq.liquid` l. 42-56). En revanche :
  - aucun `Organization` ni `WebSite`, et aucun `BreadcrumbList` sur la fiche, le guide ou les pages ;
  - les `Offer` n’ont ni `shippingDetails` ni `hasMerchantReturnPolicy` (Google les signale comme manquants pour les fiches marchandes), et `availability` est en `http://schema.org/…` au lieu de `https://` ;
  - `priceCurrency` suit la devise du visiteur (`cart.currency.iso_code`) : avec les marchés actifs (B3), un robot américain peut lire USD ;
  - le `Product` est aussi émis sur l’accueil (zone d’achat). Ce n’est pas une erreur, mais le contenu est en double ;
  - le `sku` publié vaut `CJJJJTJT18779-D` : c’est la référence du fournisseur CJ Dropshipping, que les concurrents peuvent retrouver.
- **Correctif** :
  - Ajouter dans `layout/theme.liquid` (avant `</head>`) un bloc `Organization` (name, url, logo) et `WebSite`. Sur la fiche, ajouter un `BreadcrumbList` (Accueil → produit).
  - Compléter chaque `Offer` avec :
    ```json
    "shippingDetails": {"@type":"OfferShippingDetails","shippingRate":{"@type":"MonetaryAmount","value":0,"currency":"EUR"},"shippingDestination":{"@type":"DefinedRegion","addressCountry":"FR"},"deliveryTime":{"@type":"ShippingDeliveryTime","handlingTime":{"@type":"QuantitativeValue","minValue":1,"maxValue":3,"unitCode":"DAY"},"transitTime":{"@type":"QuantitativeValue","minValue":10,"maxValue":16,"unitCode":"DAY"}}},
    "hasMerchantReturnPolicy": {"@type":"MerchantReturnPolicy","applicableCountry":"FR","returnPolicyCategory":"https://schema.org/MerchantReturnFiniteReturnWindow","merchantReturnDays":14,"returnMethod":"https://schema.org/ReturnByMail","returnFees":"https://schema.org/ReturnFeesCustomerResponsibility"}
    ```
  - Passer `availability` en `https://schema.org/InStock`.
  - Remplacer le SKU dans Shopify par une référence maison (par exemple `PT-BALLE-8`).

### I5. Format de prix « €14,99 » hors du thème

- **Pages** : `/collections/all`, `/search?q=balle`, checkout, e-mails de commande.
- **Constat** : le format monétaire de la boutique vaut `"€{{amount_with_comma_separator}}"`. `snippets/product-card.liquid` l. 7 utilise `{{ item.price | money }}` et affiche donc « €14,99 », alors que le reste du thème passe par `pt-money` (« 14,99 € »). Le checkout et les notifications utilisent le même format Shopify.
- **Correctif** :
  - Paramètres → Détails de la boutique → Devise → Formats : `{{amount_with_comma_separator}} €` et `{{amount_with_comma_separator}} € EUR`.
  - Dans `product-card.liquid` l. 7 : `{% render 'pt-money', cents: item.price %}`.

### I6. Adresse e-mail : aucune sur le site, mais une Gmail personnelle dans les e-mails de commande

- **Pages** : thème, pages, politiques (vérifiés : aucune adresse). Concernés : e-mails transactionnels et page de statut de commande.
- **Constat** :
  - Aucune adresse dans le code du thème : le pied de page ignore volontairement `contact_email` (`sections/footer.liquid` l. 2-3). Aucune non plus dans les pages Contact et Guide ni dans les 6 politiques.
  - `shop.email` et `shop.contactEmail` valent une **adresse Gmail personnelle**. Shopify l’utilise comme expéditeur et adresse de réponse des notifications, et l’affiche sur la page de statut de commande (« Contactez-nous… »).
  - Politique de remboursement : « Formulaire de rétractation (à recopier **dans un e-mail** ou un courrier) », sans adresse e-mail. Le client ne peut pas l’envoyer par e-mail.
- **Correctif** :
  - Créer une adresse dédiée (de type contact@domaine), même si elle n’est pas affichée, et la mettre dans Paramètres → Détails de la boutique → E-mail de contact. Vérifier aussi l’adresse d’expédition des notifications.
  - Remplacer la phrase du formulaire par « à envoyer depuis la page Contact du site ou par courrier ».

### I7. Politiques : texte cassé, doublon, image vide, adresse incohérente

- **Pages** : `/policies/privacy-policy`, `/policies/refund-policy`, `/policies/terms-of-sale`, `/policies/terms-of-service`.
- **Constat (preuve)** :
  - Politique de confidentialité, § Contact : « …exercer un des droits dont vous disposez,**Si tu as des questions** sur cette politique… page Contact du site. &nbsp;**France** Aux fins de la législation… ». La phrase est coupée, le texte mélange « vous » et « tu », et le mot « France » reste orphelin.
  - Le corps des CGV commence par `<p><img></p>` : une image vide, sans `src` ni `alt`.
  - « Conditions d’utilisation » (`terms-of-service`) est une **copie** des CGV, d’où un contenu dupliqué. Le menu `footer` intitulé « Conditions générales de vente » pointe vers `/policies/terms-of-service`, dont le titre affiché est « Conditions d’utilisation ».
  - Adresse : « **06** Rue du Parc » (formulaire de rétractation) contre « **6** Rue du Parc » (Coordonnées, CGV).
- **Correctif** :
  - Réécrire le § Contact de la confidentialité, par exemple : « Pour toute question ou pour exercer tes droits, écris-nous via le formulaire de la page Contact. Nous sommes responsables du traitement de tes données. »
  - Supprimer `<p><img></p>` des CGV.
  - Réduire les Conditions d’utilisation à l’usage du site (ou les supprimer) et faire pointer le lien du menu vers `/policies/terms-of-sale`.
  - Harmoniser l’adresse.

### I8. Pied de page : liens légaux en double

- **Pages** : toutes.
- **Constat** :
  - `sections/footer.liquid` l. 32-39 affiche le menu `footer` (réglage par défaut `"default": "footer"`). Ce menu contient déjà Livraison, Retours, CGV, Confidentialité et Vos choix.
  - L. 46-50, une boucle sur `shop.policies` ajoute dans la colonne « Légal » les mêmes politiques. Chaque politique est donc listée deux fois, sous deux libellés différents (« Livraison » / « Expédition »).
- **Correctif** : retirer les politiques du menu `footer` (garder « Questions fréquentes », « Nous écrire », le guide), ou supprimer la boucle l. 46-50.

### I9. Accueil : 2 s d’intro avant de voir la page, et vidéos lourdes

- **Page** : accueil, première visite de la session.
- **Constat (code et poids des fichiers publiés)** :
  - `snippets/pt-intro.liquid` pose un calque plein écran de **2 000 ms**, que l’on peut passer au toucher. La « chorégraphie » du haut de page démarre ensuite à `--pt-t0: 1380ms` (`assets/motion.css` l. 36), avec un rideau opaque `pt-hero__curtain` qui s’efface en 1 400 ms (l. 189).
  - Le contenu n’est réellement lisible qu’après environ 2,5 à 2,8 s, même si le LCP technique peut sembler bon (Chrome ne tient pas compte de l’occlusion).
  - Vidéos chargées par `motion.js` : `pt-hero-loop.webm` (**507 Ko**) ou `.mp4` (**862 Ko**), plus `pt-roule.webm` (192 Ko) ou `.mp4` (376 Ko).
  - CSS bloquants : `theme.css` 71 Ko, `sections-v9.css` 38 Ko, `motion.css` 34 Ko (non compressés).
  - Polices préchargées : Bricolage 78 Ko et Figtree 20 Ko.
  - Estimation hors scripts Shopify : environ 0,35 Mo avant interaction, environ 1,1 à 1,6 Mo après défilement de l’accueil.
- **Risque** : sur un trafic publicitaire mobile, 2 s d’écran décoratif font partir des visiteurs.
- **Correctif** :
  - Désactiver l’intro sur mobile ou à l’arrivée par une publicité. Dans `layout/theme.liquid` l. 35, ajouter `&& innerWidth >= 900 && !/[?&](utm_|fbclid|ttclid|gclid)/.test(location.search)`, ou décocher « Intro animée ».
  - Charger la boucle vidéo seulement si `navigator.connection?.saveData` est faux et si le réseau n’est pas « 2g » ou « 3g ».
  - **Mesurer** avec le script (§ 5) avant et après.

### I10. Ancienne URL produit en 404, sans redirection

- **Page** : `/products/balle-a-friandises-pattoune` (ancien produit, **archivé**).
- **Constat** : `urlRedirects` est vide. Un produit archivé renvoie 404. Tout lien partagé ou publicité vers l’ancienne URL est perdu.
- **Correctif** : Boutique en ligne → Navigation → Redirections d’URL : `/products/balle-a-friandises-pattoune` → `/products/balle-a-friandises-pattoune-1`.

---

## 4. Mineur

| # | Page | Constat (preuve) | Cause | Correctif |
| --- | --- | --- | --- | --- |
| M1 | Fiche, panier | « TTC · livraison offerte » (`product-buy.liquid` l. 143), « Total TTC » (`locales/fr.default.json` `cart.total`), alors que les CGV disent « TVA non applicable, article 293 B du CGI » | Libellés fixes | « Prix final · livraison offerte » et « Total ». Mentionner l’art. 293 B sur les factures |
| M2 | Fiche | Meta description « **Découvrez** la balle… » (vouvoiement, alors que le site tutoie partout) ; 146 caractères (longueur correcte) | SEO Shopify du produit | « Découvre… » |
| M3 | Accueil | H1 « Le jouet qui l’occupe quand tu pars. » : ni « balle », ni « friandises », ni « chat », ni « chien ». Le title de 59 caractères les contient | Réglage `title` (section `haut`) | Voir B1 ; inclure « balle à friandises » dans le H1 |
| M4 | Contact, /collections/all, blog, panier | Pas de meta description (`page_description` vide). `og:description` retombe sur « Pattoune » car `shop.description` est vide | `layout/theme.liquid` l. 56, `meta-tags.liquid` l. 9 | Renseigner Préférences → Description de la boutique et le SEO de la page Contact |
| M5 | Toutes | Pas de `twitter:image` (X lit `og:image`, ce qui suffit en pratique). `og:image` présent partout grâce à l’image du produit (`meta-tags.liquid` l. 23-31) | `meta-tags.liquid` | Ajouter `<meta name="twitter:image" …>` avec la même URL |
| M6 | Toutes | Aucun `hreflang` : normal avec une seule langue et des marchés sans sous-dossier. À traiter seulement si des marchés gardent leur propre URL | Config Marchés | Rien, ou voir B3 |
| M7 | Mobile < 900 px | Aucune navigation : l’en-tête ne montre que le logo et le panier (`motion.css` l. 290 : `.pt-hd__nav, .pt-hd__cta { display: none; }`). Contact et guide ne sont accessibles que par le pied de page | Choix de design | Ajouter au minimum un lien « Aide » ou un menu compact |
| M8 | Accueil mobile | Ligne des garanties du haut de page en `.75rem` (12 px) (`motion.css` l. 308) | CSS | Passer à `.8125rem` (13 px) au minimum |
| M9 | Panier | Sous le nom du produit s’affiche « Petite ronde » : l’option « Modèle » n’a qu’une valeur. Elle est masquée sur la fiche (`.pt-field--single`) mais pas dans le panier (`cart-summary.liquid` l. 55-57) | Variante Shopify | Supprimer l’option « Modèle » du produit (variante par défaut) |
| M10 | Fiche | La galerie montre deux fois l’animation 3D : la vignette « scène » (`scene_first: true`) et la vidéo produit « Animation 3D de la balle à friandises Pattoune » | Média produit + réglage | Retirer l’un des deux |
| M11 | Toutes | Les remises du thème sont **en dur** : les réglages `bundle1_amount` « 2,25 » et `bundle2_amount` « 3,00 » ne sont pas dans `settings_data.json`, donc les valeurs par défaut s’appliquent. Les remises Shopify sont aussi des montants fixes. Si le prix change, il faut tout changer à la main | `settings_schema.json`, remises Admin | Passer les remises Shopify en pourcentage (15 % et 20 %) et vider `bundleX_amount` |
| M12 | Thème | Réglages inutilisés et contradictoires : `delivery_min_days: 9`, `delivery_max_days: 13`, `processing_days: 2` (soit 11 à 15 jours ouvrés) contre « 12 à 18 jours ». Aucun `[data-delivery]` n’est rendu | `config/settings_data.json` publié | Aligner ou supprimer ces réglages |
| M13 | Livraison | Le profil par défaut (« Profil général ») contient FR 7,99 €, gratuit dès **65 €**, Express 10,99 €, UE 22 €, international 29 €. Il ne couvre aujourd’hui que le produit archivé, mais tout nouveau produit y tombera et contredira « livraison offerte » | Config Expédition | Aligner ce profil ou y basculer le produit |
| M14 | Blog | `main-blog.liquid` n’affiche aucun message quand il n’y a pas d’article | Thème | Ajouter un `{% else %}` |
| M15 | CLS | Polices `font-display: swap` sans métriques de repli (`size-adjust`). Le H1 en Bricolage peut décaler la mise en page lors du remplacement | `layout/theme.liquid` l. 79-113 | Ajouter un `@font-face` de repli ajusté, ou `font-display: optional` pour Figtree |
| M16 | Dépôt | `shopify-kit/GUIDE-SHOPIFY.md` (24,90 €, livraison offerte dès 35 €) et `shopify-kit/politiques/4-politique-d-expedition.txt` (« offerts dès [35 €] ») sont périmés. Rien de tout cela n’est en ligne, mais il y a un risque de recopie | Documentation | Mettre à jour (14,99 €, livraison toujours offerte, 12 à 18 jours) |
| M17 | Dépôt | Les JSON de réglages du dépôt ne reflètent pas la boutique, et `snippets/toy-scene.liquid` n’existe qu’en ligne | Dérive éditeur ↔ dépôt | `shopify theme pull --only config/settings_data.json --only templates/*.json --only sections/*-group.json` |

---

## 5. Points conformes (vérifiés)

- **Prix et offres (France)** : variante unique à 14,99 € (`compareAtPrice` vide, donc aucun prix barré trompeur). Les calculs du thème (`product-buy.liquid` l. 177-198 ; `theme.js` l. 155-171) et les remises automatiques Shopify donnent les mêmes montants :

  | Offre | Remise | Montant |
  | --- | --- | --- |
  | 1 balle | aucune | 14,99 € |
  | 2 balles | « Lot −15 % dès 2 balles » = −2,25 €/u | 25,48 € (12,74 €/u, −15 %, au lieu de 29,98 €) |
  | 3 balles | « Lot −20 % dès 3 balles » = −3,00 €/u | 35,97 € (11,99 €/u, −20 %, au lieu de 44,97 €) |

- **Livraison (France)** : le profil du produit actif donne 0 € et 12 à 18 jours. C’est cohérent avec la politique d’expédition, les CGV, la FAQ, la description produit et le texte du panier. Aucune mention « dès 35 € » en ligne.
- **Mentions trompeuses** :
  - La section `reviews` (avis) n’est utilisée dans aucun template : pas de faux avis.
  - Pas de compte à rebours, de « stock limité », de « sans BPA » ni de « non toxique ». « Indestructible » n’apparaît que sous la forme « aucun jouet n’est indestructible ».
  - « Retour sous 14 jours (droit légal) » présente bien ce délai comme un droit légal, et non comme un avantage de la boutique.
- **Adresse e-mail** : aucune dans le thème, les pages ni les politiques (voir I6 pour les e-mails transactionnels).
- **SEO de base** :
  - Un seul H1 par modèle : accueil = haut de page, la zone d’achat étant en H2 (`title_as_h1: false`) ; fiche = titre du produit.
  - `canonical` présent (`layout/theme.liquid` l. 46).
  - Title de l’accueil : 59 caractères. Meta description de l’accueil : 155 caractères. Title SEO du produit : « Balle à friandises pour chat et petit chien | Pattoune » (54 caractères).
  - `og:image` présent ; JSON-LD sans erreur de syntaxe (filtres `json`).
- **Accessibilité et mobile** :
  - Médias produit tous avec un texte `alt` ; images décoratives en `alt=""`.
  - Cibles tactiles de 44 px : boutons de quantité, « Retirer », fermeture du panier, liens du pied de page, pastilles, panier de l’en-tête.
  - Lien « Aller au contenu » ; préférence « réduire les animations » respectée.
- **Parcours** :
  - Bouton d’ajout → panier latéral `<dialog>` rafraîchi par l’API Section Rendering.
  - `/cart` : bouton `name="checkout"` dans un `form` POST vers `/cart` (Shopify redirige vers le checkout).
  - Sans JavaScript, le formulaire produit envoie normalement vers `/cart/add`.
  - Le code est conforme. **Le fonctionnement réel reste à confirmer avec le script.**

---

## 6. Tests en ligne à lancer dès que l’hôte est autorisé

L’hôte `pattounejouets.myshopify.com` est refusé par la politique réseau de cette session (`curl: (56) CONNECT tunnel failed, response 403` ; statut du proxy : `connect_rejected … pattounejouets.myshopify.com:443`). Il faut l’ajouter à la liste des domaines autorisés de l’environnement, puis lancer :

```bash
D=/tmp/claude-0/-home-user-mon-projet-claude/b0a50f99-8e8e-5116-8461-0675cba5bd6e/scratchpad/audit-live
bash $D/audit-curl.sh > $D/curl-results.txt          # statuts, redirections, sitemap, robots, e-mails, pays/langues
NODE_PATH=/opt/node-tools/node_modules node $D/audit-live.mjs   # -> $D/results.json + captures PNG
```

Ce que mesure `audit-live.mjs` :
- **Toutes les pages demandées**, en mobile 390×844 (réseau 4G lent émulé) et en bureau 1440×900 pour les 4 pages clés : statut, LCP et élément LCP, CLS, poids transféré, nombre de requêtes, ressources les plus lourdes, erreurs console, requêtes ≥ 400, images sans alt ou cassées, title, description, H1, canonical, OG/Twitter, hreflang, JSON-LD analysé, e-mails, mentions à risque, prix, débordement horizontal, cibles de moins de 24 px, texte de moins de 12 px.
- **Le parcours d’achat** : prix des offres 1/2/3, ajout de 2 balles, ouverture du panier, `/cart.js` (remises réellement appliquées), passage à 3, `/cart`. Le bouton « Commander » est cliqué mais **la requête vers le checkout est interceptée et annulée** : on ne va jamais jusqu’au paiement.
- **L’international** (`?country=BE`, `?country=US`, `Accept-Language` en/de) : langue, devise du panier, prix affichés, textes de livraison.
- **Les liens internes** de toutes les pages (statut sans suivre les redirections).
