"""Assemble la voix off : chaque phrase démarre juste après l'apparition de son texte."""
import json, sys, wave
v, dur, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
segs = json.load(open('lines.json'))[v]
rate, frames = None, None
for i, (t, _) in enumerate(segs):
    w = wave.open(f'seg-{v}-{i}.wav')
    if rate is None:
        rate = w.getframerate()
        frames = bytearray(int(dur * rate) * 2)
    data = w.readframes(w.getnframes())
    start = int((t + (0.25 if i == len(segs) - 1 else 0.15)) * rate) * 2
    frames[start:start + len(data)] = data[: max(0, len(frames) - start)]
o = wave.open(out, 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(rate); o.writeframes(bytes(frames)); o.close()
