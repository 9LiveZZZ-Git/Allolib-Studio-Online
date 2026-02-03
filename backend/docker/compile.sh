#!/bin/bash
# AlloLib WASM Compilation Script
# Compiles user C++ code and links against pre-built AlloLib
# Supports dual backends: WebGL2 (default) and WebGPU

set -e

SOURCE_FILE="${1:-/app/source/main.cpp}"
OUTPUT_DIR="${2:-/app/output}"
JOB_ID="${3:-default}"
BACKEND="${4:-webgl2}"  # webgl2 or webgpu

ALLOLIB_DIR="${ALLOLIB_DIR:-/app/allolib}"
ALLOLIB_WASM_DIR="${ALLOLIB_WASM_DIR:-/app/allolib-wasm}"
GAMMA_DIR="${GAMMA_DIR:-/app/allolib/external/Gamma}"
AL_EXT_DIR="${AL_EXT_DIR:-/app/al_ext}"

# Select library directory based on backend
LIB_DIR="/app/lib-$BACKEND"

echo "[INFO] ================================================"
echo "[INFO] AlloLib WASM Compilation"
echo "[INFO] ================================================"
echo "[INFO] Job ID: $JOB_ID"
echo "[INFO] Source: $SOURCE_FILE"
echo "[INFO] Output: $OUTPUT_DIR"
echo "[INFO] Backend: $BACKEND"
echo "[INFO] Library: $LIB_DIR"

# Validate backend
if [ "$BACKEND" != "webgl2" ] && [ "$BACKEND" != "webgpu" ]; then
    echo "[ERROR] Invalid backend: $BACKEND"
    echo "[INFO] Valid options: webgl2, webgpu"
    exit 1
fi

# Build AlloLib if not already built for this backend
if [ ! -f "$LIB_DIR/libal_web.a" ]; then
    echo "[INFO] AlloLib not built for $BACKEND, building..."
    /app/build-allolib.sh "$BACKEND"
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Base Emscripten compilation flags
EMCC_FLAGS=(
    -O2
    -std=c++17
    -sUSE_GLFW=3
    -sALLOW_MEMORY_GROWTH=1
    -sEXPORTED_RUNTIME_METHODS="['ccall','cwrap','UTF8ToString','stringToUTF8']"
    -sEXPORTED_FUNCTIONS="['_main','_malloc','_free','_allolib_create','_allolib_configure_backend','_allolib_start','_allolib_stop','_allolib_destroy','_allolib_process_audio','_allolib_configure_audio','_al_webgui_get_parameter_count','_al_webgui_get_parameter_name','_al_webgui_get_parameter_group','_al_webgui_get_parameter_type','_al_webgui_get_parameter_min','_al_webgui_get_parameter_max','_al_webgui_get_parameter_value','_al_webgui_get_parameter_default','_al_webgui_set_parameter_value','_al_webgui_set_parameter_string','_al_webgui_trigger_parameter','_al_webgui_set_parameter_vec3','_al_webgui_set_parameter_vec4','_al_web_set_point_size','_al_web_get_point_size','_al_autolod_set_bias','_al_autolod_set_enabled','_al_autolod_set_budget','_al_autolod_set_mode','_al_autolod_get_triangles','_al_autolod_get_bias','_al_autolod_set_min_full_quality_distance','_al_autolod_set_distances','_al_autolod_set_distance_scale','_al_autolod_get_distance_scale','_al_autolod_set_levels','_al_autolod_get_levels','_al_autolod_set_unload_distance','_al_autolod_set_unload_enabled','_al_texture_lod_set_enabled','_al_texture_lod_get_enabled','_al_texture_lod_set_bias','_al_texture_lod_get_bias','_al_texture_lod_set_max_resolution','_al_texture_lod_get_max_resolution','_al_texture_lod_get_resolution','_al_texture_lod_get_level','_al_texture_lod_set_reference_distance','_al_texture_lod_get_reference_distance','_al_texture_lod_get_continuous']"
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sENVIRONMENT='web'
    -sASYNCIFY=1
    -sASYNCIFY_STACK_SIZE=65536
    -sASSERTIONS=1
    --bind
)

# Backend-specific flags
if [ "$BACKEND" = "webgpu" ]; then
    echo "[INFO] Using WebGPU backend (compute shaders enabled)"
    EMCC_FLAGS+=(-sUSE_WEBGPU=1)
    # WebGPU builds also include WebGL2 for compatibility
    EMCC_FLAGS+=(-sUSE_WEBGL2=1 -sFULL_ES3=1)
else
    echo "[INFO] Using WebGL2 backend (maximum compatibility)"
    EMCC_FLAGS+=(-sUSE_WEBGL2=1 -sFULL_ES3=1)
fi

# Include paths - ALLOLIB_WASM_DIR must come FIRST to override AlloLib headers
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

# Backend-specific definitions
if [ "$BACKEND" = "webgpu" ]; then
    DEFS+=(-DALLOLIB_WEBGPU=1)
else
    DEFS+=(-DALLOLIB_WEBGL2=1)
fi

echo "[INFO] Compiling with em++..."
echo "[INFO] Flags: ${EMCC_FLAGS[*]}"

# WebControlGUI stubs file
WEBGUI_STUBS="$ALLOLIB_WASM_DIR/src/al_WebControlGUI.cpp"

# Compile
em++ "${EMCC_FLAGS[@]}" "${INCLUDE_FLAGS[@]}" "${DEFS[@]}" \
    "$SOURCE_FILE" \
    "$WEBGUI_STUBS" \
    "${LIB_FLAGS[@]}" \
    -o "$OUTPUT_DIR/app.js"

# Copy audio worklet processor
if [ -f "$ALLOLIB_WASM_DIR/src/allolib-audio-processor.js" ]; then
    cp "$ALLOLIB_WASM_DIR/src/allolib-audio-processor.js" "$OUTPUT_DIR/"
    echo "[INFO] Copied audio worklet processor"
fi

# Write backend info file for frontend
echo "$BACKEND" > "$OUTPUT_DIR/backend.txt"
echo "[INFO] Backend info written to backend.txt"

echo "[SUCCESS] Compilation complete! (backend: $BACKEND)"
echo "[INFO] Output files:"
ls -la "$OUTPUT_DIR"
