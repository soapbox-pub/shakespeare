import { contextBridge, ipcRenderer } from 'electron';
import os from 'node:os';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Get the home directory
  homedir: os.homedir(),

  // Platform information
  platform: () => ipcRenderer.invoke('get-platform'),

  // App version
  version: () => ipcRenderer.invoke('get-app-version'),

  // Filesystem API - paths support tilde (~) expansion for home directory
  fs: {
    readFile: (path, encoding) => ipcRenderer.invoke('fs:readFile', path, encoding),
    writeFile: (path, data, encoding) => ipcRenderer.invoke('fs:writeFile', path, data, encoding),
    readdir: (path, withFileTypes) => ipcRenderer.invoke('fs:readdir', path, withFileTypes),
    mkdir: (path, recursive) => ipcRenderer.invoke('fs:mkdir', path, recursive),
    stat: (path) => ipcRenderer.invoke('fs:stat', path),
    lstat: (path) => ipcRenderer.invoke('fs:lstat', path),
    unlink: (path) => ipcRenderer.invoke('fs:unlink', path),
    rmdir: (path) => ipcRenderer.invoke('fs:rmdir', path),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    readlink: (path) => ipcRenderer.invoke('fs:readlink', path),
    symlink: (target, path) => ipcRenderer.invoke('fs:symlink', target, path),
  },

  // Shell API - execute real shell commands
  shell: {
    exec: (command, cwd) => ipcRenderer.invoke('shell:exec', command, cwd),
  },
});
