# Installer le thème Pattoune sur Shopify

Compte environ une heure. Tout se fait dans l’administration Shopify, sans code.

Ce dossier contient :

- `pattoune-theme.zip` : le thème à importer dans Shopify ;
- `politiques/` : les textes légaux à coller dans Shopify ;
- ce guide.

> Ce guide n’est pas un conseil juridique. Pour un doute sur ton statut, la TVA ou une obligation légale, demande à un expert-comptable ou à la CCI.

---

## 1. Importer le thème

1. Dans Shopify : **Boutique en ligne → Thèmes**.
2. Dans « Bibliothèque de thèmes », clique sur **Ajouter un thème → Importer un fichier zip**.
3. Choisis `pattoune-theme.zip` (ne le décompresse pas).
4. Le thème apparaît dans ta bibliothèque. **Ne le publie pas encore** : clique sur **Personnaliser** pour le préparer d’abord.

---

## 2. Créer le produit

**Produits → Ajouter un produit.**

1. **Titre** : le nom de ta balle, par exemple « Balle à friandises Pattoune ».
2. **Description** : quelques phrases. Elle s’affiche sous le bouton d’achat sur la fiche produit.
3. **Médias** : tes photos et vidéos. La première sert de vignette et d’aperçu sur les réseaux sociaux.
4. **Prix** : par exemple 24,90 €. Laisse « Prix avant réduction » **vide** tant que tu n’as pas vraiment vendu à ce prix (la loi impose que le prix barré soit le plus bas des 30 derniers jours).
5. **Variantes** : ajoute une option **« Couleur »** avec tes couleurs (Bleu cobalt, Jaune soleil, Rose bonbon…).
   - Pour avoir des **pastilles de couleur** au lieu de boutons texte, choisis l’option « Couleur » de la catégorie produit proposée par Shopify, et associe une couleur à chaque valeur.
   - Associe à chaque variante **sa photo**. Le site affiche alors la bonne photo quand le client change de couleur.
6. **Stock** : si ton application fournisseur (DSers, CJ Dropshipping…) gère le stock, laisse-la faire. Sinon, décoche « Suivre la quantité ».
7. **Enregistre.**

Si tu utilises **CJ Dropshipping** ou **DSers**, installe leur application depuis l’App Store de Shopify. Importe le produit depuis l’application, puis modifie le titre, la description et les photos comme ci-dessus.

---

## 3. Créer les remises des offres groupées

Le site affiche « 2 articles −15 % » et « 3 articles −20 % ». Pour que Shopify applique réellement ces remises, crée **deux réductions automatiques** :

**Réductions → Créer une réduction → Montant de réduction sur les produits.**

| | Réduction 1 | Réduction 2 |
| --- | --- | --- |
| Méthode | Automatique | Automatique |
| Titre | Lot −15 % | Lot −20 % |
| Valeur | Pourcentage : 15 % | Pourcentage : 20 % |
| S’applique à | Ton produit | Ton produit |
| Conditions | Quantité minimale d’articles : **2** | Quantité minimale d’articles : **3** |
| Combinaisons | Ne coche rien | Ne coche rien |

Quand les deux s’appliquent (3 articles ou plus), Shopify garde automatiquement la plus avantageuse pour le client.

Si tu changes ces chiffres, change-les aussi dans le thème : **Personnaliser → Paramètres du thème → Livraison et remises**.

**Vérifie les montants** : ajoute 2 puis 3 articles au panier et compare le total avec le prix affiché sur la fiche produit. Ils doivent être identiques.

---

## 4. Régler la livraison

**Paramètres → Expédition et livraison.**

1. Crée un tarif payant, par exemple **4,90 €**.
2. Crée un tarif **gratuit** avec la condition « Prix de commande minimum : **35 €** ».
3. Reporte le même seuil dans **Personnaliser → Paramètres du thème → Livraison et remises → Livraison offerte dès**. Mets aussi le **vrai délai** de ton fournisseur.

---

## 5. Préparer la page d’accueil dans l’éditeur

**Boutique en ligne → Thèmes → Personnaliser** (sur le thème Pattoune).

1. Clique sur la section **« Produit vedette »** et **sélectionne ton produit**.
2. Modifie l’accroche, les animaux concernés et les **points forts** (blocs « Point fort »).
3. Passe chaque section en revue et adapte les textes à ton produit :
   - **Avantages** ;
   - **Étapes** ;
   - **Fiche technique** : remplace tous les « À compléter » par les vraies valeurs du fournisseur ;
   - **Comparatif** ;
   - **Questions fréquentes** : mets ton vrai délai de livraison ;
   - **Appel à l’action**.
4. **Avis clients** : la section reste invisible tant qu’elle est vide. N’ajoute que de **vrais** avis de vrais clients : les faux avis sont interdits et lourdement sanctionnés.
5. **Paramètres du thème** (icône engrenage en bas à gauche) :
   - **Logo et icône** : ton logo (facultatif) et l’icône d’onglet ;
   - **Couleurs** : les couleurs de ta marque ;
   - **Contact** : ton e-mail affiché dans le pied de page.
6. **Enregistre.**

Tu peux aussi déplacer, masquer ou ajouter des sections avec le bouton « Ajouter une section ».

---

## 6. Menus et page Contact

1. **Contenu → Menus** :
   - **Menu principal** : par exemple « Le jouet » → `/#le-jouet`, « Comment ça marche » → `/#comment`, « Questions » → `/#faq`.
   - **Pied de page** : « Contact », « Livraison » (lien vers la politique d’expédition), « Questions fréquentes » → `/#faq`.
2. Dans l’éditeur, section **En-tête**, choisis le menu principal. Section **Pied de page**, choisis le menu pied de page.
3. **Contenu → Pages → Ajouter une page** « Contact ». À droite, dans « Modèle », choisis **page.contact**. Le formulaire envoie les messages à l’e-mail de ta boutique.

---

## 7. Pages légales

**Paramètres → Politiques.** Colle les textes du dossier `politiques/` dans les bons champs :

| Fichier | Champ Shopify |
| --- | --- |
| `1-mentions-legales.txt` | Mentions légales |
| `2-conditions-generales-de-vente.txt` | Conditions d’utilisation |
| `3-politique-de-remboursement.txt` | Politique de remboursement |
| `4-politique-d-expedition.txt` | Politique d’expédition |
| `5-politique-de-confidentialite.txt` | Politique de confidentialité (complète le modèle Shopify) |

Remplace **tout ce qui est entre crochets** `[ ]`. Ces pages s’affichent automatiquement dans le pied de page et au moment du paiement.

**Cookies** : dans **Paramètres → Confidentialité des clients**, active la **bannière de cookies** pour l’Europe. C’est obligatoire si tu utilises le pixel Meta ou Google Analytics.

---

## 8. Publier

1. Fais une **commande test** : **Paramètres → Paiements**, active le mode test, passe une commande, vérifie l’e-mail de confirmation, puis désactive le mode test.
2. **Boutique en ligne → Thèmes → Publier** sur le thème Pattoune.
3. Retire le mot de passe de la boutique : **Boutique en ligne → Préférences → Protection par mot de passe**. Il faut un forfait Shopify payant.

---

## Avant d’accepter un vrai paiement

- [ ] Statut d’entreprise déclaré (la micro-entreprise suffit pour démarrer).
- [ ] Médiateur de la consommation choisi : liste sur [economie.gouv.fr/mediation-conso](https://www.economie.gouv.fr/mediation-conso). C’est obligatoire.
- [ ] Toutes les politiques remplies, sans crochets restants.
- [ ] Vrai délai de livraison affiché partout : thème, FAQ, politique d’expédition.
- [ ] Caractéristiques du produit vérifiées auprès du fournisseur. Rien d’inventé (« non toxique », « indestructible »…).
- [ ] Sécurité du produit : depuis décembre 2024, le règlement européen sur la sécurité générale des produits (GPSR) impose un responsable établi dans l’UE et des informations sur le fabricant. Demande les documents à ton fournisseur.
- [ ] Échantillon commandé et reçu : qualité et délai réels vérifiés.
- [ ] Remises testées dans le panier : les prix de la fiche produit correspondent au total payé.

---

## Questions fréquentes

**Le thème affiche une balle dessinée au lieu de mes photos.**
Le produit n’a pas encore de photos, ou la section « Produit vedette » n’a pas de produit sélectionné.

**Les couleurs s’affichent en boutons texte, pas en pastilles.**
C’est normal tant que les valeurs de l’option n’ont pas de couleur associée dans Shopify (étape 2.5). Le site reste fonctionnel.

**Le prix barré n’apparaît pas.**
Il ne s’affiche que si « Prix avant réduction » est rempli dans la variante.

**Je veux revenir en arrière.**
Ton ancien thème reste dans la bibliothèque : il suffit de le republier.
