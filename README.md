# Projets

Ce dépôt contient deux sites indépendants :

| Dossier | Projet |
| --- | --- |
| `/` (racine) | **NEXUS** : site vitrine immersif en 3D (décrit ci-dessous) |
| [`boutique/`](boutique/) | **Pattoune** : boutique en ligne mono-produit pour un jouet chien et chat, prête pour le dropshipping. Mode d’emploi complet dans [`boutique/GUIDE.md`](boutique/GUIDE.md) |

---

# NEXUS — cœur énergétique

Site immersif d'un laboratoire fictif. Le scroll raconte en cinq séquences la découverte, l'assemblage et l'activation d'un cœur énergétique modélisé entièrement en géométrie procédurale (React, TypeScript, Three.js, React Three Fiber).

## Lancer le projet

```bash
npm install
npm run dev        # http://localhost:5173
```

Production :

```bash
npm run build      # vérification TypeScript + build Vite dans dist/
npm run preview    # http://localhost:4173
```

### Paramètres d'URL utiles

| Paramètre | Effet |
| --- | --- |
| `?quality=high\|medium\|low` | force un niveau de qualité (sinon détection automatique) |
| `?nowebgl` | affiche la présentation statique de secours |
| `?debug` | expose `window.__nexus.frame` (i/s, DPR, appels de dessin, coût CPU) en production |

## Organisation

```
src/
  lib/        timeline au scroll (splines monotones), store, détection qualité, contenus
  scene/      Canvas R3F, objet procédural, shaders, post-traitement
  ui/         navigation, repères, fiches, mode exploration, formulaire, fallback SVG
```

- `src/lib/timeline.ts` : toutes les pistes animées (caméra, écartement, énergie, onde, halo) en fonction de la position 0–5 dans la page. L'état de la scène se déduit uniquement de cette position : remonter la page ou changer de sens ramène toujours à une pose cohérente.
- `src/scene/NexusCore.ts` : le cœur (noyau, verre, anneaux, 12 pétales instanciés, couronnes, injecteurs) et la vue éclatée.
- `src/scene/materials.ts` : shader du noyau, verre, particules, sol, et onde d'activation injectée dans les matériaux PBR.

## Accessibilité et repli

- Tout le texte est du HTML réel, lisible sans WebGL ni animation.
- `prefers-reduced-motion` coupe l'intro, l'inertie, la rotation au repos et les impulsions. Le bouton « Animations » permet aussi de les couper ou de les rétablir à la main.
- Sans WebGL (ou si le contexte GPU est perdu), une illustration SVG statique remplace la scène.
- Les repères 3D sont des boutons accessibles au clavier ; la liste des composants offre le même accès.
- Le formulaire de démonstration valide les champs localement. Aucune donnée n'est envoyée.
