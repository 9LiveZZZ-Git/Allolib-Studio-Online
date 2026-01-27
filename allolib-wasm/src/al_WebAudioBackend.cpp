/**
 * AlloLib Web Audio Backend
 *
 * Provides a Web Audio API implementation for AlloLib's AudioIO system.
 * This replaces PortAudio/RtAudio when building for Emscripten.
 *
 * In the web environment, audio processing happens in an AudioWorklet
 * which runs on a separate thread. This backend provides the C++ side
 * that interfaces with the JavaScript AudioWorklet.
 */

#include "al/io/al_AudioIOData.hpp"

#ifdef AL_EMSCRIPTEN

#include <emscripten.h>
#include <cstring>
#include <vector>

namespace al {

// Global audio state for web
static struct WebAudioState {
    int sampleRate = 44100;
    int bufferSize = 512;
    int outChannels = 2;
    int inChannels = 0;
    bool initialized = false;
    std::vector<float> outputBuffer;
    std::vector<float> inputBuffer;
} gWebAudioState;

// Initialize the web audio backend
extern "C" EMSCRIPTEN_KEEPALIVE
void al_web_audio_init(int sampleRate, int bufferSize, int outCh, int inCh) {
    gWebAudioState.sampleRate = sampleRate;
    gWebAudioState.bufferSize = bufferSize;
    gWebAudioState.outChannels = outCh;
    gWebAudioState.inChannels = inCh;
    gWebAudioState.outputBuffer.resize(bufferSize * outCh, 0.0f);
    gWebAudioState.inputBuffer.resize(bufferSize * inCh, 0.0f);
    gWebAudioState.initialized = true;
}

// Get output buffer pointer for JavaScript
extern "C" EMSCRIPTEN_KEEPALIVE
float* al_web_audio_get_output_buffer() {
    return gWebAudioState.outputBuffer.data();
}

// Get input buffer pointer for JavaScript
extern "C" EMSCRIPTEN_KEEPALIVE
float* al_web_audio_get_input_buffer() {
    return gWebAudioState.inputBuffer.data();
}

// Get buffer size
extern "C" EMSCRIPTEN_KEEPALIVE
int al_web_audio_get_buffer_size() {
    return gWebAudioState.bufferSize;
}

// Get sample rate
extern "C" EMSCRIPTEN_KEEPALIVE
int al_web_audio_get_sample_rate() {
    return gWebAudioState.sampleRate;
}

// Get output channels
extern "C" EMSCRIPTEN_KEEPALIVE
int al_web_audio_get_out_channels() {
    return gWebAudioState.outChannels;
}

// Get input channels
extern "C" EMSCRIPTEN_KEEPALIVE
int al_web_audio_get_in_channels() {
    return gWebAudioState.inChannels;
}

} // namespace al

#endif // AL_EMSCRIPTEN
