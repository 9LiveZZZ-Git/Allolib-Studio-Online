# AlloLib Compilation Server
# Uses Emscripten for C++ to WebAssembly compilation

FROM emscripten/emsdk:3.1.50

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    ninja-build \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Create directories
RUN mkdir -p /app/source /app/output /app/cache /app/allolib /app/allolib-wasm /app/lib

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
