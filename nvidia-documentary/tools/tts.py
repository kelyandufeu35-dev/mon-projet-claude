#!/usr/bin/env python3
"""Synthèse vocale Kokoro avec phonétique explicite.

Le texte peut contenir des segments `{ipa}` : ils sont envoyés tels quels au modèle (alphabet phonétique
international), le reste est phonétisé normalement par espeak. Sert aux noms propres et sigles que le
phonétiseur lit mal : « NVIDIA » devient {ɛnvidjˈa} (« ène-vi-dia »), « cloud » {klˈaʊd}, etc.

Usage : tts.py <texte> <voix> <vitesse> <langue> <sortie.wav> [--print]
Les modèles sont ceux déjà téléchargés par `hyperframes tts` (~/.cache/hyperframes/tts).
"""
import re
import sys
from pathlib import Path

import kokoro_onnx
import soundfile as sf

text, voice, speed, lang, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], sys.argv[5]
show = "--print" in sys.argv

root = Path.home() / ".cache" / "hyperframes" / "tts"
model = kokoro_onnx.Kokoro(str(root / "models" / "kokoro-v1.0.onnx"), str(root / "voices" / "voices-v1.0.bin"))

parts = re.split(r"(\{[^}]*\})", text)
phonemes = []
for p in parts:
    if not p:
        continue
    if p.startswith("{") and p.endswith("}"):
        phonemes.append(p[1:-1])
    else:
        core = p.strip()
        # Le phonétiseur ignore les espaces de bord : on les restitue pour garder la frontière entre mots.
        ph = model.tokenizer.phonemize(core, lang) if core else ""
        phonemes.append((" " if p[0].isspace() else "") + ph + (" " if p[-1].isspace() and core else ""))
joined = "".join(phonemes)
if show:
    print(joined)
samples, rate = model.create(joined, voice=voice, speed=speed, lang=lang, is_phonemes=True)
sf.write(out, samples, rate)
