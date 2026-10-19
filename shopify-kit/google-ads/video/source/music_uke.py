"""Musique originale de la vidéo Google Ads : ukulélé, glockenspiel, claps, basse.

Synthèse pure (cordes pincées Karplus-Strong), aucun échantillon externe.
120 BPM : un temps = 0,5 s, une mesure = 2 s. Les coupes de la vidéo tombent sur
2,5 / 5,5 / 8,5 / 11,5 / 14,5 s. Sortie : WAV stéréo 44,1 kHz.
python3 music_uke.py sortie.wav [durée]
"""
import sys, wave
import numpy as np

SR = 44100
BEAT = 0.5
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 18.0
OUT = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
N = int((DUR + 1.5) * SR)
rng = np.random.default_rng(7)
dry = np.zeros((N, 2))
wet_send = np.zeros(N)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0, rev=0.0):
    s = int(t * SR)
    if s >= N:
        return
    sig = sig[: N - s] * gain
    dry[s:s + len(sig), 0] += sig * (1 - max(0, pan))
    dry[s:s + len(sig), 1] += sig * (1 + min(0, pan))
    wet_send[s:s + len(sig)] += sig * rev


_pluck = {}
def pluck(m, dur=1.4, bright=0.5):
    """Corde pincée (Karplus-Strong), calculée période par période."""
    key = (m, round(bright, 2))
    if key in _pluck:
        return _pluck[key]
    f = hz(m); P = int(SR / f); n = int(dur * SR)
    buf = rng.uniform(-1, 1, P)
    w = int(9 - bright * 5)  # filtre l'attaque : son plus chaud, moins de souffle
    buf = np.convolve(buf, np.ones(w) / w, 'same'); buf /= np.max(np.abs(buf))
    buf *= (0.6 + bright * 0.4)
    out = np.zeros(n + P)
    out[:P] = buf
    decay = 0.996 - (m - 60) * 0.0004
    for k in range(1, (n + P) // P):
        prev = out[(k - 1) * P:k * P]
        nxt = 0.5 * (prev + np.roll(prev, 1)) * decay
        out[k * P:(k + 1) * P] = nxt[: len(out[k * P:(k + 1) * P])]
    out = out[:n]
    out *= np.minimum(1, np.arange(n) / (0.002 * SR))
    _pluck[key] = out * 0.6
    return _pluck[key]


def glock(m, dur=0.9):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 9) + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 18)
    return s * np.exp(-t * 4.5) * np.minimum(1, t / 0.001) * 0.16


def kick():
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * 0.75


def clap():
    n = int(0.25 * SR); noise = rng.standard_normal(n)
    bp = np.convolve(noise, np.ones(3) / 3, 'same') - np.convolve(noise, np.ones(30) / 30, 'same')
    t = np.arange(n) / SR; e = np.exp(-t * 28)
    for k in (0.01, 0.021):
        s = int(k * SR); e[s:] += np.exp(-np.arange(n - s) / SR * 30) * 0.7
    return bp * e * 0.22


def snap():
    n = int(0.12 * SR); noise = rng.standard_normal(n); t = np.arange(n) / SR
    hp = noise - np.convolve(noise, np.ones(4) / 4, 'same')
    return hp * np.exp(-t * 60) * 0.35


def shaker(acc):
    n = int(0.07 * SR); noise = rng.standard_normal(n); t = np.arange(n) / SR
    hp = noise - np.convolve(noise, np.ones(2) / 2, 'same')
    return hp * np.sin(np.pi * np.minimum(t / 0.07, 1)) ** 2 * (0.03 if acc else 0.017)


def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return s * np.exp(-t * 3.2) * np.minimum(1, t / 0.004) * 0.26


# Ukulélé (accordage sol-do-mi-la) : Do – Sol – La m – Fa
CHORDS = {'C': (67, 60, 64, 72), 'G': (67, 62, 67, 71), 'Am': (69, 60, 64, 69), 'F': (69, 60, 65, 69)}
ROOT = {'C': 36, 'G': 43, 'Am': 45, 'F': 41}
PROG = ['C', 'G', 'Am', 'F']
STRUM = [(0, 'D', 1.0), (2, 'D', 0.8), (3, 'U', 0.55), (5, 'U', 0.55), (6, 'D', 0.8), (7, 'U', 0.5)]  # en croches
# Motif de glockenspiel par mesure (croche, note) — joyeux, sur les notes de l'accord
MOTIF = {'C': [(0, 84), (2, 88), (3, 91), (6, 88)], 'G': [(0, 83), (2, 86), (3, 91), (6, 86)],
         'Am': [(0, 84), (2, 88), (3, 93), (6, 88)], 'F': [(0, 84), (2, 89), (3, 93), (6, 91)]}
INTRO, END = 2.5, 14.5

bars = int(np.ceil(DUR / 2))
for b in range(bars):
    t0 = b * 2.0; ch = PROG[b % 4]
    full = INTRO <= t0 + 1.0 and t0 < END
    for e8, d, v in STRUM:
        t = t0 + e8 * BEAT / 2
        if t >= DUR - 0.6:
            continue
        notes = CHORDS[ch] if d == 'D' else CHORDS[ch][::-1]
        g = v * (0.85 if t < INTRO else 1.0) * (0.85 if t >= END else 1.0)
        for i, m in enumerate(notes):
            add(pluck(m, bright=0.7 if d == 'D' else 0.4), t + i * 0.011, g, pan=-0.35 + i * 0.12, rev=0.25)
    for e8, m in MOTIF[ch]:
        t = t0 + e8 * BEAT / 2
        if t < DUR - 0.6 and (t >= 1.0):
            add(glock(m), t, 0.9 if t < END else 0.7, pan=0.3, rev=0.5)
    for beat in range(4):
        t = t0 + beat * BEAT
        if not (INTRO <= t < DUR - 1.5):
            continue
        dg = 1.0 if t < END else 0.7  # la fin garde le rythme, un peu plus doux
        add(kick(), t, (0.9 if beat in (0, 2) else 0.45) * dg)
        if beat in (1, 3):
            add(clap(), t, dg, pan=0.05, rev=0.3)
        for h in range(4):
            add(shaker(h == 2), t + h * BEAT / 4, dg, pan=0.45)
        add(bass(ROOT[ch] + (7 if beat == 2 else 0), BEAT * 0.95), t, dg)

# Petit roulement de snaps avant le plan final, puis accord de Do qui sonne
for i in range(4):
    add(snap(), END - 0.5 + i * 0.125, 0.6 + i * 0.15, pan=-0.2, rev=0.3)
add(kick(), END, 1.1)
for i, m in enumerate(CHORDS['C']):
    add(pluck(m, dur=2.5, bright=0.8), END + i * 0.018, 1.1, pan=-0.35 + i * 0.12, rev=0.4)
for i, m in enumerate((84, 88, 91, 96)):
    add(glock(m, 1.4), END + 0.12 + i * 0.12, 0.9, pan=0.3, rev=0.6)
# accord final
for i, m in enumerate(CHORDS['C']):
    add(pluck(m, dur=2.5, bright=0.6), DUR - 1.5 + i * 0.03, 0.8, rev=0.5)
add(glock(96, 1.6), DUR - 1.45, 0.8, rev=0.6)

# Réverbération : réponse impulsionnelle de bruit qui décroît (1,1 s), via FFT
L = int(1.1 * SR); ir = rng.standard_normal(L) * np.exp(-np.arange(L) / SR * 4.5)
ir = np.convolve(ir, np.ones(8) / 8, 'same'); ir /= np.sqrt(np.sum(ir ** 2))
nfft = 1 << int(np.ceil(np.log2(N + L)))
wet = np.fft.irfft(np.fft.rfft(wet_send, nfft) * np.fft.rfft(ir, nfft), nfft)[:N] * 0.35
mix = dry.copy(); mix[:, 0] += wet; mix[:, 1] += np.roll(wet, 300)
mix = mix[: int(DUR * SR)]
fade = int(0.8 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)  # légère saturation douce
mix /= np.max(np.abs(mix)) / 0.89
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', OUT, DUR)
