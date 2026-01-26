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

# Create directories for compilation
RUN mkdir -p /app/source /app/output /app/cache /app/allolib

# Environment variables
ENV EMSDK=/emsdk
ENV EM_CONFIG=/emsdk/.emscripten
ENV PATH="/emsdk:/emsdk/upstream/emscripten:${PATH}"

# AlloLib include paths (mounted at runtime)
ENV ALLOLIB_DIR=/app/allolib
ENV GAMMA_DIR=/app/allolib/external/Gamma

# Compilation script
COPY compile.sh /app/compile.sh
RUN chmod +x /app/compile.sh

# Default command
CMD ["/bin/bash"]
