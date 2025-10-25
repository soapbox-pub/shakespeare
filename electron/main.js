import { app, BrowserWindow, ipcMain, shell, Menu, protocol } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  // Remove the default menu (File, Edit, View, etc.)
  Menu.setApplicationMenu(null);

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

  // Enable DevTools keyboard shortcut (Ctrl+Shift+I / Cmd+Option+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Check for Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac)
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    // Also support F12
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Load the app
  if (process.env.ELECTRON_DEV) {
    // Development mode - load from Vite dev server
    console.log('Loading from Vite dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load from custom protocol
    // This allows absolute paths like /shakespeare.svg to work naturally
    console.log('Loading from app:// protocol: app://./index.html');
    mainWindow.loadURL('app://./index.html');
  }

  // Log any load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
  });

  // Log successful load
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Successfully loaded app');
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol scheme before app is ready (required for privileges)
if (!process.env.ELECTRON_DEV) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
      },
    },
  ]);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Register the app:// protocol to serve files from dist/
  // This allows absolute paths (/) to work naturally without base: './'
  if (!process.env.ELECTRON_DEV) {
    protocol.registerFileProtocol('app', (request, callback) => {
      // Remove 'app://' prefix and normalize path
      let filePath = request.url.replace('app://', '');

      // Remove trailing slashes
      filePath = filePath.replace(/\/+$/, '');

      // Handle root path
      if (filePath === '' || filePath === '/') {
        filePath = 'index.html';
      }

      // Remove leading slash if present
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }

      // Resolve to dist directory
      const fullPath = path.join(__dirname, '../dist', filePath);

      console.log('Protocol handler:', request.url, '->', fullPath);
      callback({ path: fullPath });
    });
  }

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

// Helper function to expand tilde (~) in paths
function expandTilde(filepath) {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// Filesystem IPC handlers
ipcMain.handle('fs:readFile', async (event, filePath, encoding) => {
  if (!filePath) {
    const err = new Error('Failed to read file: path is required');
    err.code = 'EINVAL';
    throw err;
  }
  try {
    const fullPath = expandTilde(filePath);
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
    const fullPath = expandTilde(filePath);
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
    const fullPath = expandTilde(dirPath);
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
    const fullPath = expandTilde(dirPath);
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
    const fullPath = expandTilde(filePath);
    const stats = await fs.stat(fullPath);
    const now = Date.now();
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isBlockDevice: stats.isBlockDevice(),
      isCharacterDevice: stats.isCharacterDevice(),
      isSymbolicLink: stats.isSymbolicLink(),
      isFIFO: stats.isFIFO(),
      isSocket: stats.isSocket(),
      size: stats.size,
      mtimeMs: stats.mtimeMs ?? now,
      ctimeMs: stats.ctimeMs ?? now,
      atimeMs: stats.atimeMs ?? now,
      // Date objects need to be serialized as timestamps for IPC
      // Use optional chaining and fallback to now to prevent valueOf errors
      mtime: stats.mtime?.getTime() ?? now,
      ctime: stats.ctime?.getTime() ?? now,
      atime: stats.atime?.getTime() ?? now,
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
    const fullPath = expandTilde(filePath);
    const stats = await fs.lstat(fullPath);
    const now = Date.now();
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isBlockDevice: stats.isBlockDevice(),
      isCharacterDevice: stats.isCharacterDevice(),
      isSymbolicLink: stats.isSymbolicLink(),
      isFIFO: stats.isFIFO(),
      isSocket: stats.isSocket(),
      size: stats.size,
      mtimeMs: stats.mtimeMs ?? now,
      ctimeMs: stats.ctimeMs ?? now,
      atimeMs: stats.atimeMs ?? now,
      // Date objects need to be serialized as timestamps for IPC
      // Use optional chaining and fallback to now to prevent valueOf errors
      mtime: stats.mtime?.getTime() ?? now,
      ctime: stats.ctime?.getTime() ?? now,
      atime: stats.atime?.getTime() ?? now,
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
    const fullPath = expandTilde(filePath);
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
    const fullPath = expandTilde(dirPath);
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
    const fullOldPath = expandTilde(oldPath);
    const fullNewPath = expandTilde(newPath);
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
    const fullPath = expandTilde(filePath);
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
    const fullPath = expandTilde(filePath);
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

// Shell execution handler
ipcMain.handle('shell:exec', async (event, command, cwd) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Determine the shell and command execution method based on platform
      const isWindows = process.platform === 'win32';
      const shellCmd = isWindows ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      // Expand tilde in working directory if provided, otherwise use home directory
      const workingDir = cwd ? expandTilde(cwd) : os.homedir();

      // Ensure the working directory exists before spawning
      try {
        await fs.mkdir(workingDir, { recursive: true });
        console.log(`Shell exec in directory: ${workingDir}`);
        console.log(`Command: ${command}`);
      } catch (mkdirError) {
        console.warn(`Failed to create directory ${workingDir}:`, mkdirError.message);
        // Continue anyway - directory might already exist
      }

      const child = spawn(shellCmd, shellArgs, {
        cwd: workingDir,
        env: { ...process.env },
        shell: false, // We're already using the shell
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        console.error('Shell execution error:', error);
        console.error('Working directory:', workingDir);
        console.error('Shell command:', shellCmd);
        console.error('Shell args:', shellArgs);
        reject(new Error(`Failed to execute command: ${error.message} (cwd: ${workingDir})`));
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });
    } catch (error) {
      console.error('Shell setup error:', error);
      reject(new Error(`Failed to setup shell execution: ${error.message}`));
    }
  });
});
