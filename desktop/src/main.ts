import { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import * as path from 'path';
import { BackendRunner } from './backend-runner';
import { createMenu } from './menu';

// Configuration store for persisting settings
const store = new Store({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    checkUpdatesOnStartup: true,
    theme: 'dark',
  },
});

// Global references
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendRunner: BackendRunner | null = null;
let isQuitting = false;

// Backend port (will be dynamically assigned)
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173;

// ─── App Paths ───────────────────────────────────────────────────────────────

function getResourcePath(relativePath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', '..', relativePath);
}

// ─── Window Management ───────────────────────────────────────────────────────

async function createWindow(): Promise<void> {
  const bounds = store.get('windowBounds') as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 1024,
    minHeight: 600,
    title: 'AlloLib Studio',
    icon: getIconPath(),
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    show: false, // Don't show until ready
  });

  // Set up menu
  const menu = createMenu(mainWindow, {
    checkForUpdates: () => checkForUpdates(true),
    openDevTools: () => mainWindow?.webContents.openDevTools(),
  });
  Menu.setApplicationMenu(menu);

  // Load the app
  if (app.isPackaged) {
    // Production: serve from bundled frontend
    const frontendPath = getResourcePath('frontend');
    await mainWindow.loadFile(path.join(frontendPath, 'index.html'));
  } else {
    // Development: connect to Vite dev server
    await mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', { width: bounds.width, height: bounds.height });
    }
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getIconPath(): string {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(__dirname, '..', 'resources', 'icon.ico');
  } else if (platform === 'darwin') {
    return path.join(__dirname, '..', 'resources', 'icon.icns');
  }
  return path.join(__dirname, '..', 'resources', 'icon.png');
}

// ─── System Tray ─────────────────────────────────────────────────────────────

function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'resources', 'tray-icon.png');
  let trayIcon: Electron.NativeImage;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Fallback: create a simple icon
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('AlloLib Studio');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open AlloLib Studio',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(true),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });
}

// ─── Auto Updater ────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    sendToRenderer('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    sendToRenderer('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
    });

    // Show dialog
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available.`,
      detail: 'Would you like to download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No updates available');
    sendToRenderer('update-status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`);
    sendToRenderer('update-status', {
      status: 'downloading',
      percent: progress.percent,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    sendToRenderer('update-status', { status: 'downloaded', version: info.version });

    // Show restart dialog
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart now to apply the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error);
    sendToRenderer('update-status', { status: 'error', error: error.message });
  });
}

function checkForUpdates(manual = false): void {
  if (manual) {
    autoUpdater.checkForUpdates().catch((err) => {
      dialog.showErrorBox('Update Error', `Failed to check for updates: ${err.message}`);
    });
  } else {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silent fail for automatic checks
    });
  }
}

function sendToRenderer(channel: string, data: unknown): void {
  mainWindow?.webContents.send(channel, data);
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function setupIPC(): void {
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-backend-url', () => {
    return `http://localhost:${BACKEND_PORT}`;
  });

  ipcMain.handle('check-for-updates', () => {
    checkForUpdates(true);
  });

  ipcMain.handle('restart-app', () => {
    isQuitting = true;
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle('show-save-dialog', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow!, options);
    return result;
  });

  ipcMain.handle('show-open-dialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, options);
    return result;
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log('[App] Starting AlloLib Studio...');
  console.log('[App] Version:', app.getVersion());
  console.log('[App] Packaged:', app.isPackaged);

  // Start backend server
  backendRunner = new BackendRunner(BACKEND_PORT, getResourcePath);
  await backendRunner.start();

  // Set up IPC
  setupIPC();

  // Set up auto updater
  setupAutoUpdater();

  // Create window
  await createWindow();

  // Create tray
  createTray();

  // Check for updates on startup (if enabled)
  if (store.get('checkUpdatesOnStartup')) {
    setTimeout(() => checkForUpdates(false), 3000);
  }

  // macOS: re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;

  // Stop backend
  if (backendRunner) {
    console.log('[App] Stopping backend...');
    await backendRunner.stop();
  }
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  if (!app.isPackaged) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// ─── Error Handling ──────────────────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  console.error('[App] Uncaught exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[App] Unhandled rejection:', reason);
});
