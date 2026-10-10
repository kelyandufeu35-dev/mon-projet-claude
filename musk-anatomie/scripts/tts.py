#!/usr/bin/env python3
"""Synthèse vocale locale (Kokoro-82M via kokoro-onnx) : une phrase = un fichier WAV, pour caler chaque
segment de narration précisément sur les animations. Aucun service distant : modèle téléchargé une fois
depuis les releases GitHub de kokoro-onnx (fichiers kokoro-v1.0.onnx et voices-v1.0.bin).

Usage : python3 scripts/tts.py --models DIR --out assets/audio/narration [--speed 1.08]
"""
import argparse, json, os, re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ap = argparse.ArgumentParser()
ap.add_argument("--models", required=True, help="dossier contenant kokoro-v1.0.onnx et voices-v1.0.bin")
ap.add_argument("--out", required=True)
ap.add_argument("--script", default=os.path.join(os.path.dirname(__file__), "..", "narration", "script.json"))
ap.add_argument("--speed", type=float, default=1.0)
ap.add_argument("--only", default=None, help="ids séparés par des virgules")
ap.add_argument("--phonemes-only", action="store_true", help="affiche les phonèmes sans synthétiser")
args = ap.parse_args()

cfg = json.load(open(args.script, encoding="utf-8"))
pron_path = os.path.join(os.path.dirname(args.script), "pronunciations.json")
PRON = {k: v for k, v in json.load(open(pron_path, encoding="utf-8")).items() if not k.startswith("_")} if os.path.exists(pron_path) else {}
PAT = re.compile("(" + "|".join(re.escape(x) for x in sorted(PRON, key=len, reverse=True)) + ")") if PRON else None
k = Kokoro(os.path.join(args.models, "kokoro-v1.0.onnx"), os.path.join(args.models, "voices-v1.0.bin"))
os.makedirs(args.out, exist_ok=True)
only = set(args.only.split(",")) if args.only else None
def to_phonemes(text):
    """phonétise le texte avec espeak (fr) en injectant les prononciations imposées de pronunciations.json"""
    if not PAT:
        return None
    parts = PAT.split(text)
    out = ""
    for i, piece in enumerate(parts):
        if i % 2 == 1:
            ph = PRON[piece]
        else:
            if not piece.strip():
                out += " " if piece else ""
                continue
            ph = k.tokenizer.phonemize(piece.strip(), cfg["lang"])
            if piece[:1].isspace() and out and not out.endswith(" "):
                out += " "
        out += ph
        if piece[-1:].isspace() and i % 2 == 0:
            out += " "
    return re.sub(r" +", " ", out).strip()

dur_file = os.path.join(args.out, "durations.json")
durations = json.load(open(dur_file))["durations"] if os.path.exists(dur_file) else {}
for seg in cfg["segments"]:
    if only and seg["id"] not in only:
        continue
    ph = to_phonemes(seg["text"])
    if args.phonemes_only:
        print(seg["id"], ph); continue
    if ph is not None and "(en)" in ph:
        print("  ⚠ balise de langue dans", seg["id"], ":", ph)
    if ph is not None:
        samples, sr = k.create(ph, voice=cfg["voice"], speed=args.speed, lang=cfg["lang"], is_phonemes=True)
    else:
        samples, sr = k.create(seg["text"], voice=cfg["voice"], speed=args.speed, lang=cfg["lang"])
    # supprime les silences de tête/queue, ajoute 120 ms de respiration en fin
    a = np.asarray(samples, dtype=np.float32)
    thr = 0.004
    nz = np.where(np.abs(a) > thr)[0]
    if len(nz):
        a = a[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.06 * sr)]
    a = np.concatenate([a, np.zeros(int(0.12 * sr), dtype=np.float32)])
    path = os.path.join(args.out, seg["id"] + ".wav")
    sf.write(path, a, sr)
    durations[seg["id"]] = round(len(a) / sr, 3)
    print(f'{seg["id"]}: {durations[seg["id"]]:.2f}s  ({len(seg["text"].split())} mots)', flush=True)
json.dump({"speed": args.speed, "sample_rate": 24000, "durations": durations}, open(os.path.join(args.out, "durations.json"), "w"), indent=1)
print("total:", round(sum(durations.values()), 2), "s")
if args.phonemes_only: pass
