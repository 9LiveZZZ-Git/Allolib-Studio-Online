# MAT200B Audio Assets — License & Provenance

All files in this directory are **public domain (CC0)**. They were
synthesized fresh from `math.sin` / `math.exp` / `random` in the
companion script (no third-party samples, no copyrighted material,
no attribution required).

| File | Length | Source | Notes |
|---|---|---|---|
| `drum_loop_120bpm.wav` | 8 s | procedural | 4-bar 4/4 loop. Kick (pitch-swept sine), snare (200 Hz tone + noise burst), hi-hat (high-pass noise). High dynamic range — punchy transients ideal for **downward compression** demos. |
| `pad_loop.wav` | 8 s | procedural | A3/C#4/E4 sine-stack with detuned chorus and a slow attack/release envelope. Low dynamic range (~-8 dBFS peak, never silent) — ideal for **upward compression** demos. |
| `mixed_loop.wav` | 8 s | procedural | The drum loop and pad layered. Wide dynamic spread for comparing how a single threshold treats peaks vs. body. |
| `edm_full.wav` | 30 s | procedural | 128 BPM electro: 16-bar arrangement (intro / build / drop / breakdown / second drop). 4-on-the-floor kick with pitch-swept body, snare with noise burst, off-beat hi-hat, square+saw bass with filter env, dual-detuned saw lead, four-saw pad over Am-F-C-G changes. Heavy transients + sustained pad — broadband mastering target. |
| `jazz_full.wav` | 30 s | procedural | 120 BPM small-combo blues in Bb. Walking quarter-note bass (sine + saw, biquad-LP body), brush swish + light kick + ride bell, piano comp shell-voicings on beats 2/4, sax-like square+sine melody with 5.5 Hz vibrato. Dynamic range mid (low transients, sustained spectral tail). |
| `orchestral_full.wav` | 30 s | procedural | 64 BPM classical-ish in C minor (Cm-Fm-G7-Cm-Ab-Fm-G7-Cm). 6-saw detuned string section per chord tone with vibrato + biquad-LP, cello bass (sine+saw, slow attack), brass-like french horn melody (square+harmonics), pitched timpani noise burst on phrase markers + cymbal swell at the climax. Wide dynamic range, long reverb tail-friendly transients. |

All files are mono 16-bit PCM WAV at 44.1 kHz. The 8-second loops
loop seamlessly; the 30-second mastering tracks are one-shot
arrangements (start / build / climax / resolve) — better material
for hearing how a mastering chain colors a full mix vs. a single
stem. Generator: `generate_full_tracks.py` in this directory.

Use, modify, redistribute freely. No attribution required.
