# Documentaire NVIDIA — scène pilote

Production d'un documentaire à l'image photoréaliste et futuriste, rendu avec **Hyperframes**
(compositions HTML → MP4). Ce dossier contient le moteur de rendu, la scène pilote
(GPU → centre de données) et les outils de développement.

> **Statut.** Scène pilote de référence rendue (32 s, 1920×1080, 24 i/s, son). Elle sert de standard visuel pour la
> suite du documentaire. Lire « Ce que ce rendu est — et n'est pas » avant de la juger. Images de référence :
> `docs/reference/`.

## La scène pilote

Un seul mouvement de caméra relie l'infiniment petit à l'infiniment grand :

| Temps | Plan |
|---|---|
| 0 – 8 s | **Macro** : orbite autour d'un module accélérateur *générique* (substrat, interposeur silicium, puce de calcul, six piles mémoire HBM, condensateurs de découplage, cadre de renfort). La lumière glisse en dégradé sur le silicium. |
| 8 – 15 s | **Plongée** : la face supérieure s'ouvre par un disque lumineux, la caméra entre dans l'architecture de calcul (tuiles, bus de données, impulsions vertes), optique « sonde ». |
| 15 – 20 s | **Sortie** : éclat de lumière, remontée par l'ouverture, plan de dessus du module et des radiateurs voisins. |
| 20 – 26 s | **Recul** : plateau serveur sorti de sa baie, puis l'allée de la salle de données. |
| 26 – 32 s | **Plan large** : allée froide symétrique, reflets des rampes LED dans le sol, titre. |

Légendes holographiques sobres (qualitatives, aucun chiffre) ; son synthétisé (nappe grave, air de salle,
ventilateurs, impulsions de données, impact à la sortie, accord de clôture).

## Ce que ce rendu est — et n'est pas

Vérifié dans l'environnement réel (Hyperframes 0.8.145, Chrome Headless Shell 152, WebGL2) :

| Sujet | Réalité |
|---|---|
| Moteur | Hyperframes : chaque image est une page HTML « cherchée » à l'instant `t`, capturée dans Chrome puis encodée par FFmpeg. La scène 3D est un canevas WebGL2 (Three.js) piloté par l'évènement `hf-seek`. |
| Technique | **Rastérisation** WebGL2 : matériaux PBR, éclairage par image (IBL), lumières analytiques, ombres par shadow maps, accumulation temporelle HDR. **Ni ray tracing, ni path tracing.** |
| Réflexions | Environnement IBL calculé à partir de la géométrie de la salle ; sol à réflexion de Fresnel avec copies miroir des sources lumineuses. Pas de réflexions de scène complète (pas de SSR). |
| Flou de mouvement, profondeur de champ | Réels (accumulation de sous-échantillons dans l'obturateur et sur la pupille), pas un filtre. Leur douceur est bornée par le nombre de sous-échantillons ; les ouvertures sont donc fermées (f/11–f/16). L'obturateur et le nombre de sous-échantillons s'adaptent à la vitesse apparente de la caméra (voir `docs/PERFORMANCE.md`) : dans les mouvements les plus rapides, l'obturateur est raccourci (jusqu'à ~15° en macro/sortie) plutôt que de laisser apparaître des copies translucides. |
| Photoréalisme | **Rendu CGI soigné, pas indiscernable d'une prise de vue réelle.** Les matériaux, la lumière et la caméra sont crédibles ; les textures sont procédurales et la géométrie reste stylisée (le plateau serveur est moins détaillé que le module). |
| Personnages | Aucun dans la pilote : des visages animés crédibles ne sont pas réalisables avec ces outils. |
| Caractéristiques techniques | Aucune valeur chiffrée n'est présentée comme exacte. Le GPU est un module d'accélérateur **générique**. |
| Marque | Le mot « NVIDIA » est composé en texte ; le logo n'est pas reproduit. |
| Son | Synthétisé et mesuré (−21,7 LUFS, pic −3 dBFS). Il n'a pas pu être écouté dans cet environnement. |

### Rendu logiciel vs GPU

Le conteneur de développement n'a **pas de GPU** : Chrome utilise SwiftShader (WebGL sur CPU) et sature
les 4 cœurs. Cela suffit pour produire la référence, mais lentement (voir `docs/PERFORMANCE.md`). Sur une
machine à GPU NVIDIA, la même composition se rend avec `--browser-gpu`, bien plus vite, ce qui rend 4K et
60 i/s réalistes (commande plus bas). Le 60 i/s n'a **pas** été rendu ici ; 24 i/s avec obturateur à 180° est la
cadence cinéma retenue.

## Structure

```
engine/          moteur de rendu réutilisable pour tout le documentaire
  pipeline.js    rendu HDR + accumulation temporelle (AA, flou de mouvement, profondeur de champ),
                 bloom, tonemapping neutre, étalonnage, grain, flash
  env.js         éclairage IBL (studio, géométrie de salle)
  materials.js   fabrique de matériaux PBR (convention ORM partagée)
  textures.js    textures procédurales déterministes (substrat, silicium, métal brossé, baies, sol, châssis…)
  patches.js     correctifs de performance du rendu logiciel (mesurés)
  shaders.js     extensions de shader : LED clignotantes, impulsions, ouverture de puce, ambiance, miroir
  camera.js      optique physique (focale, ouverture, mise au point), rail de caméra, pistes de valeurs
  gpu.js board.js arch.js hall.js   objets : package GPU, plateau serveur, architecture interne, salle
pilot/           projet Hyperframes de la scène pilote
  index.html     composition (canevas WebGL + interface + son)
  src/           world.js (scène + chorégraphie), hud.js (légendes), main.js (liaison hf-seek)
  audio/         script de synthèse du son (déterministe)
tools/           rendu par tranches, images fixes de développement, sonde
docs/            mesures de performance et pièges rencontrés
```

## Commandes

```bash
npm install
npm run build            # empaquette la scène (pilot/scene.js)
npm run render:draft     # validation rapide : 960×540 internes, 2 sous-échantillons (~30 min sur CPU)
npm run render:final     # 1920×1080, 5 sous-échantillons de base, qualité d'encodage maximale (plusieurs heures sur CPU)
```

```bash
node tools/motion-profile.mjs --from 0 --to 32   # profil de mouvement : vitesse, obturateur et N par image (sans rendu)
```

Le rendu est découpé en tranches de 4 s (`tools/render-chunks.mjs`), chacune étant un vrai rendu
Hyperframes ; il est **reprenable** (les tranches valides sont ignorées) et le son est mixé à l'assemblage.

Variables de composition (`--variables '{"samples":12,"scale":1,"fps":24}'`) : `samples` = sous-échantillons
de base par image (le calendrier de `world.js` les module : 100 % en macro, 40–60 % ensuite), `scale` =
résolution interne (2 = 3840×2160), `fps` = cadence de l'obturateur (180°), `timeOffset` = décalage de lecture.

Mesuré dans le conteneur sans GPU (4 cœurs, SwiftShader) pour la version finale : ~10 à 45 min par tranche de 4 s
(macro et plongée ≈ 20 min ; sortie de la puce et plateau serveur ≈ 30–45 min, jusqu'à 10 sous-échantillons par
image), soit environ 4 h de calcul pour les 32 s. Hyperframes interrompt une capture dont une image dépasse 60 s :
`tools/render-chunks.mjs` relève ce délai (`HF_DE_STALL_MS`).

### Sur une machine à GPU (4K, 60 i/s)

```bash
npm run render:gpu-4k60
# équivalent : cd pilot && npx hyperframes render --browser-gpu --gpu --fps 60 --quality delivery \
#   --variables '{"samples":12,"scale":2,"fps":60}' -o renders/pilot-4k60.mp4
```

### Contrôle `hyperframes check`

Le lint (`0 erreur, 0 avertissement`) passe. L'étape « runtime » de `hyperframes check` échoue **dans ce
conteneur** (sa sonde WebGL ne reconnaît pas SwiftShader), alors que `hyperframes render` fonctionne : la
validation a été faite par des rendus réels (extrait de 2 s, puis film complet, voir plus haut).

## Déterminisme

Aucun `Math.random()`, aucune horloge murale : chaque image est une fonction pure du temps. Textures
procédurales à graine fixe, LED et impulsions pilotées par `t`. Même entrée, mêmes images.

## Limites connues

- Le plateau serveur et la salle sont moins détaillés que le module macro ; les baies utilisent des
  textures de façade répétées (3 variantes).
- Le sol et les baies sont éclairés par une ambiance « cuite » (périodique sous chaque rampe LED) et non par
  de vraies lumières : excellent coût/qualité, mais pas de lumière locale dynamique dans l'allée.
- Profondeur de champ volontairement modérée (voir plus haut) ; pas de bokeh très prononcé.
- 24 i/s : mouvements de caméra lents pour limiter les saccades ; le 60 i/s demande un GPU.
- Les micro-billes entre la puce et les piles mémoire (4–8 s) sont une trame très fine : à pleine résolution elle
  présente un léger moiré/scintillement. Acceptable à l'échelle du cadre, à retravailler (texture filtrée) pour la suite.
- Aucun humain, aucun robot, aucune séquence « économie » ni « fabrication » dans la pilote.

## Suite proposée

Mêmes moteur, optique, éclairage et étalonnage que la pilote. Cadrage de la production confirmé par le
commanditaire : **voix off masculine, diffusion TikTok, durée courte (≈ 45–60 s, un peu plus si utile), logo autorisé**.

0. **Version TikTok** (script rédigé dans `tiktok/script.md`, narration dans `tiktok/narration.json`, voix Kokoro via `npm run voice`) : composition verticale 9:16 (1080×1920, même coût en pixels que 1080p), accroche dans les
   2 premières secondes, plans courts, sous-titres incrustés synchronisés avec la voix off, logo fourni par le
   commanditaire (fichier officiel).
   La pilote 16:9 reste la référence de qualité.

1. **Fabrication** : wafers de silicium, bras robotisés, salle blanche (géométrie procédurale à produire).
2. **Économie** : bâtiments instanciés, flux lumineux (`addWirePulse` sur des courbes), panneaux
   holographiques en DOM alimentés par des données **sourcées** à fournir.
3. **Finale** : sortie de la salle, mégastructure, réseau mondial d'infrastructures.
4. **Humains** : silhouettes de dos, mains et équipements, plutôt que des visages animés.
