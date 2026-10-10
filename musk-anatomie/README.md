# Elon Musk : anatomie d'une fortune

Documentaire de motion design **3D isométrique** (30 fps ; **16:9** 1920 × 1080 et **9:16** 1080 × 1920 pour
TikTok / Reels / Shorts ; **français** 103,5 s et **anglais** 112,4 s) qui explique comment fonctionne
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
| Sortie | `exports/musk-anatomie-1080p.mp4` (16:9, 33 Mo) et `exports/musk-anatomie-tiktok.mp4` (9:16, 30 Mo), H.264 CRF 26 + AAC ; masters CRF 16 (≈ 180 Mo chacun) non versionnés : `out/musk-anatomie.mp4`, `out/musk-anatomie-tiktok.mp4` |

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
npm run render               # rendu MP4 16:9 -> out/musk-anatomie.mp4 (master)
npm run render:tiktok        # rendu MP4 9:16 -> out/musk-anatomie-tiktok.mp4 (master vertical)
ffmpeg -i out/musk-anatomie.mp4 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -c:a copy exports/musk-anatomie-1080p.mp4
```

Contrôles réalisés sur les deux masters (version à la voix corrigée) : 30 fps, 3 105 images, 103,5 s ; aucune image
figée ; seules images noires = fondus d'entrée et de sortie (0,2 s / 0,4 s en vertical) ; audio −16,0 LUFS intégrés,
crête −1,5 dBFS. Rendu logiciel : 34 min (16:9) et 31 min (9:16).

### Version verticale (TikTok, 9:16)

`tiktok/` est un **mini-projet Hyperframes généré** par `npm run build` à partir de `index.html` (non versionné, ne pas
l'éditer à la main : un projet Hyperframes n'admet qu'un seul `index.html` racine, d'où le dossier séparé). Il charge la
même scène 3D avec `window.MUSK_FORMAT = "portrait"` : la caméra garde la largeur visible du plan 16:9 (divisée par un
facteur de recadrage animé), les cartes d'information sont empilées automatiquement dans les zones haute et basse du
cadre (`hud.layoutPortrait()`), et les sous-titres sont agrandis (`src/portrait.css`). La voix, la musique et le
minutage sont ceux de la version horizontale.

```bash
npm run lint:tiktok      # hyperframes lint sur tiktok/
npm run check:tiktok     # contrôles officiels (mise en page, contraste, mouvement) sur tiktok/
npm run dev:tiktok       # prévisualisation du format vertical
npm run render:tiktok    # rendu MP4 9:16 -> out/musk-anatomie-tiktok.mp4
```

### Version anglaise (EN)

Même film, mêmes figures, **texte à l'écran, sous-titres, voix off et sons recalés en anglais**. La langue est choisie par
la page (`window.MUSK_LANG = "en"`, posé par le build) : dans le code, chaque texte est écrit en deux versions côte à côte,
`ln("français", "english")` (`src/core/lang.js`), y compris les ancres de synchronisation sur la voix
(`when("s2b", ln("onze pour cent", "eleven percent"))`) ; les nombres et dates suivent la langue (`1 004 Md$` → `$1,004B`,
`10 oct. 2026` → `Oct 10, 2026`). Les quatre variantes sont générées par `npm run build` :

| dossier | format | langue | voix / mixage |
|---|---|---|---|
| *(racine)* | 16:9 | français | `assets/audio/mix.m4a` |
| `tiktok/` | 9:16 | français | idem |
| `en/` | 16:9 | anglais | `assets/audio/mix.en.m4a` |
| `tiktok-en/` | 9:16 | anglais | idem |

```bash
# voix anglaise : Kokoro, voix américaine af_heart, vitesse 1,12 (≈ même rythme que le français)
.venv/bin/python scripts/tts.py --models /chemin/vers/models --script narration/script.en.json --out assets/audio/narration-en --speed 1.12
AUDIO_LANG=en PYTHON=.venv/bin/python npm run audio:en      # timeline.en.json + mix.en.m4a (même balance voix/musique/bruitages)
npm run render:tiktok-en                                      # -> out/musk-anatomie-tiktok-en.mp4  (npm run render:en pour le 16:9)
npm run check:tiktok-en                                       # contrôles officiels sur la version anglaise
```

Prononciations anglaises imposées dans `narration/pronunciations.en.json` (le moteur plaçait l'accent de « Elon » sur la
mauvaise syllabe). La traduction a été relue pour le sens et la cohérence des chiffres, **pas par un anglophone natif**, et
la voix **n'a pas été écoutée** : à vérifier avant diffusion. Le français est inchangé pixel pour pixel par cette
refonte (captures comparées avant / après).

Contrôle de mise en page de toutes les variantes, toutes les 0,5 s (cartes qui se chevauchent ou sortent du cadre) :
`node scripts/overlaps.mjs --file tiktok-en/index.html --vp 1080x1920`.

Découpage pour envoi : un fichier par scène, en CRF 16 (très haute qualité), chacun sous 30 Mio :

```bash
ffmpeg -nostdin -ss <début> -to <fin> -i out/musk-anatomie.mp4 -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
       -c:a aac -b:a 256k -movflags +faststart partie-N.mp4
```

Rendu 3D en logiciel (sans GPU, 4 cœurs) : ≈ 0,6 s par image, **≈ 31 à 34 min** pour les 3 105 images (un seul rendu à
la fois : deux rendus en parallèle se partagent les mêmes cœurs). Sur une machine avec GPU, `hyperframes render` utilise
l'accélération matérielle automatiquement.

Dans un conteneur sans Chrome géré par Hyperframes, pointer vers un Chromium *headless shell* existant :

```bash
export HYPERFRAMES_BROWSER_PATH=/chemin/vers/headless_shell
export PRODUCER_HEADLESS_SHELL_PATH=$HYPERFRAMES_BROWSER_PATH
export PRODUCER_PLAYER_READY_TIMEOUT_MS=120000     # compilation des shaders en logiciel
```

## Architecture

```
index.html                  composition racine (1920×1080, durée calculée par le build) + HUD + <audio>
tiktok/ en/ tiktok-en/      variantes générées par le build (non versionnées) : 9:16 FR, 16:9 EN, 9:16 EN
src/main.js                 orchestration : monde 3D, caméra globale, ambiance, voiles, écoute de « hf-seek »
src/timing.js               table de timing unique, calée sur les durées réelles de la voix
src/core/                   moteur : World (rendu), Builder (géométrie fusionnée), palette, HUD, format (16:9 / 9:16), langue (fr / en), utilitaires
src/portrait.css            styles propres au format vertical ; src/lang-en.css : réglages de la version anglaise
src/components/             bibliothèque réutilisable (voir ci‑dessous)
src/scenes/                 hub (scène 1 + centre du finale), tesla, spacex, bourse, bank (5 et 6), finale
src/cues.js                 signaux sonores calés sur les mêmes ancres que l'image
data/facts.json             chiffres, dates, sources, statut de vérification
narration/script.json       texte de la voix off (français) ; script.en.json : version anglaise
narration/pronunciations*.json  prononciations imposées (IPA) : Elon Musk, SpaceX, xAI (fr et en)
scripts/                    build, tts, mixage audio, captures de développement, contrôle des chevauchements, benchmark
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

**Prononciation des noms propres.** Le moteur français lisait « Elon Musk » comme `elˈɔ̃ …` suivi d'une prononciation
anglaise de « Musk » : `narration/pronunciations.json` impose désormais les phonèmes (`ilˈɔn mˈœsk`, « SpaceX » =
`spˈɛs ˈiks`, « xAI » = `ˈiks a ˈi`). `scripts/tts.py` les injecte (`is_phonemes=True`) ; `--phonemes-only` affiche les
phonèmes calculés sans synthèse, pour vérifier la liste. Ces corrections sont contrôlées au niveau des phonèmes, **pas à
l'oreille** : une écoute humaine reste nécessaire, et la prononciation se règle en éditant ce fichier puis en relançant
`--only <segments>`.

Les WAV de la narration sont versionnés : le projet se rend sans Kokoro.

**Balance du mixage.** La voix est la référence ; pendant qu'elle parle, la musique est ≈ 15 dB plus bas et les
bruitages ≈ 19 dB plus bas en médiane (les plus gros impacts ≈ 3 dB sous la voix, grâce à un compresseur léger).
Une première version avait la musique au niveau de la voix et des impacts jusqu'à 13 dB *au‑dessus* d'elle : trop fort.
Les niveaux se règlent sans rien recalculer d'autre, et `STEMS_DIR` écrit chaque couche pour la mesurer :

```bash
MUSIC_GAIN=0.162 SFX_GAIN=0.21 STEMS_DIR=/tmp/stems PYTHON=.venv/bin/python npm run audio   # valeurs actuelles
```

Mesures du mixage final : −16,0 LUFS intégrés, crête −1,5 dBFS, étendue de niveau 1,7 LU. Le mixage a été contrôlé par
mesure (loudness, niveaux de chaque couche pendant la voix), **pas à l'oreille** : une écoute humaine reste recommandée
avant diffusion. Changer la piste audio ne demande pas de refaire le rendu 3D : on remplace seulement l'audio du MP4,
`ffmpeg -i out/musk-anatomie.mp4 -i assets/audio/mix.m4a -map 0:v -map 1:a -c copy -t 103.5 sortie.mp4`.

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
