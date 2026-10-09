#!/usr/bin/env python3
"""Génère assets/music.wav et assets/sfx.wav (procédural, numpy) à partir de assets/sfx_events.json (export du scénario)."""
import json, os, sys
import numpy as np, soundfile as sf
SR = 44100; D = float(sys.argv[1]) if len(sys.argv) > 1 else 36.0
OUT = os.path.join(os.path.dirname(__file__), "..", "assets"); os.makedirs(OUT, exist_ok=True)
N = int(D * SR); rng = np.random.default_rng(7)
tt = lambda n: np.arange(n) / SR
def env_ad(n, a, d, p=3):
    t = tt(n); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d * p); return e
def lp(x, fc):  # filtre passe-bas 1 pôle
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def place(buf, snd, t0, g=1.0, pan=0.0):
    i = int(t0 * SR); n = min(len(snd), buf.shape[0] - i)
    if n <= 0 or i < 0: return
    buf[i:i + n, 0] += snd[:n] * g * (1 - 0.5 * max(0, pan)); buf[i:i + n, 1] += snd[:n] * g * (1 + 0.5 * min(0, pan))
# ---------- effets ----------
def step(v):
    n = int(0.11 * SR); nz = rng.standard_normal(n) * env_ad(n, 0.001, 0.03, 4); nz = lp(nz, 1400 + 300 * v)
    th = np.sin(2 * np.pi * (95 - 20 * np.exp(-tt(n) * 40)) * tt(n)) * env_ad(n, 0.001, 0.05, 4)
    return 0.55 * nz + 0.5 * th
def tick(f=2300, d=0.03): n = int(0.08 * SR); return np.sin(2 * np.pi * f * tt(n)) * env_ad(n, 0.0005, d, 5) * 0.4
def pop(f=520): n = int(0.14 * SR); return np.sin(2 * np.pi * (f * (0.7 + 0.3 * np.exp(-tt(n) * 30))) * tt(n)) * env_ad(n, 0.002, 0.07, 4) * 0.6
def bell(): n = int(1.6 * SR); t = tt(n); return (np.sin(2 * np.pi * 1318 * t) + 0.5 * np.sin(2 * np.pi * 1976 * t) + 0.25 * np.sin(2 * np.pi * 2637 * t)) * env_ad(n, 0.002, 0.5, 5) * 0.35
def whoosh(d=0.5): n = int(d * SR); nz = lp(rng.standard_normal(n), 2400); t = tt(n); return nz * np.sin(np.pi * np.minimum(1, t / d)) ** 2 * 0.5
def thud(): n = int(0.2 * SR); t = tt(n); return np.sin(2 * np.pi * (70 - 25 * (1 - np.exp(-t * 30))) * t) * env_ad(n, 0.001, 0.09, 4) * 0.9
def chime(base=784): n = int(1.2 * SR); t = tt(n); return (np.sin(2 * np.pi * base * t) + 0.4 * np.sin(2 * np.pi * base * 2 * t)) * env_ad(n, 0.003, 0.35, 5) * 0.3
ev = json.load(open(os.path.join(OUT, "sfx_events.json")))
sfx = np.zeros((N, 2))
for e in ev:
    k, t = e["k"], e["t"]
    if k == "step": place(sfx, step(e.get("v", 0)), t, 0.45, -0.25 if e.get("v", 0) else 0.25)
    elif k == "pick": place(sfx, tick(2600), t, 0.5)
    elif k == "place": place(sfx, pop(480), t, 0.7)
    elif k == "press": place(sfx, pop(300), t, 0.8)
    elif k == "lift": place(sfx, whoosh(0.3), t, 0.4); place(sfx, tick(1800), t + 0.25, 0.5)
    elif k == "set": place(sfx, thud(), t, 0.7); place(sfx, tick(3200), t, 0.5)
    elif k == "bell": place(sfx, bell(), t, 0.8)
    elif k == "jump": place(sfx, whoosh(0.45), t - 0.05, 0.7)
    elif k == "land": place(sfx, thud(), t, 0.9)
    elif k == "chime": place(sfx, chime(784), t, 0.7); place(sfx, chime(988), t + 0.12, 0.6); place(sfx, chime(1319), t + 0.24, 0.6)
    elif k == "chime2": place(sfx, chime(659), t, 0.7); place(sfx, chime(988), t + 0.15, 0.6); place(sfx, chime(1319), t + 0.3, 0.7)
# ---------- musique douce (C – G – Am – F à 104 BPM) ----------
mus = np.zeros((N, 2)); BPM = 104; beat = 60 / BPM
chords = [[261.63, 329.63, 392.0], [196.0, 246.94, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]]
def pad(f, d):
    n = int(d * SR); t = tt(n); x = sum(np.sin(2 * np.pi * f * (1 + dt) * t) for dt in (-0.003, 0, 0.003))
    return x * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.5) * 0.12
def pluck(f):
    n = int(0.7 * SR); t = tt(n); return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * env_ad(n, 0.004, 0.18, 4) * 0.3
bars = int(D / (4 * beat)) + 2
for b in range(bars):
    ch = chords[b % 4]; t0 = b * 4 * beat
    for f in ch: place(mus, pad(f * 0.5, 4 * beat + 0.4), t0, 1.0)
    arp = [ch[0], ch[1], ch[2], ch[1] * 2, ch[2], ch[1], ch[0] * 2, ch[2]]
    for i, f in enumerate(arp): place(mus, pluck(f * 2), t0 + i * beat / 2, 0.8, pan=-0.3 + 0.6 * (i % 2))
    for k in range(4):
        n = int(0.16 * SR); kk = np.sin(2 * np.pi * (60 + 90 * np.exp(-tt(n) * 40)) * tt(n)) * env_ad(n, 0.001, 0.08, 4); place(mus, kk, t0 + k * beat, 0.35)
        h = lp(rng.standard_normal(int(0.05 * SR)), 9000) * env_ad(int(0.05 * SR), 0.0005, 0.015, 5); place(mus, h, t0 + k * beat + beat / 2, 0.12)
fade = np.minimum(1, tt(N) / 1.0) * np.minimum(1, (D - tt(N)) / 1.6)
mus *= fade[:, None]
def norm(x, p): return x / (np.max(np.abs(x)) + 1e-9) * p
sf.write(os.path.join(OUT, "music.wav"), norm(mus, 0.9), SR); sf.write(os.path.join(OUT, "sfx.wav"), norm(sfx, 0.95), SR)
print("ok")
