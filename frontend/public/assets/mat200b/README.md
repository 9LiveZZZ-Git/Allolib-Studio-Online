# MAT200B Asset Bundle

This directory hosts audio/visual assets for the MAT200B example set described
in `MAT200B_EXAMPLES_PLAN.md` (§ 0.4 — Asset pipeline).

## Convention

- Assets live under `frontend/public/assets/mat200b/` and are served by Vite at
  `/assets/mat200b/...`.
- Subdirectories are keyed by example category or example id, e.g.:
  - `mat200b/mastering/{master_v1.wav,master_v2.wav}` — short stems for A/B
    mastering demos.
  - `mat200b/convolution/{ir_room.wav,ir_plate.wav}` — IRs for convolution
    examples.
  - `mat200b/concat/forest_5min.{webm,opus}` — concatenative-AV corpus video
    plus pre-decoded MFCC sidecar JSON.
  - `mat200b/hrtf/...` — KEMAR HRIR set if Spatializer needs it (verify Gamma
    HRFilter ships MIT/CIPIC tables; otherwise ship a downsampled pack).

## Loading

C++ examples load via relative URLs. The pattern mirrors the existing HDR
loader in `/assets/environments/*.hdr`:

```cpp
WebSamplePlayer player;
player.load("/assets/mat200b/mastering/master_v1.wav"); // fetch + decode
```

`al_WebSamplePlayer.hpp` resolves URLs via `fetch` underneath, falling back to
the IDBFS-mounted virtual filesystem when needed.

## Bundle hygiene

- Keep each category folder under ~50 MB to avoid blowing up the Vite cold
  cache.
- Files larger than ~5 MB should ship as `opus`/`webm`, not `wav`.
- Document licenses in `CREDITS.md` (mirroring the top-level
  `frontend/public/assets/CREDITS.md` convention).

## Status

Phase 0 scaffold — empty until Phase 3 examples land. The directory exists so
later phases can drop sound/IR/video assets here without restructuring.
