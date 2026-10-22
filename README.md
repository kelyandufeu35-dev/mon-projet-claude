# mon-projet-claude — vidéo longue → clips YouTube

Le pipeline prend une vidéo longue en français, la transcrit, demande à Claude de choisir
les meilleurs extraits, les découpe à la frame près, rédige leurs titres et leurs miniatures,
puis les publie en programmé sur YouTube sans dépasser le quota quotidien de l'API.

```
vidéo ─ffmpeg→ audio ─Deepgram Nova-3→ phrases « [#123 12:34 S1] texte »
      ─Claude Opus 5.5→ clips (indices de phrases) ─validation Python→ ffmpeg libx264 + .srt
      ─Claude Sonnet 5.5→ titre, description, tags, texte de miniature ─Pillow→ miniature
      ─YouTube Data v3→ upload privé + publishAt, miniature, playlist, sous-titres
      ─YouTube Analytics→ durée moyenne de visionnage → exemples réinjectés dans la sélection
```

## Installation

Il faut Python 3.10 ou plus récent et `ffmpeg`/`ffprobe` dans le PATH (avec libx264 et libopus).

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DEEPGRAM_API_KEY=...
export ANTHROPIC_API_KEY=...        # ou un profil `ant auth login`
```

**YouTube** : dans Google Cloud Console (le projet déjà audité), crée un « ID client OAuth »
de type *Application de bureau*. Télécharge le JSON à la racine sous le nom
`client_secret.json`, puis lance :

```bash
python -m clipper auth              # ouvre le navigateur ; --no-browser sur un serveur
```

Le jeton est enregistré dans `state/youtube_token.json`. Il couvre les portées
`youtube.upload`, `youtube.force-ssl` (miniatures, playlists, sous-titres) et
`yt-analytics.readonly`.

## Utilisation

```bash
# Tout jusqu'aux miniatures (chaque étape est mise en cache et peut être relancée)
python -m clipper run episode42.mp4 --title "Épisode 42 — avec Marie"

# Relire les clips proposés, puis publier dans la limite du quota du jour
python -m clipper status
python -m clipper upload --dry-run
python -m clipper upload

# Chaque jour (cron), le reste de la file part dans le nouveau quota
python -m clipper upload

# Durée moyenne de visionnage → state/stats.csv (et rétroaction pour les prochaines sélections)
python -m clipper stats
```

### Publier à la main dans YouTube Studio

Tant que le projet Google n'est pas audité, YouTube verrouille en privé les vidéos envoyées par
l'API. Pour publier quand même, chaque clip est accompagné d'un fichier `NN.txt` qui contient
son titre, sa description et ses tags, prêts à copier-coller dans YouTube Studio, avec la
miniature `NN.jpg` et les sous-titres `NN.srt`. Pour régénérer ces fichiers :

```bash
python -m clipper export            # toutes les sources (ou : export <slug>)
```

Les étapes existent aussi une par une : `transcribe`, `select`, `cut`, `titles`.
Chacune accepte `--force` pour être refaite, et un slug de source (affiché par `status`)
à la place du chemin du fichier.

Fichiers produits dans `work/<slug>/` : `audio.ogg`, `deepgram.json`, `transcript.json`,
puis pour chaque clip `clips/NN.mp4`, `NN.srt` et `NN.jpg`. L'état global (clips, créneaux,
quota consommé) se trouve dans `state/db.json`.

## Quota YouTube

Le quota est de 10 000 unités par jour, remis à zéro à minuit heure du Pacifique.
Chaque appel est compté au moment de la tentative, car Google facture aussi les échecs.

| Configuration du clip | Unités | Clips / jour |
|---|---|---|
| upload 1600 + miniature 50 | 1650 | 6 |
| + playlist 50 | 1700 | **5** |
| + sous-titres `captions.insert` 400 (réglage par défaut) | 2100 | **4** |

Pour revenir à 5 clips par jour, il suffit de passer `youtube.upload_captions: false` :
le `.srt` reste généré localement. Si un upload s'interrompt après `videos.insert`,
la relance suivante reprend seulement les étapes manquantes, sans uploader une deuxième fois.

Les créneaux de publication (`youtube.schedule`) sont attribués dans l'ordre, sans doublon
et avec un délai minimal. La vidéo est envoyée en `private` avec `publishAt`, et YouTube
la rend publique à l'heure prévue.

## Choix techniques

- **Deepgram en REST** via `httpx`, sans SDK : `model=nova-3&language=fr&diarize=true`.
  Les mots horodatés sont regroupés en phrases. Une phrase se termine sur une ponctuation
  finale, un changement de locuteur, un silence de plus de 1,5 s ou au-delà de 45 mots.
- **Sélection par indices de phrases** : Claude renvoie `start`/`end` (numéros de phrases).
  Les timecodes viennent ensuite des mots Deepgram, ce qui est plus précis que des
  timecodes recopiés par le modèle.
- **Sortie structurée au lieu du tool use forcé** : sur Claude Opus 5.5 et Sonnet 5.5,
  `tool_choice` `any`/`tool` renvoie une erreur 400. La même garantie de schéma passe donc par
  `output_config.format` (JSON Schema). Un validateur Python vérifie ensuite les indices,
  les durées, les chevauchements et le score. S'il trouve des erreurs, il les renvoie à Claude
  dans le même fil, en ajout seul pour profiter du cache de prompt, avec jusqu'à 2 relances.
  Les clips encore invalides après ça sont écartés.
- **Contexte 1M** : la transcription est envoyée en un seul bloc. Elle n'est découpée en blocs
  qui se chevauchent qu'au-delà de `chunk_threshold_tokens`. Les résultats des blocs sont
  ensuite fusionnés par score, sans chevauchement.
- **Refus** : `fallbacks: "default"` (repli côté serveur) est activé et `stop_reason` est
  vérifié avant toute lecture. Pour désactiver le repli : `claude.fallbacks: null`.
- **Découpe** : `-ss` avant `-i` puis réencodage `libx264` donne une coupe exacte à la frame.
  Une marge de 0,15 s avant et 0,40 s après est ajoutée et peut se régler.
- **Miniature** : sur 12 frames prises entre 10 % et 90 % du clip, la plus nette est retenue
  (variance des contours, avec une pénalité si l'image est trop sombre ou trop claire).
  Elle est recadrée en 1280×720, puis le texte de Sonnet y est incrusté avec un contour.
  La taille de police diminue jusqu'à tenir sur 2 lignes, et le fichier fait moins de 2 Mo.
- **Rétroaction** : `stats` lit `views`, `averageViewDuration` et `averageViewPercentage`.
  Les meilleurs et les pires clips (au moins 100 vues et 3 jours en ligne) sont injectés
  comme exemples dans la sélection, et les meilleurs titres dans la génération des titres.

## Coûts (ordre de grandeur pour 1 h de vidéo)

| Poste | Hypothèse | Coût |
|---|---|---|
| Deepgram Nova-3 + diarisation | 60 min × (0,0043 + 0,0020 $, diarisation **à vérifier**) | ~0,38 $ |
| Claude Opus 5.5 (sélection) | ~25 k tokens en entrée, ~10 k en sortie (réflexion comprise) | ~0,30 $ |
| Claude Sonnet 5.5 (titres) | ~10 k en entrée, ~3 k en sortie | ~0,05 $ |

Les commandes `select`, `titles` et `run` affichent le coût réel calculé à partir de `usage`.
Les tarifs se règlent dans `config.yaml`.

## Tests

```bash
python -m pytest
```

Les tests couvrent le regroupement en phrases, le découpage en blocs, la validation,
le format `.srt`, le quota (jour Pacifique), les créneaux et les relances Claude. Un test de
bout en bout tourne sur une vraie vidéo générée par ffmpeg : découpe, durée mesurée au
ffprobe, miniature et upload avec reprise, avec Claude et YouTube simulés.
