"""Piste son d'une vidéo : voix off calée sur les textes + bruitages (souffle aux
changements de scène, « pop » quand un texte apparaît)."""
import array, json, sys, wave
v, dur, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
RATE = 22050
SFX = {
    'chien': {'whoosh': [3.2, 6.6, 10.2, 12.6], 'pop': [0.15, 3.3, 6.8, 7.5, 8.2, 10.3, 12.75, 13.05, 13.3, 13.55]},
    'chat': {'whoosh': [3.2, 6.6, 10.2, 12.6], 'pop': [0.15, 3.3, 6.6, 6.75, 7.5, 8.25, 10.3, 12.75, 13.05, 13.3, 13.55]},
    'raisons': {'whoosh': [2.8, 6, 9.2, 12.2], 'pop': [0.1, 3.0, 6.2, 9.4, 12.35, 12.65, 12.9, 13.15]},
}[v]
mix = array.array('i', [0]) * int(dur * RATE)

def load(path):
    w = wave.open(path)
    assert w.getframerate() == RATE and w.getnchannels() == 1
    return array.array('h', w.readframes(w.getnframes()))

def place(samples, t, gain=1.0):
    s = int(t * RATE)
    for i, x in enumerate(samples):
        if 0 <= s + i < len(mix):
            mix[s + i] += int(x * gain)

lines = json.load(open('lines.json'))[v]
for i, (t, _) in enumerate(lines):
    place(load(f'seg-{v}-{i}.wav'), t + (0.2 if i == len(lines) - 1 else 0.12))
whoosh, pop = load('whoosh.wav'), load('pop.wav')
for t in SFX['whoosh']:
    place(whoosh, t - 0.28, 0.22)
for t in SFX['pop']:
    place(pop, t, 0.16)
o = wave.open(out, 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(RATE)
o.writeframes(array.array('h', (max(-32768, min(32767, x)) for x in mix)).tobytes()); o.close()
