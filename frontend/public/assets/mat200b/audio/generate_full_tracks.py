"""
Procedural CC0 mastering reference tracks (v2 — better quality).

Generates three 30-second mono 44.1kHz 16-bit WAV files in this directory:
  - edm_full.wav         heavy 4-on-the-floor electro
  - jazz_full.wav        walking-bass small-combo
  - orchestral_full.wav  string pad + horns + timpani + Schroeder reverb

v2 improvements over v1:
  - Anti-aliased oscillators (polyBLEP saw + square): no more zipper
    aliasing on high-frequency leads / pads.
  - Better drums: kick body has 3 pitch-sweep layers + click; snare is
    tone + rattled noise band; hi-hat is 6-square ringmod (808-style).
  - Proper mix-level balance per element (drums ~-12 dB, bass ~-15,
    lead ~-18, pad ~-20).
  - Schroeder allpass reverb (4 combs + 2 allpasses) on orchestral for
    space; subtle plate-style on jazz.
  - Smoother envelopes (cosine attack/release ramps; no clicks).
  - 5-7 detuned-voice unison saws on EDM lead and orchestral strings.

All synthesis is procedural (numpy + math); no third-party audio.
Output is dedicated to the public domain (CC0).

Run from this directory:  python generate_full_tracks.py
"""

from __future__ import annotations
import math
import os
import wave
import numpy as np

SR       = 44100
DUR_SEC  = 30.0
N        = int(SR * DUR_SEC)
HERE     = os.path.dirname(os.path.abspath(__file__))


# -- low-level helpers ----------------------------------------------------

def midi_to_hz(m): return 440.0 * (2.0 ** ((m - 69) / 12.0))

def normalize(x, peak=0.95):
    m = float(np.max(np.abs(x)))
    return x * (peak / m) if m > 1e-9 else x

def soft_clip(x, drive=1.0):
    return np.tanh(x * drive)

def write_wav_mono(path, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {os.path.basename(path)}: {len(pcm)/SR:.2f}s, {os.path.getsize(path)/1024:.0f} KB")

# Cosine attack/release ramp (smoother than linear, click-free).
def cos_attack(n_a):
    n_a = max(1, int(n_a))
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n_a) / n_a)

def cos_release(n_r):
    n_r = max(1, int(n_r))
    return 0.5 + 0.5 * np.cos(np.pi * np.arange(n_r) / n_r)

def ar_env(n, a_n, r_n, sus=1.0):
    a_n = max(1, int(a_n)); r_n = max(1, int(r_n))
    s_n = max(0, n - a_n - r_n)
    env = np.empty(n)
    env[:a_n] = sus * cos_attack(a_n)
    env[a_n:a_n + s_n] = sus
    env[a_n + s_n:] = sus * cos_release(n - a_n - s_n)
    return env

def adsr(n, a_n, d_n, sus, r_n):
    a_n = max(1, int(a_n)); d_n = max(1, int(d_n)); r_n = max(1, int(r_n))
    s_n = max(0, n - a_n - d_n - r_n)
    env = np.empty(n)
    env[:a_n] = cos_attack(a_n)
    env[a_n:a_n + d_n] = 1 + (sus - 1) * cos_attack(d_n)
    env[a_n + d_n:a_n + d_n + s_n] = sus
    env[a_n + d_n + s_n:] = sus * cos_release(n - a_n - d_n - s_n)
    return env

def biquad_lp(x, fc, q, sr=SR):
    w0 = 2 * np.pi * fc / sr
    cw, sw = np.cos(w0), np.sin(w0)
    a = sw / (2 * q)
    b0, b1, b2 = (1 - cw)/2, 1 - cw, (1 - cw)/2
    a0, a1, a2 = 1 + a, -2 * cw, 1 - a
    b0, b1, b2, a1, a2 = b0/a0, b1/a0, b2/a0, a1/a0, a2/a0
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        out = b0*v + b1*x1 + b2*x2 - a1*y1 - a2*y2
        y[i] = out; x2 = x1; x1 = v; y2 = y1; y1 = out
    return y

def biquad_hp(x, fc, q, sr=SR):
    w0 = 2 * np.pi * fc / sr
    cw, sw = np.cos(w0), np.sin(w0)
    a = sw / (2 * q)
    b0, b1, b2 = (1 + cw)/2, -(1 + cw), (1 + cw)/2
    a0, a1, a2 = 1 + a, -2 * cw, 1 - a
    b0, b1, b2, a1, a2 = b0/a0, b1/a0, b2/a0, a1/a0, a2/a0
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        out = b0*v + b1*x1 + b2*x2 - a1*y1 - a2*y2
        y[i] = out; x2 = x1; x1 = v; y2 = y1; y1 = out
    return y


# -- polyBLEP anti-aliased oscillators -----------------------------------

def _polyblep(t, dt):
    # t and dt are same-shape arrays; dt = freq/sr per-sample.
    out = np.zeros_like(t)
    m1 = t < dt
    tt = t[m1] / dt[m1]
    out[m1] = tt + tt - tt * tt - 1.0
    m2 = t > 1.0 - dt
    tt = (t[m2] - 1.0) / dt[m2]
    out[m2] = tt * tt + tt + tt + 1.0
    return out

def polyblep_saw(freq, n_samples, sr=SR, phase0=0.0):
    """Bandlimited saw via polyBLEP. freq scalar or array."""
    dt = (np.full(n_samples, freq, dtype=np.float64) if np.isscalar(freq)
          else np.asarray(freq, dtype=np.float64)) / sr
    t = (phase0 + np.cumsum(dt)) % 1.0
    s = 2.0 * t - 1.0
    s -= _polyblep(t, dt)
    return s

def polyblep_square(freq, n_samples, sr=SR, phase0=0.0):
    dt = (np.full(n_samples, freq, dtype=np.float64) if np.isscalar(freq)
          else np.asarray(freq, dtype=np.float64)) / sr
    t = (phase0 + np.cumsum(dt)) % 1.0
    s = np.where(t < 0.5, 1.0, -1.0)
    s += _polyblep(t, dt)
    t2 = (t + 0.5) % 1.0
    s -= _polyblep(t2, dt)
    return s


# -- Schroeder allpass reverb --------------------------------------------

def schroeder_reverb(x, mix=0.25, decay=0.5):
    """Cheap stereo-flavoured-but-mono Schroeder: 4 combs + 2 APs."""
    # comb delays in ms, primes-ish so it diffuses
    comb_ms = [29.7, 37.1, 41.1, 43.7]
    ap_ms   = [5.0, 1.7]
    out = np.zeros_like(x)
    # Combs in parallel, summed
    for ms in comb_ms:
        d = max(1, int(ms * SR / 1000.0))
        buf = np.zeros(d)
        idx = 0
        y = np.empty_like(x)
        g = 0.84 * decay
        for i, v in enumerate(x):
            r = buf[idx]
            buf[idx] = v + r * g
            y[i] = r
            idx += 1
            if idx >= d: idx = 0
        out += y * 0.25
    # Allpasses in series
    for ms in ap_ms:
        d = max(1, int(ms * SR / 1000.0))
        buf = np.zeros(d)
        idx = 0
        y = np.empty_like(out)
        g = 0.7
        for i, v in enumerate(out):
            r = buf[idx]
            o = -v + r
            buf[idx] = v + g * r
            y[i] = o
            idx += 1
            if idx >= d: idx = 0
        out = y
    return x * (1.0 - mix) + out * mix


# =========================================================================
#                                 EDM
# =========================================================================
# 128 BPM, 4/4. 30s = 64 beats = 16 bars.
# Structure: intro(0-3), build(4-7), drop1(8-11), break(12-13), drop2(14-15)

def gen_edm():
    rng = np.random.default_rng(0xED)
    bpm = 128
    beat_n = int(SR * 60.0 / bpm)
    bar_n = beat_n * 4
    out = np.zeros(N)

    # ----- Kick: 3-layer body (sub sweep + thud + sine click) ----------
    def kick(start, gain=1.0):
        L = int(0.45 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        # Layer 1: deep sub sweep 200 -> 45 Hz, slow body
        p1 = 45 + (200 - 45) * np.exp(-tt * 35)
        sub = np.sin(2 * np.pi * np.cumsum(p1) / SR) * np.exp(-tt * 7)
        # Layer 2: punch sweep 300 -> 80 Hz, faster
        p2 = 80 + (300 - 80) * np.exp(-tt * 80)
        punch = np.sin(2 * np.pi * np.cumsum(p2) / SR) * np.exp(-tt * 18)
        # Layer 3: click (200 Hz tone, 5 ms decay)
        click = np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 400) * 0.25
        # Slight saturation
        body = np.tanh(sub * 1.2 + punch * 0.9) + click
        # Anti-click attack
        body[:64] *= np.linspace(0, 1, 64)
        out[start:start + L] += body * gain * 0.85

    # ----- Snare: tone + filtered noise + bandpass body ----------------
    def snare(start, gain=0.7):
        L = int(0.25 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        tone = np.sin(2 * np.pi * 200 * tt) * np.exp(-tt * 22)
        n = rng.standard_normal(L)
        n_hp = biquad_hp(n, 1500, 1.0)
        n_env = np.exp(-tt * 14)
        body = (tone * 0.30 + n_hp * 0.85 * n_env)
        body[:32] *= np.linspace(0, 1, 32)
        out[start:start + L] += body * gain * 0.55

    # ----- Closed hat: 6-square ringmod (808-ish metallic) -------------
    def hat(start, gain=0.4):
        L = int(0.06 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        freqs = [9520, 7720, 6270, 5400, 4860, 3260]
        s = np.zeros(L)
        for f in freqs:
            s += np.sign(np.sin(2 * np.pi * f * tt))
        s = biquad_hp(s, 7000, 1.0)
        env = np.exp(-tt * 90)
        out[start:start + L] += s * env * gain * 0.04

    # ----- Bass: polyBLEP saw + filter env -----------------------------
    def bass(start, dur, midi):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        f = midi_to_hz(midi)
        s = polyblep_saw(f, dur) * 0.6 + polyblep_square(f, dur) * 0.4
        # Filter env: 1500 -> 250 Hz exp decay, time-varying via 2 LP filters blended
        s_lp1 = biquad_lp(s, 1500, 1.0)
        s_lp2 = biquad_lp(s, 280, 0.9)
        env_filt = np.exp(-tt * 9)
        s = s_lp1 * env_filt + s_lp2 * (1 - env_filt) * 0.6
        amp_env = (1 - np.exp(-tt * 200)) * np.exp(-tt * 4.5)
        out[start:start + dur] += s * amp_env * 0.32

    # ----- Lead: 5-voice detuned saw with filter sweep -----------------
    def lead_voice(start, dur, midi):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        f = midi_to_hz(midi)
        s = np.zeros(dur)
        detunes = [-0.012, -0.006, 0.0, 0.005, 0.011]
        phases  = [0.0, 0.13, 0.41, 0.67, 0.89]
        for d, p0 in zip(detunes, phases):
            s += polyblep_saw(f * (1.0 + d), dur, phase0=p0) * 0.20
        s = biquad_lp(s, 2200, 0.85)
        env = ar_env(dur, int(0.005 * SR), int(0.05 * SR), sus=1.0) \
              * np.exp(-tt * 3.5)
        out[start:start + dur] += s * env * 0.21

    def lead_phrase(start, notes, dur_per_note):
        cur = start
        for m in notes:
            lead_voice(cur, dur_per_note, m)
            cur += dur_per_note

    # ----- Pad: 5-saw chord (root, 3rd or m3, 5th, octave, +12) --------
    def pad_chord(start, dur, root, kind='min'):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        ivs = [0, (3 if kind == 'min' else 4), 7, 12, 19]
        s = np.zeros(dur)
        for i, iv in enumerate(ivs):
            f = midi_to_hz(root + iv)
            for d, p0 in zip([-0.004, 0.003], [0.1 + 0.2*i, 0.5 + 0.2*i]):
                s += polyblep_saw(f * (1.0 + d), dur, phase0=p0) * 0.18
        s = biquad_lp(s, 1100, 0.55)
        env = ar_env(dur, int(0.30 * SR), int(0.30 * SR), sus=0.85)
        out[start:start + dur] += s * env * 0.13

    # ----- Riser noise sweep (build) -----------------------------------
    def riser(start, dur):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        # Sweep cutoff 200 -> 8000 Hz
        n = rng.standard_normal(dur)
        # Approximate sweeping HP via two HP filters at endpoints + crossfade
        n_lo = biquad_hp(n, 200, 0.9)
        n_hi = biquad_hp(n, 6000, 0.9)
        cf = (tt / tt[-1]) ** 2
        n_swept = n_lo * (1 - cf) + n_hi * cf
        env = (tt / tt[-1]) ** 1.5
        out[start:start + dur] += n_swept * env * 0.08

    # Schedule -----------------------------------------------------------
    chord_prog = [(57, 'min'), (53, 'maj'), (48, 'maj'), (55, 'maj')]
    bars = 16
    for bar in range(bars):
        bar_start = bar * bar_n
        root, kind = chord_prog[bar % 4]
        pad_chord(bar_start, bar_n, root + 12, kind)

        is_intro = bar < 4
        is_build = 4 <= bar < 8
        is_drop  = (8 <= bar < 12) or (bar >= 14)
        is_break = 12 <= bar < 14

        if is_drop:
            for b in range(4): kick(bar_start + b * beat_n, 1.0)
            snare(bar_start + 1 * beat_n)
            snare(bar_start + 3 * beat_n)
            for sub in range(8):
                hat(bar_start + sub * (beat_n // 2),
                    gain=0.45 if sub % 2 == 1 else 0.30)
            for sub in range(8):
                bass(bar_start + sub * (beat_n // 2), beat_n // 2, root - 12)
        elif is_build:
            for b in range(4):
                kick(bar_start + b * beat_n, gain=0.55 + 0.15 * b)
            for sub in range(8):
                hat(bar_start + sub * (beat_n // 2), gain=0.25)
            if bar == 7:
                riser(bar_start, bar_n)
        elif is_intro:
            if bar >= 2:
                kick(bar_start, gain=0.8)
                kick(bar_start + 2 * beat_n, gain=0.8)
        else:  # break
            phrase = [69, 72, 76, 79]
            lead_phrase(bar_start, phrase, beat_n)

        if bar >= 14:
            phrase = [69, 72, 76, 72, 74, 72, 69, 67]
            lead_phrase(bar_start, phrase, beat_n // 2)

    # Bus chain
    out = soft_clip(out, drive=0.95)
    out = normalize(out, peak=0.78)
    return out


# =========================================================================
#                                 JAZZ
# =========================================================================
# 120 BPM, 4/4 swing. 30s = 60 beats = 15 bars.
# Bb blues changes.

def gen_jazz():
    rng = np.random.default_rng(0xEAA)
    bpm = 120
    beat_n = int(SR * 60.0 / bpm)
    bar_n = beat_n * 4
    out = np.zeros(N)

    blues_roots = [58, 63, 58, 58, 63, 63, 58, 58,
                   65, 63, 58, 65, 58, 63, 58]   # 15 bars

    # ----- Walking bass: each beat, scale-tone choice -----------------
    def walk(start, midi):
        L = beat_n
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        f = midi_to_hz(midi)
        # Upright-bass: sine + soft saw + slight pluck
        body = (np.sin(2 * np.pi * f * tt) * 0.7 +
                polyblep_saw(f, L) * 0.18)
        body = biquad_lp(body, 480, 0.7)
        pluck = np.exp(-tt * 28) * 0.4
        env = (1 - np.exp(-tt * 250)) * (0.3 + 0.7 * np.exp(-tt * 3.5))
        out[start:start + L] += body * env * 0.55 + body * pluck * 0.15

    # ----- Brush swish: noise band with slow envelope ------------------
    def swish(start):
        L = beat_n
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        n = rng.standard_normal(L)
        n = biquad_hp(n, 4000, 0.85)
        env = (0.4 + 0.6 * np.sin(np.pi * tt / (L / SR)) ** 2) * 0.7
        out[start:start + L] += n * env * 0.025

    # ----- Ride cymbal: bell tone + noise ------------------------------
    def ride(start, gain=0.20):
        L = int(0.30 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        n = rng.standard_normal(L)
        n = biquad_hp(n, 5000, 0.95)
        bell = (np.sin(2 * np.pi * 3500 * tt) * 0.5 +
                np.sin(2 * np.pi * 4180 * tt) * 0.4 +
                np.sin(2 * np.pi * 5300 * tt) * 0.25)
        env = np.exp(-tt * 12)
        out[start:start + L] += (n * 0.6 + bell * 0.5) * env * gain

    # ----- Soft kick on 1 & 3 ------------------------------------------
    def kick_soft(start):
        L = int(0.22 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        p = 60 + (160 - 60) * np.exp(-tt * 45)
        body = np.sin(2 * np.pi * np.cumsum(p) / SR) * np.exp(-tt * 11)
        body[:32] *= np.linspace(0, 1, 32)
        out[start:start + L] += body * 0.35

    # ----- Snare brush hit (2 & 4) -------------------------------------
    def brush_hit(start):
        L = int(0.12 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        n = rng.standard_normal(L)
        n = biquad_hp(n, 3500, 0.9)
        env = np.exp(-tt * 24)
        out[start:start + L] += n * env * 0.10

    # ----- Piano comp: shell voicing on 2 & 4 --------------------------
    def piano(start, root):
        L = int(0.40 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        # Shell: root, 7, 3, 5
        voicings = [root + 12, root + 22, root + 16, root + 19]
        s = np.zeros(L)
        for v in voicings:
            f = midi_to_hz(v)
            note = (np.sin(2 * np.pi * f * tt) * 0.85 +
                    np.sin(2 * np.pi * 2 * f * tt) * 0.20 +
                    np.sin(2 * np.pi * 3 * f * tt) * 0.08)
            note *= np.exp(-tt * 4.5) * (1 - np.exp(-tt * 600))
            s += note * 0.22
        out[start:start + L] += s * 0.40

    # ----- Sax/horn: 5-saw unison + LP + vibrato -----------------------
    def sax(start, dur, midi):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        f = midi_to_hz(midi)
        vib = np.sin(2 * np.pi * 5.5 * tt) * 0.012
        f_mod = f * (1.0 + vib)
        s = np.zeros(dur)
        for d, p0 in zip([-0.004, 0.0, 0.005], [0.1, 0.4, 0.7]):
            phase = 2 * np.pi * np.cumsum(f_mod * (1.0 + d)) / SR
            s += (np.sign(np.sin(phase)) * 0.35 +
                  np.sin(phase) * 0.55 +
                  np.sin(phase * 3) * 0.15) * 0.32
        s = biquad_lp(s, 2400, 0.7)
        env = ar_env(dur, int(0.06 * SR), int(0.20 * SR), sus=0.85)
        out[start:start + dur] += s * env * 0.22

    # Schedule
    for bar, root in enumerate(blues_roots):
        bs = bar * bar_n
        # Bass
        scale = [0, 3, 4, 5, 7, 9, 10]
        offs = rng.choice(scale, size=4, replace=True)
        for b in range(4):
            walk(bs + b * beat_n, root - 12 + int(offs[b]))
        # Drums
        for b in range(4):
            ride(bs + b * beat_n)
            swish(bs + b * beat_n)
        kick_soft(bs)
        kick_soft(bs + 2 * beat_n)
        brush_hit(bs + 1 * beat_n)
        brush_hit(bs + 3 * beat_n)
        # Comp
        piano(bs + 1 * beat_n, root)
        piano(bs + 3 * beat_n, root)
        # Sax
        if bar % 2 == 0 and bar >= 2:
            scale_for_phrase = [0, 2, 3, 5, 7, 8, 10]
            phr = [root + 12 + int(rng.choice(scale_for_phrase)) for _ in range(4)]
            for i, p in enumerate(phr):
                sax(bs + i * beat_n,
                    beat_n + (beat_n // 4 if i == 3 else 0), p)

    # Subtle plate-style reverb
    out = schroeder_reverb(out, mix=0.10, decay=0.55)
    out = soft_clip(out, drive=0.7)
    out = normalize(out, peak=0.72)
    return out


# =========================================================================
#                              ORCHESTRAL
# =========================================================================
# 64 BPM, 4/4. C minor: i-iv-V-i-VI-iv-V-i.

def gen_orchestral():
    rng = np.random.default_rng(0x0AC)
    bpm = 64
    beat_n = int(SR * 60.0 / bpm)
    bar_n = beat_n * 4
    out = np.zeros(N)

    chord_prog = [(48, 'min'), (53, 'min'), (55, 'dom'), (48, 'min'),
                  (56, 'maj'), (53, 'min'), (55, 'dom'), (48, 'min')]

    # ----- Strings: 7-saw unison per chord tone with vibrato -----------
    def strings(start, dur, root, kind):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        if kind == 'min':   ivs = [0, 3, 7, 12, 15, 19]
        elif kind == 'dom': ivs = [0, 4, 7, 10, 12, 16]
        else:               ivs = [0, 4, 7, 12, 16, 19]
        chord = np.zeros(dur)
        for iv in ivs:
            f = midi_to_hz(root + 12 + iv)
            vib = np.sin(2 * np.pi * (4.8 + iv * 0.05) * tt + iv * 0.7) * 0.005
            for d, p0 in zip([-0.010, -0.005, 0.0, 0.004, 0.008],
                             [0.1, 0.3, 0.5, 0.7, 0.9]):
                ff = f * (1.0 + d) * (1.0 + vib)
                chord += polyblep_saw(ff, dur, phase0=p0) * 0.085
        chord = biquad_lp(chord, 1700, 0.55)
        env = ar_env(dur, int(0.40 * SR), int(0.55 * SR), sus=0.85)
        out[start:start + dur] += chord * env * 0.11

    # ----- Cello: deep sine + saw, slow attack ------------------------
    def cello(start, dur, midi):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        f = midi_to_hz(midi)
        vib = np.sin(2 * np.pi * 4.5 * tt) * 0.008
        ff = f * (1.0 + vib)
        phase = 2 * np.pi * np.cumsum(ff) / SR
        s = np.sin(phase) * 0.7 + (2 * (phase / (2 * np.pi) % 1.0) - 1.0) * 0.3
        s = biquad_lp(s, 800, 0.7)
        env = ar_env(dur, int(0.20 * SR), int(0.55 * SR), sus=0.85)
        out[start:start + dur] += s * env * 0.32

    # ----- French horn: square + harmonics + vibrato -------------------
    def horn(start, dur, midi):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        f = midi_to_hz(midi)
        vib = np.sin(2 * np.pi * 4.8 * tt) * 0.010
        ff = f * (1.0 + vib)
        phase = 2 * np.pi * np.cumsum(ff) / SR
        s = (np.sign(np.sin(phase)) * 0.30 +
             np.sin(phase) * 0.55 +
             np.sin(phase * 3) * 0.16 +
             np.sin(phase * 5) * 0.07)
        s = biquad_lp(s, 2000, 0.7)
        env = ar_env(dur, int(0.18 * SR), int(0.35 * SR), sus=0.80)
        out[start:start + dur] += s * env * 0.20

    # ----- Timpani -----------------------------------------------------
    def timpani(start, midi=43, gain=1.0):
        L = int(0.85 * SR)
        if start + L > N: L = N - start
        if L <= 0: return
        tt = np.arange(L) / SR
        f = midi_to_hz(midi)
        body = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5.5) +
                np.sin(2 * np.pi * f * 1.5 * tt) * 0.3 * np.exp(-tt * 7.5) +
                np.sin(2 * np.pi * f * 2.0 * tt) * 0.15 * np.exp(-tt * 9))
        n = rng.standard_normal(L) * np.exp(-tt * 28) * 0.18
        attack = (1 - np.exp(-tt * 600))
        out[start:start + L] += (body * attack + n) * gain * 0.36

    def cymbal(start, dur):
        if start + dur > N: dur = N - start
        if dur <= 0: return
        tt = np.arange(dur) / SR
        n = rng.standard_normal(dur)
        n = biquad_hp(n, 6000, 0.95)
        env = (tt / tt[-1]) ** 2
        out[start:start + dur] += n * env * 0.07

    horn_melody = [
        (0, 0, 67, 4),
        (1, 0, 65, 2), (1, 2, 63, 2),
        (2, 0, 67, 2), (2, 2, 71, 2),
        (3, 0, 72, 2), (3, 2, 71, 2),
        (4, 0, 75, 4),
        (5, 0, 72, 2), (5, 2, 70, 2),
        (6, 0, 71, 2), (6, 2, 74, 2),
        (7, 0, 72, 4),
    ]

    for bar, (root, kind) in enumerate(chord_prog):
        bs = bar * bar_n
        strings(bs, bar_n, root, kind)
        cello(bs, bar_n, root - 12)
        if bar in (0, 4):
            timpani(bs, midi=root - 12, gain=0.95)
        if bar == 4:
            cymbal(bs, int(beat_n * 1.8))
        if bar == 7:
            for r in range(8):
                timpani(bs + r * (beat_n // 2), midi=43, gain=0.55)

    for bar, beat, midi, dur_b in horn_melody:
        s_pos = bar * bar_n + beat * beat_n
        d = dur_b * beat_n
        horn(s_pos, d, midi)

    # Schroeder reverb gives the orchestra hall depth
    out = schroeder_reverb(out, mix=0.30, decay=0.70)
    out = soft_clip(out, drive=0.6)
    out = normalize(out, peak=0.68)
    return out


# -- main ----------------------------------------------------------------

if __name__ == '__main__':
    print(f"Generating v2 mastering tracks: {DUR_SEC:.0f}s @ {SR} Hz mono 16-bit")
    write_wav_mono(os.path.join(HERE, 'edm_full.wav'),         gen_edm())
    write_wav_mono(os.path.join(HERE, 'jazz_full.wav'),        gen_jazz())
    write_wav_mono(os.path.join(HERE, 'orchestral_full.wav'),  gen_orchestral())
    print("Done.")
