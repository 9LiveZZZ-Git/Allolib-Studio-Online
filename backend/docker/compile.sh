#!/bin/bash
# AlloLib WASM Compilation Script
# Compiles user C++ code and links against pre-built AlloLib

set -e

SOURCE_FILE="${1:-/app/source/main.cpp}"
OUTPUT_DIR="${2:-/app/output}"
JOB_ID="${3:-default}"

ALLOLIB_DIR="${ALLOLIB_DIR:-/app/allolib}"
ALLOLIB_WASM_DIR="${ALLOLIB_WASM_DIR:-/app/allolib-wasm}"
GAMMA_DIR="${GAMMA_DIR:-/app/allolib/external/Gamma}"
AL_EXT_DIR="${AL_EXT_DIR:-/app/al_ext}"
LIB_DIR="/app/lib"

echo "[INFO] ================================================"
echo "[INFO] AlloLib WASM Compilation"
echo "[INFO] ================================================"
echo "[INFO] Job ID: $JOB_ID"
echo "[INFO] Source: $SOURCE_FILE"
echo "[INFO] Output: $OUTPUT_DIR"

# Build AlloLib if not already built
if [ ! -f "$LIB_DIR/libal_web.a" ]; then
    echo "[INFO] AlloLib not built yet, building..."
    /app/build-allolib.sh
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Emscripten compilation flags
EMCC_FLAGS=(
    -O2
    -std=c++17
    -sUSE_WEBGL2=1
    -sFULL_ES3=1
    -sUSE_GLFW=3
    -sALLOW_MEMORY_GROWTH=1
    -sEXPORTED_RUNTIME_METHODS="['ccall','cwrap','UTF8ToString','stringToUTF8']"
    -sEXPORTED_FUNCTIONS="['_main','_malloc','_free','_allolib_create','_allolib_start','_allolib_stop','_allolib_destroy','_allolib_process_audio','_allolib_configure_audio']"
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sENVIRONMENT='web'
    -sASYNCIFY=1
    -sASYNCIFY_STACK_SIZE=65536
    -sASSERTIONS=1
    --bind
)

# Include paths - ALLOLIB_WASM_DIR must come FIRST to override AlloLib headers with WebGL2 patches
INCLUDE_FLAGS=(
    -I"$ALLOLIB_WASM_DIR/include"
    -I"$ALLOLIB_DIR/include"
    -I"$ALLOLIB_DIR/external/glfw/include"
    -I"$ALLOLIB_DIR/external/glad/include"
    -I"$ALLOLIB_DIR/external/json/include"
    -I"$GAMMA_DIR"
)

# Library flags
LIB_FLAGS=(
    -L"$LIB_DIR"
    -lal_web
    -lGamma
)

# Definitions
DEFS=(
    -DAL_AUDIO_DUMMY
    -DAL_EMSCRIPTEN
    -DGLFW_INCLUDE_ES3
)

echo "[INFO] Compiling with em++..."
echo "[INFO] Command: em++ ${EMCC_FLAGS[*]} ${INCLUDE_FLAGS[*]} ${DEFS[*]} $SOURCE_FILE ${LIB_FLAGS[*]} -o $OUTPUT_DIR/app.js"

# Compile
em++ "${EMCC_FLAGS[@]}" "${INCLUDE_FLAGS[@]}" "${DEFS[@]}" \
    "$SOURCE_FILE" \
    "${LIB_FLAGS[@]}" \
    -o "$OUTPUT_DIR/app.js"

# Copy audio worklet processor
if [ -f "$ALLOLIB_WASM_DIR/src/allolib-audio-processor.js" ]; then
    cp "$ALLOLIB_WASM_DIR/src/allolib-audio-processor.js" "$OUTPUT_DIR/"
    echo "[INFO] Copied audio worklet processor"
fi

echo "[SUCCESS] Compilation complete!"
echo "[INFO] Output files:"
ls -la "$OUTPUT_DIR"
