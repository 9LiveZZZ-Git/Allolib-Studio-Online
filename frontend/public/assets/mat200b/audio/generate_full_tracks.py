"""
Procedural CC0 mastering reference tracks.

Generates three 30-second mono 44.1kHz 16-bit WAV files in this directory:
  - edm_full.wav         heavy 4-on-the-floor electro
  - jazz_full.wav        walking-bass small-combo
  - orchestral_full.wav  string pad + horns + timpani

All synthesis is procedural (math.sin / math.exp / random); no third-party
audio is sampled or quoted. Output is dedicated to the public domain (CC0).

Run from this directory:  python generate_full_tracks.py
"""

from __future__ import annotations
import math
import random
import struct
import wave
import os
import numpy as np

SR       = 44100
DUR_SEC  = 30.0
N        = int(SR * DUR_SEC)
HERE     = os.path.dirname(os.path.abspath(__file__))


# -- helpers --------------------------------------------------------------

def sine(freq, t, phase=0.0):
    return np.sin(2.0 * np.pi * freq * t + phase)

def saw(freq, t, phase=0.0):
    return 2.0 * ((freq * t + phase / (2 * np.pi)) % 1.0) - 1.0

def square(freq, t, phase=0.0, duty=0.5):
    return np.where(((freq * t + phase / (2 * np.pi)) % 1.0) < duty, 1.0, -1.0)

def adsr(n, a, d, s, r, sus_amp=0.7):
    """Length-n ADSR envelope. a/d/r in samples, sus_amp in [0,1]."""
    env = np.zeros(n)
    a, d, r = max(1, int(a)), max(1, int(d)), max(1, int(r))
    s = max(0, n - a - d - r)
    env[:a] = np.linspace(0, 1, a)
    env[a:a+d] = np.linspace(1, sus_amp, d)
    env[a+d:a+d+s] = sus_amp
    env[a+d+s:a+d+s+r] = np.linspace(sus_amp, 0, r)
    return env

def expdec(n, tau_samples):
    return np.exp(-np.arange(n) / max(1.0, tau_samples))

def onepole_lp(x, alpha):
    """alpha in (0,1): smaller = darker. y[n] = (1-a)x + a y[n-1]."""
    y = np.empty_like(x)
    s = 0.0
    one_minus_a = 1.0 - alpha
    for i, v in enumerate(x):
        s = one_minus_a * v + alpha * s
        y[i] = s
    return y

def biquad_lp(x, fc, q, sr=SR):
    """Simple biquad lowpass via RBJ cookbook."""
    w0 = 2 * np.pi * fc / sr
    cos_w0 = np.cos(w0)
    sin_w0 = np.sin(w0)
    a = sin_w0 / (2 * q)
    b0 = (1 - cos_w0) / 2
    b1 = 1 - cos_w0
    b2 = (1 - cos_w0) / 2
    a0 = 1 + a
    a1 = -2 * cos_w0
    a2 = 1 - a
    b0, b1, b2, a1, a2 = b0/a0, b1/a0, b2/a0, a1/a0, a2/a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        out = b0*v + b1*x1 + b2*x2 - a1*y1 - a2*y2
        y[i] = out
        x2 = x1
        x1 = v
        y2 = y1
        y1 = out
    return y

def hp_simple(x, alpha=0.995):
    """One-zero/one-pole highpass: y[n] = x[n] - x[n-1] + alpha y[n-1]."""
    y = np.empty_like(x)
    px = py = 0.0
    for i, v in enumerate(x):
        out = v - px + alpha * py
        y[i] = out
        px = v
        py = out
    return y

def normalize(x, peak=0.95):
    m = np.max(np.abs(x))
    if m > 1e-9:
        x = x * (peak / m)
    return x

def soft_clip(x, drive=1.2):
    return np.tanh(x * drive)

def write_wav_mono(path, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {path}: {len(pcm)/SR:.2f}s, {os.path.getsize(path)/1024:.0f} KB")

def midi_to_hz(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


# -- EDM ------------------------------------------------------------------
# 128 BPM, 4/4. 30s = 64 beats = 16 bars.
# Structure (4 bars each): intro, build, drop1, breakdown, drop2.

def gen_edm():
    rng = np.random.default_rng(0xED)
    bpm = 128
    beat_s = 60.0 / bpm
    beat_n = int(beat_s * SR)

    out = np.zeros(N)
    t = np.arange(N) / SR

    # ----- Kick: pitched sine + click + body
    def kick(start_samp, gain=1.0):
        L = int(0.30 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        pitch = 50 + (180 - 50) * np.exp(-tt * 60)
        body = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
        amp = np.exp(-tt * 12) * (1 - np.exp(-tt * 200))
        click = (rng.standard_normal(L) * np.exp(-tt * 80)) * 0.12
        out[start_samp:start_samp + L] += (body * amp + click) * gain * 0.95

    # ----- Closed hat
    def hat(start_samp, gain=0.4):
        L = int(0.06 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        n = rng.standard_normal(L)
        n = hp_simple(n)
        env = np.exp(-tt * 70)
        out[start_samp:start_samp + L] += n * env * gain * 0.6

    # ----- Snare/clap on beats 2 and 4
    def snare(start_samp, gain=0.55):
        L = int(0.18 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        body = np.sin(2 * np.pi * 200 * tt) * np.exp(-tt * 25)
        noise = rng.standard_normal(L) * np.exp(-tt * 18)
        noise = hp_simple(noise, alpha=0.97)
        out[start_samp:start_samp + L] += (body * 0.4 + noise) * gain * 0.55

    # ----- Bass: square at A1 with filter env (per bar)
    def bass_note(start_samp, dur_samp, midi):
        if start_samp + dur_samp > N:
            dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        f = midi_to_hz(midi)
        sq = square(f, tt) * 0.5 + saw(f, tt) * 0.5
        # AD-shaped filter sweep 1500 -> 200 over 80% of note
        env = np.exp(-tt * 8)
        fc = 200 + 1300 * env
        # Approximate: time-varying biquad would be expensive — do a
        # smoother static filter then amp-modulate by env.
        flt = biquad_lp(sq, 800, 0.9)
        amp = (1 - np.exp(-tt * 80)) * env
        out[start_samp:start_samp + dur_samp] += flt * amp * 0.45

    # ----- Lead: sawtooth melody during drops
    def lead_phrase(start_samp, beats_pattern, dur_per_beat):
        cur = start_samp
        for midi in beats_pattern:
            L = dur_per_beat
            if cur + L > N: L = N - cur
            if L <= 0: break
            tt = np.arange(L) / SR
            f = midi_to_hz(midi)
            s = saw(f, tt) * 0.6 + saw(f * 1.005, tt) * 0.4  # detuned saws
            flt = biquad_lp(s, 2200, 0.7)
            env = (1 - np.exp(-tt * 100)) * np.exp(-tt * 4)
            out[cur:cur + L] += flt * env * 0.35
            cur += L

    # ----- Pad: chord progression (Am-F-C-G), saw stack
    def pad_chord(start_samp, dur_samp, midi_root, kind='min'):
        if start_samp + dur_samp > N:
            dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        if kind == 'min':
            intervals = [0, 3, 7, 12]
        else:
            intervals = [0, 4, 7, 12]
        chord = np.zeros(dur_samp)
        for iv in intervals:
            f = midi_to_hz(midi_root + iv)
            chord += saw(f, tt) * 0.25
            chord += saw(f * 1.003, tt) * 0.20
        chord = biquad_lp(chord, 1100, 0.6)
        env = adsr(dur_samp, int(0.4 * SR), int(0.1 * SR), 0,
                   int(0.3 * SR), sus_amp=0.7)
        out[start_samp:start_samp + dur_samp] += chord * env * 0.18

    # Schedule
    bars = 16
    bar_n = beat_n * 4
    chord_prog = [(57, 'min'), (53, 'maj'), (48, 'maj'), (55, 'maj')]  # Am F C G

    for bar in range(bars):
        bar_start = bar * bar_n
        # Pad — every bar, full duration, follow chord cycle
        root, kind = chord_prog[bar % 4]
        pad_chord(bar_start, bar_n, root + 12, kind)

        # Intro (bars 0-3): only pad + sparse kick
        # Build (bars 4-7): pad + kick + ramping hat
        # Drop1 (bars 8-11): full
        # Breakdown (bars 12-13): pad + lead
        # Drop2 (bars 14-15): full
        is_intro = bar < 4
        is_build = 4 <= bar < 8
        is_drop = 8 <= bar < 12 or bar >= 14
        is_break = 12 <= bar < 14

        # Kick: 4 on the floor (every beat)
        if is_drop:
            for b in range(4):
                kick(bar_start + b * beat_n)
        elif is_build:
            for b in range(4):
                kick(bar_start + b * beat_n, gain=0.5 + 0.15 * b)
        elif is_intro and bar >= 2:
            kick(bar_start)
            kick(bar_start + 2 * beat_n)

        # Snare/clap on beats 2 and 4 during drop
        if is_drop:
            snare(bar_start + 1 * beat_n)
            snare(bar_start + 3 * beat_n)

        # Hi-hat on offbeats during build/drop
        if is_drop or is_build:
            for sub in range(8):
                hat(bar_start + sub * (beat_n // 2), gain=0.3 if is_build else 0.4)

        # Bass: 1/8th note pattern during drop
        if is_drop:
            bass_root = root - 12
            for sub in range(8):
                bass_note(bar_start + sub * (beat_n // 2), beat_n // 2, bass_root)

        # Lead during drop2 + breakdown
        if bar >= 14:
            phrase = [69, 72, 76, 72, 74, 72, 69, 67]  # A4 melody
            lead_phrase(bar_start, phrase, beat_n // 2)
        elif is_break:
            phrase = [69, 72, 76, 79]
            lead_phrase(bar_start, phrase, beat_n)

    # Bus: gentle soft clip + normalize to -3 dB FS (so mastering A/B has headroom)
    out = soft_clip(out, drive=0.85)
    out = normalize(out, peak=0.70)
    return out


# -- Jazz -----------------------------------------------------------------
# 120 BPM swing, 4/4. 30s = 60 beats = 15 bars.
# Walking bass + brush drums + piano comp + sax-like melody.

def gen_jazz():
    rng = np.random.default_rng(0xEAA)
    bpm = 120
    beat_s = 60.0 / bpm
    beat_n = int(beat_s * SR)
    out = np.zeros(N)

    # Bb blues changes: Bb7-Eb7-Bb7-Bb7  Eb7-Eb7-Bb7-Bb7  F7-Eb7-Bb7-F7  +3 more bars
    # Roots in MIDI: Bb=58, Eb=63, F=65
    blues_roots = [58, 63, 58, 58, 63, 63, 58, 58, 65, 63, 58, 65,
                   58, 63, 58]  # 15 bars

    # ----- Walking bass: quarter notes, mostly chord tones
    def walk_note(start_samp, midi):
        L = beat_n
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        f = midi_to_hz(midi)
        # Upright-bass-ish: sine + slight saw + pluck attack
        body = np.sin(2 * np.pi * f * tt) * 0.75 + saw(f, tt) * 0.15
        body = biquad_lp(body, 600, 0.7)
        attack = np.exp(-tt * 35)
        env = (1 - np.exp(-tt * 200)) * (0.4 + 0.6 * np.exp(-tt * 4))
        out[start_samp:start_samp + L] += body * env * 0.55 + body[:L] * attack * 0.1

    # ----- Brush drums: snare swish + light cymbal ride pattern
    def brush_swish(start_samp):
        L = beat_n
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        n = rng.standard_normal(L)
        n = hp_simple(n, alpha=0.96)
        env = 0.3 + 0.7 * np.sin(2 * np.pi * 1.0 * tt + np.pi/2) ** 2
        out[start_samp:start_samp + L] += n * env * 0.04

    def ride(start_samp, gain=0.18):
        L = int(0.20 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        n = rng.standard_normal(L)
        n = hp_simple(n, alpha=0.985)
        # Bell-like sine layer
        bell = np.sin(2 * np.pi * 3500 * tt) * 0.15 + np.sin(2 * np.pi * 4200 * tt) * 0.1
        env = np.exp(-tt * 18)
        out[start_samp:start_samp + L] += (n * 0.7 + bell) * env * gain

    def kick_soft(start_samp):
        L = int(0.18 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        f = 60 + (140 - 60) * np.exp(-tt * 50)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 12)
        out[start_samp:start_samp + L] += body * 0.35

    # ----- Piano comp: shell voicing on beats 2 and 4
    def piano_comp(start_samp, midi_root, kind='dom7'):
        L = int(0.30 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        if kind == 'dom7':
            voicings = [midi_root + 12, midi_root + 16, midi_root + 22, midi_root + 24]  # 1-3-7-1
        else:
            voicings = [midi_root + 12, midi_root + 15, midi_root + 19, midi_root + 22]
        chord = np.zeros(L)
        for v in voicings:
            f = midi_to_hz(v)
            # Piano-ish: sine + 2 harmonics + decay
            p = (np.sin(2*np.pi*f*tt) * 0.8 +
                 np.sin(2*np.pi*2*f*tt) * 0.25 +
                 np.sin(2*np.pi*3*f*tt) * 0.10)
            p *= np.exp(-tt * 6) * (1 - np.exp(-tt * 800))
            chord += p * 0.25
        out[start_samp:start_samp + L] += chord * 0.45

    # ----- Sax/trumpet melody: sustained tones with vibrato
    def sax_note(start_samp, dur_samp, midi):
        if start_samp + dur_samp > N: dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        f = midi_to_hz(midi)
        vib = np.sin(2 * np.pi * 5.5 * tt) * 0.012  # 5.5 Hz vibrato
        f_mod = f * (1.0 + vib)
        phase = 2 * np.pi * np.cumsum(f_mod) / SR
        # Brassy: square + odd harmonics, filtered
        s = (np.sign(np.sin(phase)) * 0.4 +
             np.sin(phase) * 0.6 +
             np.sin(phase * 3) * 0.18 +
             np.sin(phase * 5) * 0.08)
        s = biquad_lp(s, 2200, 0.8)
        a_n = int(0.05 * SR); r_n = int(0.20 * SR)
        env = adsr(dur_samp, a_n, int(0.05 * SR), 0, r_n, sus_amp=0.8)
        out[start_samp:start_samp + dur_samp] += s * env * 0.32

    # Schedule: 15 bars, 4/4
    for bar, root in enumerate(blues_roots):
        bar_start = bar * beat_n * 4
        # Walking bass — choose 4 chord/scale tones per bar
        offsets = rng.choice([0, 3, 4, 5, 7, 9, 10], size=4, replace=True)
        for b in range(4):
            walk_note(bar_start + b * beat_n, root - 12 + int(offsets[b]))

        # Drums: kick on 1 & 3, swish on every beat, ride on every beat
        for b in range(4):
            ride(bar_start + b * beat_n)
            brush_swish(bar_start + b * beat_n)
        kick_soft(bar_start)
        kick_soft(bar_start + 2 * beat_n)
        # Light snare-like accent on 2 and 4
        snare_swish(out, rng, bar_start + 1 * beat_n, beat_n)
        snare_swish(out, rng, bar_start + 3 * beat_n, beat_n)

        # Piano comp on 2 and 4
        piano_comp(bar_start + 1 * beat_n, root)
        piano_comp(bar_start + 3 * beat_n, root)

        # Sax phrase: every other bar, syncopated
        if bar % 2 == 0 and bar >= 2:
            scale = [0, 2, 3, 5, 7, 8, 10]  # blues-ish
            phrase = [root + 12 + int(rng.choice(scale)) for _ in range(4)]
            for i, p in enumerate(phrase):
                sax_note(bar_start + i * beat_n, beat_n + (beat_n // 4 if i == 3 else 0), p)

    out = soft_clip(out, drive=0.6)
    out = normalize(out, peak=0.65)
    return out


def snare_swish(out, rng, start_samp, beat_n):
    L = int(0.10 * SR)
    if start_samp + L > N: L = N - start_samp
    if L <= 0: return
    tt = np.arange(L) / SR
    n = rng.standard_normal(L)
    n = hp_simple(n, alpha=0.97)
    env = np.exp(-tt * 30)
    out[start_samp:start_samp + L] += n * env * 0.10


# -- Orchestral -----------------------------------------------------------
# 60 BPM, 4/4. 30s = 30 beats = 7.5 bars. Use 8 bars at 60 BPM
# but compressed timing: actually 30s / (4 * 1.0) = 7.5 bars. Use 8 bars
# with 0.9375s per beat to hit 30s exactly.

def gen_orchestral():
    rng = np.random.default_rng(0x0AC)
    bpm = 64
    beat_s = 60.0 / bpm
    beat_n = int(beat_s * SR)
    bar_n = beat_n * 4

    out = np.zeros(N)

    # Cm-Fm-G7-Cm-Ab-Fm-G7-Cm  (i-iv-V-i-VI-iv-V-i in C minor)
    # MIDI roots: Cm=48, Fm=53, G=55, Ab=56
    chord_prog = [
        (48, 'min'),  # Cm
        (53, 'min'),  # Fm
        (55, 'dom'),  # G7
        (48, 'min'),  # Cm
        (56, 'maj'),  # Ab
        (53, 'min'),  # Fm
        (55, 'dom'),  # G7
        (48, 'min'),  # Cm
    ]

    # ----- String section: 5-saw pad with vibrato + slow LP filter
    def strings(start_samp, dur_samp, midi_root, kind):
        if start_samp + dur_samp > N: dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        if kind == 'min':
            ivs = [0, 3, 7, 12, 15]
        elif kind == 'dom':
            ivs = [0, 4, 7, 10, 12]
        else:
            ivs = [0, 4, 7, 12, 16]
        chord = np.zeros(dur_samp)
        for iv in ivs:
            f = midi_to_hz(midi_root + 12 + iv)
            # 6 saws detuned
            vib = np.sin(2 * np.pi * 5.0 * tt + iv * 0.7) * 0.005
            for d in (-0.008, -0.004, 0.0, 0.003, 0.007):
                ff = f * (1.0 + d) * (1.0 + vib)
                phase = 2 * np.pi * np.cumsum(ff) / SR
                chord += (2.0 * (phase / (2 * np.pi) % 1.0) - 1.0) * 0.10
        chord = biquad_lp(chord, 1500, 0.5)
        env = adsr(dur_samp, int(0.45 * SR), int(0.05 * SR), 0,
                   int(0.55 * SR), sus_amp=0.85)
        out[start_samp:start_samp + dur_samp] += chord * env * 0.13

    # ----- Cello: low bass on each chord
    def cello(start_samp, dur_samp, midi):
        if start_samp + dur_samp > N: dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        f = midi_to_hz(midi)
        vib = np.sin(2 * np.pi * 4.5 * tt) * 0.008
        ff = f * (1.0 + vib)
        phase = 2 * np.pi * np.cumsum(ff) / SR
        # Cello = sine + saw + body
        s = (np.sin(phase) * 0.6 +
             (2 * (phase / (2 * np.pi) % 1.0) - 1.0) * 0.4)
        s = biquad_lp(s, 700, 0.7)
        a_n = int(0.20 * SR); r_n = int(0.45 * SR)
        env = adsr(dur_samp, a_n, int(0.10 * SR), 0, r_n, sus_amp=0.85)
        out[start_samp:start_samp + dur_samp] += s * env * 0.35

    # ----- French horn melody
    def horn_note(start_samp, dur_samp, midi):
        if start_samp + dur_samp > N: dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        f = midi_to_hz(midi)
        vib = np.sin(2 * np.pi * 4.8 * tt) * 0.010
        ff = f * (1.0 + vib)
        phase = 2 * np.pi * np.cumsum(ff) / SR
        # Brass: square + odd harmonics
        s = (np.sign(np.sin(phase)) * 0.35 +
             np.sin(phase) * 0.50 +
             np.sin(phase * 3) * 0.15)
        s = biquad_lp(s, 1800, 0.7)
        a_n = int(0.15 * SR); r_n = int(0.30 * SR)
        env = adsr(dur_samp, a_n, int(0.10 * SR), 0, r_n, sus_amp=0.80)
        out[start_samp:start_samp + dur_samp] += s * env * 0.22

    # ----- Timpani: pitched noise burst
    def timpani(start_samp, midi=43, gain=1.0):
        L = int(0.6 * SR)
        if start_samp + L > N: L = N - start_samp
        if L <= 0: return
        tt = np.arange(L) / SR
        f = midi_to_hz(midi)
        body = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 6)
        body += np.sin(2 * np.pi * f * 1.5 * tt) * 0.3 * np.exp(-tt * 8)
        n = rng.standard_normal(L) * np.exp(-tt * 30) * 0.15
        out[start_samp:start_samp + L] += (body * 0.7 + n) * gain * 0.40

    # ----- Cymbal swell (for climax)
    def cymbal_swell(start_samp, dur_samp):
        if start_samp + dur_samp > N: dur_samp = N - start_samp
        if dur_samp <= 0: return
        tt = np.arange(dur_samp) / SR
        n = rng.standard_normal(dur_samp)
        n = hp_simple(n, alpha=0.99)
        env = np.linspace(0, 1, dur_samp) ** 2
        out[start_samp:start_samp + dur_samp] += n * env * 0.10

    # Schedule
    horn_melody = [
        # bar, beat (0..3), midi, dur_beats
        (0, 0, 67, 4),   # G4 over Cm
        (1, 0, 65, 2),   (1, 2, 63, 2),   # F4, Eb4 over Fm
        (2, 0, 67, 2),   (2, 2, 71, 2),   # G4, B4 over G7
        (3, 0, 72, 2),   (3, 2, 71, 2),   # C5, B4 over Cm
        (4, 0, 75, 4),   # Eb5 over Ab
        (5, 0, 72, 2),   (5, 2, 70, 2),   # C5, Bb4 over Fm
        (6, 0, 71, 2),   (6, 2, 74, 2),   # B4, D5 over G7
        (7, 0, 72, 4),   # C5 over Cm (resolution)
    ]

    for bar, (root, kind) in enumerate(chord_prog):
        bar_start = bar * bar_n
        strings(bar_start, bar_n, root, kind)
        cello(bar_start, bar_n, root - 12)

        # Timpani on bar 1 of each phrase, plus climax bar 4
        if bar == 0 or bar == 4:
            timpani(bar_start, midi=root - 12, gain=0.9)
        if bar == 4:
            cymbal_swell(bar_start, int(beat_n * 1.5))

        # Bar 7 final timpani roll on resolution
        if bar == 7:
            for r in range(8):
                timpani(bar_start + r * (beat_n // 2), midi=43, gain=0.5)

    # Horn melody
    for bar, beat, midi, dur_b in horn_melody:
        s = bar * bar_n + beat * beat_n
        d = dur_b * beat_n
        horn_note(s, d, midi)

    out = soft_clip(out, drive=0.7)
    out = normalize(out, peak=0.62)
    return out


# -- main ----------------------------------------------------------------

if __name__ == '__main__':
    print(f"Generating {DUR_SEC:.0f}s tracks at {SR} Hz mono 16-bit...")
    edm = gen_edm()
    write_wav_mono(os.path.join(HERE, 'edm_full.wav'), edm)

    jazz = gen_jazz()
    write_wav_mono(os.path.join(HERE, 'jazz_full.wav'), jazz)

    orch = gen_orchestral()
    write_wav_mono(os.path.join(HERE, 'orchestral_full.wav'), orch)
    print("Done.")
