/**
 * Font Compatibility Header
 *
 * Maps al::Font to WebFont (WASM) or a minimal native stub (desktop).
 *
 * Usage:
 *   #include "al_compat_font.hpp"
 *
 *   al::Font font;
 *   font.load("Arial", 24);        // CSS family on WASM, path on desktop
 *   font.render(g, "Hello", 0, 0); // Works on both platforms
 */

#pragma once

#ifdef __EMSCRIPTEN__
// ============================================================================
// WASM/Browser - Use WebFont (Canvas 2D texture atlas)
// ============================================================================
#include "al_WebFont.hpp"

namespace al {

// WebFont provides load(family, size) and render(g, text, x, y) on WASM.
// Native al::Font provides a compatible interface on desktop.
using Font = WebFont;

} // namespace al

#else
// ============================================================================
// Native/Desktop - Provide a minimal stub
// ============================================================================
// Uncomment the line below if al/graphics/al_Font.hpp is available in your
// AlloLib installation (not always present — depends on freetype linkage):
// #include "al/graphics/al_Font.hpp"

#include <string>

namespace al {

/**
 * Minimal Font stub for native/desktop builds.
 *
 * Replace with the real al::Font implementation by uncommenting the
 * #include above when freetype support is compiled into AlloLib.
 */
struct Font {
    /**
     * Load a font.
     * @param path  Path to a TTF/OTF file (desktop) or CSS font family (WASM).
     * @param size  Font size in pixels.
     * @return true on success (always false in this stub).
     */
    bool load(const std::string& /*path*/, int /*size*/ = 24) { return false; }

    /**
     * Render text at (x, y).
     * No-op in this stub — link against the real al::Font for output.
     */
    template <typename TGraphics>
    void render(TGraphics& /*g*/, const std::string& /*text*/,
                float /*x*/, float /*y*/) {}

    /** Measure rendered text width in pixels. */
    float measureWidth(const std::string& /*text*/) const { return 0.0f; }

    /** Line height in pixels. */
    float lineHeight() const { return 0.0f; }

    /** True once load() succeeds. */
    bool ready() const { return false; }
};

} // namespace al

#endif // __EMSCRIPTEN__
