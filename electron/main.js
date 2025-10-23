import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Disabled to support ESM in preload
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/shakespeare-512x512.png'),
    title: 'Shakespeare',
    backgroundColor: '#ffffff',
  });

  // Load the app
  if (process.env.ELECTRON_DEV) {
    // Development mode - load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load from built files
    // Use file:// protocol for proper asset loading
    mainWindow.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app-level events
app.on('web-contents-created', (event, contents) => {
  // Security: Prevent navigation to external sites
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Allow navigation within the app
    if (parsedUrl.origin === 'http://localhost:5173' ||
        parsedUrl.protocol === 'file:') {
      return;
    }

    // Block all other navigation
    event.preventDefault();
  });

  // Security: Prevent opening new windows
  contents.setWindowOpenHandler(({ url }) => {
    // Open external links in the default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// IPC handlers can be added here if needed for future Electron-specific features
// For example: file system access, native dialogs, etc.

// Example: Handle getting app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Example: Handle getting platform
ipcMain.handle('get-platform', () => {
  return process.platform;
});
