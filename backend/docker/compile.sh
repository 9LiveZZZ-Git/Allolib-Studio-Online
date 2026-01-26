#!/bin/bash
# AlloLib WASM Compilation Script

set -e

SOURCE_FILE="${1:-/app/source/main.cpp}"
OUTPUT_DIR="${2:-/app/output}"
JOB_ID="${3:-default}"

echo "[INFO] Starting compilation for job: $JOB_ID"
echo "[INFO] Source: $SOURCE_FILE"
echo "[INFO] Output: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Emscripten compilation flags
EMCC_FLAGS=(
    -O2
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
    --bind
    -std=c++17
)

# Add AlloLib include paths (when integrated)
# EMCC_FLAGS+=(-I/app/allolib/include)

# Compile
echo "[INFO] Running emcc..."
em++ "${EMCC_FLAGS[@]}" \
    "$SOURCE_FILE" \
    -o "$OUTPUT_DIR/app.js"

echo "[SUCCESS] Compilation complete"
echo "[INFO] Output files:"
ls -la "$OUTPUT_DIR"
