#!/usr/bin/env python3
"""Synthèse de la voix off française (Kokoro-82M, hors ligne) à partir de data/narration.json.
Usage : python3 scripts/tts.py [--model-dir /tmp/kokoro]
Écrit assets/audio/vo/<id>.wav et data/vo_durations.json (durées mesurées)."""
import json, sys, os, time
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

model_dir = '/tmp/kokoro'
if '--model-dir' in sys.argv: model_dir = sys.argv[sys.argv.index('--model-dir') + 1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
narr = json.load(open(os.path.join(root, 'data/narration.json')))
v = narr['voice']
k = Kokoro(os.path.join(model_dir, 'kokoro-v1.0.onnx'), os.path.join(model_dir, 'voices-v1.0.bin'))
print('voix disponibles (fr):', [x for x in k.get_voices() if x.startswith('f') and 'siwis' in x])
out = os.path.join(root, 'assets/audio/vo'); os.makedirs(out, exist_ok=True)
durs = {}
for line in narr['lines']:
    t0 = time.time()
    text = line['text'].replace('’', "'")
    samples, sr = k.create(text, voice=v['voice'], speed=v.get('speed', 1.0), lang=v['lang'])
    # petit fondu pour éviter les clics
    n = int(sr * 0.02); samples = samples.copy()
    samples[:n] *= np.linspace(0, 1, n); samples[-n:] *= np.linspace(1, 0, n)
    sf.write(os.path.join(out, line['id'] + '.wav'), samples, sr)
    durs[line['id']] = round(len(samples) / sr, 3)
    print(line['id'], f"{durs[line['id']]:.2f}s", f"(prévu t={line['t']})", f"[{time.time()-t0:.1f}s calcul]")
json.dump(durs, open(os.path.join(root, 'data/vo_durations.json'), 'w'), indent=2)
