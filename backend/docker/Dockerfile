# AlloLib Compilation Server
# Uses Emscripten for C++ to WebAssembly compilation
# Supports dual backends: WebGL2 and WebGPU

# IMPORTANT: Emscripten 3.1.73+ required for WebGPU support
# See webgpu-implementation-plan.md "Proof of Concept Findings" for details
FROM emscripten/emsdk:3.1.73

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    ninja-build \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Create directories for dual-backend builds
RUN mkdir -p /app/source /app/output /app/cache /app/allolib /app/allolib-wasm
RUN mkdir -p /app/lib-webgl2 /app/lib-webgpu

# Environment variables
ENV EMSDK=/emsdk
ENV EM_CONFIG=/emsdk/.emscripten
ENV PATH="/emsdk:/emsdk/upstream/emscripten:${PATH}"

# AlloLib paths (mounted at runtime)
ENV ALLOLIB_DIR=/app/allolib
ENV ALLOLIB_WASM_DIR=/app/allolib-wasm
ENV GAMMA_DIR=/app/allolib/external/Gamma
ENV AL_EXT_DIR=/app/al_ext

# Build script for pre-compiling AlloLib
COPY build-allolib.sh /app/build-allolib.sh
RUN chmod +x /app/build-allolib.sh

# Compilation script for user code
COPY compile.sh /app/compile.sh
RUN chmod +x /app/compile.sh

# Default command
CMD ["/bin/bash"]
