import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // App control
  restartApp: () => ipcRenderer.invoke('restart-app'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // File dialogs
  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: OpenDialogOptions) => ipcRenderer.invoke('show-open-dialog', options),

  // Platform info
  platform: process.platform,
  isPackaged: process.env.NODE_ENV === 'production',
});

// Type definitions for the exposed API
interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  error?: string;
  releaseNotes?: string;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

// Declare global type for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      getBackendUrl: () => Promise<string>;
      checkForUpdates: () => Promise<void>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
      restartApp: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      showSaveDialog: (options: SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
      showOpenDialog: (options: OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
      platform: NodeJS.Platform;
      isPackaged: boolean;
    };
  }
}
