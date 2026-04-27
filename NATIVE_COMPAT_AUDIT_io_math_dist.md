# Native Compat Audit — I/O, Math, Distributed (and misc)

Scope: `al/io/`, `al/math/`, `al/protocol/`, `al/app/al_DistributedApp`, `al/scene/al_DistributedScene`, plus File / CSV / Recorder / FileSelector. Reference docs: `allolib-docs/al___*_8hpp_source.html`. Compat layer: `allolib-wasm/include/`.

## Already covered

| Native API | Web equivalent | File:line |
|---|---|---|
| `al::MIDIByte` (status-byte constants) | stub class | `al_WebMIDI.hpp:106-115` |
| `al::MIDIMessage` | wire-compatible struct + `noteNumber/controlNumber` | `al_WebMIDI.hpp:72-101` |
| `al::MIDIMessageHandler::onMIDIMessage` / `bindTo()` | virtual stub | `al_WebMIDI.hpp:122-127` |
| `RtMidiIn` (incl. `openPort`, `getPortCount`, `setCallback`, `cancelCallback`) | no-op stub | `al_WebMIDI.hpp:133-144` |
| `MIDIIn` / `MIDIOut` typedef | alias to `WebMIDI` | `al_compat_io.hpp:41-42` |
| `osc::Message` / `osc::Send` / `osc::Recv` (basic API) | `WebOSC` over WebSocket-JSON | `al_WebOSC.hpp:1-477` |
| `osc::Send` / `osc::Recv` typedef | alias to `WebOSC` | `al_compat_io.hpp:45-46` |
| `osc::Send::send(addr, args...)` | overloads up to 3 args | `al_WebOSC.hpp:326-358` |
| `al::File` (basic read) | `WebFile::loadFromURL` (async fetch) | `al_WebFile.hpp:265-322` |
| `al::File` (write) | `WebFile::download` / `downloadBinary` | `al_WebFile.hpp:57-114` |
| `al::CSVReader::readFile` | error stub + `readString()` helper | `al_playground_compat.hpp:423-471` |
| `al::CSVReader::addType` / `getColumnNames` / `size` | stubs | `al_playground_compat.hpp:435-439` |
| `al::AppRecorder` | empty stub | `al_playground_compat.hpp:828-836` |
| `al::DistributedApp` (base class) | transpiler collapses to `WebApp` | `transpiler.ts:148-155` |
| `al::DistributedAppWithState<T>` | transpiler collapses to `WebApp` | `transpiler.ts:148-155` |
| `#include "al/io/al_MIDI.hpp"` | rewritten to `al_WebMIDI.hpp` | `transpiler.ts:97-100` |
| `#include "al/protocol/al_OSC.hpp"` | rewritten to `al_WebOSC.hpp` | `transpiler.ts:102-105` |
| `#include "al/io/al_File.hpp"` | rewritten to `al_WebFile.hpp` | `transpiler.ts:112-115` |
| `al::Vec`, `al::Mat`, `al::Quat`, `al::Matrix4` | upstream header used as-is (header-only, std C++) | `allolib-docs/al___vec_8hpp_source.html`, see §6 |
| `al::Interval`, `al::Complex`, `al::Polar`, `al::Ray`, `al::SphereCoord`, `al::Frenet`, `al::MinMeanMax` | upstream header used as-is | §6 |
| `al::rnd::Random<RNG>` (`uniform`, `gaussian`, `prob`, etc.) | upstream header used as-is | §6 |
| `al::SingleRWRingBuffer` | upstream header used as-is (pure std C++) | `al___single_r_w_ring_buffer_8hpp_source.html` |

## Hard-no in browser

| Native API | Why blocked | Web alternative |
|---|---|---|
| `al::Arduino` (`serial::Serial`, `init(port,baud)`) | Browser cannot open OS COM ports from WASM. (WebSerial exists in Chrome but requires user gesture and isn't wired.) | None today. Could implement on top of Web Serial API later (Chrome-only, requires `navigator.serial.requestPort`). |
| `al::osc::Recv` raw UDP listen / `Send` raw UDP socket | Browsers cannot bind/send UDP. | `WebOSC` already routes via WebSocket bridge (oscbridge / node-osc-websocket). |
| `al::Socket` (TCP/UDP/SCTP, `INET6`, `hostName()`) | Same — no raw sockets in WASM. | WebSocket only; no compat shim provided. |
| `al::DistributedApp` networking (`StateSendDomain`, `StateReceiveDomain`, broadcast UDP, `setPort`, `getPrimaryHost`) | Built on `al_Socket` UDP + multicast. | None viable (would need WebRTC/WebSocket re-architecture). Transpiler already collapses to single-process `WebApp`. |
| `al::DistributedScene` (OSC-based scene replication) | Inherits `osc::MessageConsumer`, requires real OSC over UDP. | Would need `WebOSC` retrofit; currently no stub. |
| `al::CommandClient` / `al::CommandServer` (TCP command channel from `al_CommandConnection.hpp`) | Raw TCP. | None (would need WebSocket port). |
| `al::PersistentConfig` writing to disk (`~/.config`-style) | No filesystem persistence. | localStorage-based partial replacement exists for `PresetHandler`. |
| `al::File::write(...)`, `File::copy`, `File::remove`, `Dir::make`, `Dir::removeRecursively` | No write access to user FS. | `WebFile::download*` (one-shot save dialog only — no in-place writes). |
| `al::PushDirectory` (chdir) | No real CWD in WASM. | Drop / no-op only. |
| `al::SearchPaths` recursive directory walk | No FS to walk. | None. |
| `al::FileSelector` (ImGui file dialog over `al::Dir`) | ImGui not used in web; FS not walkable. | `WebFile::upload()` opens the browser file picker — different API. |
| `al::AppRecorder::startRecordingOffline` (writes WAV + image sequence) | Domain freezing + disk write. | Stub only; no MediaRecorder/canvas-capture wired. |

## Missing — high severity

- **`al::File::read(const std::string& path)` (sync static)** — used heavily in tutorials to load shaders/JSON. No WASM equivalent because fetch is async. Suggested approach: provide a doc-only mapping that points users to `WebFile::loadFromURL` with a callback, and add a transpiler warning when `al::File::read(` appears.
- **`al::FilePath`, `al::FileList`, `al::SearchPaths`** — pure value types, but referenced in any code touching `al/io/al_File.hpp`. They are NOT defined in `al_WebFile.hpp` (which only ships `UploadedFile` + `WebFile`). After the include rewrite, native code using `FilePath p("a","b"); p.filepath();` won't compile. Suggested approach: add a header-only `FilePath`/`FileList` (no FS access) to `al_WebFile.hpp` for source-compat.
- **`al::checkExtension`, `al::baseName`, `al::extension`, `al::directory`, `al::isRelativePath`** — string-only path helpers from `al_File.hpp` that have no WASM-blocker reason to be missing. Suggested approach: pure-string reimplementation in `al_WebFile.hpp`.
- **`osc::Send::send(addr, A, B, C, D, E, F, G, H)`** — `WebOSC::send` only has 1-arg, 2-arg, 3-arg float overloads + `OSCMessage::add` chain. Tutorials with 4+ args break. Suggested: add variadic template `send(addr, args...)` mirroring native.
- **`osc::Send::operator<<(int64_t/uint64_t/double/Blob)` etc.** — `OSCArg` supports int32/float/double/string/bool only; missing int64, blob, char. Suggested: extend `OSCArg` constructors.
- **`osc::Message::operator>>(int& / float& / std::string& ...)`** — native uses stream-extract; `OSCMessage` uses `getInt(i)/getFloat(i)`. Code that does `msg >> a >> b` won't compile. Suggested: add `operator>>` overloads to `OSCMessage`.
- **`osc::PacketHandler::onMessage(osc::Message&)`** — transpiler regex blanks the body but leaves the override out (`transpiler.ts:228-231` deletes the entire function). Apps that *also* dispatch from `onMessage` lose that logic silently. Suggested: warn loudly + keep stub body that calls `mDefaultHandler`.
- **`al::CSVReader::copyToStruct<T>()`** (memcpy-based row binding) — heavily used in dataviz tutorials. Web stub `al_playground_compat.hpp:423` only stores rows as `vector<vector<string>>`. Suggested: implement a `copyToStruct` that walks `mDataTypes` and packs into `T`.
- **`al::CSVReader::getColumn(int)`** — returns `vector<double>`. Web stub doesn't expose it. Suggested: parse `mRows[*][index]` with `std::stod`.
- **`al::demangle()`** — used by some tutorials for runtime type names. Suggested: 1-line `#ifdef __EMSCRIPTEN__` returning `name` unchanged (or use `__cxa_demangle` if available — Emscripten ships it).
- **`al::noteToHz(double)` / `al::getMIDIDeviceIndex(std::string)`** — free functions in `al_MIDI.hpp`. Not in `al_WebMIDI.hpp`. Suggested: add `noteToHz` (1-liner: `440 * pow(2, (n-69)/12)`) and a stub for `getMIDIDeviceIndex`.

## Missing — low severity

- `al::PushDirectory` — usually `RAII` wrapping `chdir`. Apps that use it for asset-relative loads will compile fail. Suggested: empty no-op class.
- `al::Dir::make / remove / removeRecursively` — see §2 hard-no. Add no-op stubs that always return `false`.
- `al::File::searchBack` (walk up tree to find asset folder) — typical desktop pattern. No-op returning `true` keeps things compiling but assets must be served at fixed paths.
- `al::Arduino` — fully missing. Add a no-op class (mirrors RtMidiIn pattern) so tutorials compile and run silently.
- `al::CommandClient` / `al::CommandServer` — Likely never used in single-process web; add empty stubs only if a demo references them.
- `al::ser::encode/decode` (`al_Serialize.hpp`) — needs C-side `al_Serialize.h` which is endian-aware C. Should compile under Emscripten as-is; only missing if `-I` path doesn't reach it.
- `al::FileSelector::drawFileSelector()` — ImGui-only. Stub returning `false` + a printf hint pointing at `WebFile::upload()`.
- `al::Buffer` (variably-sized ring; the Doxygen file is `#if 0`-gated upstream — already inactive).

## Transpiler gaps

Patterns NOT recognized in `frontend/src/services/transpiler.ts` (additions would help):

- `#include "al/io/al_CSVReader.hpp"` — not rewritten. Should map to `al_playground_compat.hpp` (which provides the stub).
- `#include "al/io/al_FileSelector.hpp"` — not rewritten. Should map to `al_playground_compat.hpp` and warn.
- `#include "al/io/al_Arduino.hpp"` — not rewritten. Should error or warn (no compat at all).
- `#include "al/io/al_Socket.hpp"` — not rewritten. Should error.
- `#include "al/io/al_AppRecorder.hpp"` — not rewritten. Should map to `al_playground_compat.hpp`.
- `#include "al/protocol/al_CommandConnection.hpp"` — not rewritten.
- `#include "al/scene/al_DistributedScene.hpp"` — not rewritten. (DistributedApp base class is collapsed, but `DistributedScene` member declarations leak through.)
- `#include "al/app/al_StateDistributionDomain.hpp"` — not rewritten.
- `#include "al/app/al_NodeConfiguration.hpp"` — not rewritten. `NodeConfiguration` is the second base of `DistributedApp`; collapsing the include + dropping mixin would help.
- `#include "al/types/al_SingleRWRingBuffer.hpp"`, `al/types/al_Buffer.hpp`, `al/types/al_Conversion.hpp` — header-only; pass-through OK as long as `-I"$ALLOLIB_DIR/include"` is set (it is, per `compile.sh`). No transpiler change needed; just verify.
- `#include "al/math/*.hpp"` — pass-through; verify `-I` path covers them (it does). No regex needed.
- Base class `: public osc::PacketHandler` (and `osc::MessageConsumer`) — not rewritten; leaves dangling vtable references when `osc::Recv` is replaced by `WebOSC`. Suggested: regex-rewrite to a no-op base or `WebOSCHandler`.

## Math types — pass-through verification

Confirmed pure-C++ standard-only (no OS calls, no inline asm, no SSE intrinsics). All use `<cmath>`, `<cstdio>`, `<algorithm>`, `<vector>`, `<random>`, `<type_traits>`, `<initializer_list>` — all available in Emscripten libc++.

| Header | Includes | Notes |
|---|---|---|
| `al_Vec.hpp` | `<cmath>`, `<cstdio>`, `<initializer_list>`, `<ostream>`, `<type_traits>`, `al_Constants.hpp` | template-only; Vec2/3/4 typedefs are aliases. |
| `al_Mat.hpp` | `al_Vec.hpp`, `<cmath>`, `<stdio.h>` | template-only. |
| `al_Quat.hpp` | `al_Constants.hpp`, `al_Mat.hpp`, `al_Vec.hpp` | template-only. |
| `al_Matrix4.hpp` | `al_Constants.hpp`, `al_Mat.hpp`, `al_Quat.hpp`, `al_Vec.hpp` | derived from `Mat<4,T>`. |
| `al_Interval.hpp` | (none) | template-only, single-file. |
| `al_Complex.hpp` | `<cmath>`, `al_Constants.hpp` | template-only. |
| `al_Curve.hpp` | (declarations only — implementations in .cpp upstream) | the .cpp ships with allolib's archive; ensure `-l` links it. **Verify**: if linking only `-I` headers, free functions like `frenet(...)` may produce undefined symbols. |
| `al_Ray.hpp` | `al_Vec.hpp` | template-only. |
| `al_Spherical.hpp` | `al_Complex.hpp`, `al_Functions.hpp`, `al_Vec.hpp` | mostly templates; `sphericalToCart` etc. are templates. |
| `al_Constants.hpp` | (none) | macros only (M_PI, M_E, …). |
| `al_Conversion.hpp` | `<limits.h>`, `<stdio.h>`, `<string.h>`, `<cstdint>`, `<iostream>`, `<sstream>` | inline + template functions. |
| `al_Random.hpp` | `<time.h>` (for `time(NULL)` seed), `<cmath>`, `<random>`, `al_Constants.hpp`, `al_Conversion.hpp`, `al_StdRandom.hpp` | `time(NULL)` works under Emscripten. **Confirmed pass-through.** |
| `al_StdRandom.hpp` | `<random>` (assumption — file present in docs list) | std-only. |
| `al_Analysis.hpp` | `al_Functions.hpp`, `<limits>` | `MinMeanMax<T>` template only. |
| `al_Buffer.hpp` | `<algorithm>`, `<vector>` | the `Buffer` template body is `#if 0`-gated upstream (inactive). |
| `al_SingleRWRingBuffer.hpp` | `<cstring>`, `<inttypes.h>`, `<vector>` | impl in matching `.cpp`. **Verify link**: declarations only in header; if only headers are on the include path, `SingleRWRingBuffer::write/read` will be undefined. Used by `al_Arduino` (already missing) but also by `al_CommandConnection.hpp`.
| `al_Serialize.hpp` | `al_Serialize.h` (C) | pure C; should compile under Emscripten. **Verify** the `.h` is on the include path.

**Caveats:**
- No platform-specific code, no inline assembly, no SSE/AVX intrinsics, no Windows/POSIX syscalls in any of the math headers. Safe pass-through.
- Items with implementations split into `.cpp` (`Curve`, `SingleRWRingBuffer`, `Serialize`, `Functions`) require the `.cpp` to be either compiled or header-included. `compile.sh` only sets `-I` paths — verify whether allolib's `.cpp` files are added to the source list, otherwise expect undefined-symbol errors at link time for these specific functions. Templated math (Vec/Mat/Quat/Interval/Random) is unaffected.
