# McDonald's — Inside the Organization

Vidéo explicative d'environ **93 secondes** (16:9, 1920 × 1080, 30 i/s) en **motion design 3D isométrique miniature**.
Elle montre **qui dirige McDonald's, comment l'organisation est structurée, comment fonctionne la franchise
et comment la hiérarchie descend jusqu'aux équipes d'un restaurant**. Rien sur les burgers, les fournisseurs ou la logistique.

> ⚠️ Les schémas sont **pédagogiques**. Ils ne prétendent pas reproduire l'organigramme officiel exact de McDonald's
> (voir « Vérification des informations » plus bas).

## Livrables

| Fichier | Contenu |
|---|---|
| `video/mcdonalds-inside-the-organization-web.mp4` | **Vidéo finale** (1920×1080, 30 i/s, 93,5 s, ≈ 30 Mo, voix + musique, volume normalisé à −16 LUFS). |
| `renders/mcdonalds-inside-the-organization.mp4` | Master (CRF 15, ≈ 116 Mo) — non versionné (trop lourd pour git), régénérable avec `npm run render`. |
| `docs/storyboard.jpg`, `docs/poster-*.jpg` | Planche de 9 images et affiches extraites de la vidéo finale. |
| `preview.html` / Studio Hyperframes | Prévisualisation interactive (voir plus bas). |

## Le film en six scènes

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
npm run build                     # src/ -> dist/scene.js (Three.js inclus, 100 % hors-ligne)

# Prévisualisation
npm run dev                       # Studio Hyperframes (timeline, scrub, édition)
npm run preview:standalone        # puis http://localhost:4173/preview.html : lecture + son + chapitres
                                  # (ou : python3 -m http.server 4173)

# Validation et rendu
npm run lint                      # contrat Hyperframes
npm run check                     # lint + exécution + mise en page + contraste (long en WebGL logiciel)
PRODUCER_HEADLESS_SHELL_PATH=/chemin/vers/chrome-headless-shell npm run render
# -> renders/mcdonalds-inside-the-organization.mp4
```

Durée de rendu observée : **≈ 50 min** pour les 2 805 images (4 cœurs, WebGL logiciel SwiftShader, sans GPU).
Une retouche locale n'oblige pas à tout refaire : `node scripts/render-segment.mjs <début> <fin> seg.mp4` re-rend une fenêtre de temps
avec la même fonction pure du temps, et `scripts/splice.sh` l'épisse dans le master en conservant son audio
(c'est ainsi que l'écran final et une légende ont été corrigés). `scripts/make-web.sh` produit la version allégée.

Contrôle visuel rapide d'images isolées (sans Hyperframes) :
`node scripts/shoot.mjs --out /tmp/shots 12.8 53.6 88` puis `scripts/sheet.sh` ou `scripts/look.sh 8 20 40 80` (planche 2×2).

## Architecture

```
index.html            composition Hyperframes (1920×1080, 93,5 s) : canvas WebGL + étiquettes + texte + <audio>
preview.html          lecteur autonome (lecture, scrub, chapitres, son)
src/
  main.js             assemble le monde ; renderAt(t) = fonction pure du temps (écoute l'événement hf-seek)
  cameraPlan.js       plan de caméra isométrique (zooms exponentiels, plongeon, ascension)
  overlay.js          textes animés GSAP (titre, chapitres, légendes, sous-titres, message final)
  engine/             stage (rendu, lumières, sol), camera, labels (HTML ancré en 3D), links (liaisons lumineuses)
  components/         character (personnages articulés), building (tours qui se construisent, arches),
                      restaurant (coupe), furniture, icons (icônes de toit des 7 fonctions)
  sets/               hq, plaza, globe, city, interior, chart  (une « scène » = un set)
  data/landmask.js    contours de continents simplifiés pour le globe en points
data/                 narration.json (voix off + chapitres), facts.json (faits et statut de vérification), sfx.json
scripts/              build, tts (Kokoro), music (synthèse), audio-tags, shoot/look/sheet (contrôle visuel)
assets/               polices (Poppins/Inter), audio (voix off, musique, effets), GSAP
```

**Déterminisme.** Tout l'état visuel est une fonction pure du temps `t` (pas de `Date.now`, de `Math.random` non seedé ni
de boucle libre) : Hyperframes peut sauter à n'importe quelle image et obtenir exactement les mêmes pixels.
La 3D passe par l'adaptateur Three.js de Hyperframes (`hf-seek`), le texte par une timeline GSAP en pause.

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
* **Musique** : originale, synthétisée par `scripts/music.py` (aucune banque externe).
* **Effets** : banque libre de droits Pixabay fournie avec Hyperframes (`assets/audio/sfx/CREDITS.md`).

## Couleurs

Rouge `#DA291C`, jaune `#FFC72C`, blanc et gris. Liaisons : gouvernance **blanc**, hiérarchie interne **rouge**,
relations contractuelles **jaune**, coordination **cyan** (seul accent hors palette, réservé aux liaisons).
