"""Musique originale de la vidéo Google Ads (synthèse, aucun échantillon externe).

120 BPM : un temps = 0,5 s. Les coupes de la vidéo tombent sur les temps
(1,5 s, 3 s, 5,5 s, 7,5 s). Sortie : WAV stéréo 44,1 kHz.
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
OUT = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
N = int(DUR * SR)
rng = np.random.default_rng(3)
mix = np.zeros((N, 2))


def add(sig, t, gain=1.0, pan=0.0):
    s = int(t * SR)
    if s >= N:
        return
    sig = sig[: N - s] * gain
    mix[s : s + len(sig), 0] += sig * (1 - max(0, pan))
    mix[s : s + len(sig), 1] += sig * (1 + min(0, pan))


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.12) * 1.2


def clap():
    n = int(0.22 * SR)
    noise = rng.standard_normal(n)
    # Filtre passe-bande grossier : différence de deux moyennes glissantes.
    a = np.convolve(noise, np.ones(4) / 4, "same") - np.convolve(noise, np.ones(40) / 40, "same")
    e = env(n, 0.001, 0.06)
    for k in (0.012, 0.024):  # petits rebonds typiques d'un clap
        s = int(k * SR)
        e[s:] += env(n - s, 0.001, 0.05) * 0.6
    return a * e * 0.55


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    noise = rng.standard_normal(n)
    hp = noise - np.convolve(noise, np.ones(3) / 3, "same")
    return hp * env(n, 0.0005, 0.06 if open_ else 0.015) * 0.35


def note(freq, dur, kind="pluck"):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "bass":
        saw = 2 * (t * freq % 1) - 1
        sub = np.sin(2 * np.pi * freq / 2 * t)
        sig = 0.55 * saw + 0.6 * sub
        sig = np.convolve(sig, np.ones(18) / 18, "same")  # adoucit
        return sig * env(n, 0.004, dur * 0.9) * 0.5
    # Pluck : deux ondes carrées légèrement désaccordées, enveloppe courte.
    sq = np.sign(np.sin(2 * np.pi * freq * t)) + np.sign(np.sin(2 * np.pi * freq * 1.006 * t))
    sq = np.convolve(sq, np.ones(6) / 6, "same")
    return sq * env(n, 0.002, 0.11) * 0.12


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)



CHORDS = [(48, [60, 64, 67, 72]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (43, [55, 59, 62, 67])]
MELODY = [0, 2, 1, 3, 2, 1, 3, 2]
END = 14.5
beats = int(DUR / BEAT)
for b in range(beats):
    t = b * BEAT
    bar = b // 4
    root, chord = CHORDS[bar % 4]
    intro = t < 2.5
    outro = t >= END
    g = 0.55 if (intro or outro) else 1.0
    if not intro or b % 2 == 0:
        add(kick(), t, 0.9 * g)
    if b % 2 == 1 and not intro:
        add(clap(), t, 0.8 * g)
    for h in range(2):
        add(hat(open_=(h == 1 and b % 4 == 3)), t + h * BEAT / 2, 0.7 * g, pan=0.3)
    for h in range(2):
        add(note(hz(root - 12 if h == 0 else root), BEAT / 2, "bass"), t + h * BEAT / 2, 0.85 * g)
    for h in range(2):
        idx = MELODY[(b * 2 + h) % len(MELODY)]
        add(note(hz(chord[idx] + 12), 0.25), t + h * BEAT / 2, (0.7 if intro else 1.0), pan=-0.25 if h else 0.25)

def whoosh():
    n = int(0.4 * SR)
    noise = rng.standard_normal(n)
    bp = np.convolve(noise, np.ones(5) / 5, "same") - np.convolve(noise, np.ones(60) / 60, "same")
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    return bp * shape * 0.3

n = int(1.0 * SR)
noise = rng.standard_normal(n)
add(np.convolve(noise, np.ones(3) / 3, "same") * np.linspace(0, 1, n) ** 2 * 0.15, END - 1.0)
for cut in (2.5, 5.5, 8.5, 11.5):
    add(whoosh(), cut - 0.3, 0.9)
add(kick(), END, 1.3)

fade = int(1.2 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.max(np.abs(mix)) / 0.89
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", OUT, DUR)
