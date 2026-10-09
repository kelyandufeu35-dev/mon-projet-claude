# McDonald's — Inside the Organization

Vidéo explicative d'environ **98 secondes** (un **hook** de 5 s « Comment McDo fonctionne ? » + 93,5 s de film) en **motion design 3D isométrique miniature**,
en deux formats générés depuis le même code : **16:9 (1920 × 1080)** et **9:16 TikTok / Reels / Shorts (1080 × 1920)**, 30 i/s.
Elle montre **qui dirige McDonald's, comment l'organisation est structurée, comment fonctionne la franchise
et comment la hiérarchie descend jusqu'aux équipes d'un restaurant**. Rien sur les burgers, les fournisseurs ou la logistique.

> ⚠️ Les schémas sont **pédagogiques**. Ils ne prétendent pas reproduire l'organigramme officiel exact de McDonald's
> (voir « Vérification des informations » plus bas).

## Livrables

| Fichier | Contenu |
|---|---|
| `video/mcdonalds-inside-the-organization-tiktok.mp4` | **Version TikTok** (1080×1920, 9:16, 30 i/s, 98,5 s, voix + musique, −16 LUFS). |
| `video/mcdonalds-inside-the-organization-web.mp4` | **Version 16:9** (1920×1080, 30 i/s, 98,5 s, voix + musique, −16 LUFS). |
| `renders/*.mp4` | Masters (CRF 15–16) — non versionnés (trop lourds pour git), régénérables avec `npm run render` / `npm run render:tiktok`. |
| `docs/storyboard.jpg`, `docs/poster-*.jpg` | Planche de 9 images et affiches extraites de la vidéo finale. |
| `preview.html` / Studio Hyperframes | Prévisualisation interactive (voir plus bas). |

## Le hook d'ouverture (0 – 5 s)

« **Comment McDo fonctionne ?** » : titre cinétique (COMMENT / **McDo** / FONCTIONNE ?) sur un montage de 4 plans clés du film (organigramme, globe, restaurant en coupe,
salle du conseil) coupés toutes les 1,25 s avec punch de caméra, puis trois questions (« Qui dirige ? Qui décide ? Et qui est derrière le comptoir ? »).
La voix du hook, les sous-questions et les coupes sont synchronisées (`data/narration.json` → `hook`, `src/timeline.js` → `CUTS`).

## Le film en six scènes

Les temps ci-dessous sont des temps de **scène** ; ajoutez 5 s pour le temps vidéo (hook).

| # | Temps | Contenu |
|---|-------|---------|
| 1 | 0 – 15 s | La tour du siège se construit, la caméra monte au dernier étage, **le toit s'ouvre** sur la salle du conseil : conseil d'administration (gouvernance, en estrade), PDG et équipe de direction (pilotent l'entreprise). |
| 2 | 15 – 30 s | **Sept immeubles de fonctions** se construisent autour du siège (finance, marketing, opérations, RH, technologie et numérique, développement et franchises, juridique et conformité), bureaux ouverts en coupe, liaisons lumineuses vers la direction générale, puis liaisons de coordination entre fonctions. |
| 3 | 30 – 45 s | Les immeubles s'effondrent, la place se déplie en **carte azimutale en points** qui se replie en **globe**. Le siège devient l'épingle du globe. Marchés illustrés avec trois natures de structure *différentes* : exploités, licenciés de développement, sociétés affiliées. |
| 4 | 45 – 60 s | **Plongeon** dans un marché, éclair, les arches se dévoilent : ville miniature. Contrat de franchise, standards de marque, franchisé indépendant, restaurant, poignée de main avec le responsable, autres franchisés. |
| 5 | 60 – 75 s | **Le toit du restaurant s'envole**, coupe intérieure : exploitant, responsable, adjoints, managers de quart, équipiers. Lignes de supervision qui suivent les personnages en mouvement. |
| 6 | 75 – 93,5 s | La ville s'efface, restaurants et bureaux s'envolent vers leur place dans l'**organigramme géant** à quatre paliers, avec quatre types de liaisons (gouvernance, hiérarchie interne, contrats, coordination). Message final. |

Message final : « McDonald's : une organisation mondiale, des milliers d'entrepreneurs et d'équipes locales. »

## Lancer le projet

Prérequis : Node 22+, ffmpeg, un Chromium (le rendu logiciel WebGL/SwiftShader suffit).

```bash
cd inside-the-organization
npm install                       # three, gsap, esbuild, playwright-core, polices
npm run build                     # src/ -> dist/scene.js (16:9) et tiktok/dist/scene.js (9:16), Three.js inclus, 100 % hors-ligne

# Prévisualisation
npm run dev                       # Studio Hyperframes (timeline, scrub, édition) — 16:9 ;  npm run dev:tiktok pour le 9:16
npm run preview:standalone        # puis http://localhost:4173/preview.html (16:9) ou /tiktok/preview.html (9:16) : lecture + son + chapitres
                                  # (ou : python3 -m http.server 4173)

# Validation et rendu
npm run lint                      # contrat Hyperframes (les deux projets)
npm run check                     # lint + exécution + mise en page + contraste (long en WebGL logiciel) ; check:tiktok pour le 9:16
PRODUCER_HEADLESS_SHELL_PATH=/chemin/vers/chrome-headless-shell npm run render         # -> renders/mcdonalds-inside-the-organization.mp4
PRODUCER_HEADLESS_SHELL_PATH=/chemin/vers/chrome-headless-shell npm run render:tiktok  # -> renders/mcdonalds-inside-the-organization-tiktok.mp4
```

Durée de rendu observée : **≈ 50 min par format** pour les ≈ 2 950 images (4 cœurs, WebGL logiciel SwiftShader, sans GPU).
Une retouche locale n'oblige pas à tout refaire : `node scripts/render-segment.mjs <début> <fin> seg.mp4` re-rend une fenêtre de temps
avec la même fonction pure du temps, et `scripts/splice.sh` l'épisse dans le master en conservant son audio
(c'est ainsi que l'écran final et une légende ont été corrigés). `scripts/make-web.sh` produit la version allégée.

Contrôle visuel rapide d'images isolées (sans Hyperframes) :
`node scripts/shoot.mjs --out /tmp/shots 12.8 53.6 88` puis `scripts/sheet.sh` ou `scripts/look.sh 8 20 40 80` (planche 2×2) ;
en portrait : `scripts/pshots.sh planche.png 8 20 40 80` (temps de scène, planche horizontale de captures 1080×1920).
`node scripts/determinism.mjs [--portrait] t1 t2 …` compare des images obtenues dans un ordre de lecture différent.

## Architecture

```
index.html            composition Hyperframes 16:9 (1920×1080, 98,5 s) : canvas WebGL + étiquettes + texte + <audio>
preview.html          lecteur autonome (lecture, scrub, chapitres, son)
tiktok/               projet Hyperframes 9:16 (1080×1920) : même code (bundle compilé avec __PORTRAIT__=true), mêmes assets (copiés par le build)
src/
  main.js             assemble le monde ; renderAt(t) = fonction pure du temps (écoute l'événement hf-seek)
  format.js           format de sortie (paysage / portrait) fixé à la compilation : dimensions, zone de sécurité des étiquettes
  timeline.js         découpage du film, hook d'ouverture et correspondance temps vidéo → temps de scène
  cameraPlan.js       plan de caméra isométrique (zooms exponentiels, plongeon, ascension) ; surcharges `p:` pour le portrait
  overlay.js          textes animés GSAP (hook, titre, chapitres, légendes, sous-titres, message final)
  engine/             stage (rendu, lumières, sol), camera, labels (HTML ancré en 3D), links (liaisons lumineuses)
  components/         character (personnages articulés), building (tours qui se construisent, arches),
                      restaurant (coupe), furniture, icons (icônes de toit des 7 fonctions)
  sets/               hq, plaza, globe, city, interior, chart  (une « scène » = un set)
  data/landmask.js    contours de continents simplifiés pour le globe en points
data/                 narration.json (voix off, hook, chapitres), pronunciation.json (prononciation), facts.json (faits et statut de vérification), sfx.json
scripts/              build, tts (Kokoro), music (synthèse), audio-tags, shoot/look/sheet (contrôle visuel)
assets/               polices (Poppins/Inter), audio (voix off, musique, effets), GSAP
```

**Déterminisme.** Tout l'état visuel est une fonction pure du temps `t` (pas de `Date.now`, de `Math.random` non seedé ni
de boucle libre) : Hyperframes peut sauter à n'importe quelle image et obtenir exactement les mêmes pixels.
La 3D passe par l'adaptateur Three.js de Hyperframes (`hf-seek`), le texte par une timeline GSAP en pause.

**Deux formats, un code.** `scripts/build.mjs` compile `src/` deux fois (esbuild `define __PORTRAIT__`). Le portrait garde les mêmes scènes, avec : caméra plus haute et
recentrée (la fenêtre visible est 3,2× plus étroite), organigramme final recomposé verticalement (`LY` dans `sets/chart.js`), étiquettes 3D 35 % plus grandes
avec placement anti-chevauchement (`engine/labels.js`), sous-titres, légendes et notes déplacés hors des zones d'interface TikTok (≈ 150 px en haut, ≈ 450 px en bas),
titre de chapitre agrandi. Textes dimensionnés pour un téléphone (titres de cartes ≈ 30–40 px, sous-titres 46 px, chapitre 56 px).

**Composants réutilisables.** Personnages articulés (hanches, torse, tête, bras et jambes à deux segments ; actes : marche,
assis, parole, frappe, poignée de main, plateau…) — acteurs pilotés par chemin et actes horodatés ; tours qui poussent étage par étage ;
liaisons lumineuses (tube + halo, tracé progressif, impulsions, version dynamique qui suit des personnages) ;
étiquettes HTML ancrées dans la 3D avec zone de sécurité.

## Vérification des informations

Les faits utilisés sont consignés dans `data/facts.json`, **fait par fait**, avec source et statut.

* Les sites officiels demandés (`corporate.mcdonalds.com`, pages leadership / franchising / investisseurs, `sec.gov`) étaient
  **bloqués par la politique réseau de l'environnement de création** (refus de connexion). Je n'ai donc **pas pu lire ces pages
  directement**. Les faits ont été recoupés par recherche web sur des extraits de documents officiels (10-K 2025, proxy 2026, 8-K 2026,
  page leadership) et sont marqués `verified_via_search`.
* **Aucun nom de dirigeant n'est affiché.** Tant qu'ils n'ont pas été vérifiés directement sur la source officielle (et le dernier 8-K
  mentionne un changement récent à la tête de McDonald's USA), la vidéo n'affiche que des **fonctions** (« Directeur général (PDG) »,
  « Conseil d'administration »…). `display.showNames` reste à `false`.
* Éléments **illustratifs**, signalés dans la vidéo : les sept fonctions de la scène 2 (organisation simplifiée), les marchés de la
  scène 3 (exemples, aucune hiérarchie régionale uniforme n'est inventée), les rôles de la scène 5 (varient selon le pays et le restaurant),
  l'organigramme final (ce n'est pas l'organigramme officiel).
* Faits structurants retenus : conseil d'administration chargé de la gouvernance ; segments États-Unis / International Operated Markets /
  International Developmental Licensed Markets ; environ 95 % de restaurants franchisés fin 2025 ; trois structures de franchise (conventionnelle,
  licence de développement, société affiliée) ; franchisés exploitants indépendants.

## Limites connues

* Vérification des sources officielles **non faite en lecture directe** (réseau bloqué, voir plus haut) : à refaire avant diffusion publique,
  en particulier avant d'afficher des noms de dirigeants.
* Le globe est un rendu en points à partir de contours de continents très simplifiés (stylisé, pas cartographique).
* Les personnages sont stylisés (primitives articulées, pas de visage expressif) ; les tenues par rôle sont des conventions de lecture, pas des uniformes réels.
* `npm run check` signale en informations des étiquettes 3D qui passent sous un sous-titre ou un panneau : superpositions voulues (couches).

## Son

* **Voix off** : française, synthétisée hors ligne avec Kokoro-82M (voix `ff_siwis`), script dans `data/narration.json`.
  Régénération : `npm run voice` (modèle à télécharger, voir `scripts/tts.py`).
  **Prononciation** : le moteur lisait « McDonald's » comme « M-C » + un mot anglais, et « marketing » à l'anglaise. `data/pronunciation.json` remplace les phonèmes fautifs
  par la prononciation française usuelle (« mac-donalds », « mar-ké-tinng », « McDo » → « mac do ») ; les sous-titres gardent l'orthographe normale. Les corrections
  ont été vérifiées au niveau des phonèmes (aucune balise anglaise résiduelle) mais **pas à l'oreille** : à écouter avant diffusion.
* **Musique** : originale, synthétisée par `scripts/music.py` (aucune banque externe), avec une section dédiée au hook (kick, basse, arpège, montée, impact sur la scène 1).
* **Effets** : banque libre de droits Pixabay fournie avec Hyperframes (`assets/audio/sfx/CREDITS.md`).

## Couleurs

Rouge `#DA291C`, jaune `#FFC72C`, blanc et gris. Liaisons : gouvernance **blanc**, hiérarchie interne **rouge**,
relations contractuelles **jaune**, coordination **cyan** (seul accent hors palette, réservé aux liaisons).
