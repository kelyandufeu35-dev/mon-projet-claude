"""Musique originale de la pub (synthèse, aucun échantillon externe) + bruitages.

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


# Grille d'accords (une mesure = 4 temps) : Do – La m – Fa – Sol.
CHORDS = [(48, [60, 64, 67, 72]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (43, [55, 59, 62, 67])]
MELODY = [0, 2, 1, 3, 2, 1, 3, 2]  # indices dans l'accord, en croches

beats = int(DUR / BEAT)
for b in range(beats):
    t = b * BEAT
    bar = b // 4
    root, chord = CHORDS[bar % 4]
    intro = t < 1.0
    add(kick(), t, 1.0 if not intro else 0.7)
    if b % 2 == 1:
        add(clap(), t, 0.9)
    for h in range(2):
        add(hat(open_=(h == 1 and b % 4 == 3)), t + h * BEAT / 2, 0.8, pan=0.3)
    # Basse en croches (octave du bas sur le premier temps).
    for h in range(2):
        add(note(hz(root - 12 if h == 0 else root), BEAT / 2, "bass"), t + h * BEAT / 2, 0.9)
    # Mélodie pluck en croches, alternée gauche/droite.
    if not intro:
        for h in range(2):
            idx = MELODY[(b * 2 + h) % len(MELODY)]
            add(note(hz(chord[idx] + 12), 0.25), t + h * BEAT / 2, 1.0, pan=-0.25 if h else 0.25)

# Montée avant le plan final (bruit qui monte) puis coupure nette au prix.
rise_t0, rise_t1 = 6.5, 7.5
n = int((rise_t1 - rise_t0) * SR)
noise = rng.standard_normal(n)
ramp = np.linspace(0, 1, n) ** 2
add(np.convolve(noise, np.ones(3) / 3, "same") * ramp * 0.18, rise_t0)

# Bruitages : chocs de la balle (plan 1 et plan 4) et souffles aux coupes.
def thud():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 40)) * t) * env(n, 0.001, 0.07) * 0.9


def whoosh():
    n = int(0.4 * SR)
    noise = rng.standard_normal(n)
    bp = np.convolve(noise, np.ones(5) / 5, "same") - np.convolve(noise, np.ones(60) / 60, "same")
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    return bp * shape * 0.35


for t in (0.458, 0.843):  # balle qui touche le sol puis rebondit
    add(thud(), t, 1.0)
for i in range(3):  # trois balles
    add(thud(), 5.5 + 0.12 + i * 0.32 + 0.5, 0.8, pan=(i - 1) * 0.4)
for cut in (1.5, 3.0, 5.5, 7.5):
    add(whoosh(), cut - 0.3, 1.0)

# Fondu de fin et normalisation.
fade = int(0.4 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.max(np.abs(mix)) / 0.89
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", OUT, DUR)
