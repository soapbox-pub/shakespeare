import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Platform information
  platform: () => ipcRenderer.invoke('get-platform'),

  // App version
  version: () => ipcRenderer.invoke('get-app-version'),

  // Flag to indicate we're running in Electron
  isElectron: true,
});
