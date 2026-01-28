/**
 * Web Audio Sample Player
 *
 * Alternative to al::SoundFile for web browsers.
 * Uses Web Audio API's decodeAudioData for loading audio files.
 *
 * Usage:
 *   WebSamplePlayer player;
 *   player.load("path/to/sample.wav");  // Async load
 *   if (player.ready()) {
 *       float sample = player.read(channel, frame);
 *   }
 */

#ifndef AL_WEB_SAMPLE_PLAYER_HPP
#define AL_WEB_SAMPLE_PLAYER_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <cstdint>

namespace al {

/**
 * Web-based sample player using Web Audio API
 *
 * Note: Loading is asynchronous. Check ready() before accessing samples.
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
     * Load a sample from URL (async)
     * The sample will be decoded using Web Audio API
     */
    void load(const std::string& url) {
        mReady = false;
        mUrl = url;

        EM_ASM({
            var url = UTF8ToString($0);
            var playerPtr = $1;

            fetch(url)
                .then(response => response.arrayBuffer())
                .then(buffer => {
                    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    return audioCtx.decodeAudioData(buffer);
                })
                .then(audioBuffer => {
                    var channels = audioBuffer.numberOfChannels;
                    var frames = audioBuffer.length;
                    var sampleRate = audioBuffer.sampleRate;

                    // Interleave channel data
                    var interleaved = new Float32Array(channels * frames);
                    for (var frame = 0; frame < frames; frame++) {
                        for (var ch = 0; ch < channels; ch++) {
                            var channelData = audioBuffer.getChannelData(ch);
                            interleaved[frame * channels + ch] = channelData[frame];
                        }
                    }

                    // Copy to WASM memory
                    var ptr = Module._malloc(interleaved.length * 4);
                    Module.HEAPF32.set(interleaved, ptr >> 2);

                    // Call C++ callback
                    Module.ccall('_al_web_sample_loaded', null,
                        ['number', 'number', 'number', 'number', 'number', 'number'],
                        [playerPtr, ptr, channels, frames, sampleRate, interleaved.length]);
                })
                .catch(err => {
                    console.error('Failed to load sample:', err);
                });
        }, url.c_str(), this);
    }

    /**
     * Check if sample is loaded and ready
     */
    bool ready() const { return mReady; }

    /**
     * Get number of channels
     */
    int channels() const { return mChannels; }

    /**
     * Get number of frames
     */
    int frames() const { return mFrames; }

    /**
     * Get sample rate
     */
    float sampleRate() const { return mSampleRate; }

    /**
     * Get duration in seconds
     */
    float duration() const {
        return mFrames / (float)mSampleRate;
    }

    /**
     * Read sample at frame and channel
     */
    float read(int channel, int frame) const {
        if (!mReady || !mSamples) return 0;
        if (frame < 0 || frame >= mFrames) return 0;
        if (channel < 0 || channel >= mChannels) return 0;
        return mSamples[frame * mChannels + channel];
    }

    /**
     * Read interpolated sample at fractional frame position
     */
    float readInterp(int channel, float frame) const {
        if (!mReady) return 0;

        int f0 = (int)frame;
        int f1 = f0 + 1;
        float frac = frame - f0;

        float s0 = read(channel, f0);
        float s1 = read(channel, f1);

        return s0 + (s1 - s0) * frac;
    }

    /**
     * Get pointer to raw sample data (interleaved)
     */
    const float* data() const { return mSamples; }

    // Called from JavaScript when sample is loaded
    void _onLoaded(float* samples, int channels, int frames, float sampleRate, int totalSamples) {
        if (mSamples) delete[] mSamples;

        mSamples = new float[totalSamples];
        for (int i = 0; i < totalSamples; i++) {
            mSamples[i] = samples[i];
        }

        mChannels = channels;
        mFrames = frames;
        mSampleRate = sampleRate;
        mReady = true;

        printf("[WebSamplePlayer] Loaded: %d channels, %d frames, %.0f Hz\n",
               channels, frames, sampleRate);
    }

private:
    bool mReady;
    std::string mUrl;
    float* mSamples = nullptr;
    int mChannels;
    int mFrames;
    float mSampleRate;
};

} // namespace al

// C callback for JavaScript
extern "C" {
    void _al_web_sample_loaded(al::WebSamplePlayer* player, float* samples,
                                int channels, int frames, float sampleRate, int totalSamples) {
        if (player) {
            player->_onLoaded(samples, channels, frames, sampleRate, totalSamples);
            free(samples);  // Free the malloc'd buffer
        }
    }
}

#endif // AL_WEB_SAMPLE_PLAYER_HPP
