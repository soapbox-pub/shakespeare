/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * 
 * Add this to your tsconfig.json include array to use these types:
 * "include": ["src", "electron/electron.d.ts"]
 */

interface ElectronAPI {
  /**
   * Flag indicating the app is running in Electron.
   * Always `true` when running in Electron.
   */
  isElectron: boolean;

  /**
   * Get the current platform.
   * @returns 'darwin' | 'win32' | 'linux'
   */
  platform(): Promise<string>;

  /**
   * Get the application version from package.json.
   * @returns Version string (e.g., "1.0.0")
   */
  version(): Promise<string>;
}

interface Window {
  /**
   * Electron API exposed via preload script.
   * Only available when running in Electron.
   */
  electron?: ElectronAPI;
}
