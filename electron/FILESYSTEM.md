# Electron Filesystem Configuration

## Overview

When running Shakespeare as an Electron desktop app, the filesystem is configured to use your local OS filesystem at `~/shakespeare` instead of the browser's IndexedDB-backed virtual filesystem.

## Filesystem Root

- **Location**: `~/shakespeare` (expands to your home directory)
  - macOS/Linux: `/Users/username/shakespeare` or `/home/username/shakespeare`
  - Windows: `C:\Users\username\shakespeare`

- **Automatic Creation**: The directory is automatically created when the Electron app starts if it doesn't exist

## How It Works

### Architecture

1. **Browser Mode**: Uses `LightningFSAdapter` with IndexedDB storage
2. **Electron Mode**: Uses `NodeFSAdapter` with Node.js `fs` module

The filesystem adapter is selected automatically in `src/App.tsx`:

```typescript
const fs = window.electron?.isElectron
  ? new NodeFSAdapter()
  : new LightningFSAdapter(new LightningFS('shakespeare-fs').promises);
```

### Path Resolution

All paths used within Shakespeare are relative to the filesystem root:

- `/projects/my-app/` → `~/shakespeare/projects/my-app/`
- `/tmp/upload.txt` → `~/shakespeare/tmp/upload.txt`
- `/config/ai.json` → `~/shakespeare/config/ai.json`

The path resolution happens in `electron/main.js` via the `resolvePath()` function, which:
1. Normalizes the path
2. Removes leading slashes
3. Joins with `SHAKESPEARE_ROOT`

### IPC Communication

Filesystem operations are handled via Electron IPC:

1. **Renderer Process** (`src/lib/NodeFSAdapter.ts`):
   - Calls `window.electron.fs.*` methods
   - Converts data types for IPC serialization (Uint8Array ↔ Array)

2. **Preload Script** (`electron/preload.js`):
   - Exposes filesystem API to renderer via `contextBridge`
   - Provides type-safe interface

3. **Main Process** (`electron/main.js`):
   - Handles IPC calls with `ipcMain.handle()`
   - Performs actual filesystem operations using Node.js `fs/promises`
   - Ensures parent directories exist for write operations

## Supported Operations

All standard filesystem operations are supported:

- **File Operations**: `readFile`, `writeFile`, `unlink`, `rename`
- **Directory Operations**: `readdir`, `mkdir`, `rmdir`
- **Metadata**: `stat`, `lstat`
- **Symlinks**: `readlink`, `symlink`

## Benefits

### Advantages of Local Filesystem

1. **No Storage Limits**: Unlike IndexedDB, your filesystem is only limited by disk space
2. **Direct File Access**: Use your favorite code editor, file manager, or command-line tools
3. **Version Control**: Easy to use Git clients outside of Shakespeare
4. **Backup/Sync**: Use standard backup tools or cloud sync (Dropbox, iCloud, etc.)
5. **Performance**: Faster for large projects and files

### Data Portability

Your projects are stored in a standard directory structure:

```
~/shakespeare/
├── projects/
│   ├── my-react-app/
│   │   ├── package.json
│   │   ├── src/
│   │   └── ...
│   └── another-project/
│       └── ...
├── config/
│   ├── ai.json
│   └── git.json
└── tmp/
    └── ...
```

You can:
- Copy projects between machines
- Share projects with others
- Use external tools to work on projects
- Migrate to/from browser version by copying files

## Security

- **Sandboxed Access**: Only the `~/shakespeare` directory is accessible
- **Path Validation**: All paths are normalized and validated
- **IPC Security**: Context isolation enabled, no direct Node.js access from renderer

## Troubleshooting

### Directory Permissions

If you encounter permission errors, ensure your user has read/write access to `~/shakespeare`:

```bash
# Check permissions
ls -la ~/shakespeare

# Fix permissions if needed
chmod -R u+rw ~/shakespeare
```

### Finding Your Files

To open the Shakespeare directory in your file manager:

- **macOS**: `open ~/shakespeare`
- **Linux**: `xdg-open ~/shakespeare` or `nautilus ~/shakespeare`
- **Windows**: `explorer %USERPROFILE%\shakespeare`

### Switching Between Browser and Electron

The browser and Electron versions use different storage:

- **Browser**: IndexedDB (not directly accessible)
- **Electron**: `~/shakespeare` directory

To migrate projects:
1. Export from browser as ZIP
2. Import ZIP in Electron version

Or vice versa.

## Development

When running in development mode (`npm run electron:dev`):

- Filesystem still uses `~/shakespeare`
- DevTools are automatically opened
- Hot reload works via Vite dev server
- Same filesystem behavior as production build
