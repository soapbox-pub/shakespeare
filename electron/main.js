import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shakespeare filesystem root directory
const SHAKESPEARE_ROOT = path.join(os.homedir(), 'shakespeare');

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

// Helper function to ensure Shakespeare root directory exists
async function ensureShakespeareRoot() {
  try {
    await fs.mkdir(SHAKESPEARE_ROOT, { recursive: true });
    console.log(`Shakespeare filesystem root: ${SHAKESPEARE_ROOT}`);
  } catch (error) {
    console.error('Failed to create Shakespeare root directory:', error);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Ensure Shakespeare root directory exists before creating window
  await ensureShakespeareRoot();

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

// Helper function to resolve paths relative to Shakespeare root
function resolvePath(relativePath) {
  // Normalize the path and remove leading slash if present
  const normalized = path.normalize(relativePath).replace(/^[/\\]+/, '');
  return path.join(SHAKESPEARE_ROOT, normalized);
}

// Filesystem IPC handlers
ipcMain.handle('fs:readFile', async (event, filePath, encoding) => {
  if (!filePath) {
    const err = new Error('Failed to read file: path is required');
    err.code = 'EINVAL';
    throw err;
  }
  try {
    const fullPath = resolvePath(filePath);
    const data = await fs.readFile(fullPath, encoding ? { encoding } : undefined);
    // If no encoding, convert Buffer to array for IPC serialization
    return encoding ? data : Array.from(data);
  } catch (error) {
    // Re-throw with original error code preserved for ENOENT handling
    // Serialize the error code as a regular property so it survives IPC
    const err = new Error(`Failed to read file ${filePath}: ${error.message}`);
    // Copy enumerable properties including code
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data, encoding) => {
  if (!filePath) {
    const err = new Error('Failed to write file: path is required');
    err.code = 'EINVAL';
    throw err;
  }
  try {
    const fullPath = resolvePath(filePath);
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    // Convert array back to Buffer if needed
    const dataToWrite = Array.isArray(data) ? Buffer.from(data) : data;
    await fs.writeFile(fullPath, dataToWrite, encoding ? { encoding } : undefined);
  } catch (error) {
    const err = new Error(`Failed to write file ${filePath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:readdir', async (event, dirPath, withFileTypes) => {
  try {
    const fullPath = resolvePath(dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: !!withFileTypes });

    if (withFileTypes) {
      // Convert Dirent objects to plain objects for IPC
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
    }

    return entries;
  } catch (error) {
    // Re-throw with original error code preserved for ENOENT handling
    const err = new Error(`Failed to read directory ${dirPath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:mkdir', async (event, dirPath, recursive) => {
  try {
    const fullPath = resolvePath(dirPath);
    await fs.mkdir(fullPath, { recursive: !!recursive });
  } catch (error) {
    const err = new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:stat', async (event, filePath) => {
  try {
    const fullPath = resolvePath(filePath);
    const stats = await fs.stat(fullPath);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isBlockDevice: stats.isBlockDevice(),
      isCharacterDevice: stats.isCharacterDevice(),
      isSymbolicLink: stats.isSymbolicLink(),
      isFIFO: stats.isFIFO(),
      isSocket: stats.isSocket(),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      atimeMs: stats.atimeMs,
      // Date objects need to be serialized as timestamps for IPC
      mtime: stats.mtime.getTime(),
      ctime: stats.ctime.getTime(),
      atime: stats.atime.getTime(),
    };
  } catch (error) {
    // Re-throw with original error code preserved for ENOENT handling
    const err = new Error(`Failed to stat ${filePath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:lstat', async (event, filePath) => {
  try {
    const fullPath = resolvePath(filePath);
    const stats = await fs.lstat(fullPath);
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isBlockDevice: stats.isBlockDevice(),
      isCharacterDevice: stats.isCharacterDevice(),
      isSymbolicLink: stats.isSymbolicLink(),
      isFIFO: stats.isFIFO(),
      isSocket: stats.isSocket(),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      atimeMs: stats.atimeMs,
      // Date objects need to be serialized as timestamps for IPC
      mtime: stats.mtime.getTime(),
      ctime: stats.ctime.getTime(),
      atime: stats.atime.getTime(),
    };
  } catch (error) {
    const err = new Error(`Failed to lstat ${filePath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:unlink', async (event, filePath) => {
  try {
    const fullPath = resolvePath(filePath);
    await fs.unlink(fullPath);
  } catch (error) {
    const err = new Error(`Failed to unlink ${filePath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:rmdir', async (event, dirPath) => {
  try {
    const fullPath = resolvePath(dirPath);
    await fs.rmdir(fullPath);
  } catch (error) {
    // Re-throw with original error code preserved for ENOENT handling
    const err = new Error(`Failed to remove directory ${dirPath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:rename', async (event, oldPath, newPath) => {
  try {
    const fullOldPath = resolvePath(oldPath);
    const fullNewPath = resolvePath(newPath);
    // Ensure parent directory of new path exists
    await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
    await fs.rename(fullOldPath, fullNewPath);
  } catch (error) {
    const err = new Error(`Failed to rename ${oldPath} to ${newPath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:readlink', async (event, filePath) => {
  try {
    const fullPath = resolvePath(filePath);
    return await fs.readlink(fullPath);
  } catch (error) {
    const err = new Error(`Failed to read link ${filePath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});

ipcMain.handle('fs:symlink', async (event, target, filePath) => {
  try {
    const fullPath = resolvePath(filePath);
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.symlink(target, fullPath);
  } catch (error) {
    const err = new Error(`Failed to create symlink ${filePath}: ${error.message}`);
    if (error.code) {
      Object.defineProperty(err, 'code', {
        value: error.code,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    throw err;
  }
});
