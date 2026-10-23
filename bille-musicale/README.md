# Bille musicale — parcours de bille synchronisé pour TikTok

Une bille descend un parcours vertical et rebondit sur des plateformes : **chaque impact joue une
note**, et la suite des impacts joue la mélodie avec les bonnes notes et le bon rythme. Format
9:16, sur téléphone comme sur ordinateur, sans visage, sans voix et sans interaction pendant la
lecture.

```
notes (horaires) ─► planificateur : 1 impact = 1 note, paraboles exactes entre impacts
                 ─► vérificateur : contacts, collisions parasites, sens des rebonds
                 ─► scène ─┬─► rendu Canvas = fonction pure du temps t
                           └─► sons programmés à t sur l'horloge de l'AudioContext
```

## Lancer l'application

Il faut [Node.js](https://nodejs.org) 18 ou plus récent (aucune dépendance pour l'application).

```bash
cd bille-musicale
npm start            # affiche http://localhost:8080/ et l'adresse sur le réseau local
```

Sur un téléphone connecté au même Wi-Fi, ouvrez l'adresse « réseau local » affichée. Le dossier
est un site statique : n'importe quel hébergeur statique convient (GitHub Pages, Netlify…). Les
modules JavaScript ne se chargent pas en double-cliquant sur `index.html` (`file://`) : passez
par un serveur.

### Version en fichier unique

```bash
node tools/build-single.mjs        # crée dist/bille-musicale.html
```

Ce fichier contient toute l'application (styles et scripts intégrés) : il s'ouvre d'un
double-clic, sans serveur, et peut être mis en ligne tel quel. Publiée dans claude.ai, la page
enregistre les vidéos et projets par la fenêtre d'enregistrement du téléphone (pas d'audio WAV
dans ce cas, format refusé par l'hôte).

### Commandes

| Commande | Effet |
|---|---|
| Lecture / Pause (espace) | Démarre ou met en pause |
| Recommencer (R) | Reprend au début |
| Barre de position | Se déplace dans la mélodie |
| Tempo | De 50 % à 160 % ; le parcours est recalculé pour les nouveaux horaires |
| Instrument / Octave / Volume | Xylophone, piano ou boîte à musique, synthétisés (aucun fichier son) |
| Couleurs | 5 palettes, 6 couleurs modifiables, couleur des plateformes selon la hauteur, par note ou unique |
| Plein écran (F) | Interface masquée, la lecture démarre ; Échap ou double-touche pour quitter |

Les réglages sont mémorisés dans le navigateur.

## Import MIDI

« Importer un MIDI… » accepte les fichiers `.mid`/`.midi` (formats 0 et 1, changements de tempo
pris en compte). Chaque couple piste/canal est proposé séparément ; la piste qui semble porter la
mélodie (la plus aiguë, peu d'accords, hors batterie, nom évocateur) est marquée ★ et
présélectionnée.

Cette version joue **une note à la fois** : dans un accord, seule la note la plus aiguë est
gardée, et les notes à moins de « Écart min » (70 ms par défaut) de la précédente sont retirées
pour que chaque rebond reste lisible. Le nombre de notes retirées est affiché. « Durée max »
(60 s par défaut) coupe les morceaux longs.

## Comment la synchronisation est garantie

1. **Le parcours est construit à partir des horaires.** La note i devient un impact à l'instant
   T_i. Entre deux impacts, la bille suit une parabole dont la vitesse verticale et la gravité
   sont résolues exactement pour qu'elle touche le point de contact suivant à T_{i+1}
   (`src/planner.js`, `solveHop`). Pour les notes courtes, la gravité est la même d'un rebond à
   l'autre (mouvement crédible) ; pour les notes longues, la bille « flotte » un peu plus
   (animation guidée).
2. **Les rebonds sont plausibles.** Chaque plateforme est orientée selon la normale
   n ∝ v_sortie − v_entrée, l'orientation d'une vraie réflexion. Une recherche avec retour
   arrière choisit pour chaque rebond la variante la plus naturelle (direction, distance, hauteur,
   descente) qui ne traverse aucune autre plateforme.
3. **Une seule horloge.** Les notes sont programmées à l'avance sur l'horloge de l'AudioContext
   (précision à l'échantillon) et l'image affiche la position de la bille à l'instant **réellement
   entendu** (`getOutputTimestamp`, latence de sortie comprise). Le rendu est une fonction pure
   du temps : la lecture, l'enregistrement et l'export dessinent exactement la même image pour le
   même instant.
4. **Vérification automatique.** À chaque calcul, le panneau « Synchronisation » contrôle que
   chaque impact tombe à l'horaire de sa note, que la bille touche sa plateforme (erreur de l'ordre
   de 10⁻¹³ px), qu'aucune trajectoire ne traverse une autre plateforme (échantillonnage toutes les
   2 ms) et que chaque rebond part du bon côté. « Vérifier le son rendu » rend la piste hors ligne
   et retrouve chaque attaque dans le signal : pour la démo, 37/37 attaques à moins de 2 ms, sur
   les trois instruments.

Ces vérifications ont aussi révélé un vrai problème, corrigé depuis : le compresseur de Web Audio
(`DynamicsCompressorNode`) retarde le son de 6 ms. Il est remplacé par un limiteur sans latence.

Si un casque Bluetooth annonce mal sa latence, le réglage « Décalage audio » corrige l'écart à la
main (une valeur positive retarde l'image).

## Vidéo

### 1. Enregistrement d'écran (téléphone ou ordinateur)

Lancez l'enregistrement d'écran du système, puis touchez « Mode enregistrement d'écran » :
l'interface disparaît, la première image reste figée 2 s (pour couper proprement au montage),
la mélodie se joue, puis l'application revient à l'écran normal. Sur iPhone, Safari ne permet pas
le plein écran d'une page : ajoutez l'application à l'écran d'accueil (Partager → « Sur l'écran
d'accueil ») pour l'ouvrir sans barre d'adresse.

### 2. Enregistrement intégré au navigateur

« Enregistrer la vidéo avec le son » capte le canvas (1080×1920 ou 720×1280) et le son
directement, sans passer par l'écran. Le fichier est en **MP4 H.264** si le navigateur sait
l'encoder (Chrome et Edge récents, Safari), sinon en **WebM**. Pour convertir un WebM en MP4 :

```bash
tools/webm-vers-mp4.sh enregistrement.webm      # nécessite ffmpeg
```

C'est un enregistrement en temps réel : si l'appareil peine, des images peuvent manquer. Le son
reste aligné : mesuré à moins de 25 ms, même dans un navigateur de test sans GPU qui ne produisait
que 36 i/s. Pour un résultat parfait, utilisez l'export ci-dessous.

### 3. Export MP4 image par image (recommandé pour publier)

Le MP4 exige des outils externes, que le navigateur ne fournit pas :

- **ffmpeg** (avec libx264), pour encoder la vidéo et le son ;
  macOS : `brew install ffmpeg` · Ubuntu/Debian : `sudo apt install ffmpeg` · Windows :
  `winget install ffmpeg` ;
- **Playwright + Chromium**, pour faire tourner l'application sans fenêtre ;
  `npm install` puis `npx playwright install chromium` (ou `--chrome /chemin/vers/chrome`
  pour utiliser un Chrome déjà installé).

```bash
cd bille-musicale
npm install && npx playwright install chromium     # une seule fois

# Démo
npm run export -- --out demo.mp4

# Votre mélodie : dans l'application, « Projet .json » télécharge la mélodie et tous les réglages
npm run export -- --project mon-projet.json --out ma-video.mp4 [--fps 60] [--crf 18]
```

Le script dessine chaque image à l'instant exact `image / fps` avec le code de l'application,
rend le son avec `OfflineAudioContext` sur la même chronologie, puis assemble un MP4 1080×1920
H.264/AAC (`yuv420p`, `faststart`, compatible TikTok et iPhone). Aucune image ne peut glisser par
rapport au son : chaque impact apparaît sur la première image qui suit l'instant de sa note.
Comptez environ 1 minute de calcul pour 20 s de vidéo à 60 i/s.

### Vérifier une vidéo

```bash
npm run verify -- ma-video.mp4 --project mon-projet.json    # nécessite ffmpeg
```

L'outil repère dans le fichier les éclairs d'impact image par image et les attaques dans le son,
puis mesure l'écart. Il fonctionne aussi sur un enregistrement d'écran, s'il ne montre que
l'animation. Résultat pour l'export de la démo :

```
Image : 37/37 éclairs d'impact retrouvés (début de l'animation à -8.3 ms dans la vidéo)
Son   : 37/37 attaques retrouvées
Écart son − image sur 37 impacts : de -15.8 ms à 0.0 ms (parfait : entre −16.7 ms et 0)
✓ Synchronisation exacte à l'image près
```

## Développement

```bash
npm test     # parseur MIDI, planificateur (contacts, collisions, caméra), mesure de synchronisation
```

| Fichier | Rôle |
|---|---|
| `src/melody.js` | Noms des notes, mélodie de démonstration originale « Cascade de verre » |
| `src/midi.js` | Lecture MIDI, carte des tempos, choix de la piste, réduction à une note à la fois |
| `src/planner.js` | Parcours : impacts, paraboles, plateformes, recherche sans collision, caméra |
| `src/verify.js` | Contrôle géométrique, mesure des attaques sonores, détection des éclairs à l'image |
| `src/scene.js` | Projet + réglages → scène (parcours, couleurs, événements sonores) |
| `src/renderer.js` | Dessin Canvas 2D d'une image à l'instant t |
| `src/synth.js` | Instruments synthétisés, chaîne de sortie, rendu hors ligne, WAV |
| `src/transport.js` | Horloge commune, programmation des notes, compensation de latence |
| `src/recorder.js` | Enregistrement MediaRecorder |
| `tools/` | Serveur local, export MP4, vérification d'une vidéo, conversion WebM → MP4 |
