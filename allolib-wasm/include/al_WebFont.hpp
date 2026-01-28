/**
 * Web Font Rendering
 *
 * Simple bitmap font rendering for AlloLib WASM.
 * Uses Canvas 2D API to generate font texture atlas.
 *
 * Usage:
 *   WebFont font;
 *   font.load("Arial", 24);  // Font family, size in pixels
 *
 *   // In onDraw:
 *   font.render(g, "Hello World", 0, 0);
 *
 * Note: This creates a texture atlas at load time with ASCII characters.
 * For full Unicode support, consider loading a pre-made font atlas.
 */

#ifndef AL_WEB_FONT_HPP
#define AL_WEB_FONT_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <cstdint>
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"

namespace al {

/**
 * Character glyph information
 */
struct Glyph {
    float u0, v0, u1, v1;  // Texture coordinates
    float width, height;    // Size in pixels
    float xOffset, yOffset; // Offset from baseline
    float advance;          // Horizontal advance
};

/**
 * Bitmap font using texture atlas
 */
class WebFont {
public:
    WebFont() : mSize(24), mLineHeight(28), mLoaded(false) {}

    ~WebFont() {
        // Texture cleanup handled by Texture destructor
    }

    /**
     * Load a font with specified family and size
     * @param fontFamily CSS font family (e.g., "Arial", "monospace")
     * @param size Font size in pixels
     * @param bold Whether to use bold weight
     */
    void load(const std::string& fontFamily = "Arial", int size = 24, bool bold = false) {
        mFontFamily = fontFamily;
        mSize = size;
        mBold = bold;

        // Generate font atlas using Canvas 2D
        EM_ASM({
            var fontPtr = $0;
            var fontFamily = UTF8ToString($1);
            var size = $2;
            var bold = $3;

            // Create offscreen canvas
            var canvas = document.createElement('canvas');
            var atlasSize = 512;  // Power of 2 for WebGL
            canvas.width = atlasSize;
            canvas.height = atlasSize;
            var ctx = canvas.getContext('2d');

            // Set font
            var fontStyle = (bold ? 'bold ' : '') + size + 'px ' + fontFamily;
            ctx.font = fontStyle;
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'white';

            // Clear with transparent black
            ctx.clearRect(0, 0, atlasSize, atlasSize);

            // Characters to include (ASCII printable range)
            var chars = '';
            for (var i = 32; i < 127; i++) {
                chars += String.fromCharCode(i);
            }

            // Layout characters in grid
            var padding = 2;
            var x = padding;
            var y = padding;
            var maxHeight = 0;
            var glyphData = [];

            for (var i = 0; i < chars.length; i++) {
                var ch = chars[i];
                var metrics = ctx.measureText(ch);
                var charWidth = Math.ceil(metrics.width) + 1;
                var charHeight = size + 4;  // Approximate height

                // Check if we need to move to next row
                if (x + charWidth + padding > atlasSize) {
                    x = padding;
                    y += maxHeight + padding;
                    maxHeight = 0;
                }

                // Draw character
                ctx.fillText(ch, x, y);

                // Store glyph info
                glyphData.push({
                    code: chars.charCodeAt(i),
                    u0: x / atlasSize,
                    v0: y / atlasSize,
                    u1: (x + charWidth) / atlasSize,
                    v1: (y + charHeight) / atlasSize,
                    width: charWidth,
                    height: charHeight,
                    advance: metrics.width
                });

                x += charWidth + padding;
                maxHeight = Math.max(maxHeight, charHeight);
            }

            // Get pixel data
            var imageData = ctx.getImageData(0, 0, atlasSize, atlasSize);
            var pixels = imageData.data;

            // Convert RGBA to single channel (use red channel or alpha)
            var alphaData = new Uint8Array(atlasSize * atlasSize);
            for (var i = 0; i < alphaData.length; i++) {
                alphaData[i] = pixels[i * 4 + 3];  // Alpha channel
            }

            // Copy to WASM memory
            var ptr = Module._malloc(alphaData.length);
            Module.HEAPU8.set(alphaData, ptr);

            // Pass glyph data as JSON
            var glyphJson = JSON.stringify(glyphData);
            var glyphPtr = allocateUTF8(glyphJson);

            // Call C++ callback
            Module.ccall('_al_web_font_loaded', null,
                ['number', 'number', 'number', 'number', 'number'],
                [fontPtr, ptr, atlasSize, size, glyphPtr]);

            _free(ptr);
            _free(glyphPtr);

        }, this, fontFamily.c_str(), size, bold ? 1 : 0);
    }

    /**
     * Check if font is loaded and ready
     */
    bool ready() const { return mLoaded; }

    /**
     * Get font size in pixels
     */
    int size() const { return mSize; }

    /**
     * Get line height
     */
    float lineHeight() const { return mLineHeight; }

    /**
     * Measure text width
     */
    float measureWidth(const std::string& text) const {
        if (!mLoaded) return 0;

        float width = 0;
        for (char c : text) {
            auto it = mGlyphs.find(c);
            if (it != mGlyphs.end()) {
                width += it->second.advance;
            }
        }
        return width;
    }

    /**
     * Build a mesh for text rendering
     * @param text The text to render
     * @param x Starting X position
     * @param y Starting Y position (baseline)
     */
    void buildMesh(Mesh& mesh, const std::string& text, float x = 0, float y = 0) const {
        if (!mLoaded) return;

        mesh.reset();
        mesh.primitive(Mesh::TRIANGLES);

        float curX = x;
        float curY = y;

        for (char c : text) {
            if (c == '\n') {
                curX = x;
                curY += mLineHeight;
                continue;
            }

            auto it = mGlyphs.find(c);
            if (it == mGlyphs.end()) continue;

            const Glyph& g = it->second;

            // Quad vertices (two triangles)
            float x0 = curX;
            float y0 = curY;
            float x1 = curX + g.width;
            float y1 = curY + g.height;

            // First triangle
            mesh.vertex(x0, y0, 0);
            mesh.texCoord(g.u0, g.v0);
            mesh.vertex(x1, y0, 0);
            mesh.texCoord(g.u1, g.v0);
            mesh.vertex(x1, y1, 0);
            mesh.texCoord(g.u1, g.v1);

            // Second triangle
            mesh.vertex(x0, y0, 0);
            mesh.texCoord(g.u0, g.v0);
            mesh.vertex(x1, y1, 0);
            mesh.texCoord(g.u1, g.v1);
            mesh.vertex(x0, y1, 0);
            mesh.texCoord(g.u0, g.v1);

            curX += g.advance;
        }
    }

    /**
     * Render text directly
     * Note: Requires proper shader setup for textured quads
     */
    void render(Graphics& g, const std::string& text, float x, float y) {
        if (!mLoaded) return;

        Mesh textMesh;
        buildMesh(textMesh, text, x, y);

        // Bind texture and draw
        mTexture.bind();
        g.draw(textMesh);
        mTexture.unbind();
    }

    /**
     * Get the font texture for manual rendering
     */
    Texture& texture() { return mTexture; }

    // Internal callback from JavaScript
    void _onLoaded(uint8_t* atlasData, int atlasSize, int fontSize, const char* glyphJson) {
        mSize = fontSize;
        mLineHeight = fontSize * 1.2f;

        // Create texture from atlas data
        mTexture.create2D(atlasSize, atlasSize, Texture::R8, Texture::RED, Texture::UBYTE);
        mTexture.submit(atlasData);

        // Parse glyph data from JSON
        std::string json(glyphJson);
        parseGlyphs(json);

        mLoaded = true;
        printf("[WebFont] Loaded: %s %dpx, %zu glyphs\n",
               mFontFamily.c_str(), mSize, mGlyphs.size());
    }

private:
    void parseGlyphs(const std::string& json) {
        mGlyphs.clear();

        // Simple JSON array parser
        size_t pos = 1;  // Skip opening [
        while (pos < json.length()) {
            // Find next object
            size_t objStart = json.find('{', pos);
            if (objStart == std::string::npos) break;
            size_t objEnd = json.find('}', objStart);
            if (objEnd == std::string::npos) break;

            std::string obj = json.substr(objStart, objEnd - objStart + 1);

            Glyph g;
            int code = 0;

            // Parse fields (simple extraction)
            auto getNumber = [&obj](const std::string& key) -> float {
                size_t p = obj.find("\"" + key + "\":");
                if (p == std::string::npos) return 0;
                p += key.length() + 3;
                return atof(obj.c_str() + p);
            };

            code = (int)getNumber("code");
            g.u0 = getNumber("u0");
            g.v0 = getNumber("v0");
            g.u1 = getNumber("u1");
            g.v1 = getNumber("v1");
            g.width = getNumber("width");
            g.height = getNumber("height");
            g.advance = getNumber("advance");
            g.xOffset = 0;
            g.yOffset = 0;

            if (code > 0) {
                mGlyphs[(char)code] = g;
            }

            pos = objEnd + 1;
        }
    }

    std::string mFontFamily;
    int mSize;
    bool mBold;
    float mLineHeight;
    bool mLoaded;
    Texture mTexture;
    std::unordered_map<char, Glyph> mGlyphs;
};

} // namespace al

// C callback for JavaScript
extern "C" {
    void _al_web_font_loaded(al::WebFont* font, uint8_t* atlasData, int atlasSize, int fontSize, const char* glyphJson) {
        if (font) {
            font->_onLoaded(atlasData, atlasSize, fontSize, glyphJson);
        }
    }
}

#endif // AL_WEB_FONT_HPP
