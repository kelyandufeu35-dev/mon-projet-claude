# « Comment NVIDIA fonctionne vraiment » — script TikTok (v2, français)

Vidéo explicative verticale sur le fonctionnement de l'entreprise NVIDIA : ce qu'elle conçoit, ce qu'elle ne
fabrique pas, ce qu'elle vend vraiment, pourquoi les développeurs restent, et qui paie.

| | |
|---|---|
| Format | 9:16, 1080×1920, 24 i/s (30 i/s possible sur machine à GPU) |
| Durée | ≈ 63 s (voix `bm_george`) · 58 s (voix française native `ff_siwis`) |
| Voix off | masculine, **français**, Kokoro (synthèse locale d'Hyperframes). Pas de sous-titres. |
| Texte à l'écran | deux mots seulement : « CUDA » (hologramme, plan 5) et « NVIDIA » (dernier plan, composé en texte) |
| Son | voix off + nappe musicale synthétisée en retrait + effets aux transitions |
| Public | TikTok : accroche dans les 2 premières secondes, un plan nouveau toutes les 8 à 13 s |

La narration exacte est dans `narration.fr.json` (source unique ; version anglaise conservée dans
`narration.en.json`). Les durées ci-dessous viennent de la synthèse réelle (`tools/voice.mjs`, voix `bm_george`) :
on cale les plans sur elles, pas l'inverse.

## Voix : ce que Kokoro permet vraiment

Kokoro n'a **aucune voix masculine française native** ; sa seule voix française est féminine (`ff_siwis`).
Trois options ont été synthétisées sur le texte complet (`samples/`) :

1. `bm_george` lisant le français : c'est la voix demandée. Chaque voix de Kokoro est entraînée sur une langue ;
   lue avec la phonétique française, elle aura vraisemblablement un accent anglais. Je ne peux pas l'écouter ici.
2. `ff_siwis` abaissée de 4 demi-tons : voix française native rendue plus grave. Expérimental : un décalage de hauteur
   par ré-échantillonnage peut donner un timbre artificiel.
3. `ff_siwis` native, féminine : la plus naturelle en français, mais pas masculine.

Si aucune ne convient : enregistrement ou export d'une voix masculine française de votre côté ; je cale alors la
vidéo sur ce fichier (l'outil sait mesurer n'importe quelle piste).

## Narration (français)

| # | Phrase | Début → fin |
|---|---|---|
| 1 | NVIDIA ne fabrique pas ses propres puces. Alors, que vend-elle vraiment ? | 0,4 → 4,7 |
| 2 | Elle les conçoit : des milliers de petits cœurs qui font d'énormes quantités de calculs en même temps. Pensées pour les jeux vidéo, idéales pour l'IA. | 5,0 → 13,2 |
| 3 | Des fonderies, comme TSMC, transforment des plaques de silicium en puces, couche microscopique après couche. NVIDIA ne possède aucune usine de puces. Elle possède la conception. | 13,5 → 24,5 |
| 4 | Mais la puce n'est que le début. NVIDIA vend des systèmes entiers : réseau, baies, centres de données complets qui fonctionnent comme un seul ordinateur. | 24,9 → 33,3 |
| 5 | Et une couche logicielle, CUDA, permet aux développeurs de tout programmer. C'est pourquoi tant de développeurs d'IA construisent sur NVIDIA. | 33,6 → 41,7 |
| 6 | Qui paie ? D'abord les grands acteurs du cloud, puis les laboratoires d'IA et les entreprises, tous en course pour la puissance de calcul. Aujourd'hui, les centres de données rapportent l'essentiel du chiffre d'affaires de NVIDIA. | 42,0 → 54,8 |
| 7 | Alors NVIDIA n'est pas vraiment une usine à puces. Elle conçoit le moteur de l'ère de l'IA, et vend tout ce qui l'entoure. | 55,2 → 62,3 |

Prononciation : le champ `tts` de chaque phrase donne une écriture phonétique à la synthèse (« Envidia », « té ès èm cé »,
« Couda », « i a ») ; le texte affiché reste l'orthographe correcte. À vérifier à l'oreille.

Le texte reboucle sur lui-même : la dernière image est le gros plan de la puce de l'ouverture, ce qui relance la
vidéo naturellement (la question de la phrase 1 trouve sa réponse en 7).

## Plan par plan

Repères de cadrage vertical : sujet au centre ; on évite le bas (≈ 20 % : interface et légende TikTok) et le bord
droit (≈ 12 % : boutons). Les deux mots à l'écran se placent dans le tiers supérieur du cadre central.

| Plan | Temps | Image | Mouvement | Source |
|---|---|---|---|---|
| 1. Accroche | 0,0 – 4,9 | Module accélérateur en gros plan, lumière qui glisse sur le silicium. Aucun texte. | Poussée lente vers la puce | Pilote, macro (recadré 9:16) |
| 2. Concevoir | 4,9 – 13,4 | La caméra s'incline, passe l'ouverture de la puce et entre dans l'architecture : tuiles de calcul qui s'allument une à une (« milliers de petits cœurs »), impulsions vertes qui s'intensifient sur « idéales pour l'IA ». | Orbite puis plongée | Pilote, plongée (recadrée) |
| 3. Fonderie | 13,4 – 24,7 | Salle blanche : wafers sur un plateau tournant, bras robotisé qui en saisit un, reflets irisés sur la surface. Sur « couche après couche », une pile de couches se forme au-dessus de la plaque. Sur « elle possède la conception », fondu enchaîné vers un plan de masse en fil de fer lumineux de la puce. | Travelling latéral lent, puis rotation autour de la plaque | **À construire** (wafers, bras, salle blanche) |
| 4. Systèmes | 24,7 – 33,4 | Le plateau serveur sort de sa baie, le recul révèle la baie, puis l'allée. Sur « réseau », des impulsions parcourent les câbles et les chemins de câbles. Sur « comme un seul ordinateur », toutes les baies pulsent à l'unisson. | Recul continu | Pilote, plateau + allée (recadrés), impulsions réseau à ajouter |
| 5. Logiciel | 33,4 – 41,8 | Couches translucides superposées qui montent de la puce vers le haut du cadre à travers la baie : la pile logicielle qui s'appuie sur le matériel. Au moment où la voix dit « CUDA », le mot apparaît en hologramme sur la couche supérieure, puis s'efface. Des lignes de lumière relient ensuite chaque baie à la couche. | Montée lente | **À construire** (visuel abstrait + un mot) |
| 6. Économie | 41,8 – 55,0 | Vue en hauteur : bâtiments de centres de données, campus cloud et laboratoires ; flux de lumière qui convergent vers la salle. Sur « l'essentiel du chiffre d'affaires », un anneau lumineux dont presque tout l'arc est allumé (proportion, **sans chiffre**). | Montée en grue | **À construire** (bâtiments instanciés, flux) |
| 7. Final | 55,0 – 62,8 | La caméra continue de s'élever au-dessus du réseau mondial de centres de données (points lumineux reliés sur un globe). Fondu vers le mot « NVIDIA » composé en texte (comme dans la pilote), puis retour à la puce de l'ouverture pour la boucle. | Montée, puis fondu | **À construire** (globe + réseau) |

Humains : aucun visage. Si on veut du vivant, une silhouette de dos dans l'allée au plan 4 (optionnel, non prévu).

## Faits vérifiés (aucun chiffre non sourcé dans la narration)

| Affirmation | Statut | Source |
|---|---|---|
| NVIDIA ne possède ni n'exploite d'usine de wafers ; elle s'appuie sur des fonderies (TSMC en tête) | Confirmé : formulation constante de ses rapports annuels | [10-K FY2011](https://www.sec.gov/Archives/edgar/data/0001045810/000104581011000015/fy2011form10k.htm), [10-K FY2020](https://www.sec.gov/Archives/edgar/data/1045810/000104581020000010/nvda-2020x10k.htm) |
| Le GPU a été conçu pour le graphisme (GeForce 256, 1999) ; CUDA, plateforme de calcul parallèle, est public depuis 2007 | Confirmé (recoupement de plusieurs sources) | [GeForce 256](https://en.wikipedia.org/wiki/GeForce_256), [GeForce](https://en.wikipedia.org/wiki/GeForce) |
| Le centre de données est l'essentiel du chiffre d'affaires ; il comprend le calcul **et le réseau** ; les hyperscalers en font un peu plus de la moitié | Confirmé pour le T4 de l'exercice 2026 (centre de données 62,3 Md$ sur 68,1 Md$ au total, soit environ 91 %) | [Communiqué NVIDIA](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026) |

Réserves à connaître :

- La lecture directe de la page SEC a été bloquée dans ce conteneur ; les chiffres du communiqué viennent des extraits
  renvoyés par la recherche, et le pourcentage (≈ 91 %) est **un calcul de ma part**. Il n'apparaît pas dans la narration.
  À rouvrir avant diffusion.
- « Les centres de données rapportent l'essentiel du chiffre d'affaires » est vrai à la date de rédaction
  (octobre 2026) ; à revérifier si la vidéo est publiée plus tard.
- Je n'ai pas confirmé la liste des fonderies de l'exercice le plus récent (une source secondaire cite aussi
  Samsung). La narration dit « des fonderies, comme TSMC », ce qui reste exact.
- « Tant de développeurs d'IA construisent sur NVIDIA » est qualitatif, sans chiffre : c'est la ligne la moins sourcée.
  Texte validé par le commanditaire ; à garder sous les yeux avant diffusion.
- Marque : le mot « NVIDIA » est composé en texte ; le logo officiel n'est pas reproduit. Le commanditaire a indiqué
  que le logo est autorisé mais que le mot suffit.

## Son

- **Voix** : voix de Kokoro, mixée à environ −16 LUFS. Une voix de synthèse a un rendu régulier : les pauses de
  `narration.fr.json` (0,3 à 0,5 s) sont là pour donner du souffle.
- **Nappe** : la nappe du pilote, recomposée à la durée de la vidéo, ducking de −10 dB sous la voix.
- **Effets** : impact à chaque changement de plan (sortie de la puce, révélation de la salle, bascule vers l'économie),
  impulsions réseau synchronisées avec les impulsions visuelles du plan 4.
- **Niveau final** : −14 LUFS intégré, crête vraie ≤ −1 dBTP (norme de diffusion habituelle des plateformes).
  Je ne peux pas écouter le résultat ici : le contrôle est mesuré, pas auditif.

## Plan de production

1. **Verticalisation du moteur** : cadrage 9:16. Le moteur lit le rapport d'image mais les focales et les trajectoires
   de la pilote sont réglées pour le 16:9 et doivent être recalées (champ horizontal, profondeur de champ).
2. **Plans 1, 2, 4** : réemploi de la pilote recadrée en vertical + impulsions réseau.
3. **Plans 3, 5, 6, 7** : à construire (salle blanche et wafers, pile logicielle et mot CUDA, bâtiments et flux,
   globe et réseau). C'est l'essentiel du travail.
4. **Assemblage et son** : montage sur `timing.json` (les temps ci-dessus en sont tirés), nappe, effets, mixage.
5. **Rendu** : 1080×1920, même procédure par tranches que la pilote. Environ 63 s ≈ 2 fois la durée de la pilote : de
   l'ordre de 8 à 10 h de calcul sur ce conteneur sans GPU ; de l'ordre de la dizaine de minutes à une heure sur une
   machine à GPU NVIDIA (`--browser-gpu`).
6. **Contrôle** : images à pleine résolution à chaque jonction et à chaque mouvement rapide, comme pour la pilote.

## À décider

1. **Voix** : après écoute des trois essais, laquelle garde-t-on ? Elle fixe la durée finale (58 à 63 s) et le calage.
2. Si la prononciation d'un mot sonne mal (« Envidia », « TSMC », « CUDA », « IA »), on ajuste le champ `tts` correspondant.

## Commandes

```bash
# une fois : environnement de synthèse vocale (Kokoro)
python3 -m venv tools/.venv-tts && tools/.venv-tts/bin/pip install kokoro-onnx soundfile

npm run voice -- --voice bm_george                      # français (défaut) : synthèse + durées + piste assemblée
npm run voice -- --voice ff_siwis --pitch -4            # voix française native abaissée de 4 demi-tons
npm run voice -- --script tiktok/narration.en.json      # version anglaise
# sorties : tiktok/voice/<langue>/<voix>/{<phrase>.wav, timing.json, narration.wav}
```
