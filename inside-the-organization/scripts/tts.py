#!/usr/bin/env python3
"""Synthèse de la voix off française (Kokoro-82M, hors ligne) à partir de data/narration.json.
Applique data/pronunciation.json (corrections de phonèmes : « McDonald's », « McDo », « marketing »...).
Usage : python3 scripts/tts.py [--lang en] [--model-dir /tmp/kokoro] [id ...]
  --lang en : lit data/narration.en.json + pronunciation.en.json, écrit assets/audio/vo-en/ et data/vo_durations.en.json
Écrit assets/audio/vo/<id>.mp3 et data/vo_durations.json (durées mesurées)."""
import json, sys, os, time, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

args = sys.argv[1:]
model_dir = '/tmp/kokoro'
if '--model-dir' in args:
    i = args.index('--model-dir'); model_dir = args[i + 1]; del args[i:i + 2]
lang = 'fr'
if '--lang' in args:
    i = args.index('--lang'); lang = args[i + 1]; del args[i:i + 2]
sfx = '' if lang == 'fr' else '.' + lang
only = set(args)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
narr = json.load(open(os.path.join(root, f'data/narration{sfx}.json')))
pron = json.load(open(os.path.join(root, f'data/pronunciation{sfx}.json')))
v = narr['voice']
k = Kokoro(os.path.join(model_dir, 'kokoro-v1.0.onnx'), os.path.join(model_dir, 'voices-v1.0.bin'))
out = os.path.join(root, 'assets/audio/vo' if lang == 'fr' else f'assets/audio/vo-{lang}'); os.makedirs(out, exist_ok=True)
dpath = os.path.join(root, f'data/vo_durations{sfx}.json')
durs = json.load(open(dpath)) if os.path.exists(dpath) else {}

def phonemes(text):
    text = text.replace('’', "'")
    for a, b in pron['text_replace'].items(): text = text.replace(a, b)
    ph = k.tokenizer.phonemize(text, v['lang'])
    for a, b in pron['phoneme_replace']: ph = ph.replace(a, b)
    if '(en)' in ph: print('  ⚠ balise anglaise restante :', ph)
    return ph

lines = narr.get('hook', {}).get('lines', []) + narr['lines']
for line in lines:
    if only and line['id'] not in only: continue
    t0 = time.time()
    ph = phonemes(line['text'])
    samples, sr = k.create(ph, voice=v['voice'], speed=v.get('speed', 1.0), lang=v['lang'], is_phonemes=True)
    n = int(sr * 0.02); samples = samples.copy()
    samples[:n] *= np.linspace(0, 1, n); samples[-n:] *= np.linspace(1, 0, n)
    wav = os.path.join(tempfile.gettempdir(), line['id'] + '.wav'); sf.write(wav, samples, sr)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(out, line['id'] + '.mp3')], check=True)
    durs[line['id']] = round(len(samples) / sr, 3)
    print(line['id'], f"{durs[line['id']]:.2f}s", f"(t={line['t']})", f"[{time.time()-t0:.1f}s]")
json.dump(durs, open(dpath, 'w'), indent=2)
