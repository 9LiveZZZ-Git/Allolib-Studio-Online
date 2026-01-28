/**
 * AlloLib I/O Compatibility Header
 *
 * Provides unified APIs for features that differ between platforms:
 * - Sample loading (SoundFile vs WebSamplePlayer)
 * - MIDI (al_MIDI vs WebMIDI)
 * - OSC (al_OSC vs WebOSC)
 * - File I/O (native vs WebFile)
 *
 * Usage:
 *   #include "al_compat_io.hpp"
 *
 *   al::SamplePlayer player;     // Works on both platforms
 *   player.load("sound.wav");
 *   float sample = player.read(0, frame);
 */

#ifndef AL_COMPAT_IO_HPP
#define AL_COMPAT_IO_HPP

#ifdef __EMSCRIPTEN__
// ============================================================================
// WASM/Browser - Use Web APIs
// ============================================================================

#include "al_WebSamplePlayer.hpp"
#include "al_WebMIDI.hpp"
#include "al_WebOSC.hpp"
#include "al_WebFile.hpp"
#include "al_WebImage.hpp"

namespace al {

// Sample loading - use WebSamplePlayer
using SamplePlayer = WebSamplePlayer;

// MIDI - use WebMIDI
using MIDIIn = WebMIDI;
using MIDIOut = WebMIDI;

// OSC - use WebOSC
using OSCSend = WebOSC;
using OSCRecv = WebOSC;

// File utilities
using FileIO = WebFile;

// Image loading
using ImageLoader = WebImage;

} // namespace al

#else
// ============================================================================
// Native/Desktop - Use native AlloLib APIs
// ============================================================================

// Note: On desktop, include the actual AlloLib headers
// This file just provides the type aliases for compatibility

#include "al/io/al_File.hpp"
#include "al/graphics/al_Image.hpp"

// If you have these on desktop:
// #include "al/io/al_MIDI.hpp"
// #include "al/protocol/al_OSC.hpp"
// #include "al/sound/al_SoundFile.hpp"

namespace al {

// On desktop, you'd typically use:
// using SamplePlayer = SoundFilePlayer;  // or similar
// using MIDIIn = MIDIInput;
// using OSCSend = osc::Send;
// using OSCRecv = osc::Recv;

// Image loading on desktop uses stb_image via al::Image
using ImageLoader = Image;

} // namespace al

#endif // __EMSCRIPTEN__

// ============================================================================
// Cross-platform helper functions
// ============================================================================

namespace al {

/**
 * Load a resource with platform-appropriate method
 * On WASM: loads from URL via fetch
 * On Desktop: loads from filesystem
 */
inline std::string getResourcePath(const std::string& filename) {
#ifdef __EMSCRIPTEN__
    // In browser, resources are typically served from a URL
    return filename;  // Relative to serving root
#else
    // On desktop, might need to prepend a data directory
    // This is application-specific
    return filename;
#endif
}

} // namespace al

#endif // AL_COMPAT_IO_HPP
