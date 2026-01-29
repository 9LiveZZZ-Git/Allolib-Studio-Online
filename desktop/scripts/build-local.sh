#!/bin/bash
# AlloLib Studio Desktop - Local Build Script (macOS/Linux)
# This script builds the desktop application locally

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_FRONTEND=false
SKIP_BACKEND=false
PACKAGE_ONLY=false
TARGET="dir"

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            shift
            ;;
        --package-only)
            PACKAGE_ONLY=true
            shift
            ;;
        --target)
            TARGET="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}========================================"
echo "  AlloLib Studio Desktop Build Script  "
echo -e "========================================${NC}"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DESKTOP_DIR")"

echo -e "Project Root: ${CYAN}$PROJECT_ROOT${NC}"
echo -e "Desktop Dir: ${CYAN}$DESKTOP_DIR${NC}"
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)  PLATFORM="linux";;
    Darwin*) PLATFORM="mac";;
    *)       PLATFORM="unknown";;
esac
echo -e "Platform: ${CYAN}$PLATFORM${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed. Please install Node.js 18 or later.${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "  Node.js: ${GREEN}$NODE_VERSION${NC}"

NPM_VERSION=$(npm --version)
echo -e "  npm: ${GREEN}$NPM_VERSION${NC}"
echo ""

# Install root dependencies
if [ "$PACKAGE_ONLY" = false ]; then
    echo -e "${YELLOW}Installing root dependencies...${NC}"
    cd "$PROJECT_ROOT"
    npm ci
    echo -e "  ${GREEN}Done!${NC}"
    echo ""
fi

# Build frontend
if [ "$SKIP_FRONTEND" = false ] && [ "$PACKAGE_ONLY" = false ]; then
    echo -e "${YELLOW}Building frontend...${NC}"
    cd "$PROJECT_ROOT"
    npm run build:frontend
    echo -e "  ${GREEN}Done!${NC}"
    echo ""
fi

# Build backend
if [ "$SKIP_BACKEND" = false ] && [ "$PACKAGE_ONLY" = false ]; then
    echo -e "${YELLOW}Building backend...${NC}"
    cd "$PROJECT_ROOT"
    npm run build:backend
    echo -e "  ${GREEN}Done!${NC}"
    echo ""
fi

# Install desktop dependencies
echo -e "${YELLOW}Installing desktop dependencies...${NC}"
cd "$DESKTOP_DIR"
npm ci
echo -e "  ${GREEN}Done!${NC}"
echo ""

# Build desktop TypeScript
echo -e "${YELLOW}Building desktop TypeScript...${NC}"
npm run build
echo -e "  ${GREEN}Done!${NC}"
echo ""

# Package application
echo -e "${YELLOW}Packaging application (target: $TARGET)...${NC}"

case "$TARGET" in
    "dir")
        npm run pack
        ;;
    "dmg")
        npx electron-builder --mac dmg
        ;;
    "pkg")
        npx electron-builder --mac pkg
        ;;
    "appimage")
        npx electron-builder --linux AppImage
        ;;
    "deb")
        npx electron-builder --linux deb
        ;;
    "all")
        if [ "$PLATFORM" = "mac" ]; then
            npm run dist:mac
        else
            npm run dist:linux
        fi
        ;;
    *)
        npm run pack
        ;;
esac

echo ""
echo -e "${GREEN}========================================"
echo "  Build Complete!                       "
echo -e "========================================${NC}"
echo ""
echo -e "Output directory: ${CYAN}$DESKTOP_DIR/release${NC}"
echo ""

# List output files
if [ -d "$DESKTOP_DIR/release" ]; then
    echo -e "${YELLOW}Build artifacts:${NC}"
    ls -lh "$DESKTOP_DIR/release" 2>/dev/null | tail -n +2 | while read line; do
        echo "  $line"
    done
fi

cd "$PROJECT_ROOT"
