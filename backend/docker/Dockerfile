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
RUN mkdir -p /app/source /app/output /app/cache

# Pre-download and cache common AlloLib headers
# This will be populated when AlloLib is integrated
RUN mkdir -p /app/allolib

# Environment variables
ENV EMSDK=/emsdk
ENV EM_CONFIG=/emsdk/.emscripten
ENV PATH="/emsdk:/emsdk/upstream/emscripten:${PATH}"

# Compilation script
COPY compile.sh /app/compile.sh
RUN chmod +x /app/compile.sh

# Default command
CMD ["/bin/bash"]
