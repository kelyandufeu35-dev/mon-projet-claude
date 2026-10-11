# Documentaire NVIDIA — scène pilote

Production d'un documentaire à l'image photoréaliste et futuriste, rendu avec **Hyperframes**
(compositions HTML → MP4). Ce dossier contient le moteur de rendu, la scène pilote
(GPU → centre de données) et les outils de développement.

> **Statut.** Scène pilote de référence (≈ 32 s). Elle sert de standard visuel pour la suite du
> documentaire. Voir « Ce que ce rendu est — et n'est pas » avant de la juger.

## Ce que ce rendu est — et n'est pas

Vérifié dans l'environnement réel (Hyperframes 0.8.145, Chrome Headless Shell 152, WebGL2) :

| Sujet | Réalité |
|---|---|
| Moteur | Hyperframes : chaque image est une page HTML « cherchée » à l'instant `t`, capturée dans Chrome puis encodée par FFmpeg. La scène 3D est un canevas WebGL2 (Three.js) piloté par l'évènement `hf-seek`. |
| Technique de rendu | **Rastérisation** WebGL2 : matériaux PBR, éclairage par image (IBL), lumières analytiques, ombres par shadow maps, accumulation temporelle HDR. **Ce n'est ni du ray tracing, ni du path tracing.** |
| Réflexions de salle | Environnement calculé à partir de la géométrie réelle de la salle ; sol à réflexion de Fresnel avec copies miroir des sources. Pas de réflexions de scène complète (pas de SSR). |
| Flou de mouvement / profondeur de champ | Réels (accumulation de sous-échantillons dans l'obturateur et sur la pupille), pas un filtre de post-traitement. Qualité bornée par le nombre de sous-échantillons. |
| Personnages | Aucun dans la scène pilote (voir « Suite »). Pas de visages animés : non crédibles avec ces outils. |
| Caractéristiques techniques | Aucune valeur chiffrée n'est présentée comme exacte. Le GPU est un module d'accélérateur **générique**. |
| Marque | Le mot « NVIDIA » est composé en texte. Le logo n'est pas reproduit. |

### Rendu logiciel vs GPU

Le conteneur de développement n'a **pas de GPU** : Chrome utilise SwiftShader (WebGL sur CPU). Cela
suffit pour produire la référence, mais c'est lent. Sur une machine à GPU NVIDIA, la même
composition se rend avec `--browser-gpu`, bien plus vite, ce qui permet 4K et 60 i/s (voir plus bas).

## Structure

```
engine/          moteur de rendu réutilisable pour tout le documentaire
  pipeline.js    rendu HDR + accumulation temporelle (AA, flou de mouvement, profondeur de champ),
                 bloom, tonemapping neutre, étalonnage, grain
  env.js         éclairage IBL (studio, géométrie de salle)
  materials.js   fabrique de matériaux PBR (convention ORM partagée)
  textures.js    textures procédurales déterministes (substrat, silicium, métal brossé, baies, sol…)
  patches.js     correctifs de performance du rendu logiciel (mesurés)
  shaders.js     extensions de shader : LED clignotantes, impulsions, ouverture de puce, ambiance, miroir
  camera.js      optique physique (focale, ouverture, mise au point), rail de caméra, pistes de valeurs
  gpu.js board.js arch.js hall.js   objets : package GPU, plateau serveur, architecture interne, salle
pilot/           projet Hyperframes de la scène pilote
  index.html     composition (canevas WebGL + interface + son)
  src/           world.js (scène + chorégraphie), hud.js (légendes), main.js (liaison hf-seek)
  assets/ audio/ son synthétisé (script déterministe)
tools/           outils de développement (images fixes, sonde)
```

## Commandes

```bash
npm install
npm run build            # empaquette la scène (pilot/scene.js)
npm run check            # lint Hyperframes (+ contrôles du runtime)
npm run render:draft     # brouillon rapide (basse définition, peu d'échantillons)
npm run render:final     # 1080p24, qualité maximale d'encodage
```

Variables de rendu (`--variables '{"samples":12,"scale":1,"fps":24}'`) :
`samples` = sous-échantillons par image, `scale` = résolution interne (2 = 3840×2160),
`fps` = cadence de l'obturateur (180°), `timeOffset` = décalage de lecture (tests).

### Sur une machine à GPU (4K, 60 i/s)

```bash
cd pilot
npx hyperframes render --browser-gpu --gpu --fps 60 --quality delivery \
  --variables '{"samples":16,"scale":2,"fps":60}' -o renders/pilot-4k60.mp4
```

## Déterminisme

Aucun `Math.random()`, aucune horloge murale : chaque image est une fonction pure du temps. Textures
procédurales à graine fixe, LED et impulsions pilotées par `t`. Même entrée, mêmes images.
