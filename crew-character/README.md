# Équipier 3D — personnage isométrique procédural (Hyperframes + Three.js)

Un petit employé de restaurant (uniforme rouge et jaune, casquette) **construit entièrement en code** :
aucune image, aucun modèle 3D, aucun générateur externe. Formes, matériaux, squelette, visage et animations
sont programmatiques ; le rendu vidéo passe par Hyperframes (adaptateur `three`, événement `hf-seek`).

> Création indépendante, non affiliée à McDonald's. Le « M » et l'uniforme sont des évocations stylisées, non officielles.

## Lancer

```bash
npm install            # three + esbuild (uniquement pour reconstruire les bundles)
npm run build          # dist/video.js (vidéo) + dist/interactive.js (démo)
npm run preview        # Hyperframes Studio : la vidéo de démonstration (index.html)
npm run render         # renders/equipier-3d.mp4 (1920×1080, 30 i/s)
open demo.html         # démo interactive autonome (boutons, curseurs, caméra)
node tools/inline.mjs  # dist/equipier-3d.html : démo en un seul fichier
```

## Réutiliser le personnage dans une autre scène

```js
import { Crew } from "./src/character/crew.js";

const crew = new Crew({ name: "LÉO" });         // le badge nominatif est paramétrable
scene.add(crew.object);
crew.setPosition(1.5, 0, -0.5).setScale(1.2).setYaw(Math.PI / 4);   // position, échelle, orientation

crew.play("idle",  { at: 0 });
crew.play("wave",  { at: 2.0, opts: { hand: "R" } });                // un salut de 3 s
crew.play("walk",  { at: 5.5 });                                     // fondu automatique entre animations
crew.play("carry", { at: 9.0, opts: { moving: true } });
crew.setMotion((t) => ({ x: 0.6 * t, z: 0, yaw: Math.PI / 2 }));    // déplacement (pas = vitesse de marche)

function frame(t) { crew.update(t); renderer.render(scene, camera); } // l'état est une fonction pure de t
```

Animations : `idle`, `walk`, `wave`, `carry`, `work`, `happy` (`src/character/anims.js`).
Chaque animation renvoie une *pose* (structure de nombres) : elles se mélangent donc image par image,
ce qui donne des transitions naturelles. `speed` règle la vitesse d'un segment.

## Organisation

| Dossier | Rôle |
| --- | --- |
| `src/character/` | `rig.js` (squelette + maillages), `face.js` (yeux, paupières, sourcils, bouche dynamique), `hand.js` (doigts articulés), `pose.js` (poses, IK des bras et des jambes), `anims.js`, `crew.js` (file d'animations, ombres de contact) |
| `src/props/` | plateau, burger (pain, steak, fromage, salade, tomate), frites, boisson, comptoirs, planning du geste « Work » |
| `src/stage/` | rendu, caméra isométrique orthographique (35,264°), lumières douces, diorama |
| `src/demo/` | `story.js` (scénario de la vidéo), `video.js` (entrée Hyperframes), `interactive.js` (commandes), `lab.js` (banc d'essai) |
| `tools/` | `make_audio.py` (musique + bruitages calculés), `inline.mjs` (page autonome) |

## Détails techniques

- **Marche** : cinématique inverse planaire des jambes ; le pied d'appui recule exactement à la vitesse du corps (pas de glissement).
- **Bras** : IK à deux segments (portage du plateau, saisie des ingrédients) ; orientation de la paume contrôlée.
- **Visage** : paupières sphériques, regard orientable, bouche reconstruite à chaque image (sourire, bouche ouverte, dents, langue).
- **Déterminisme** : aucune horloge réelle, aucune graine aléatoire non fixée → rendu identique image par image.
