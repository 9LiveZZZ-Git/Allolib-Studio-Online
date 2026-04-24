# AlloLib Studio Online — Railway Deployment Image
#
# Built on the Emscripten base so compile.sh can run em++ directly.
# Node.js 20 is layered on top to serve the Express API.
#
# Build time: ~25–40 min (AlloLib WASM compilation; cached in subsequent deployments)
# Image size:  ~3–4 GB

FROM emscripten/emsdk:3.1.73

# ── System deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
        curl cmake ninja-build \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── AlloLib source (cloned at build time) ────────────────────────────────────
RUN git clone --depth 1 \
        https://github.com/AlloSphere-Research-Group/allolib.git \
        /app/allolib \
    && cd /app/allolib \
    && git submodule update --init --recursive

# ── WASM compat layer + build scripts ────────────────────────────────────────
COPY allolib-wasm/ /app/allolib-wasm/
COPY backend/docker/build-allolib.sh /app/build-allolib.sh
COPY backend/docker/compile.sh       /app/compile.sh
RUN chmod +x /app/build-allolib.sh /app/compile.sh

# ── Pre-build AlloLib for both backends (slow; result is a cached layer) ─────
ENV ALLOLIB_DIR=/app/allolib
ENV ALLOLIB_WASM_DIR=/app/allolib-wasm
ENV GAMMA_DIR=/app/allolib/external/Gamma
RUN /app/build-allolib.sh all

# ── Node.js backend ──────────────────────────────────────────────────────────
COPY backend/package.json backend/package-lock.json* /app/backend/
WORKDIR /app/backend
RUN npm ci

COPY backend/ /app/backend/
RUN npm run build && npm prune --production

# ── Runtime directories ───────────────────────────────────────────────────────
RUN mkdir -p /app/source /app/compiled

# ── Runtime environment ───────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV USE_EMCC=true
ENV COMPILE_SCRIPT=/app/compile.sh
ENV SOURCE_DIR=/app/source
ENV COMPILE_DIR=/app/compiled

EXPOSE 4000
CMD ["node", "dist/index.js"]
