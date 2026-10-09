#!/usr/bin/env python3
"""Musique originale du film, synthétisée (numpy/scipy) — aucune banque sonore externe.
Structure calée sur les scènes : 0–15 nappes & cloches, 15–45 pulsation + arpèges,
45–75 plus intime, 75–93 montée finale. Montées/impacts aux transitions (15, 30, 45, 60, 75, 88).
Usage : python3 scripts/music.py  ->  assets/audio/music.wav"""
import numpy as np, soundfile as sf, os
from scipy import signal

SR = 44100; DUR = 93.5; N = int(SR * DUR)
BPM = 104.0; BEAT = 60.0 / BPM; BAR = 4 * BEAT
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def add(buf_l, buf_r, t0, sig, pan=0.0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    n = min(len(sig), N - i0)
    gl = gain * np.cos((pan + 1) * np.pi / 4); gr = gain * np.sin((pan + 1) * np.pi / 4)
    buf_l[i0:i0 + n] += sig[:n] * gl; buf_r[i0:i0 + n] += sig[:n] * gr
def tt(d): return np.arange(int(SR * d)) / SR
def adsr(n, a, d, s, r):
    e = np.ones(n); a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    e[:a_n] = np.linspace(0, 1, a_n, endpoint=False) if a_n else 1
    e[a_n:a_n + d_n] = np.linspace(1, s, d_n) if d_n else s
    e[a_n + d_n:max(a_n + d_n, n - r_n)] = s
    if r_n: e[max(0, n - r_n):] *= np.linspace(s, 0, min(r_n, n))[:n - max(0, n - r_n)] / max(s, 1e-6) * s if False else np.linspace(1, 0, min(r_n, n))[:n - max(0, n - r_n)]
    return e
def lp(x, fc, order=2): b, a = signal.butter(order, fc / (SR / 2), 'low'); return signal.lfilter(b, a, x)
def hp(x, fc, order=2): b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, lo, hi): b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return signal.lfilter(b, a, x)

# --- instruments ---
def pad(freqs, d, amp=0.12):
    t = tt(d); out = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0.0, 0.004):
            ff = f * (1 + det)
            out += (np.sin(2 * np.pi * ff * t) + 0.35 * np.sin(2 * np.pi * 2 * ff * t) + 0.12 * np.sin(2 * np.pi * 3 * ff * t))
    out = lp(out, 1600) * amp / len(freqs)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.0)
    return out * np.clip(env, 0, 1)
def bass(f, d, amp=0.32):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return lp(s, 400) * amp * np.exp(-t * 2.2) * np.minimum(1, t / 0.01)
def pluck(f, d=0.5, amp=0.16):
    t = tt(d); out = np.zeros_like(t)
    for k in range(1, 9): out += np.sin(2 * np.pi * k * f * t) / k * np.exp(-t * (6 + 5 * k))
    return out * amp * np.minimum(1, t / 0.003)
def bell(f, d=2.4, amp=0.12):
    t = tt(d); out = np.zeros_like(t)
    for r, a, dc in ((1, 1, 1.6), (2.76, 0.5, 2.4), (5.4, 0.25, 3.5), (8.9, 0.12, 5)):
        out += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dc)
    return out * amp
def kick(amp=0.5):
    t = tt(0.3); f = 45 + 90 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 11) * amp * np.minimum(1, t / 0.002)
def hat(amp=0.07, d=0.06):
    t = tt(d); n = hp(rng.standard_normal(len(t)), 7000); return n * np.exp(-t * 70) * amp
def clap(amp=0.13):
    t = tt(0.25); n = bp(rng.standard_normal(len(t)), 900, 3800); e = np.exp(-t * 22) * (1 + 0.8 * np.exp(-((t - 0.02) % 0.02) * 200)); return n * e * amp
def riser(d=3.0, amp=0.16):
    t = tt(d); n = rng.standard_normal(len(t)); out = np.zeros_like(t)
    for i, fc in enumerate(np.geomspace(300, 9000, 12)):
        a, b = int(len(t) * i / 12), int(len(t) * (i + 1) / 12 + 400); seg = bp(n, fc * 0.8, fc * 1.25); out[a:b] += seg[a:b]
    return out * (t / d) ** 2.2 * amp
def impact(amp=0.55):
    t = tt(2.2); f = 38 + 120 * np.exp(-t * 9); ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t * 2.6)
    tail = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 3.4) * 0.5
    return (boom + tail) * amp
def whoosh(d=1.2, amp=0.18):
    t = tt(d); n = rng.standard_normal(len(t)); y = bp(n, 500, 5000) * np.sin(np.pi * t / d) ** 2; return y * amp

CH = [  # Am, F, C, G
    dict(root=45, tri=[57, 60, 64]), dict(root=41, tri=[53, 57, 60]),
    dict(root=48, tri=[55, 60, 64]), dict(root=43, tri=[55, 59, 62]),
]
PENTA = [69, 72, 74, 76, 79, 81]

nb = int(DUR / BAR) + 1
for b in range(nb):
    t0 = b * BAR; c = CH[b % 4]
    sc = 1 if t0 < 15 else 2 if t0 < 30 else 3 if t0 < 45 else 4 if t0 < 60 else 5 if t0 < 75 else 6
    # nappe
    add(L, R, t0, pad([midi(m) for m in c['tri']], BAR + 0.9), pan=-0.1, gain=1.0 if sc != 5 else 0.85)
    # basse
    if sc >= 2:
        for k in range(4):
            if sc == 5 and k % 2: continue
            f = midi(c['root'] + (12 if (sc == 6 and k % 2) else 0)); add(L, R, t0 + k * BEAT, bass(f, BEAT * 1.6), 0, 1.0)
    else:
        add(L, R, t0, bass(midi(c['root']), BAR * 0.95, 0.25), 0, 1.0)
    # cloches (sc 1) / arpèges (sc ≥ 2)
    if sc == 1:
        for k in range(0, 8, 3):
            m = PENTA[(b * 3 + k) % len(PENTA)]; add(L, R, t0 + k * BEAT / 2 + 0.05, bell(midi(m)), pan=0.4 if k % 2 else -0.4)
    else:
        for k in range(8):
            if sc == 5 and k % 2: continue
            arp = c['tri'] + [c['tri'][0] + 12]
            m = arp[(k * (2 if sc == 6 else 1)) % len(arp)] + 12
            add(L, R, t0 + k * BEAT / 2, pluck(midi(m), 0.5, 0.12 if sc != 6 else 0.15), pan=-0.5 + (k % 4) * 0.33)
    # percussions
    if sc in (2, 3, 4, 6):
        for k in range(4):
            on = (sc == 2 and k in (0, 2)) or (sc == 3) or (sc == 4 and k == 0) or sc == 6
            if on: add(L, R, t0 + k * BEAT, kick(0.45 if sc != 4 else 0.3), 0, 1.0)
        for k in range(8):
            if sc in (3, 6) or (sc == 2 and k % 2): add(L, R, t0 + k * BEAT / 2, hat(0.06 if k % 2 == 0 else 0.09), pan=0.3)
        if sc in (3, 6):
            for k in (1, 3): add(L, R, t0 + k * BEAT, clap(0.11), 0, 1.0)

# transitions
for tc in (14.2, 29.2, 41.9, 58.6, 73.6):
    add(L, R, tc, riser(max(1.0, {14.2: 0.9, 29.2: 1.2, 41.9: 3.1, 58.6: 1.4, 73.6: 1.4}[tc]) + 0.0, 0.16), 0, 1.0)
for ti in (15.0, 30.3, 45.0, 60.1, 75.0):
    add(L, R, ti, impact(0.5 if ti in (45.0, 75.0) else 0.32), 0, 1.0)
for tw in (5.9, 15.0, 30.2, 60.1, 75.0): add(L, R, tw, whoosh(1.4, 0.2), 0, 1.0)
# finale : accord de do majeur tenu + cloche
add(L, R, 88.2, impact(0.5), 0, 1.0)
add(L, R, 88.4, pad([midi(m) for m in (48, 52, 55, 60, 64, 67)], 5.3, 0.2), 0, 1.0)
for j, m in enumerate((72, 76, 79, 84)): add(L, R, 88.5 + j * 0.28, bell(midi(m), 3.2, 0.13), pan=-0.3 + j * 0.2)

# ambiance : effet de largeur + normalisation + fondus
def haas(x, ms=14):
    d = int(SR * ms / 1000); y = np.zeros_like(x); y[d:] = x[:-d]; return y
Lw = L + 0.25 * haas(R); Rw = R + 0.25 * haas(L, 19)
y = np.stack([Lw, Rw], 1)
fade_in = np.minimum(1, np.arange(N) / (SR * 1.5)); fade_out = np.minimum(1, (N - np.arange(N)) / (SR * 2.5))
y *= (fade_in * fade_out)[:, None]
y = y / np.max(np.abs(y)) * 0.89
os.makedirs('assets/audio', exist_ok=True)
sf.write('assets/audio/music.wav', y.astype(np.float32), SR)
print('musique écrite', y.shape, 'pic', float(np.max(np.abs(y))))
