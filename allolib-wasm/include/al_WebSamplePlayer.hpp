/**
 * Web Audio Sample Player
 *
 * Alternative to al::SoundFile for web browsers.
 * Uses Web Audio API's decodeAudioData for loading audio files.
 *
 * Usage:
 *   WebSamplePlayer player;
 *   player.load("path/to/sample.wav");  // suspends via Asyncify; returns when ready
 *   if (player.ready()) {
 *       float sample = player.read(channel, frame);
 *   }
 *
 * Implementation note (2026-05-01, v0.12.8): the previous JS->C
 * round-trip via Module.ccall('_al_web_sample_loaded', ...) required
 * the symbol to be exported AND for the user TU to actually emit it.
 * That made the symbol fragile against per-example links: examples
 * that didn't include this header didn't emit the symbol, so any
 * attempt to add it to EXPORTED_FUNCTIONS hit
 *   wasm-ld: symbol exported via --export not found
 * at link time; conversely, if it wasn't exported, runtime calls
 * aborted with "Cannot call unknown function _al_web_sample_loaded".
 *
 * The fix is structural: load() now uses EM_ASYNC_JS, which suspends
 * the wasm caller until the JS coroutine resolves and returns a
 * pointer to a packed buffer (header + interleaved samples). No
 * C-callable symbol is exposed to JS, so no export contract exists,
 * so neither the link nor the runtime can fail on a missing name.
 * ASYNCIFY=1 is already enabled in compile.sh, which is the only
 * runtime requirement.
 */

#ifndef AL_WEB_SAMPLE_PLAYER_HPP
#define AL_WEB_SAMPLE_PLAYER_HPP

#include <emscripten.h>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>

namespace al {
class WebSamplePlayer;
} // namespace al

// JS coroutine: fetch URL, decode via Web Audio, allocate a single
// packed buffer in WASM memory, return its pointer. Layout:
//   bytes  0..3 : int32   numChannels
//   bytes  4..7 : int32   numFrames
//   bytes  8..11: float32 sampleRate
//   bytes 12..  : float32 interleaved samples (channels * frames)
// Caller is responsible for free()-ing the returned pointer. Returns
// 0 on failure (network, decode, OOM).
EM_ASYNC_JS(void*, _al_ws_fetch_and_decode, (const char* urlPtr), {
    const url = UTF8ToString(urlPtr);
    try {
        const resp = await fetch(url);
        if (!resp.ok) { console.error('[WebSamplePlayer] fetch failed', resp.status, url); return 0; }
        const buf = await resp.arrayBuffer();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const ab = await ctx.decodeAudioData(buf);
        const ch = ab.numberOfChannels;
        const fr = ab.length;
        const sr = ab.sampleRate;
        const total = ch * fr;
        const ptr = Module._malloc(12 + total * 4);
        if (!ptr) { console.error('[WebSamplePlayer] malloc failed'); return 0; }
        Module.HEAP32[(ptr + 0) >> 2] = ch;
        Module.HEAP32[(ptr + 4) >> 2] = fr;
        Module.HEAPF32[(ptr + 8) >> 2] = sr;
        const dataIdx = (ptr + 12) >> 2;
        // Pull each channel once, then interleave.
        const channelData = [];
        for (let c = 0; c < ch; c++) channelData.push(ab.getChannelData(c));
        for (let f = 0; f < fr; f++) {
            const base = dataIdx + f * ch;
            for (let c = 0; c < ch; c++) {
                Module.HEAPF32[base + c] = channelData[c][f];
            }
        }
        return ptr;
    } catch (e) {
        console.error('[WebSamplePlayer] load failed:', e);
        return 0;
    }
});

namespace al {

/**
 * Web-based sample player using Web Audio API.
 *
 * Note: load() suspends via Asyncify until the file is decoded; on
 * return, ready() is true and read()/readInterp() work immediately.
 */
class WebSamplePlayer {
public:
    WebSamplePlayer() : mReady(false), mChannels(0), mFrames(0), mSampleRate(44100) {}

    ~WebSamplePlayer() {
        if (mSamples) {
            delete[] mSamples;
            mSamples = nullptr;
        }
    }

    /**
     * Load a sample from URL. Suspends via Asyncify until decoded.
     * On success, ready() returns true. On failure, ready() stays false
     * and an error is logged to the console.
     */
    void load(const std::string& url) {
        mReady = false;
        mUrl = url;

        void* p = _al_ws_fetch_and_decode(url.c_str());
        if (!p) return;

        // Read header (int32, int32, float32) then samples.
        const auto* hdrInt   = reinterpret_cast<const int32_t*>(p);
        const auto* hdrFloat = reinterpret_cast<const float*>(p);
        const int   channels = hdrInt[0];
        const int   frames   = hdrInt[1];
        const float sampleRate = hdrFloat[2];
        const auto* samples = reinterpret_cast<const float*>(
            reinterpret_cast<const char*>(p) + 12);
        const int totalSamples = channels * frames;

        if (mSamples) delete[] mSamples;
        mSamples = new float[totalSamples];
        for (int i = 0; i < totalSamples; ++i) mSamples[i] = samples[i];

        mChannels   = channels;
        mFrames     = frames;
        mSampleRate = sampleRate;
        mReady      = true;

        std::free(p);

        std::printf("[WebSamplePlayer] Loaded: %d channels, %d frames, %.0f Hz\n",
                    channels, frames, sampleRate);
    }

    bool  ready()      const { return mReady; }
    int   channels()   const { return mChannels; }
    int   frames()     const { return mFrames; }
    float sampleRate() const { return mSampleRate; }
    float duration()   const { return mFrames / (float)mSampleRate; }

    float read(int channel, int frame) const {
        if (!mReady || !mSamples) return 0;
        if (frame < 0 || frame >= mFrames) return 0;
        if (channel < 0 || channel >= mChannels) return 0;
        return mSamples[frame * mChannels + channel];
    }

    float readInterp(int channel, float frame) const {
        if (!mReady) return 0;
        const int f0 = (int)frame;
        const int f1 = f0 + 1;
        const float frac = frame - f0;
        const float s0 = read(channel, f0);
        const float s1 = read(channel, f1);
        return s0 + (s1 - s0) * frac;
    }

    const float* data() const { return mSamples; }

private:
    bool mReady;
    std::string mUrl;
    float* mSamples = nullptr;
    int mChannels;
    int mFrames;
    float mSampleRate;
};

} // namespace al

#endif // AL_WEB_SAMPLE_PLAYER_HPP
