# « How NVIDIA actually works » — script TikTok (v1)

Vidéo explicative verticale sur le fonctionnement de l'entreprise NVIDIA : ce qu'elle conçoit, ce qu'elle ne
fabrique pas, ce qu'elle vend vraiment, pourquoi les développeurs restent, et qui paie.

| | |
|---|---|
| Format | 9:16, 1080×1920, 24 i/s (30 i/s possible sur machine à GPU) |
| Durée | ≈ 60 s (voix `bm_george`) · 54 s (`am_adam`) · 62 s (`am_michael`) |
| Voix off | masculine, anglais, Kokoro (synthèse locale d'Hyperframes). Pas de sous-titres. |
| Texte à l'écran | aucun, sauf le logo NVIDIA sur le dernier plan (fichier officiel à fournir) |
| Son | voix off + nappe musicale synthétisée en retrait + effets aux transitions |
| Public | TikTok : accroche dans les 2 premières secondes, un plan nouveau toutes les 8 à 11 s |

La narration exacte est dans `narration.json` (source unique). Les durées de chaque phrase ci-dessous viennent
de la synthèse réelle (`tools/voice.mjs`, voix `bm_george`) : on cale les plans sur elles, pas l'inverse.

## Narration (anglais)

| # | Phrase | Mots | Début → fin |
|---|---|---|---|
| 1 | NVIDIA doesn't build its own chips. So what does it actually sell? | 12 | 0,4 → 4,5 |
| 2 | It designs them: thousands of tiny cores doing enormous amounts of math at once. Made for games, ideal for AI. | 20 | 4,8 → 12,8 |
| 3 | Foundries like TSMC turn silicon wafers into chips, layer by microscopic layer. NVIDIA owns no chip factory. It owns the design. | 21 | 13,1 → 23,1 |
| 4 | But the chip is only the start. NVIDIA sells whole systems: networking, racks, entire data centers working as one computer. | 20 | 23,4 → 32,0 |
| 5 | And a software layer called CUDA lets developers program all of it. That's why so many AI developers build on NVIDIA. | 21 | 32,4 → 40,6 |
| 6 | Who pays? Above all, the big cloud companies, then AI labs and enterprises, all racing for compute. Today, data centers bring in most of NVIDIA's revenue. | 26 | 40,9 → 51,7 |
| 7 | So NVIDIA isn't really a chip factory. It designs the engine of the AI era, and sells everything around it. | 20 | 52,1 → 59,7 |

Le texte reboucle sur lui-même : la dernière image est le gros plan de la puce de l'ouverture, ce qui relance la
vidéo naturellement (la question de la phrase 1 trouve sa réponse en 7).

## Plan par plan

Repères de cadrage vertical : sujet au centre ; on évite le bas (≈ 20 % : interface et légende TikTok) et le bord
droit (≈ 12 % : boutons). Le logo se place dans le tiers supérieur du cadre central.

| Plan | Temps | Image | Mouvement | Source |
|---|---|---|---|---|
| 1. Accroche | 0,0 – 4,7 | Module accélérateur en gros plan, lumière qui glisse sur le silicium. Aucun texte. | Poussée lente vers la puce | Pilote, macro (recadré 9:16) |
| 2. Concevoir | 4,7 – 13,0 | La caméra s'incline, passe l'ouverture de la puce et entre dans l'architecture : tuiles de calcul qui s'allument une à une (« thousands of tiny cores »), impulsions vertes qui s'intensifient sur « ideal for AI ». | Orbite puis plongée | Pilote, plongée (recadrée) |
| 3. Fonderie | 13,0 – 23,3 | Salle blanche : wafers sur un plateau tournant, bras robotisé qui en saisit un, reflets irisés sur la surface. Sur « layer by microscopic layer », une pile de couches se forme au-dessus de la plaque. Sur « It owns the design », fondu enchaîné vers un plan de masse en fil de fer lumineux de la puce. | Travelling latéral lent, puis rotation autour de la plaque | **À construire** (wafers, bras, salle blanche) |
| 4. Systèmes | 23,3 – 32,2 | Le plateau serveur sort de sa baie, le recul révèle la baie, puis l'allée. Sur « networking », des impulsions parcourent les câbles et les chemins de câbles. Sur « working as one computer », toutes les baies pulsent à l'unisson. | Recul continu | Pilote, plateau + allée (recadrés), impulsions réseau à ajouter |
| 5. Logiciel | 32,2 – 40,6 | Couches translucides superposées qui montent de la puce vers le haut du cadre à travers la baie : la pile logicielle qui s'appuie sur le matériel. Des lignes de lumière relient ensuite chaque baie à la couche. | Montée lente | **À construire** (visuel abstrait, sans texte) |
| 6. Économie | 40,6 – 51,9 | Vue en hauteur : bâtiments de centres de données, campus cloud et laboratoires ; flux de lumière qui convergent vers la salle. Sur « data centers bring in most of NVIDIA's revenue », un anneau lumineux dont presque tout l'arc est allumé (proportion, **sans chiffre**). | Montée en grue | **À construire** (bâtiments instanciés, flux) |
| 7. Final | 52,0 – 59,7 | La caméra continue de s'élever au-dessus du réseau mondial de centres de données (points lumineux reliés sur un globe). Fondu vers le logo NVIDIA, puis retour à la puce de l'ouverture pour la boucle. | Montée, puis fondu | **À construire** (globe + réseau) |

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
- « Today, data centers bring in most of NVIDIA's revenue » est vrai à la date de rédaction (octobre 2026) ; à
  revérifier si la vidéo est publiée plus tard.
- Je n'ai pas confirmé la liste des fonderies de l'exercice le plus récent (une source secondaire cite aussi
  Samsung). La narration dit « foundries like TSMC », ce qui reste exact.
- « Why so many AI developers build on NVIDIA » est qualitatif, sans chiffre : c'est la ligne la moins sourcée,
  à valider.

## Son

- **Voix** : voix de Kokoro, mixée à environ −16 LUFS ; essai des trois voix masculines dans `samples/`.
  Une voix de synthèse a un rendu régulier : les pauses de `narration.json` (0,3 à 0,5 s) sont là pour donner du souffle.
- **Nappe** : la nappe du pilote, recomposée à la durée de la vidéo, ducking de −10 dB sous la voix.
- **Effets** : impact à chaque changement de plan (sortie de la puce, révélation de la salle, bascule vers l'économie),
  impulsions réseau synchronisées avec les impulsions visuelles du plan 4.
- **Niveau final** : −14 LUFS intégré, crête vraie ≤ −1 dBTP (norme de diffusion habituelle des plateformes).
  Je ne peux pas écouter le résultat ici : le contrôle est mesuré, pas auditif.

## Plan de production

1. **Verticalisation du moteur** : cadrage 9:16. Le moteur lit le rapport d'image mais les focales et les trajectoires
   de la pilote sont réglées pour le 16:9 et doivent être recalées (champ horizontal, profondeur de champ).
2. **Plans 1, 2, 4** : réemploi de la pilote recadrée en vertical + impulsions réseau.
3. **Plans 3, 5, 6, 7** : à construire (salle blanche et wafers, pile logicielle, bâtiments et flux, globe et réseau).
   C'est l'essentiel du travail.
4. **Assemblage et son** : montage sur `timing.json`, nappe, effets, mixage.
5. **Rendu** : 1080×1920, même procédure par tranches que la pilote. Environ 60 s ≈ 2 fois la durée de la pilote : de
   l'ordre de 8 à 10 h de calcul sur ce conteneur sans GPU ; de l'ordre de la dizaine de minutes à une heure sur une
   machine à GPU NVIDIA (`--browser-gpu`).
6. **Contrôle** : images à pleine résolution à chaque jonction et à chaque mouvement rapide, comme pour la pilote.

## À fournir / à décider

1. **Voix** : écouter les trois essais et choisir (`bm_george`, `am_adam`, `am_michael`). Le choix modifie la durée
   (54 à 62 s) et donc le calage des plans.
2. **Logo** : fichier officiel (SVG ou PNG). Sans fichier, le dernier plan porte le mot « NVIDIA » en texte.
3. **Texte à l'écran** : je n'ai prévu aucun texte (pas de sous-titres), sauf le logo. Le mot « CUDA » en hologramme
   au plan 5 serait possible si vous le souhaitez.
4. **Relecture du texte** : en particulier les trois réserves ci-dessus.

## Commandes

```bash
# une fois : environnement de synthèse vocale (Kokoro)
python3 -m venv tools/.venv-tts && tools/.venv-tts/bin/pip install kokoro-onnx soundfile

npm run voice -- --voice bm_george     # synthèse + mesure des durées + piste assemblée
# sorties : tiktok/voice/<voix>/{<phrase>.wav, timing.json, narration.wav}
```
