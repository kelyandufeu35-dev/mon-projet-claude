# Google Ads · Performance Max Pattoune

Tout ce qu'il faut pour remplir le groupe d'assets et faire passer « L'efficacité de l'annonce » de *Faible* à *Bonne* ou *Excellente*.
Longueurs vérifiées une à une. Règles respectées : tutoiement, pas d'argument santé, pas de fausse urgence, pas de nom de marque, délai 8 à 25 jours.

Où coller : **Campagnes › ta campagne Performance Max › Groupes d'assets › Modifier le groupe d'assets**.

---

## 1. Avant tout : pourquoi 0 impression

À vérifier dans cet ordre (le premier point bloque presque toujours une nouvelle boutique) :

1. **Merchant Center › Produits** : combien sont *Approuvés* / *En attente* / *Refusés* ? Tant que l'examen n'est pas fini (souvent 3 à 7 jours), la campagne n'a rien à montrer.
2. **Merchant Center › Présentation / Problèmes du compte** : un avertissement du type *Fausse déclaration* ou *Site non vérifié* bloque tout le compte. Google demande des coordonnées visibles : la page Contact du site et l'adresse des conditions de vente comptent ; ta fiche « Coordonnées » Shopify a le téléphone et l'e-mail vides (choix volontaire, on n'y touche pas sans ton accord).
3. **Google Ads, bandeau en haut** : moyen de paiement validé ? vérification de l'annonceur demandée ?
4. **Diagnostics de la campagne** : le texte exact sous « Impressions : problèmes détectés ».

---

## 2. Titres courts (15 maximum, 30 caractères)

| # | Titre | Car. |
|---|---|---|
| 1 | Tout pour ton chat, ton chien | 29 |
| 2 | Jouets, paniers et harnais | 26 |
| 3 | Livraison offerte dès 25 € | 26 |
| 4 | Paniers en peluche douce | 24 |
| 5 | Accessoires dès 6,99 € | 22 |
| 6 | Harnais réglable réfléchissant | 30 |
| 7 | Laisse corde réfléchissante | 27 |
| 8 | Jeux pour occuper ton chien | 27 |
| 9 | Jouets pour chat d'intérieur | 28 |
| 10 | Gamelles, brosses et soins | 26 |
| 11 | Colis suivi jusqu'à chez toi | 28 |
| 12 | Livré en France, UE et Suisse | 29 |
| 13 | 14 jours pour changer d'avis | 28 |
| 14 | Une vraie personne te répond | 28 |
| 15 | Pattoune, pour chat et chien | 28 |

> Titre 5 : à changer si le prix du gant ou de la brosse à dents (6,99 €) change.

## 3. Titres longs (5 maximum, 90 caractères)

1. Jouets, paniers, harnais et gamelles : tout pour le quotidien de ton chat ou de ton chien
2. Livraison offerte dès 25 € en France, dans l'UE et en Suisse, avec un colis suivi
3. Des accessoires simples et bien expliqués pour ton chat et ton chien
4. Paniers en peluche, jouets à friandises, harnais réfléchissants : trouve son préféré
5. Pattoune : jouets et accessoires pour chats et chiens, livrés chez toi

## 4. Descriptions (5 maximum, 90 caractères ; la 1re doit faire 60 ou moins)

1. Jouets, paniers, harnais et soins pour chat et chien. *(53)*
2. Livraison offerte dès 25 € en France, UE et Suisse. Colis suivi, reçu en 8 à 25 jours.
3. Chaque produit est décrit honnêtement : tailles, matières et conseils d'utilisation.
4. Paniers douillets, jouets pour l'occuper, harnais réfléchissants pour les balades.
5. Une question avant de commander ? Écris-nous, une vraie personne te répond.

## 5. Autres champs du groupe d'assets

- **Nom de l'entreprise** : Pattoune
- **URL finale** : la page d'accueil de la boutique
- **Incitation à l'action** : Acheter
- **Chemin d'affichage** : `/chat-chien`

---

## 6. Images (dossier `images/`, sans texte incrusté, prêtes à importer)

Google limite à 20 images par groupe d'assets : il y en a 19.

| Format | Fichiers |
|---|---|
| Paysage 1200 × 628 | paysage-01 laisse · 02 panier rond · 03 harnais · 04 canne à plumes · 05 balles à garnir · 06 panier rectangulaire · 07 panier igloo |
| Carré 1200 × 1200 | carre-08 balle à friandises · 09 distributeur · 10 gant de toilettage · 11 brosse · 12 panier igloo · 13 balles à garnir · 14 harnais |
| Portrait 960 × 1200 | portrait-15 tapis de litière · 16 gourde · 17 gant ramasse-poils · 18 harnais · 19 laisse |

**Logos** : `logo-carre-1200.png` (1:1) et `logo-paysage-1200x300.png` (4:1).

Photos fournisseur déjà utilisées sur les fiches produits, recadrées. La balle à friandises est le rendu 3D du site. Aucune image générée par IA.

**Vidéo** : dossier `video/`, 18 s, même montage en 3 formats : `vertical` (1080 × 1920), `carre` (1080 × 1080), `paysage` (1920 × 1080). Photos produits réelles, musique originale (ukulélé, glockenspiel, claps ; synthèse, `video/source/music_uke.py`), pas de voix, aucune image IA. Plans : intro « Tout pour ton chat et ton chien » · Jouets · Couchage · Promenade · Repas et propreté · fin « Livraison offerte dès 25 € ». Les vidéos de `reels/` ne conviennent pas pour la pub (« 9 trouvailles », « lien en bio », images IA).

Mise en ligne : YouTube Studio › Créer › Importer des vidéos, les 3 fichiers, visibilité **Non répertoriée**, « Contenu modifié ou synthétique » : **Non**, « conçue pour les enfants » : **Non**.
- Titre : `Pattoune · Tout pour ton chat et ton chien`
- Description : `Jouets, paniers, harnais, gamelles et soins pour chat et chien. Livraison offerte dès 25 € en France, dans l'UE et en Suisse. https://pattounejouets.myshopify.com`

Puis Google Ads › groupe de composants › Vidéos › + Vidéos › coller le lien de chacune.

---

## 7. Extensions au niveau de la campagne

**Accroches** (25 caractères max) : Port offert dès 25 € · Colis suivi · Paiement sécurisé · Pour chat et chien · Retour sous 14 jours · Une vraie personne répond

**Liens annexes** (titre 25 max, lignes 35 max)

| Titre | Ligne 1 | Ligne 2 | URL |
|---|---|---|---|
| Jouets | Balles, cannes, puzzles | Pour occuper chat et chien | /collections/jouets |
| Paniers et couchage | Peluche longue et douce | Rond, igloo ou rectangulaire | /collections/couchage |
| Promenade | Harnais, laisse, gourde | Bandes réfléchissantes | /collections/promenade |
| Pour les chats | Jeux, paniers, litière | Tout pour ton chat | /collections/pour-les-chats |
| Pour les chiens | Jeux, harnais, gamelles | Tout pour ton chien | /collections/pour-les-chiens |
| Livraison | Offerte dès 25 € | France, UE et Suisse, colis suivi | /policies/shipping-policy |

---

## 8. Signal d'audience (aide Google à démarrer)

**Thèmes de recherche** : jouet pour chien · jouet pour chat · panier pour chat · panier pour chien · harnais pour chien · laisse pour chien · balle à friandises chien · canne à plumes chat · distributeur croquettes chat · gamelle inclinée chat · brosse pour chat · gant de toilettage chat · tapis de litière chat · alèse pour chiot · accessoires pour chien · accessoires pour chat

**Centres d'intérêt** : dans *Segments d'affinité*, cherche « animaux » et prends le segment des propriétaires et amis des chiens et des chats.
