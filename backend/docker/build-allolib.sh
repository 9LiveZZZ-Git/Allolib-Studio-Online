#!/bin/bash
# Build AlloLib as static library for Emscripten
# This script is run once when setting up the compiler container

set -e

ALLOLIB_DIR="${ALLOLIB_DIR:-/app/allolib}"
ALLOLIB_WASM_DIR="${ALLOLIB_WASM_DIR:-/app/allolib-wasm}"
BUILD_DIR="/app/build-wasm"
LIB_DIR="/app/lib"

echo "[INFO] Building AlloLib for WebAssembly..."
echo "[INFO] AlloLib source: $ALLOLIB_DIR"
echo "[INFO] AlloLib-WASM config: $ALLOLIB_WASM_DIR"
echo "[INFO] Build directory: $BUILD_DIR"

# Force rebuild - always build fresh to pick up source changes
echo "[INFO] Removing old libraries to force rebuild..."
rm -f "$LIB_DIR/libal_web.a" "$LIB_DIR/libGamma.a" 2>/dev/null || true

# Create build directory
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with Emscripten CMake
echo "[INFO] Running emcmake cmake..."
emcmake cmake "$ALLOLIB_WASM_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_TEST_APP=OFF \
    -G Ninja

# Build
echo "[INFO] Building with Ninja..."
ninja

# Install libraries
echo "[INFO] Installing libraries..."
mkdir -p "$LIB_DIR"
cp libal_web.a "$LIB_DIR/" 2>/dev/null || true
cp libGamma.a "$LIB_DIR/" 2>/dev/null || true

echo "[SUCCESS] AlloLib build complete!"
echo "[INFO] Libraries installed to: $LIB_DIR"
ls -la "$LIB_DIR"
