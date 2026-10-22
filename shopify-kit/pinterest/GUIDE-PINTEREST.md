# Guide Pinterest Pattoune (version simple)

Tout est prêt dans ce dossier :

- **10 images** `pin-01…jpg` à `pin-10…jpg` : ce sont tes épingles.
- **`pins.csv`** : pour chaque image, le titre, la description, le lien et le tableau à copier-coller.
  Ouvre-le avec Excel, Numbers ou Google Sheets.

Compte environ 20 minutes pour l'étape 1, puis 2 minutes par épingle.

---

## Étape 1 : créer ton compte Pinterest Business (gratuit)

1. Va sur **pinterest.fr/business/create**.
2. Inscris-toi et choisis un mot de passe.
3. Quand on te le demande :
   - **Nom de l'entreprise** : `Pattoune`
   - **Site web** : `https://pattounejouets.myshopify.com`
   - **Pays** : France · **Langue** : Français
   - **Type d'entreprise** : Commerce / boutique en ligne
4. Ajoute ta **photo de profil** : `shopify-kit/tiktok/pattoune-photo-profil.jpg`.
5. Dans **À propos**, colle ce texte :

   > La balle à friandises qui transforme le repas en jeu, pour chats et petits chiens. Conseils, jeux de flair et astuces pour occuper ton animal à la maison.

Tu as déjà un compte Pinterest perso ? Dans les paramètres, clique sur **« Convertir en compte professionnel »** : c'est aussi gratuit.

---

## Étape 2 : créer 3 tableaux

Un tableau, c'est un dossier qui regroupe des épingles.
Sur ton profil, clique sur **+**, puis **Tableau**, et crée ces 3 tableaux (copie les noms tels quels) :

| Nom du tableau | Ce qu'on y met |
|---|---|
| **Occuper son chien et son chat à la maison** | les conseils (épingles 01, 02, 04, 09) |
| **Jeux de flair et astuces maison chien chat** | les jeux et astuces (épingles 08, 10) |
| **Balle à friandises chat et petit chien** | le produit (épingles 03, 05, 06, 07) |

Le bon tableau est déjà indiqué dans la colonne `tableau` du fichier `pins.csv`.

---

## Étape 3 : publier une épingle (à refaire pour chacune)

1. Clique sur **+** puis **Épingle** (ou « Créer une épingle »).
2. Glisse l'image, par exemple `pin-01-conseil-occuper-chien-seul.jpg`.
3. Ouvre `pins.csv` et copie la ligne de cette image :
   - **Titre** : colonne `titre`
   - **Description** : colonne `description`
   - **Lien** : colonne `lien` (copie-le en entier, avec `https://`)
4. **Tableau** : choisis celui indiqué dans la colonne `tableau`.
5. Clique sur **Publier**.

Astuce : au lieu de « Publier », tu peux choisir **« Publier plus tard »** et programmer toutes tes épingles en une fois.

---

## Étape 4 : le rythme

**1 à 2 épingles par jour, pas plus.** Mieux vaut publier un peu chaque jour que tout le même jour.

Ordre conseillé (une ligne par jour ; si tu en fais 2 par jour, prends deux lignes) :

| Jour | Épingle |
|---|---|
| 1 | pin-05 (produit : son repas devient un jeu) |
| 2 | pin-01 (5 idées pour occuper ton chien seul) |
| 3 | pin-06 (comment ça marche en 3 étapes) |
| 4 | pin-02 (ton chat s'ennuie ? 6 signes) |
| 5 | pin-08 (4 jeux de flair maison) |
| 6 | pin-07 (taille 8 cm) |
| 7 | pin-09 (chien qui mange trop vite) |
| 8 | pin-03 (bien choisir une balle à croquettes) |
| 9 | pin-04 (les 5 règles d'or des jeux de flair) |
| 10 | pin-10 (5 astuces pour bien débuter) |

Après le jour 10, tu peux republier les mêmes images dans un autre de tes tableaux s'il correspond aussi.
Laisse au moins quelques semaines entre deux publications de la même image.

Pinterest est lent : les visites arrivent souvent après plusieurs semaines. C'est normal, continue.

---

## Option : l'application Pinterest gratuite sur Shopify

Elle sert à envoyer automatiquement la fiche de ta balle (photo, prix, lien) dans Pinterest, pour qu'elle apparaisse comme un produit qu'on peut acheter.

1. Dans ton administration Shopify : **Applications**, puis **Boutique Shopify App Store**.
2. Cherche **« Pinterest »** (l'application publiée par Pinterest, gratuite).
3. Clique sur **Installer**, puis connecte ton compte Pinterest Business.
4. Suis les étapes à l'écran : l'application relie ta boutique et ton compte, puis importe ton produit.

Ce n'est pas obligatoire : les 10 épingles fonctionnent très bien sans elle.

---

## À retenir

- Ne modifie pas les textes pour ajouter des promesses (« indestructible », « recommandé par les vétérinaires », etc.) : on ne dit que ce qui est vrai.
- Garde les messages de sécurité : la balle s'utilise **sous surveillance**, et **pas pour les grands chiens**.
- Pour changer un texte sur une image : le fichier `source/build-pins.cjs` permet de les régénérer.
