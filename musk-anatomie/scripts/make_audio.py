#!/usr/bin/env python3
"""Mixage audio du film, 100 % généré par code (aucun échantillon externe) :
  - narration : fichiers WAV Kokoro (assets/audio/narration/*.wav) placés aux instants de timeline.json
  - musique   : nappes + basse + arpèges + pulsation, intensité pilotée par scène, atténuée sous la voix
  - effets    : signaux calés sur les ancres d'animation (timeline.json -> cues)
Sortie : assets/audio/mix.wav (48 kHz stéréo) ; l'encodage AAC/loudnorm est fait par scripts/make-audio.sh.
"""
import json, math, os, sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TL = json.load(open(os.path.join(ROOT, "assets/audio/timeline.json")))
DUR = TL["duration"]
N = int(math.ceil((DUR + 3.0) * SR))
rng = np.random.default_rng(20261010)

music = np.zeros((N, 2), np.float32)
sfx = np.zeros((N, 2), np.float32)
wet = np.zeros((N, 2), np.float32)   # envoi réverbération des effets
narr = np.zeros((N, 2), np.float32)

# ---------------------------------------------------------------- outils
def tt(d):
    return np.arange(int(d * SR)) / SR

def put(bus, sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N or i0 + len(sig) <= 0:
        return
    if i0 < 0:
        sig = sig[-i0:]; i0 = 0
    n = min(len(sig), N - i0)
    l = math.cos((pan + 1) * math.pi / 4); r = math.sin((pan + 1) * math.pi / 4)
    bus[i0:i0 + n, 0] += sig[:n] * gain * l
    bus[i0:i0 + n, 1] += sig[:n] * gain * r

def put_pan_curve(bus, sig, t0, gain, pan0, pan1):
    n = len(sig); p = np.linspace(pan0, pan1, n)
    l = np.cos((p + 1) * np.pi / 4); r = np.sin((p + 1) * np.pi / 4)
    i0 = int(t0 * SR)
    if i0 >= N: return
    m = min(n, N - i0)
    bus[i0:i0 + m, 0] += sig[:m] * l[:m] * gain
    bus[i0:i0 + m, 1] += sig[:m] * r[:m] * gain

def sfx_out(sig, t0, gain=1.0, pan=0.0, send=0.25):
    put(sfx, sig, t0, gain, pan)
    if send > 0: put(wet, sig, t0, gain * send, pan)

def bp(x, lo, hi, order=2):
    hi = min(hi, SR / 2 - 200); lo = max(20, lo)
    return signal.sosfilt(signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)

def lp(x, fc, order=4):
    return signal.sosfilt(signal.butter(order, min(fc, SR / 2 - 200), btype="low", fs=SR, output="sos"), x)

def hp(x, fc, order=4):
    return signal.sosfilt(signal.butter(order, fc, btype="high", fs=SR, output="sos"), x)

def noise(d):
    return rng.standard_normal(int(d * SR))

def expenv(n, a=0.002, tau=0.2):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    ai = max(1, int(a * SR))
    e[:ai] *= np.linspace(0, 1, ai)
    return e

def arenv(n, a, r, shape=1.0):
    e = np.ones(n)
    ai, ri = max(1, int(a * SR)), max(1, int(r * SR))
    ai = min(ai, n); ri = min(ri, n)
    e[:ai] = np.linspace(0, 1, ai) ** shape
    e[n - ri:] *= np.linspace(1, 0, ri) ** shape
    return e

def sine(f, d, ph=0.0):
    return np.sin(2 * np.pi * f * tt(d) + ph)

def saw(f, d, nh=14, detune=0.0):
    t = tt(d); out = np.zeros(len(t))
    for k in range(1, nh + 1):
        if f * k * (1 + detune) > SR / 2 - 500: break
        out += np.sin(2 * np.pi * f * k * (1 + detune) * t + k) / k
    return out * 0.6

def sweep_noise(d, f0, f1, q=3.0):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n)
    chunk = int(0.05 * SR); hop = chunk // 2; win = np.hanning(chunk)
    for s in range(0, max(1, n - chunk), hop):
        u = s / max(1, n); f = f0 * (f1 / f0) ** u
        bw = f / q
        seg = bp(x[s:s + chunk], f - bw / 2, f + bw / 2) * win
        out[s:s + len(seg)] += seg
    return out / (np.max(np.abs(out)) + 1e-9)

def bell_tone(f, d, partials=((1, 1.0, 1.0), (2.76, 0.6, 0.6), (5.4, 0.35, 0.35), (8.93, 0.2, 0.25))):
    out = np.zeros(int(d * SR)); n = len(out)
    for ratio, amp, dec in partials:
        out += amp * np.sin(2 * np.pi * f * ratio * tt(d)) * np.exp(-tt(d) / (d * 0.35 * dec + 0.02))
    out *= np.minimum(1, np.arange(n) / (0.003 * SR))
    return out / (np.max(np.abs(out)) + 1e-9)

def pluck(f, d=0.35):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08) + 0.25 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.05)
    return s * np.exp(-t / (d * 0.28)) * np.minimum(1, np.arange(len(t)) / (0.002 * SR))

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

# ---------------------------------------------------------------- effets
def fx_ticks(t0, d, g=1.0, **_):
    n = int(d / 0.055)
    for k in range(n):
        f = 700 * (3.4 ** (k / max(1, n)))
        s = sine(f, 0.012) * expenv(int(0.012 * SR), 0.0005, 0.004)
        sfx_out(s, t0 + k * 0.055, 0.22 * g, pan=(-0.3 if k % 2 else 0.3), send=0.1)

def fx_shimmer(t0, d, g=1.0, **_):
    for _k in range(int(d * 16)):
        f = rng.uniform(1800, 5600)
        s = (sine(f, 0.3) + 0.5 * sine(f * 1.5, 0.3)) * expenv(int(0.3 * SR), 0.001, 0.08)
        sfx_out(s, t0 + rng.uniform(0, d), 0.05 * g, pan=rng.uniform(-0.8, 0.8), send=0.35)

def fx_morph(t0, g=1.0, **_):
    d = 0.6
    s = np.sin(2 * np.pi * np.cumsum(np.linspace(260, 1100, int(d * SR))) / SR) * arenv(int(d * SR), 0.05, 0.3)
    sfx_out(s, t0, 0.12 * g, send=0.4)
    sfx_out(sweep_noise(d, 800, 4000) * arenv(int(d * SR), 0.1, 0.3), t0, 0.1 * g, send=0.3)

def fx_riser(t0, d, g=1.0, **_):
    n = int(d * SR)
    nz = sweep_noise(d, 300, 7500, 2.5) * (np.linspace(0, 1, n) ** 2.2)
    ph = np.cumsum(np.linspace(110, 900, n)) * 2 * np.pi / SR
    tone = (np.sin(ph) + 0.4 * np.sin(2 * ph)) * (np.linspace(0, 1, n) ** 2) * (1 + 0.3 * np.sin(2 * np.pi * 7 * tt(d)))
    sfx_out(nz, t0, 0.5 * g, send=0.3); sfx_out(tone, t0, 0.16 * g, send=0.3)

def fx_impact(t0, g=1.0, **_):
    d = 1.6
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(95, 30, int(d * SR))) / SR) * expenv(int(d * SR), 0.003, 0.45)
    bang = lp(noise(0.7), 900, 2) * expenv(int(0.7 * SR), 0.001, 0.18)
    air = hp(noise(1.2), 4000) * expenv(int(1.2 * SR), 0.002, 0.35) * 0.25
    sfx_out(sub, t0, 0.9 * g, send=0.2); sfx_out(bang, t0, 0.6 * g, send=0.3); sfx_out(air, t0, 0.35 * g, send=0.4)

def fx_clank(t0, g=1.0, f=1.0, **_):
    base = rng.uniform(600, 1100) * f
    out = np.zeros(int(0.45 * SR))
    for r, a, dec in ((1, 1, 0.12), (2.76, 0.7, 0.08), (5.4, 0.4, 0.05), (8.9, 0.25, 0.03)):
        out += a * np.sin(2 * np.pi * base * r * tt(0.45)) * np.exp(-tt(0.45) / dec)
    out += hp(noise(0.02), 3000)[: len(out)].tolist() + [0] * (len(out) - int(0.02 * SR)) if False else 0
    sfx_out(out / (np.max(np.abs(out)) + 1e-9), t0, 0.28 * g, pan=rng.uniform(-0.6, 0.6), send=0.3)

def fx_build(t0, d, g=1.0, **_):
    n = int(d * SR)
    rumble = lp(noise(d), 160, 2) * arenv(n, 0.4, 0.6)
    sfx_out(rumble, t0, 0.55 * g, send=0.15)
    for k in range(int(d * 3.5)):
        fx_clank(t0 + rng.uniform(0.1, d - 0.3), g * 0.8, f=rng.uniform(0.6, 1.3))
    for k in range(4):
        dd = 0.5; s0 = rng.uniform(0, d - dd)
        whine = np.sin(2 * np.pi * np.cumsum(np.linspace(380, 720, int(dd * SR))) / SR) * arenv(int(dd * SR), 0.1, 0.2) * 0.07
        sfx_out(whine, t0 + s0, g, pan=rng.uniform(-0.8, 0.8), send=0.2)

def fx_tinkle(t0, d, g=1.0, **_):
    scale = [587.3, 659.3, 740.0, 880.0, 987.8, 1174.7, 1318.5]
    for k in range(int(d * 9)):
        s = bell_tone(rng.choice(scale), 0.7)
        sfx_out(s, t0 + k * d / (d * 9) + rng.uniform(0, 0.03), 0.1 * g, pan=rng.uniform(-0.7, 0.7), send=0.5)

def fx_chime(t0, g=1.0, f=1.0, **_):
    sfx_out(bell_tone(1046.5 * f, 1.6), t0, 0.3 * g, send=0.5)
    sfx_out(bell_tone(1568 * f, 1.1), t0 + 0.07, 0.15 * g, pan=0.3, send=0.5)

def fx_gold_up(t0, g=1.0, **_):
    for k, f in enumerate((587.3, 740.0, 880.0, 1174.7)):
        sfx_out(bell_tone(f, 0.9), t0 + k * 0.09, 0.22 * g, pan=-0.2 + 0.2 * k, send=0.5)

def fx_rise_arp(t0, d, g=1.0, **_):
    sc = [293.7, 329.6, 370.0, 440.0, 493.9, 587.3, 659.3, 740.0, 880.0, 987.8]
    n = 10
    for k in range(n):
        tk = t0 + (k / n) ** 0.85 * d
        sfx_out(pluck(sc[k], 0.4), tk, 0.22 * g * (0.5 + k / n), pan=-0.4 + 0.08 * k, send=0.4)

def fx_fall_arp(t0, d, g=1.0, **_):
    sc = [880.0, 783.99, 698.46, 587.3, 523.25, 466.2, 392.0, 349.2, 293.7, 233.1]
    n = 10
    for k in range(n):
        tk = t0 + (k / n) * d
        s = lp(pluck(sc[k], 0.45), 2400 - k * 140, 2)
        sfx_out(s, tk, 0.22 * g * (1.1 - k / n * 0.5), pan=0.4 - 0.08 * k, send=0.4)

def fx_lock(t0, g=1.0, **_):
    c = hp(noise(0.012), 2500) * expenv(int(0.012 * SR), 0.0003, 0.003)
    th = sine(130, 0.12) * expenv(int(0.12 * SR), 0.001, 0.04)
    sfx_out(c, t0, 0.5 * g, send=0.2); sfx_out(th, t0 + 0.04, 0.5 * g, send=0.2)
    sfx_out(c, t0 + 0.14, 0.35 * g, pan=0.2, send=0.2)

def fx_pop(t0, g=1.0, **_):
    d = 0.12
    s = np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1500, int(d * SR))) / SR) * expenv(int(d * SR), 0.001, 0.04)
    sfx_out(s, t0, 0.3 * g, send=0.3)

def fx_roar(t0, d, g=1.0, **_):
    n = int(d * SR)
    body = lp(noise(d), 1800, 2) * arenv(n, 0.5, 0.9, 1.5)
    crackle = hp(noise(d), 3000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 37 * tt(d)))) * arenv(n, 0.4, 0.8) * 0.2
    low = (sine(48, d) + 0.6 * sine(71, d)) * arenv(n, 0.3, 0.9) * (1 + 0.15 * np.sin(2 * np.pi * 9 * tt(d)))
    sfx_out(body, t0, 0.5 * g, send=0.25); sfx_out(crackle, t0, 0.35 * g, send=0.1); sfx_out(low, t0, 0.45 * g, send=0.15)

def fx_whoosh(t0, d, g=1.0, **_):
    n = int(d * SR)
    s = sweep_noise(d, 500, 3800, 1.5) * np.sin(np.linspace(0, np.pi, n)) ** 1.5
    put_pan_curve(sfx, s, t0, 0.5 * g, -0.7, 0.7)
    put_pan_curve(wet, s, t0, 0.2 * g, -0.7, 0.7)

def fx_thud(t0, g=1.0, **_):
    d = 0.6
    s = np.sin(2 * np.pi * np.cumsum(np.linspace(80, 38, int(d * SR))) / SR) * expenv(int(d * SR), 0.002, 0.18)
    sfx_out(s, t0, 0.8 * g, send=0.15); sfx_out(lp(noise(0.25), 400, 2) * expenv(int(0.25 * SR), 0.001, 0.07), t0, 0.5 * g, send=0.2)

def fx_merge(t0, g=1.0, **_):
    d = 1.4
    for k, f in enumerate((293.7, 440.0, 587.3, 740.0, 880.0)):
        s = bell_tone(f, 1.3) * arenv(int(1.3 * SR), 0.05, 0.9)
        sfx_out(s, t0 + k * 0.1, 0.22 * g, pan=-0.5 + 0.25 * k, send=0.5)
    fx_shimmer(t0 + 0.1, 1.2, 0.8)

def fx_bell(t0, g=1.0, **_):
    sfx_out(bell_tone(523.25, 3.2, ((1, 1, 1.4), (2.0, 0.5, 1.0), (2.76, 0.4, 0.7), (4.2, 0.25, 0.4), (5.4, 0.2, 0.3))), t0, 0.5 * g, send=0.5)
    sfx_out(bell_tone(523.25, 3.2, ((1, 1, 1.4), (2.0, 0.5, 1.0), (2.76, 0.4, 0.7))), t0 + 0.55, 0.4 * g, pan=0.2, send=0.5)

def fx_coins(t0, g=1.0, **_):
    for k in range(14):
        f = rng.uniform(2200, 3600)
        s = (sine(f, 0.22) + 0.6 * sine(f * 1.34, 0.22)) * expenv(int(0.22 * SR), 0.0008, 0.06)
        sfx_out(s, t0 + k * 0.04 + rng.uniform(0, 0.02), 0.13 * g, pan=rng.uniform(-0.7, 0.7), send=0.3)

def fx_unbuild(t0, d, g=1.0, **_):
    n = int(d * SR)
    s = sweep_noise(d, 5000, 250, 2.0) * np.sin(np.linspace(0, np.pi, n)) ** 1.3
    sfx_out(s, t0, 0.4 * g, send=0.3)
    sfx_out(lp(noise(d), 120, 2) * arenv(n, 0.1, 0.8), t0, 0.5 * g, send=0.1)

def fx_vault(t0, d, g=1.0, **_):
    # molette : cliquetis qui accélère, puis verrous, puis porte qui grince, souffle et halo
    k = 0; t = 0.0
    while t < 1.0:
        c = (hp(noise(0.015), 1500) * 0.8 + 0.6 * sine(1900, 0.015)) * expenv(int(0.015 * SR), 0.0004, 0.004)
        sfx_out(c, t0 + t, 0.4 * g, pan=0.0, send=0.25)
        t += 0.14 - 0.1 * (t / 1.0); k += 1
    for j in range(3):
        fx_clank(t0 + 1.0 + j * 0.1, 0.9 * g, f=0.7)
    creak = sweep_noise(1.0, 600, 220, 9.0) * np.sin(np.linspace(0, np.pi, int(1.0 * SR))) ** 1.2
    sfx_out(creak, t0 + 1.1, 0.5 * g, send=0.3)
    fx_thud(t0 + 2.0, 0.9 * g)
    air = hp(noise(0.7), 2500) * arenv(int(0.7 * SR), 0.05, 0.5) * 0.4
    sfx_out(air, t0 + 1.2, 0.5 * g, send=0.3)
    for kk, f in enumerate((392.0, 587.3, 783.99, 987.8)):
        sfx_out(bell_tone(f, 1.6) * arenv(int(1.6 * SR), 0.1, 1.0), t0 + 1.6 + kk * 0.07, 0.12 * g, pan=-0.3 + 0.2 * kk, send=0.6)

def fx_slide(t0, d, g=1.0, **_):
    n = int(d * SR)
    sfx_out(lp(noise(d), 220, 2) * arenv(n, 0.1, 0.3), t0, 0.5 * g, send=0.15)
    sfx_out(bp(noise(d), 900, 2400, 2) * arenv(n, 0.15, 0.4) * 0.15, t0, g, send=0.2)

def fx_stamp(t0, g=1.0, **_):
    th = sine(105, 0.3) * expenv(int(0.3 * SR), 0.001, 0.09)
    cl = hp(noise(0.03), 2200) * expenv(int(0.03 * SR), 0.0004, 0.01)
    sfx_out(th, t0, 0.6 * g, send=0.2); sfx_out(cl, t0, 0.4 * g, send=0.2)

def fx_hit_red(t0, g=1.0, **_):
    d = 0.7
    s = (saw(220, d, 8) + saw(233.1, d, 8)) * expenv(int(d * SR), 0.003, 0.25)
    sfx_out(lp(s, 1800, 2), t0, 0.28 * g, send=0.3); sfx_out(hp(noise(0.2), 3000) * expenv(int(0.2 * SR), 0.001, 0.05), t0, 0.35 * g)

def fx_crash(t0, g=1.0, **_):
    d = 1.4
    n = int(d * SR)
    sfx_out(sweep_noise(d, 4200, 180, 1.2) * expenv(n, 0.01, 0.55), t0, 0.5 * g, send=0.3)
    fx_thud(t0 + 0.5, 1.0 * g)
    ph = np.cumsum(np.linspace(440, 110, n)) * 2 * np.pi / SR
    sfx_out(np.sin(ph) * expenv(n, 0.01, 0.5), t0, 0.12 * g, send=0.3)

def fx_cash(t0, g=1.0, **_):
    sfx_out(bell_tone(2093, 1.0, ((1, 1, 1), (2.4, 0.5, 0.6), (3.7, 0.3, 0.4))), t0, 0.28 * g, send=0.4)
    sfx_out(bell_tone(2637, 0.9, ((1, 1, 1), (2.4, 0.5, 0.6))), t0 + 0.07, 0.2 * g, pan=0.25, send=0.4)
    sfx_out(hp(noise(0.04), 4000) * expenv(int(0.04 * SR), 0.0003, 0.012), t0, 0.3 * g)
    fx_coins(t0 + 0.1, 0.7 * g)

def fx_trickle(t0, d, g=1.0, **_):
    for k in range(int(d * 9)):
        f = rng.uniform(2400, 4200)
        s = sine(f, 0.18) * expenv(int(0.18 * SR), 0.0006, 0.045)
        sfx_out(s, t0 + rng.uniform(0, d), 0.1 * g, pan=rng.uniform(-0.5, 0.5), send=0.3)

def fx_alarm(t0, d, g=1.0, **_):
    t = 0.0
    while t < d - 0.2:
        for k, f in enumerate((880.0, 660.0)):
            s = np.sign(np.sin(2 * np.pi * f * tt(0.13))) * 0.5 * arenv(int(0.13 * SR), 0.005, 0.03)
            sfx_out(lp(s, 3500, 2), t0 + t + k * 0.15, 0.25 * g, send=0.2)
        t += 0.42

def fx_zip(t0, g=1.0, f=1.0, **_):
    d = 0.4
    s = np.sin(2 * np.pi * np.cumsum(np.linspace(400, 1700, int(d * SR)) * f) / SR) * arenv(int(d * SR), 0.02, 0.2)
    sfx_out(s, t0, 0.14 * g, send=0.4); sfx_out(sweep_noise(d, 1200, 6000, 2) * arenv(int(d * SR), 0.05, 0.25), t0, 0.12 * g, send=0.3)

def fx_swell(t0, d, g=1.0, **_):
    n = int((d + 3) * SR)
    for f in (146.8, 220.0, 293.7, 369.99, 440.0):
        s = (saw(f, d + 3, 12) + saw(f, d + 3, 12, 0.004)) * arenv(n, d * 0.6, 3.0, 1.0)
        sfx_out(lp(s, 3000, 2), t0, 0.07 * g, send=0.5)
    sfx_out(sweep_noise(d, 400, 7000, 2.0) * np.linspace(0, 1, int(d * SR)) ** 2, t0, 0.22 * g, send=0.4)
    fx_impact(t0 + d * 0.7, 0.55 * g)

def fx_outro(t0, d, g=1.0, **_):
    n = int(d * SR)
    sfx_out(sweep_noise(d, 180, 9000, 1.6) * np.sin(np.linspace(0, np.pi * 0.9, n)) ** 1.4, t0, 0.35 * g, send=0.45)
    low = sine(55, d) * arenv(n, 1.0, 1.5) * 0.4
    sfx_out(low, t0, 0.5 * g, send=0.1)

FX = {k[3:]: v for k, v in list(globals().items()) if k.startswith("fx_")}
for cue in TL["cues"]:
    fn = FX.get(cue["k"])
    if fn is None:
        print("signal inconnu :", cue["k"]); continue
    kw = {kk: vv for kk, vv in cue.items() if kk not in ("t", "k")}
    fn(cue["t"], **kw)

# ---------------------------------------------------------------- musique
BPM = 100.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
CHORD_LEN = 2 * BAR
PROG = [
    ([50, 53, 57], 38),   # Dm  (basse D2)
    ([46, 50, 53], 34),   # Bb
    ([53, 57, 60], 41),   # F
    ([48, 52, 55], 36),   # C
]
ints = np.array(TL["intensity"])
def I(t):
    return np.interp(t, ints[:, 0], ints[:, 1])

s5 = TL["scenes"]["s5"]; s7 = TL["scenes"]["s7"]
line1 = next((c["t"] for c in TL["cues"] if c["k"] == "swell"), s7["t0"] + 12)
n_chords = int(math.ceil((DUR + 2) / CHORD_LEN))
pad_buf = np.zeros(N, np.float32)
sub_buf = np.zeros(N, np.float32)
for ci in range(n_chords):
    t0 = ci * CHORD_LEN
    notes, bass = PROG[ci % len(PROG)]
    if t0 >= line1 - 0.3:           # résolution finale en Ré majeur
        notes, bass = [50, 54, 57, 62], 38
    d = CHORD_LEN + 2.0
    dn = int(d * SR)
    chord = np.zeros(dn)
    for m in notes:
        f = mtof(m)
        chord += saw(f, d, 12) + saw(f, d, 12, 0.0045) + 0.7 * saw(f * 0.5, d, 8, -0.003)
    chord = lp(chord, 2600, 2) * arenv(dn, 1.6, 1.8, 1.0) * 0.06
    i0 = int(t0 * SR)
    if i0 < N:
        m = min(dn, N - i0); pad_buf[i0:i0 + m] += chord[:m]
    f = mtof(bass)
    bs = (np.sin(2 * np.pi * f * tt(d)) + 0.35 * np.sin(2 * np.pi * 2 * f * tt(d))) * arenv(dn, 0.4, 1.4) * 0.14
    if i0 < N:
        m = min(dn, N - i0); sub_buf[i0:i0 + m] += bs[:m]
tN = np.arange(N) / SR
Iv = I(tN).astype(np.float32)
put(music, pad_buf * (0.35 + 0.65 * Iv), 0, 1.0, 0.0)
put(music, sub_buf * Iv, 0, 1.0, 0.0)

# arpèges (à partir de la scène 2) ; pulsation (scène 3 → sauf scène 5) ; charleston (scène 4 →)
s2t0 = TL["scenes"]["s2"]["t0"]; s3t0 = TL["scenes"]["s3"]["t0"]; s4t0 = TL["scenes"]["s4"]["t0"]
step = BEAT / 2
k = 0
t = s2t0
while t < DUR - 1.0:
    ci = int(t // CHORD_LEN); notes, _ = PROG[ci % len(PROG)]
    if t >= line1 - 0.3: notes = [50, 54, 57, 62]
    pat = [0, 1, 2, 1, 0, 2, 1, 2]
    m = notes[pat[k % 8] % len(notes)] + (24 if (k // 8) % 2 else 12)
    amp = 0.1 * I(t) * (0.5 if s5["t0"] < t < s5["t1"] else 1.0)
    put(music, pluck(mtof(m), 0.4), t, amp, pan=-0.35 if k % 2 else 0.35)
    put(wet, pluck(mtof(m), 0.4), t, amp * 0.5, pan=0.0)
    t += step; k += 1
t = s3t0
while t < DUR - 2.0:
    if not (s5["t0"] + 1.0 < t < s5["t1"]):
        d = 0.28
        kick = np.sin(2 * np.pi * np.cumsum(np.linspace(130, 46, int(d * SR))) / SR) * expenv(int(d * SR), 0.001, 0.09)
        put(music, kick, t, 0.32 * I(t), 0.0)
    t += BEAT
t = s4t0 + step
while t < DUR - 2.0:
    if not (s5["t0"] + 1.0 < t < s5["t1"]):
        hat = hp(noise(0.05), 7500) * expenv(int(0.05 * SR), 0.0003, 0.012)
        put(music, hat, t, 0.08 * I(t), pan=0.3)
    t += BEAT

# réverbération courte sur la musique (profondeur)
def make_ir(rt60, d):
    n = int(d * SR)
    ir = np.zeros((n, 2))
    for ch in range(2):
        x = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / (rt60 * SR))
        ir[:, ch] = lp(x, 7000, 2)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True) + 1e-9) * 0.9

def reverb(bus, ir):
    out = np.zeros_like(bus)
    for ch in range(2):
        out[:, ch] = signal.fftconvolve(bus[:, ch], ir[:, ch], mode="full")[: len(bus)]
    return out

ir_long = make_ir(2.4, 2.6)
ir_short = make_ir(1.1, 1.2)
music_wet = reverb(music, ir_short)
sfx_wet = reverb(wet, ir_long)

# ---------------------------------------------------------------- narration
dur_json = json.load(open(os.path.join(ROOT, "assets/audio/narration/durations.json")))
for sid, info in TL["segments"].items():
    p = os.path.join(ROOT, "assets/audio/narration", sid + ".wav")
    x, sr0 = sf.read(p, dtype="float32")
    if x.ndim > 1: x = x.mean(axis=1)
    x = signal.resample_poly(x, SR // sr0, 1) if SR % sr0 == 0 else signal.resample(x, int(len(x) * SR / sr0))
    x = hp(x, 70, 2)
    rms = np.sqrt(np.mean(x ** 2) + 1e-9)
    x = x * (0.095 / rms)                      # ≈ -20,5 dBFS RMS
    x = np.tanh(x * 1.1) / 1.1                 # écrêtage doux
    put(narr, x, info["start"], 1.0, 0.0)
    put(wet, x, info["start"], 0.05, 0.0)

# atténuation de la musique sous la voix
env = np.abs(narr.mean(axis=1))
env = signal.sosfilt(signal.butter(2, 3.0, fs=SR, output="sos"), env)
duck = 1.0 - 0.52 * np.clip(env / 0.045, 0, 1)
duck = signal.sosfilt(signal.butter(1, 6.0, fs=SR, output="sos"), duck)

mix = (music + 0.9 * music_wet) * duck[:, None] * 0.9 + sfx * 0.85 + sfx_wet * 0.9 + narr * 1.0 + reverb(narr * 0.05, ir_short)
# fondus d'entrée/sortie
fi = np.minimum(1, tN / 0.5); fo = np.clip((DUR + 0.2 - tN) / 1.6, 0, 1)
mix *= (fi * fo)[:, None]
n_out = int((DUR + 0.2) * SR)
mix = mix[:n_out]
peak = np.max(np.abs(mix))
print("crête avant normalisation : %.2f" % peak)
mix = mix / max(1.0, peak / 0.92)
out = os.path.join(ROOT, "assets/audio/mix.wav")
sf.write(out, mix.astype(np.float32), SR, subtype="PCM_16")
print("écrit", out, "%.1f s" % (len(mix) / SR))
