#!/bin/bash
# Build AlloLib as static library for Emscripten
# Supports dual backends: WebGL2 (default) and WebGPU
# This script is run once when setting up the compiler container

set -e

BACKEND="${1:-all}"  # webgl2, webgpu, or all (default)

ALLOLIB_DIR="${ALLOLIB_DIR:-/app/allolib}"
ALLOLIB_WASM_DIR="${ALLOLIB_WASM_DIR:-/app/allolib-wasm}"

echo "[INFO] ================================================"
echo "[INFO] Building AlloLib for WebAssembly"
echo "[INFO] Backend: $BACKEND"
echo "[INFO] ================================================"
echo "[INFO] AlloLib source: $ALLOLIB_DIR"
echo "[INFO] AlloLib-WASM config: $ALLOLIB_WASM_DIR"

build_backend() {
    local backend_type=$1
    local backend_flag=$2
    local build_dir="/app/build-wasm-$backend_type"
    local lib_dir="/app/lib-$backend_type"

    echo ""
    echo "[INFO] ================================================"
    echo "[INFO] Building $backend_type backend..."
    echo "[INFO] Build directory: $build_dir"
    echo "[INFO] Library directory: $lib_dir"
    echo "[INFO] ================================================"

    # Force rebuild
    echo "[INFO] Removing old libraries..."
    rm -f "$lib_dir/libal_web.a" "$lib_dir/libGamma.a" 2>/dev/null || true

    # Create build directory
    mkdir -p "$build_dir"
    cd "$build_dir"

    # Configure with Emscripten CMake
    echo "[INFO] Running emcmake cmake..."
    emcmake cmake "$ALLOLIB_WASM_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_TEST_APP=OFF \
        $backend_flag \
        -G Ninja

    # Build
    echo "[INFO] Building with Ninja..."
    ninja

    # Install libraries
    echo "[INFO] Installing libraries..."
    mkdir -p "$lib_dir"
    cp libal_web.a "$lib_dir/" 2>/dev/null || true
    cp libGamma.a "$lib_dir/" 2>/dev/null || true

    echo "[SUCCESS] $backend_type backend build complete!"
    echo "[INFO] Libraries installed to: $lib_dir"
    ls -la "$lib_dir"
}

# Build requested backend(s)
case "$BACKEND" in
    webgl2)
        build_backend "webgl2" "-DALLOLIB_BACKEND_WEBGL2=ON -DALLOLIB_BACKEND_WEBGPU=OFF"
        ;;
    webgpu)
        build_backend "webgpu" "-DALLOLIB_BACKEND_WEBGL2=OFF -DALLOLIB_BACKEND_WEBGPU=ON"
        ;;
    all)
        build_backend "webgl2" "-DALLOLIB_BACKEND_WEBGL2=ON -DALLOLIB_BACKEND_WEBGPU=OFF"
        build_backend "webgpu" "-DALLOLIB_BACKEND_WEBGL2=OFF -DALLOLIB_BACKEND_WEBGPU=ON"
        ;;
    *)
        echo "[ERROR] Unknown backend: $BACKEND"
        echo "[INFO] Valid options: webgl2, webgpu, all"
        exit 1
        ;;
esac

echo ""
echo "[SUCCESS] AlloLib build complete!"
