#!/bin/bash
# AlloLib WASM Compilation Script

set -e

SOURCE_FILE="${1:-/app/source/main.cpp}"
OUTPUT_DIR="${2:-/app/output}"
JOB_ID="${3:-default}"

ALLOLIB_DIR="${ALLOLIB_DIR:-/app/allolib}"
GAMMA_DIR="${GAMMA_DIR:-/app/allolib/external/Gamma}"
AL_EXT_DIR="${AL_EXT_DIR:-/app/al_ext}"

echo "[INFO] Starting compilation for job: $JOB_ID"
echo "[INFO] Source: $SOURCE_FILE"
echo "[INFO] Output: $OUTPUT_DIR"
echo "[INFO] AlloLib: $ALLOLIB_DIR"
echo "[INFO] AlloLib Extensions: $AL_EXT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Emscripten compilation flags
EMCC_FLAGS=(
    -O2
    -std=c++17
    -s USE_WEBGL2=1
    -s FULL_ES3=1
    -s USE_GLFW=3
    -s ALLOW_MEMORY_GROWTH=1
    -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap']"
    -s MODULARIZE=1
    -s EXPORT_ES6=1
    -s "ENVIRONMENT='web'"
    -s ASYNCIFY=1
    -s ASSERTIONS=1
    -s GL_DEBUG=1
    --bind
)

# Include paths for AlloLib and dependencies
INCLUDE_FLAGS=(
    -I"$ALLOLIB_DIR/include"
    -I"$ALLOLIB_DIR/external/glfw/include"
    -I"$ALLOLIB_DIR/external/json/single_include"
    -I"$ALLOLIB_DIR/external/imgui"
    -I"$GAMMA_DIR"
    -I"$AL_EXT_DIR/soundfile"
    -I"$AL_EXT_DIR/spatialaudio"
    -I"$AL_EXT_DIR/assets3d"
)

# Compile
echo "[INFO] Running emcc..."
em++ "${EMCC_FLAGS[@]}" "${INCLUDE_FLAGS[@]}" \
    "$SOURCE_FILE" \
    -o "$OUTPUT_DIR/app.js"

echo "[SUCCESS] Compilation complete"
echo "[INFO] Output files:"
ls -la "$OUTPUT_DIR"
