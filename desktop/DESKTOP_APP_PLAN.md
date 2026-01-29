# AlloLib Studio Desktop Application Plan

## Overview

Create a standalone desktop application that bundles the frontend and backend, runs locally, and supports auto-updates from GitHub releases.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Electron 28+ | Cross-platform desktop shell |
| Builder | electron-builder | Create installers for all platforms |
| Updates | electron-updater | Auto-update from GitHub releases |
| Backend | Bundled Express server | Local compilation service |
| Frontend | Built Vue.js app | Served locally |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │  Backend Server │  │     Update Manager          │   │
│  │  (Express)      │  │  - Check GitHub releases    │   │
│  │  - Compilation  │  │  - Download updates         │   │
│  │  - WebSocket    │  │  - Apply on restart         │   │
│  └────────┬────────┘  └─────────────────────────────┘   │
│           │                                              │
│  ┌────────▼────────────────────────────────────────┐    │
│  │              BrowserWindow (Renderer)            │    │
│  │  ┌──────────────────────────────────────────┐   │    │
│  │  │           Vue.js Frontend                 │   │    │
│  │  │  - Monaco Editor                          │   │    │
│  │  │  - WebGL Viewer                           │   │    │
│  │  │  - Sequencer                              │   │    │
│  │  │  - Terminal                               │   │    │
│  │  └──────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Features

### Core Features
- [x] Bundled backend server (starts automatically)
- [x] Bundled frontend (served from local files)
- [x] Auto-update checking from GitHub releases
- [x] Native window controls and menus
- [x] System tray icon with quick actions

### Update System
- Check for updates on startup (configurable)
- Manual "Check for Updates" menu option
- Download progress indicator
- "Restart to Update" prompt
- Automatic update on quit (optional)

### Native Integration
- File system access for project saving
- Native file dialogs
- Drag & drop support
- Keyboard shortcuts
- Window state persistence (size, position)

## Build Targets

| Platform | Format | File |
|----------|--------|------|
| Windows x64 | NSIS Installer | `AlloLib-Studio-Setup-x.x.x.exe` |
| Windows x64 | Portable | `AlloLib-Studio-x.x.x-win.zip` |
| macOS x64 | DMG | `AlloLib-Studio-x.x.x.dmg` |
| macOS arm64 | DMG | `AlloLib-Studio-x.x.x-arm64.dmg` |
| macOS | pkg | `AlloLib-Studio-x.x.x.pkg` |
| Linux x64 | AppImage | `AlloLib-Studio-x.x.x.AppImage` |
| Linux x64 | deb | `allolib-studio_x.x.x_amd64.deb` |

## File Structure

```
desktop/
├── package.json              # Electron dependencies
├── tsconfig.json             # TypeScript config
├── electron-builder.yml      # Build configuration
├── src/
│   ├── main.ts               # Electron main process
│   ├── preload.ts            # Preload script (IPC bridge)
│   ├── backend-runner.ts     # Backend process manager
│   ├── update-manager.ts     # Auto-update logic
│   ├── menu.ts               # Native menu builder
│   └── tray.ts               # System tray
├── resources/
│   ├── icon.ico              # Windows icon
│   ├── icon.icns             # macOS icon
│   ├── icon.png              # Linux icon
│   └── tray-icon.png         # Tray icon
└── scripts/
    └── notarize.js           # macOS notarization

.github/workflows/
└── release.yml               # GitHub Actions release workflow
```

## Implementation Steps

### Step 1: Project Setup
1. Create `desktop/` directory
2. Initialize package.json with Electron dependencies
3. Set up TypeScript configuration
4. Create basic main.ts

### Step 2: Backend Integration
1. Create backend-runner.ts to spawn Express server
2. Handle backend stdout/stderr
3. Graceful shutdown on app quit
4. Port conflict detection

### Step 3: Frontend Serving
1. Serve built frontend from app resources
2. Load index.html in BrowserWindow
3. Configure CSP for local loading
4. Handle deep links

### Step 4: Auto-Update System
1. Configure electron-updater with GitHub provider
2. Check for updates on startup
3. Add update menu items
4. Show download progress
5. Handle update installation

### Step 5: Native Features
1. Create application menu
2. Add system tray with menu
3. Window state persistence
4. File dialogs for save/load

### Step 6: Build Configuration
1. Configure electron-builder.yml
2. Set up code signing (optional for beta)
3. Configure auto-update publishing
4. Add app icons

### Step 7: GitHub Actions Workflow
1. Create release workflow
2. Build for Windows, macOS, Linux
3. Upload artifacts to GitHub release
4. Generate release notes

### Step 8: Testing & Release
1. Test on Windows
2. Test on macOS (if available)
3. Test on Linux (if available)
4. Create v0.1.0-beta.1 release

## Dependencies

### Electron Main
```json
{
  "electron": "^28.0.0",
  "electron-builder": "^24.9.0",
  "electron-updater": "^6.1.0",
  "electron-store": "^8.1.0"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.3.0",
  "@types/node": "^20.10.0",
  "electron-devtools-installer": "^3.2.0"
}
```

## Update Flow

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  App Start  │───▶│  Check GitHub    │───▶│  Update Found?  │
└─────────────┘    │  releases API    │    └────────┬────────┘
                   └──────────────────┘             │
                                              Yes   │   No
                   ┌──────────────────┐    ┌───────▼────────┐
                   │  Download Update │◀───│  Show Banner   │
                   │  in Background   │    └────────────────┘
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │  "Restart Now"   │
                   │  or "Later"      │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │  Apply Update    │
                   │  on App Quit     │
                   └──────────────────┘
```

## GitHub Release Configuration

### Release Assets (per release)
- `AlloLib-Studio-Setup-x.x.x.exe` (Windows NSIS)
- `AlloLib-Studio-x.x.x-win.zip` (Windows Portable)
- `AlloLib-Studio-x.x.x.dmg` (macOS Intel)
- `AlloLib-Studio-x.x.x-arm64.dmg` (macOS Apple Silicon)
- `AlloLib-Studio-x.x.x.pkg` (macOS Installer)
- `AlloLib-Studio-x.x.x.AppImage` (Linux)
- `allolib-studio_x.x.x_amd64.deb` (Debian/Ubuntu)
- `latest.yml` (Windows update manifest)
- `latest-mac.yml` (macOS update manifest)
- `latest-linux.yml` (Linux update manifest)

### Version Strategy
- Beta releases: `v0.1.0-beta.1`, `v0.1.0-beta.2`, etc.
- Stable releases: `v0.1.0`, `v0.2.0`, etc.
- Pre-release flag in GitHub for beta versions

## Security Considerations

1. **Code Signing** (recommended for production)
   - Windows: Authenticode certificate
   - macOS: Apple Developer ID + notarization

2. **Content Security Policy**
   - Restrict script sources
   - Allow localhost for backend API

3. **Context Isolation**
   - Enable context isolation
   - Use preload scripts for IPC

## Known Limitations (Beta)

1. **No Code Signing** - Windows may show SmartScreen warning
2. **No Notarization** - macOS may require manual security override
3. **Backend Requirements** - Emscripten/Docker must be installed separately for compilation
4. **First Launch** - May be slow as backend initializes

## Future Enhancements

1. Bundled Emscripten SDK
2. Sandboxed compilation environment
3. Plugin system
4. Project templates
5. Cloud sync for projects
