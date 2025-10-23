# Integrating Electron Features into Shakespeare

This guide shows how to use Electron-specific features in your Shakespeare codebase.

## Detecting Electron Environment

The preload script exposes a minimal API at `window.electron`. You can use this to detect if the app is running in Electron:

```typescript
// Check if running in Electron
if (window.electron?.isElectron) {
  console.log('Running in Electron desktop app');
} else {
  console.log('Running in web browser');
}
```

## Using Electron API

The exposed API includes:

### Platform Detection

```typescript
// Get the platform
const platform = await window.electron?.platform();
// Returns: 'darwin' | 'win32' | 'linux'

// Platform-specific code
if (platform === 'darwin') {
  console.log('Running on macOS');
} else if (platform === 'win32') {
  console.log('Running on Windows');
} else if (platform === 'linux') {
  console.log('Running on Linux');
}
```

### App Version

```typescript
// Get the app version
const version = await window.electron?.version();
console.log('Shakespeare version:', version);
```

## Example: Platform-Specific UI

```tsx
import { useEffect, useState } from 'react';

export function PlatformBadge() {
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (window.electron?.isElectron) {
      window.electron.platform().then(setPlatform);
    }
  }, []);

  if (!platform) return null;

  const platformNames = {
    darwin: 'macOS',
    win32: 'Windows',
    linux: 'Linux',
  };

  return (
    <div className="platform-badge">
      Running on {platformNames[platform as keyof typeof platformNames] || platform}
    </div>
  );
}
```

## Example: Conditional Features

```tsx
import { useEffect, useState } from 'react';

export function useIsElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(window.electron?.isElectron ?? false);
  }, []);

  return isElectron;
}

// Usage in a component
function MyComponent() {
  const isElectron = useIsElectron();

  return (
    <div>
      {isElectron ? (
        <button onClick={handleElectronFeature}>
          Use Native Feature
        </button>
      ) : (
        <button onClick={handleWebFeature}>
          Use Web Feature
        </button>
      )}
    </div>
  );
}
```

## Adding New Electron Features

To add new Electron-specific features:

### 1. Add IPC Handler in Main Process

Edit `electron/main.js` (ESM syntax):

```javascript
// Add new IPC handler
ipcMain.handle('my-new-feature', async (event, arg) => {
  // Implement your feature
  return result;
});
```

### 2. Expose in Preload Script

Edit `electron/preload.js` (ESM syntax):

```javascript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Existing API
  isElectron: true,
  platform: () => ipcRenderer.invoke('get-platform'),
  version: () => ipcRenderer.invoke('get-app-version'),

  // New feature
  myNewFeature: (arg) => ipcRenderer.invoke('my-new-feature', arg),
});
```

### 3. Update TypeScript Definitions

Edit `electron/electron.d.ts`:

```typescript
interface ElectronAPI {
  isElectron: boolean;
  platform(): Promise<string>;
  version(): Promise<string>;

  // Add your new feature
  myNewFeature(arg: string): Promise<ReturnType>;
}
```

### 4. Use in React Components

```typescript
// Now you can use it
const result = await window.electron?.myNewFeature('argument');
```

## Common Use Cases

### File System Access

```javascript
// In electron/main.js (ESM)
import { dialog } from 'electron';

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});
```

### Native Notifications

```javascript
// In electron/main.js (ESM)
import { Notification } from 'electron';

ipcMain.handle('show-notification', async (event, { title, body }) => {
  new Notification({ title, body }).show();
});
```

### Native Menus

```javascript
// In electron/main.js (ESM)
import { Menu } from 'electron';

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('new-project')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    // ... more menu items
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();
});
```

### Auto-Updates

```javascript
// In electron/main.js (ESM)
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

// In preload.js (ESM)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // ...
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
});
```

## Security Considerations

### ⚠️ Important Security Rules

1. **Never expose the entire IPC module** to the renderer
2. **Always validate input** in main process handlers
3. **Use contextBridge** for all renderer-to-main communication
4. **Keep nodeIntegration disabled** in BrowserWindow
5. **Keep contextIsolation enabled** in BrowserWindow
6. **Sanitize any data** before passing to main process

### Good Example

```javascript
// ✅ Good: Specific, validated handler
ipcMain.handle('save-file', async (event, { filename, content }) => {
  // Validate input
  if (typeof filename !== 'string' || typeof content !== 'string') {
    throw new Error('Invalid arguments');
  }

  // Sanitize filename
  const safeName = path.basename(filename);

  // Perform operation
  await fs.writeFile(safeName, content);
});
```

### Bad Example

```javascript
// ❌ Bad: Exposes too much
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: ipcRenderer, // Never do this!
  require: require, // Never do this!
});
```

## Best Practices

1. **Keep the Electron API minimal** - Only expose what you need
2. **Use TypeScript** - Type definitions prevent errors
3. **Handle errors gracefully** - IPC calls can fail
4. **Test in both environments** - Web and Electron should both work
5. **Progressive enhancement** - Web features first, Electron enhancements second
6. **Document new features** - Update this file when adding features

## Testing Electron Features

```typescript
// Mock window.electron for tests
beforeEach(() => {
  (window as any).electron = {
    isElectron: true,
    platform: jest.fn().mockResolvedValue('darwin'),
    version: jest.fn().mockResolvedValue('1.0.0'),
  };
});

afterEach(() => {
  delete (window as any).electron;
});

test('component uses Electron API', async () => {
  render(<MyComponent />);

  expect(window.electron?.platform).toHaveBeenCalled();
});
```

## Resources

- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
