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

All three are mono 16-bit PCM WAV at 44.1 kHz. They loop seamlessly
(both bar count and pad envelope are aligned to the 8 s frame).

Use, modify, redistribute freely. No attribution required.
