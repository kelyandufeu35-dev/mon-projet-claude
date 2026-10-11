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

## Conséquence sur les choix de production

- Le rendu logiciel produit la référence, mais lentement. La même composition se rend bien plus vite sur
  un GPU : `--browser-gpu` (voir README).
- La qualité du flou de profondeur de champ dépend du nombre de sous-échantillons : on garde donc les
  ouvertures fermées (f/11–f/16) et une optique « sonde » (quasi sténopé) à l'intérieur de la puce.
