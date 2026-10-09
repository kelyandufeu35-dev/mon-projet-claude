"""McDonald's Inside — bande-son : musique de fond très basse, quelques effets doux, voix off calée sur la timeline."""
import numpy as np, soundfile as sf, os
SR = 44100; DUR = 86.0; N = int(SR * DUR)
rng = np.random.default_rng(11)
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "assets")
def tt(n): return np.arange(n) / SR
def env_ad(n, a, d, p=2.0): t = tt(n); return np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-t / d * p)
def fft_filter(x, kind, f0, f1=None, order=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    if kind == "lp": H = 1 / (1 + (f / f0) ** (2 * order))
    elif kind == "hp": H = 1 - 1 / (1 + (f / f0) ** (2 * order))
    else: H = (1 / (1 + (f / f1) ** (2 * order))) * (1 - 1 / (1 + (f / f0) ** (2 * order)))
    return np.fft.irfft(X * H, len(x))
def place(buf, snd, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= len(buf) or i + len(snd) <= 0: return
    j = min(len(buf), i + len(snd)); seg = snd[: j - i] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[i:j, 0] += seg * l; buf[i:j, 1] += seg * r
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------- musique : lumineuse, légère, en retrait ----------
BPM = 100.0; beat = 60 / BPM; bar = beat * 4
music = np.zeros((N, 2))
chords = [[48, 55, 64, 67], [43, 55, 62, 67], [45, 57, 64, 69], [41, 53, 60, 65]]  # C G Am F
for k in range(int(DUR / (2 * bar)) + 1):
    notes = chords[k % 4]; t0 = k * 2 * bar; L = int((2 * bar + 1.0) * SR); t = tt(L); pad = np.zeros(L)
    for m in notes:
        for det in (-0.06, 0.0, 0.06):
            f = midi(m + det); pad += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) / 3
    a = np.minimum(t / 1.2, 1) * np.minimum(1, (2 * bar + 1.0 - t) / 1.0)
    place(music, fft_filter(pad * a, "lp", 1600), t0, 0.07, -0.15 if k % 2 else 0.15)
def pluck(f, d=0.6):
    n = int(d * SR); t = tt(n)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9)) * env_ad(n, 0.003, d, 5)
t0 = 3.0; i = 0
while t0 < 80:
    ch = chords[int(t0 / (2 * bar)) % 4]; note = ch[(i * 2) % 4] + 24 + (12 if i % 8 in (5, 6) else 0)
    place(music, pluck(midi(note)), t0, 0.05, np.sin(i * 0.8) * 0.5); t0 += beat / 2; i += 1
def kick():
    n = int(0.3 * SR); t = tt(n); f = 52 + 70 * np.exp(-t * 24); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)
KK = kick(); t0 = 11.0
while t0 < 78: place(music, KK, t0, 0.12); t0 += beat * 2
def hat(): n = int(0.05 * SR); return fft_filter(rng.standard_normal(n), "hp", 8000) * env_ad(n, 0.001, 0.03, 4)
H1 = hat(); t0 = 11.0 + beat
while t0 < 78: place(music, H1, t0, 0.025, 0.3); t0 += beat * 2
music *= np.clip(tt(N) / 2.5, 0, 1)[:, None] ** 1.5 * np.clip((DUR - 2.5 - tt(N)) / 2.0, 0, 1)[:, None]

# ---------- effets : whooshes doux + carillon final ----------
sfx = np.zeros((N, 2))
def whoosh(d=1.2):
    n = int(d * SR); t = tt(n); x = rng.standard_normal(n); out = np.zeros(n); steps = 16
    for s in range(steps):
        fc = 300 * (8000 / 300) ** (s / steps); out += fft_filter(x, "bp", fc, fc * 1.8) * np.exp(-((t / d - s / steps) ** 2) / 0.012)
    return out * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
WH = whoosh(); WH /= np.max(np.abs(WH))
for tw in (9.6, 24.6, 39.6, 54.6, 69.6, 79.4): place(sfx, WH, tw, 0.5)
def chime(f, d=2.4):
    n = int(d * SR); t = tt(n); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t)) * env_ad(n, 0.004, d, 3.0)
for k, f in enumerate((784, 988, 1175, 1568)): place(sfx, chime(f), 80.6 + k * 0.16, 0.3, -0.3 + k * 0.2)
# petits "pops" quand les restaurants apparaissent sur le globe
def pop(f=520, d=0.14): n = int(d * SR); t = tt(n); return np.sin(2 * np.pi * (f + 600 * np.exp(-t * 30)) * t) * env_ad(n, 0.002, d, 5)
for i in range(22): place(sfx, pop(480 + (i % 5) * 70), 0.9 + i * 0.28 + (i % 3) * 0.1, 0.12, -0.5 + (i % 7) / 7)

# ---------- voix off ----------
vo = np.zeros((N, 2)); mask = np.zeros(N)
for name, ts in (("v1", 0.8), ("v2", 10.9), ("v3", 26.0), ("v3b", 35.9), ("v4", 41.0), ("v5", 55.6), ("v6", 76.0)):
    x, sr = sf.read(os.path.join(OUT, "vo", name + ".wav"))
    if x.ndim > 1: x = x.mean(1)
    n2 = int(len(x) * SR / sr); x = np.interp(np.linspace(0, len(x) - 1, n2), np.arange(len(x)), x)
    x = fft_filter(x, "hp", 70); x /= np.max(np.abs(x)) + 1e-9
    place(vo, x, ts, 0.9); i0 = int(ts * SR); mask[i0: i0 + n2] = 1
k = int(0.25 * SR); sm_ = np.convolve(mask, np.ones(k) / k, mode="same")
music *= (1 - 0.35 * sm_)[:, None]; sfx *= (1 - 0.4 * sm_)[:, None]
def norm(x, p): return x / (np.max(np.abs(x)) + 1e-9) * p
music = norm(music, 0.85); sfx = norm(sfx, 0.8)
end = int(85.5 * SR)
for nm, a in (("music", music), ("sfx", sfx), ("voiceover", vo)): sf.write(os.path.join(OUT, nm + ".wav"), a[:end], SR, subtype="PCM_16")
print("ok")
