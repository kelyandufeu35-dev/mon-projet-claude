"""NEXALOG — bande-son générée procéduralement (numpy) : musique, effets, voix off calée sur la timeline."""
import numpy as np, soundfile as sf, os, sys
SR = 44100
DUR = 57.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")

def tt(n): return np.arange(n) / SR
def env_ad(n, a, d, p=2.0):
    t = tt(n); e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-t / d * p)
    return e
def fft_filter(x, kind, f0, f1=None, order=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    if kind == "lp": H = 1 / (1 + (f / f0) ** (2 * order))
    elif kind == "hp": H = 1 - 1 / (1 + (f / f0) ** (2 * order))
    elif kind == "bp": H = (1 / (1 + (f / f1) ** (2 * order))) * (1 - 1 / (1 + (f / f0) ** (2 * order)))
    return np.fft.irfft(X * H, len(x))
def place(buf, snd, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= len(buf) or i + len(snd) <= 0: return
    j = min(len(buf), i + len(snd)); seg = snd[: j - i] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[i:j, 0] += seg * l; buf[i:j, 1] += seg * r
def reverb(x, tail=2.2, wet=0.35):
    n = int(SR * tail); ir = rng.standard_normal(n) * np.exp(-tt(n) / (tail / 4.5))
    ir = fft_filter(ir, "lp", 5000)
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    y /= (np.max(np.abs(y)) + 1e-9)
    return x * (1 - wet) + y * wet * np.max(np.abs(x))

# ---------------- MUSIQUE ----------------
BPM = 112.0; beat = 60.0 / BPM
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
music = np.zeros((N, 2))
chords = [(57, [57, 64, 69, 72]), (53, [53, 60, 65, 69]), (48, [48, 55, 60, 64]), (55, [55, 62, 67, 71])]
bar = beat * 4
# nappes
for k in range(int(DUR / (2 * bar)) + 1):
    root, notes = chords[k % 4]
    t0 = k * 2 * bar; L = int((2 * bar + 1.2) * SR)
    t = tt(L)
    pad = np.zeros(L)
    for m in notes:
        for det in (-0.07, 0.0, 0.07):
            f = midi(m + det * 0.5)
            pad += (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.15 * np.sin(6 * np.pi * f * t)) / 3
    a = np.minimum(t / 1.4, 1) * np.minimum(1, (2 * bar + 1.2 - t) / 1.2)
    pad = fft_filter(pad * a, "lp", 1800)
    lvl = 0.05 if t0 < 6.5 else 0.075
    place(music, pad, t0, lvl, -0.15 if k % 2 else 0.15)
# basse (8e) dès le drop
def bass_note(f, d):
    n = int(d * SR); t = tt(n)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    return x * env_ad(n, 0.005, d, 3.0)
for k in range(int(DUR / (2 * bar)) + 1):
    root = chords[k % 4][0] - 12
    for b in range(16):
        t0 = k * 2 * bar + b * beat / 2
        if t0 < 9.4 or t0 > 52.6: continue
        place(music, bass_note(midi(root), beat * 0.45), t0, 0.14 if b % 2 == 0 else 0.1)
# kick
def kick():
    n = int(0.32 * SR); t = tt(n)
    f = 48 + 90 * np.exp(-t * 22); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9)
KK = kick()
t0 = 9.45
while t0 < 52.8:
    place(music, KK, t0, 0.34); t0 += beat
# clap / hat
def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR); x = rng.standard_normal(n)
    x = fft_filter(x, "hp", 7000) * env_ad(n, 0.001, 0.2 if open_ else 0.04, 4)
    return x
H1, H2 = hat(), hat(True)
t0 = 9.45 + beat / 2
i = 0
while t0 < 52.4:
    place(music, H2 if i % 4 == 3 else H1, t0, 0.05, 0.3 if i % 2 else -0.3); t0 += beat / 2; i += 1
def clap():
    n = int(0.25 * SR); x = rng.standard_normal(n)
    x = fft_filter(x, "bp", 900, 5000) * env_ad(n, 0.002, 0.12, 4); return x
CL = clap()
t0 = 9.45 + beat
while t0 < 52.4:
    place(music, CL, t0, 0.07); t0 += beat * 2
# arpège
scale = [69, 72, 76, 79, 81, 84, 76, 72]
def pluck(f, d=0.5):
    n = int(d * SR); t = tt(n)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(4 * np.pi * f * t) * np.exp(-t * 8) + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 14)
    return x * env_ad(n, 0.002, d, 5)
t0 = 11.0; i = 0
while t0 < 51.5:
    chord = chords[int(t0 / (2 * bar)) % 4][1]
    note = chord[(i * 3) % 4] + 12 + (12 if i % 8 in (5, 6) else 0)
    place(music, pluck(midi(note)), t0, 0.06, np.sin(i * 0.9) * 0.6)
    t0 += beat / 2; i += 1
# montée (riser) 6.3 -> 9.4
def riser(d, f0, f1, g=1.0):
    n = int(d * SR); t = tt(n); x = rng.standard_normal(n)
    sweep = np.zeros(n)
    X = fft_filter(x, "bp", f0, f0 * 3)
    # balayage par mélange de bandes
    out = np.zeros(n); steps = 24
    for s in range(steps):
        fc = f0 * (f1 / f0) ** (s / steps)
        seg = fft_filter(x, "bp", fc, fc * 1.6)
        w = np.exp(-((t / d - s / steps) ** 2) / 0.004)
        out += seg * w
    return out * (t / d) ** 1.6 * g
RS = riser(3.1, 300, 7000, 1.0); RS /= np.max(np.abs(RS)) + 1e-9
# (riser supprimé : sonnait comme une sirène)
# fin : accord final + fondu
Z = np.zeros((N, 2))
fin = np.zeros(int(4.0 * SR)); tf = tt(len(fin))
for m in (57, 64, 69, 72, 76):
    fin += (np.sin(2 * np.pi * midi(m) * tf) + 0.3 * np.sin(4 * np.pi * midi(m) * tf))
fin = fft_filter(fin * env_ad(len(fin), 0.02, 3.0, 2.0), "lp", 3000)
place(Z, reverb(fin, 2.5, 0.4), 52.9, 0.1)
music += Z
# intro : filtre ouvert progressivement (simulé par un gain)
g = np.clip((tt(N) - 0.0) / 3.0, 0, 1)[:, None] ** 1.5
music *= g
# fondu de sortie
fo = np.clip((DUR - 1.2 - tt(N)) / 1.2, 0, 1)[:, None]
music *= fo

# ---------------- EFFETS ----------------
sfx = np.zeros((N, 2))
def whoosh(d=1.1, up=True):
    n = int(d * SR); t = tt(n); x = rng.standard_normal(n)
    out = np.zeros(n); steps = 18
    for s in range(steps):
        pos = s / steps if up else 1 - s / steps
        fc = 250 * (9000 / 250) ** pos
        w = np.exp(-((t / d - s / steps) ** 2) / 0.012)
        out += fft_filter(x, "bp", fc, fc * 1.8) * w
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return out * e
WH = whoosh(); WH /= np.max(np.abs(WH))
for tw in (6.6, 19.4, 28.1, 35.9, 43.9, 52.2): place(sfx, WH, tw, 0.5, 0.0)
# impact logo
def boom(d=2.2):
    n = int(d * SR); t = tt(n)
    f = 38 + 120 * np.exp(-t * 7); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 2.2)
    nz = fft_filter(rng.standard_normal(n), "lp", 2500) * np.exp(-t * 6) * 0.5
    return reverb(x + nz, 2.0, 0.35)
BM = boom(); BM /= np.max(np.abs(BM))
# impacts du logo supprimés
# bip de recul + chuintement des camions
def beep(f=980, d=0.16):
    n = int(d * SR); t = tt(n); return np.sin(2 * np.pi * f * t) * np.minimum(1, np.minimum(t / 0.005, (d - t) / 0.01))
BP = beep()
rev = [(0.05, 8.2), (4.5, 12.65), (8.0, 16.15), (31.0, 39.15), (26.0, 34.15), (36.5, 44.65), (-5.0, 3.15)]
for s0, d in rev:
    t0 = s0 + 3.55
    while t0 < d - 0.2:
        pass  # bips de recul supprimés
        t0 += 0.55
def hiss(d=0.9):
    n = int(d * SR); x = fft_filter(rng.standard_normal(n), "hp", 2500) * env_ad(n, 0.01, d, 3.5); return x
HS = hiss()
for d in (3.15, 8.2, 12.65, 16.15, 34.15, 39.15, 44.65): place(sfx, HS, d - 0.1, 0.18, 0.5)
# scanners
def blip(f=2200, d=0.09):
    n = int(d * SR); t = tt(n); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2 * t)) * env_ad(n, 0.002, d, 4)
for i in range(26):
    t0 = 28.8 + i * 0.29 + (0.11 if i % 3 == 0 else 0)
    pass  # bips de scanner supprimés
# servos des bras (cycles ~ toutes les 2.8 s à partir de 34 s)
def servo(d=0.7, f0=300, f1=900):
    n = int(d * SR); t = tt(n); f = f0 + (f1 - f0) * np.sin(np.pi * t / d) ** 0.6
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sign(np.sin(ph)) * 0.3 + np.sin(ph)) * np.sin(np.pi * t / d)
    return fft_filter(x, "lp", 2500)
SV = servo()
for c, t0a in enumerate((35.2, 34.6, 34.0, 33.5)):
    t = t0a
    while t < 50:
        pass  # servos supprimés
        t += 2.8
# bruit de fond d'usine (très bas)
hum = fft_filter(rng.standard_normal(N), "lp", 220) * 0.5
hum *= np.clip((tt(N) - 8.5) / 2, 0, 1) * np.clip((52.5 - tt(N)) / 2, 0, 1)
sfx[:, 0] += hum * 0.06; sfx[:, 1] += hum * 0.06

# ---------------- VOIX OFF ----------------
vo = np.zeros((N, 2))
VT = [("v1", 0.9), ("v2", 4.3), ("v3", 7.1), ("v4", 11.0), ("v5", 20.2), ("v6", 28.8), ("v7", 36.8), ("v8", 44.6), ("v9", 52.8)]
mask = np.zeros(N)
for name, ts in VT:
    x, sr = sf.read(os.path.join(OUT, "vo", name + ".wav"))
    if x.ndim > 1: x = x.mean(1)
    # rééchantillonnage linéaire 24 kHz -> 44.1 kHz
    n2 = int(len(x) * SR / sr); x = np.interp(np.linspace(0, len(x) - 1, n2), np.arange(len(x)), x)
    x = fft_filter(x, "hp", 70)
    x /= np.max(np.abs(x)) + 1e-9
    place(vo, x, ts, 0.9, 0.0)
    i0 = int(ts * SR); mask[i0 : i0 + n2] = 1
# ducking de la musique sous la voix
k = int(0.25 * SR); sm = np.convolve(mask, np.ones(k) / k, mode="same")
duck = 1 - 0.38 * sm
music *= duck[:, None]; sfx *= (1 - 0.25 * sm)[:, None]

def norm(x, peak):
    return x / (np.max(np.abs(x)) + 1e-9) * peak
music = norm(music, 0.85); sfx = norm(sfx, 0.8)
sf.write(os.path.join(OUT, "music.wav"), music[: int(56.5 * SR)], SR, subtype="PCM_16")
sf.write(os.path.join(OUT, "sfx.wav"), sfx[: int(56.5 * SR)], SR, subtype="PCM_16")
sf.write(os.path.join(OUT, "voiceover.wav"), vo[: int(56.5 * SR)], SR, subtype="PCM_16")
print("ok")
