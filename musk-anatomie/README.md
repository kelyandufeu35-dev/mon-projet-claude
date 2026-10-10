# Elon Musk : anatomie d'une fortune

Documentaire de motion design **3D isométrique** (≈ 105 s, 16:9, 1920 × 1080, 30 fps) qui explique comment fonctionne
réellement la richesse d'Elon Musk : une immense maquette financière où chaque entreprise, chaque action et chaque
mécanisme (capitalisation, volatilité, liquidités, prêt garanti par des titres) devient visible.

Tout est fabriqué **dans ce projet, par code** avec [Hyperframes](https://github.com/heygen-com/hyperframes) :
géométries 3D (Three.js), animations, graphiques, voix off (synthèse locale Kokoro), musique et effets sonores.
Aucun générateur externe d'images, de vidéos ou de sons n'est utilisé.

| | |
|---|---|
| Moteur | Hyperframes 0.8.145 (compositions HTML, rendu image par image dans Chrome + FFmpeg) |
| 3D | Three.js 0.170 — vraie 3D, caméra orthographique isométrique, ombres portées |
| Voix | Kokoro‑82M en local (`kokoro-onnx`), voix française `ff_siwis` |
| Musique & effets | synthétisés en Python (numpy / scipy), mixés avec la voix |
| Sortie | `out/musk-anatomie.mp4` (H.264 + AAC) |

## Les 7 scènes

| # | Scène | Ce qu'on voit | Ce qu'on explique |
|---|---|---|---|
| 1 | Le mystère de sa fortune | pièce sombre, Musk sur son podium, compteur, billets qui se transforment en actions / immeubles / fusée / usine, plongée dans une action | l'ordre de grandeur de la fortune, daté et sourcé ; une estimation n'est pas un solde de compte |
| 2 | Tesla | Gigafactory qui se construit, grues, robots, voitures, mosaïque de 100 blocs d'actions | action, % détenu, capitalisation, formule *Nombre d'actions × Prix*, actions détenues / restreintes / options |
| 3 | SpaceX et IA | l'action devient une fusée, décollage, pas de tir, centre de données, Starlink, réseau de neurones | absorption de xAI (2 fév. 2026), cotation (12 juin 2026), pas de double comptage, valeur d'entreprise vs capitalisation vs part personnelle |
| 4 | Pourquoi sa fortune varie | Bourse, graphique géant en temps réel, blocs d'actions qui montent et descendent | exemple chiffré **hypothétique** : 100 M d'actions × 100 $ = 10 Md$ ; ± 10 % = ± 1 Md$ |
| 5 | Milliardaire ≠ argent liquide | banque qui se démonte, coffre qui s'ouvre, plateau d'actions + un petit tas de billets | patrimoine net, actions et participations, liquidités, dettes, plus‑values non réalisées, impôts et effet de marché d'une vente massive |
| 6 | Emprunter grâce à ses actions | portefeuille → coffre de garantie → banque → emprunteur, jauge, alarme | prêt garanti par des titres, intérêts, remboursement, **appel de marge** (mécanisme général, exemple hypothétique) |
| 7 | La structure complète | tous les districts reliés par des flux lumineux, légende, phrase finale, zoom de clôture | propriété, contrôle, valorisation, dettes, patrimoine net |

## Utiliser le projet

```bash
cd musk-anatomie
npm install                  # hyperframes, three, gsap, esbuild, polices locales
npm run build                # bundle + timeline + durée reportée dans index.html
npx hyperframes preview      # prévisualisation (Studio), ou : npm run dev
npx hyperframes check        # lint + runtime + mise en page + mouvement + contraste
npx hyperframes snapshot --at 20.5,52.5,95     # images clés PNG pour vérification
npm run render               # rendu MP4 -> out/musk-anatomie.mp4
```

Rendu 3D en logiciel (sans GPU) : ≈ 0,5 s par image côté 3D, **environ 1 h** pour les 3 162 images. Sur une machine avec
GPU, `hyperframes render` utilise l'accélération matérielle automatiquement.

Dans un conteneur sans Chrome géré par Hyperframes, pointer vers un Chromium *headless shell* existant :

```bash
export HYPERFRAMES_BROWSER_PATH=/chemin/vers/headless_shell
export PRODUCER_HEADLESS_SHELL_PATH=$HYPERFRAMES_BROWSER_PATH
export PRODUCER_PLAYER_READY_TIMEOUT_MS=120000     # compilation des shaders en logiciel
```

## Architecture

```
index.html                  composition racine (1920×1080, durée calculée par le build) + HUD + <audio>
src/main.js                 orchestration : monde 3D, caméra globale, ambiance, voiles, écoute de « hf-seek »
src/timing.js               table de timing unique, calée sur les durées réelles de la voix
src/core/                   moteur : World (rendu), Builder (géométrie fusionnée), palette, HUD, utilitaires
src/components/             bibliothèque réutilisable (voir ci‑dessous)
src/scenes/                 hub (scène 1 + centre du finale), tesla, spacex, bourse, bank (5 et 6), finale
src/cues.js                 signaux sonores calés sur les mêmes ancres que l'image
data/facts.json             chiffres, dates, sources, statut de vérification
narration/script.json       texte de la voix off
scripts/                    build, tts, mixage audio, captures de développement, benchmark
```

**Déterminisme.** Hyperframes envoie à chaque image un évènement `hf-seek` portant le temps exact. Toute la scène
(3D, caméra, HUD, compteurs) est une *fonction pure du temps* : pas d'horloge, graines fixes pour l'aléatoire, aucune
ressource distante. Le même instant donne toujours les mêmes pixels, en aperçu comme en rendu.

**Composants réutilisables** (`src/components/`) : personnages articulés (poses, marche, gesticulation), bâtiments
(Gigafactory, tour de lancement, hangar, centre de données, Bourse, banque, coffre‑fort), véhicules (flotte de voitures
instanciée, fusée avec flamme, satellites, robots, grues), objets financiers (certificats d'actions texturés, mosaïque
d'actionnariat, graphiques 3D, bandeau défilant, liasses, jauge), effets (flux lumineux animés par shader, morphing de
voxels, éclats, fumée).

**Performances.** Les surfaces mates utilisent des matériaux Lambert, seuls le métal / l'or / le verre sont en PBR, et
les lumières « émissives » sont des matériaux HDR sans éclairage : mesuré, cela divise le coût de rendu logiciel par ≈ 2.

## Voix off, musique, effets

```bash
# 1) voix (une fois) : modèle Kokoro depuis les releases GitHub de kokoro-onnx
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile numpy scipy
.venv/bin/python scripts/tts.py --models /chemin/vers/models --out assets/audio/narration --speed 1.18
# 2) musique + effets + mixage + AAC normalisé (-16 LUFS)
PYTHON=.venv/bin/python npm run audio
```

Les WAV de la narration sont versionnés : le projet se rend sans Kokoro. Mesures du mixage final : −15,6 LUFS
intégrés, crête vraie −1,1 dBTP. Le mixage a été contrôlé par mesure (loudness, niveaux par tranche), **pas à l'oreille** :
une écoute humaine reste recommandée avant diffusion.

## Données, dates et sources — lire avant de citer un chiffre

Chaque chiffre affiché a une date et une source ; aucune estimation n'est présentée comme un montant certain.
`data/facts.json` porte, pour chaque valeur, un **statut de vérification** :

* `search_summary` : relevé dans le résumé d'une recherche web citant la source indiquée ;
* `conflicting` : plusieurs sources divergent, la vidéo affiche une fourchette ou un ordre de grandeur ;
* `not_found` : aucune donnée fiable, la vidéo l'écrit au lieu d'inventer.

**Limite importante.** Depuis l'environnement de production, la politique réseau refusait l'accès direct aux six sources
prioritaires (Forbes, Bloomberg, Tesla IR, SEC EDGAR, SpaceX, x.ai). Aucune page primaire n'a donc pu être ouverte :
les chiffres viennent de résumés de recherche web qui citent ces sources, et doivent être **revérifiés sur les pages
primaires** avant diffusion. Les valeurs de `facts.json` sont à rafraîchir à la date de publication.

| Donnée affichée | Valeur | Date | Source citée | Statut | Où dans la vidéo |
|---|---|---|---|---|---|
| Patrimoine net (Forbes) | ≈ 1 004 Md$ | 10/10/2026 | Forbes, profil Elon Musk | search_summary | sc. 1 (compteur, carte), sc. 7 |
| Patrimoine net (Bloomberg) | ≈ 1 040 Md$ | 05/10/2026 | Bloomberg Billionaires Index | search_summary | sc. 1, sc. 7 |
| Variation en une séance | +61 Md$ | 02/10/2026 | Forbes | search_summary | sc. 4 |
| Part de Tesla | ≈ 11 % (hors actions restreintes) | oct. 2026 | profil Forbes ; autres estimations : 13 %, 20,3 % avec options | conflicting | sc. 2, 7, voix |
| Actions restreintes (plan 2025) | 423,7 M | 2026 | Tesla 10‑K/A | search_summary | sc. 2 |
| Options plan 2018 | 303,96 M exercées à 23,34 $ | juin 2026 | Form 4 / 10‑K/A | search_summary | sc. 2 |
| Fusion SpaceX–xAI | clôturée le 2 fév. 2026, 100 % actions, ratio 0,1433 ; xAI filiale à 100 % | 02/02/2026 | CNBC ; S‑1/A SpaceX | search_summary | sc. 3, voix |
| Renommage « SpaceXAI » | juil. 2026 | — | source unique | search_summary | sc. 3 (signalé « source unique ») |
| Cotation SpaceX | Nasdaq : SPCX, 135 $, ≈ 75 Md$ levés | 11–12/06/2026 | presse, S‑1/A | search_summary | sc. 3 |
| Part de SpaceX | ≈ 38 à 42 % du capital ; ≈ 82 % des voix | oct. 2026 ; S‑1/A du 03/06/2026 | Forbes ; S‑1/A | conflicting | sc. 3, 7 |
| Actions Tesla nanties | ≈ 236 M sur ≈ 715 M ; plafond de prêt 3,5 Md$ | 29/08/2025 | Tesla, proxy 2025 | search_summary | sc. 7 |
| Prêts effectivement contractés | non publiés | — | — | not_found | sc. 7 (écrit tel quel) |
| Liquidités personnelles | aucun chiffre fiable | — | — | not_found | sc. 5, 7 (écrit tel quel) |
| Autres participations | Neuralink, The Boring Co. : non chiffrées | — | — | not_found | sc. 7 |
| Capitalisation Tesla / SpaceX actuelles | non affichées (sources contradictoires) | — | — | conflicting | exemple hypothétique à la place |

Les exemples des scènes 4 et 6 (100 M d'actions × 100 $, prêt = 25 % de la valeur, chute à 62) sont **inventés** et
présentés comme tels à l'écran. La scène 6 décrit un mécanisme général : aucune opération particulière n'est présentée
comme un fait. Le personnage « Musk » est une figurine stylisée, sans logo ni ressemblance recherchée.

Seuls le compteur d'ouverture, la carte « source » de la scène 1 et la carte « patrimoine net » de la scène 7 lisent
`data/facts.json` ; les autres textes sont écrits dans `src/scenes/*.js` (voir la colonne « Où dans la vidéo »).

## Licences des composants

Hyperframes (Apache‑2.0), Three.js (MIT), GSAP (licence GSAP standard, gratuite), polices Inter / Space Grotesk /
JetBrains Mono (SIL OFL, via @fontsource), `kokoro-onnx` et modèle Kokoro‑82M (voir leurs dépôts).
