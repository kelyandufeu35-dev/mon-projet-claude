# Mettre en ligne SquishyTime

Tout se fait dans l'admin de **bys-user-store**, jamais depuis Pattoune. Fais une étape à la fois, dans l'ordre.

Dans ce dossier :

- `squishytime-theme.zip` : le thème à importer ;
- `fiche-produit.md` : les textes du squishy fraise ;
- `legal/` : les 5 textes légaux à coller ;
- `theme/` : le code source du thème (pas besoin d'y toucher).

> Ce guide n'est pas un conseil juridique. Pour un doute sur une obligation légale, demande à un expert-comptable ou à la CCI.

---

## 1. Importer le thème

1. **Boutique en ligne → Thèmes**.
2. **Ajouter un thème → Importer un fichier zip**, choisis `squishytime-theme.zip` (sans le décompresser).
3. Ne le publie pas encore.

## 2. Préparer le produit

Importe le squishy avec DSers, puis ouvre-le dans **Produits** et suis `fiche-produit.md` : titre, description, taille unique **12 cm à 15,99 €**, photos, référencement.

Vérifie aussi le **coût de livraison facturé par DSers** : la livraison est offerte au client, donc ce coût sort de ta marge.

## 3. Créer la collection « Tous les squishy »

**Produits → Collections → Créer une collection.**

- Titre : `Tous les squishy`
- Type : **Automatisée**, condition « Type de produit est égal à Squishy ». Chaque nouveau squishy y entrera tout seul.
- En bas, vérifie que l'adresse URL finit par `tous-les-squishy`.

La grille « Tous les squishy » de l'accueil reste cachée tant qu'il n'y a qu'un produit. Elle apparaît dès le 2ᵉ squishy.

## 4. Créer les remises des lots

**Réductions → Créer une réduction → Montant de réduction sur les produits**, deux fois :

| | Réduction 1 | Réduction 2 |
| --- | --- | --- |
| Méthode | Automatique | Automatique |
| Titre (visible dans le panier) | `Lot −10 %` | `Lot −15 %` |
| Valeur | 10 % | 15 % |
| S'applique à | Collection « Tous les squishy » | Collection « Tous les squishy » |
| Conditions | Quantité minimale d'articles : **2** | Quantité minimale d'articles : **3** |
| Combinaisons | rien de coché | rien de coché |

À partir de 3 articles, Shopify garde automatiquement la remise la plus avantageuse (−15 %).

## 5. Régler la livraison offerte

**Paramètres → Expédition et livraison → Expédition générale.**

1. Dans chaque zone (France, et les autres pays que tu livres), crée un tarif **Livraison offerte** à **0,00 €**.
2. Supprime les tarifs payants.

Si un jour la livraison devient payante, décoche aussi **Personnaliser → Paramètres du thème → Offres et livraison → Livraison toujours offerte**.

## 6. Coller les textes légaux

**Paramètres → Politiques.** Colle chaque fichier de `legal/` dans la case qui correspond (le nom de la case est écrit en haut de chaque fichier).

Avant de coller :

- remplace l'**adresse** et le **SIREN** entre crochets par ceux des mentions légales de Pattoune (même entreprise) ;
- mets la date du jour en haut des CGV.

Le pied de page affiche ces politiques tout seul.

## 7. Créer la page Contact

**Boutique en ligne → Pages → Ajouter une page.**

- Titre : `Contact`
- Contenu : vide (le thème affiche un texte et le formulaire).
- À droite, **Modèle de thème : `contact`**.
- Vérifie que l'adresse URL finit par `/pages/contact`.

La page n'affiche **ni e-mail, ni téléphone, ni adresse** : seulement un formulaire. Les messages arrivent sur l'e-mail de la boutique (**Paramètres → Général**).

Les clients voient l'e-mail d'expéditeur dans les confirmations de commande (**Paramètres → Notifications**). Utilise une adresse dédiée à la boutique plutôt que ton e-mail perso.

## 8. Créer les menus

**Boutique en ligne → Menus.**

- **Menu principal** (`main-menu`) : Accueil · Tous les squishy (lien vers la collection) · Contact (lien vers la page).
- **Menu de pied de page** (`footer`) : Tous les squishy · Livraison (politique d'expédition) · Retours (politique de remboursement) · Contact.

## 9. Personnaliser le thème

**Boutique en ligne → Thèmes → Personnaliser** sur SquishyTime.

1. **Grande bannière** : choisis ton produit (affiche « 15,99 € · livraison offerte »). Ajoute une belle photo détourée si tu en as une, sinon la fraise animée reste.
2. **Produit vedette** : choisis ton produit. C'est ici qu'on achète directement depuis l'accueil.
3. **Grille de produits** : choisis la collection « Tous les squishy ».
4. **Paramètres du thème → Logo et favicon** : ton logo si tu en as un (sinon le nom avec la petite fraise).
5. **Paramètres du thème → Réseaux sociaux** : tes liens TikTok, Instagram…

## 10. Référencement de l'accueil

**Boutique en ligne → Préférences.**

- Titre : `SquishyTime – Squishy fraise à remontée lente`
- Méta-description : `Des squishy tout doux qui reprennent leur forme lentement. Squishy fraise géant de 12 cm, livraison offerte.`
- Image de partage sur les réseaux : une belle photo du squishy (1200 × 630 px).

## 11. Tester une commande

1. **Paramètres → Paiements** : active le mode test de Shopify Payments.
2. Sur la boutique, mets **2 squishy** au panier : le panier doit afficher **Lot −10 %**. Puis 3 : **Lot −15 %**.
3. Les totaux attendus sont 28,78 € (×2) et 40,77 € (×3).
4. Va jusqu'au paiement test, puis désactive le mode test.

## 12. Domaine et publication

1. **Paramètres → Domaines → Acheter un domaine**, depuis bys-user-store : `squishytime.shop` (10 $), `squishytimes.com` ou `squishytimeshop.com` (16 $).
2. **Boutique en ligne → Thèmes → Publier** sur SquishyTime.
3. **Boutique en ligne → Préférences** : retire le mot de passe quand tout est prêt.

---

Polices Fredoka et Nunito : licence SIL Open Font License 1.1, incluses dans le thème.
