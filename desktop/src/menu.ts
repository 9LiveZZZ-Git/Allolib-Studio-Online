import { app, BrowserWindow, Menu, shell, MenuItemConstructorOptions } from 'electron';

interface MenuActions {
  checkForUpdates: () => void;
  openDevTools: () => void;
}

export function createMenu(mainWindow: BrowserWindow, actions: MenuActions): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Check for Updates...',
                click: actions.checkForUpdates,
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          },
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-project');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu-save-as');
          },
        },
        { type: 'separator' },
        {
          label: 'Export Project...',
          click: () => {
            mainWindow.webContents.send('menu-export');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Build menu
    {
      label: 'Build',
      submenu: [
        {
          label: 'Compile',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            mainWindow.webContents.send('menu-compile');
          },
        },
        {
          label: 'Run',
          accelerator: 'F5',
          click: () => {
            mainWindow.webContents.send('menu-run');
          },
        },
        {
          label: 'Stop',
          accelerator: 'Shift+F5',
          click: () => {
            mainWindow.webContents.send('menu-stop');
          },
        },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/9LiveZZZ-Git/Allolib-Studio-Online#readme');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'View on GitHub',
          click: () => {
            shell.openExternal('https://github.com/9LiveZZZ-Git/Allolib-Studio-Online');
          },
        },
        { type: 'separator' },
        ...(!isMac
          ? [
              {
                label: 'Check for Updates...',
                click: actions.checkForUpdates,
              },
              { type: 'separator' as const },
              {
                label: 'About',
                click: () => {
                  const { dialog } = require('electron');
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'About AlloLib Studio',
                    message: 'AlloLib Studio',
                    detail: `Version: ${app.getVersion()}\n\nA creative coding environment for audio-visual applications.\n\nBuilt with Electron, Vue.js, and AlloLib.`,
                  });
                },
              },
            ]
          : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
