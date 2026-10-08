# NEXALOG — publicité 3D isométrique (Hyperframes)

Film publicitaire de 56 s (1920×1080, 30 i/s) pour une grande plateforme de distribution et de logistique fictive, **NEXALOG**.
Tout est réalisé avec **Hyperframes** : composition HTML, rendu image par image, synthèse vocale Kokoro (`hyperframes tts`) et mixage audio.

## Parcours

| Temps | Séquence |
| --- | --- |
| 0 – 6,5 s | Vue aérienne : le complexe se construit, camions sur les routes, drone, titre **NEXALOG** |
| 6,5 – 10,5 s | Zoom vers le hall, le toit se soulève panneau par panneau, les murs s’abaissent |
| 10,6 – 18,9 s | **01 Réception** : camions en marche arrière, quais, robots AGV, palettes |
| 19,9 – 27,7 s | **02 Stockage automatisé** : navettes autonomes, racks, caméra qui pivote le long des allées |
| 28,5 – 35,7 s | **03 Tri intelligent** : convoyeurs, portiques de scan, déviateurs, bacs |
| 36,4 – 43,7 s | **04 Préparation** : bras robotisés, conditionnement, étiquetage |
| 44,4 – 51,0 s | **05 Expédition** : chargement automatique, départ des camions vers le magasin |
| 52,2 – 56 s | Plan large, le toit se referme, logo et signature |

Un produit « héros » (lueur orange, étiquette de suivi) traverse les cinq étapes du début à la fin.

## Architecture

- `index.html` : composition racine (canvas + surcouche HTML/GSAP + pistes audio).
- `js/engine.js` : moteur isométrique maison (projection orthographique, tri en profondeur, éclairage par face, glows).
- `js/world.js` : site, hall, murs, toit en panneaux, environnement.
- `js/actors1.js` : racks, convoyeurs, colis, scanners, déviateurs.
- `js/actors2.js` : camions, AGV, déchargement, navettes de stockage.
- `js/actors3.js` : bras robotisés, expédition, ouvriers, trafic, drone, produit héros.
- `js/story.js` : caméra (jalons Catmull-Rom), construction, toit, boucle de rendu `renderAt(t)`.
- `js/hud.js` : titres, cartes d’étapes, compteurs, suivi produit, bulles d’équipement.
- `tools/make_audio.py` : musique, effets sonores et voix off synchronisés (voix issues de `hyperframes tts -v ff_siwis`).
- `assets/vo/*.txt` : texte de la voix off ; `assets/*.wav` : pistes audio.

Chaque image est une fonction pure du temps (`hf-seek`), donc le rendu est déterministe.

## Commandes

```bash
npm run check     # lint + runtime + mise en page + contraste
npm run dev       # prévisualisation dans le studio
npm run render    # rendu MP4 (renders/)
```

## Remplacer la voix off

Remplacez `assets/voiceover.wav` par votre enregistrement (Flora, Google, voix humaine) de 56 s calé sur la timeline,
ou relancez `python3 tools/make_audio.py` après avoir régénéré les segments `assets/vo/v*.wav`.
