# Performance du rendu logiciel — mesures

Environnement de mesure : conteneur 4 cœurs, sans GPU. Chrome Headless Shell 152, WebGL2 via ANGLE /
SwiftShader (rendu sur CPU). Toutes les durées sont des mesures réelles, synchronisées par `readPixels`.

## Ce qui coûte (1 sous-échantillon, 1280×720, scène PBR de test)

| Élément | Durée |
|---|---|
| Matériau basique (sans éclairage) | ~130 ms |
| PBR standard, sans environnement ni lumière | ~150 ms |
| + 1 spot sans ombre | ~230 ms |
| + 1 spot avec ombres PCF doux | ~410 ms |
| + environnement IBL (cubeUV, par défaut Three r170) | **~800–900 ms** |
| + environnement IBL, lecture `texture2D` (`engine/patches.js`) | **~420 ms** |
| MSAA ×4 sur la cible HDR | ×2,5 (moins avantageux que l'accumulation) |
| Demi-résolution | ×0,5 environ (coût ∝ pixels) |

Constats :

- SwiftShader sature déjà les 4 cœurs : lancer plusieurs *workers* Hyperframes n'apporte rien.
- Le coût dominant est l'ombrage par pixel (IBL, lumières, ombres), pas la géométrie.
- Le format de texture d'environnement (RGBA16F ou RGBM 8 bits) n'a pas d'influence ; c'est
  `texture2DGradEXT` qui était lent. Le remplacer par `texture2D` ne change pas l'image (pas de mipmaps).
- Chaque lumière active est payée par pixel, même d'intensité nulle : n'activer que les lumières utiles
  à l'instant `t` (voir `world.js`).
- Une lecture de texture plein écran coûte ~70 ms à 720p : partager une texture ORM
  (occlusion/rugosité/métal) économise deux lectures par pixel.

## Pièges rencontrés (corrigés)

- `scene.background` défini à une couleur ⇒ Three efface couleur **et profondeur** à chaque `render()`,
  même avec `autoClear = false`. Le pré-passage de profondeur était donc annulé. Ne pas définir de fond.
- `lookAt` est instable quand la visée est presque parallèle au vecteur « haut » (plans à la verticale) :
  chaque échantillon de pupille obtenait un roulis différent. Le pipeline re-pointe par rotation minimale
  et le rail de caméra accepte un vecteur « haut » par image-clé.
- `material.envMapRotation` : Three nie chaque angle d'Euler ; ce n'est l'inverse de la rotation voulue
  que pour un seul axe. Pour une rotation 3D générale, calculer l'Euler de l'inverse puis nier ses angles.

## Flou de mouvement : copies translucides (« fantômes »)

Le flou de mouvement est une accumulation de N images prises à des instants répartis dans l'ouverture de
l'obturateur. Si le contour d'un objet se déplace de plus de quelques pixels entre deux sous-échantillons,
on ne voit pas un flou continu mais N copies translucides distinctes (arêtes d'ailettes, vis, perforations
d'un châssis qui se dédoublent ou se détriplent).

- L'écart entre copies = déplacement apparent pendant l'obturateur ÷ (N − 1).
- Le déplacement apparent en pixels dépend de l'échelle : à quelques millimètres du sujet (macro, plongée,
  sortie de la puce), la caméra balaie des milliers de pixels par seconde, même à vitesse lente en mètres.
- Un contrôle visuel sur des images réduites ne suffit pas : les copies ne sont nettes qu'à la résolution native.

`world.js` dimensionne donc l'obturateur et le nombre de sous-échantillons **à partir de la vitesse apparente**
(`motionPx` : projection de points de la vue, à trois profondeurs, aux deux bornes de l'obturateur) :

- `shutterFor(t, fps, base)` : obturateur de la piste (180° par défaut), raccourci quand le budget d'échantillons
  ne suffirait pas ;
- `samplesFor(t, base, fps)` : N = déplacement / 6 px + 1, borné à 2 × `base` ;
- `node tools/motion-profile.mjs` affiche, sans rendu, le profil image par image (vitesse, obturateur, N).

Les tranches de la pilote ont été rendues avec ces réglages (`base` = 5, écart toléré 6 px sur 1920 de large).
Les vitesses sont mesurées sur 1920 px de large quelle que soit la résolution interne ; à 4K les détails sont
plus fins et les copies plus visibles : abaisser `GHOST_PX` (donc augmenter N) pour un rendu 4K.

## Conséquence sur les choix de production

- Le rendu logiciel produit la référence, mais lentement. La même composition se rend bien plus vite sur
  un GPU : `--browser-gpu` (voir README).
- La qualité du flou de profondeur de champ dépend du nombre de sous-échantillons : on garde donc les
  ouvertures fermées (f/11–f/16) et une optique « sonde » (quasi sténopé) à l'intérieur de la puce.

## Garde-fou de capture d'Hyperframes

Hyperframes interrompt un rendu si **aucune image n'avance pendant 60 s** (« capture stalled: no frame progress »).
Avec 10 sous-échantillons ou plus à 1080p en rendu logiciel, une seule image dépasse cette durée : la tranche
est alors perdue (plus d'une heure de calcul dans notre cas). Relever le délai par la variable d'environnement
`HF_DE_STALL_MS` (en ms) ; `tools/render-chunks.mjs` la fixe à 20 minutes.
