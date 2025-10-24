# Electron Architecture

This document describes the architecture of Shakespeare's Electron implementation, focusing on the real terminal feature.

## Overview

Shakespeare's Electron app uses a standard Electron architecture with a main process, renderer process, and preload script for secure IPC communication.

## Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron App                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Main Process                            │  │
│  │                   (Node.js/Electron)                       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  • File System Operations (fs module)                     │  │
│  │  • Shell Execution (child_process.spawn)                  │  │
│  │  • IPC Handlers (ipcMain)                                 │  │
│  │  • Window Management                                       │  │
│  │                                                            │  │
│  │  Working Directory: ~/shakespeare                         │  │
│  │                                                            │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                      │
│                           │ IPC Bridge                           │
│                           │ (contextBridge)                      │
│                           │                                      │
│  ┌────────────────────────┴──────────────────────────────────┐  │
│  │                   Preload Script                          │  │
│  │              (Secure IPC Bridge - ESM)                    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  Exposes to Renderer:                                     │  │
│  │  • window.electron.isElectron                             │  │
│  │  • window.electron.platform()                             │  │
│  │  • window.electron.version()                              │  │
│  │  • window.electron.fs.*                                   │  │
│  │  • window.electron.shell.exec()  ← NEW                    │  │
│  │                                                            │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                      │
│                           │ window.electron API                  │
│                           │                                      │
│  ┌────────────────────────┴──────────────────────────────────┐  │
│  │                  Renderer Process                         │  │
│  │                 (React/TypeScript)                        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │            Terminal Component                     │    │  │
│  │  │  • Detects window.electron.shell                 │    │  │
│  │  │  • Routes to real shell if available             │    │  │
│  │  │  • Falls back to virtual shell in browser        │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │            ShellTool (AI)                        │    │  │
│  │  │  • Detects window.electron.shell                 │    │  │
│  │  │  • Routes to real shell if available             │    │  │
│  │  │  • Falls back to virtual commands in browser     │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │         ElectronFSAdapter                        │    │  │
│  │  │  • Implements JSRuntimeFS interface              │    │  │
│  │  │  • Routes to window.electron.fs.*                │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Shell Execution Flow

### Browser Mode (Virtual Shell)

```
User Input: "ls -la"
     │
     ▼
┌────────────────┐
│ Terminal.tsx   │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  ShellTool     │
│ (Virtual)      │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  LsCommand     │
│ (JavaScript)   │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  LightningFS   │
│  (IndexedDB)   │
└────────┬───────┘
         │
         ▼
    Result
```

### Electron Mode (Real Shell)

```
User Input: "ls -la"
     │
     ▼
┌────────────────────┐
│   Terminal.tsx     │
│ (Renderer Process) │
└─────────┬──────────┘
          │
          │ Detects window.electron.shell
          │
          ▼
┌────────────────────┐
│ window.electron    │
│   .shell.exec()    │
└─────────┬──────────┘
          │
          │ IPC Call
          │
          ▼
┌────────────────────┐
│  Preload Script    │
│  (IPC Bridge)      │
└─────────┬──────────┘
          │
          │ Secure IPC
          │
          ▼
┌────────────────────┐
│   Main Process     │
│  shell:exec        │
│  IPC Handler       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ child_process      │
│   .spawn()         │
│ /bin/sh or cmd.exe │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│   OS Shell         │
│  (Real Terminal)   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  ~/shakespeare/    │
│  (OS Filesystem)   │
└─────────┬──────────┘
          │
          ▼
    Result
    { stdout, stderr, exitCode }
```

## Filesystem Architecture

### Browser Mode

```
┌─────────────────────────────────────┐
│        Browser Storage              │
├─────────────────────────────────────┤
│                                     │
│  IndexedDB                          │
│  ├── /projects/                     │
│  │   ├── project-1/                 │
│  │   │   ├── package.json           │
│  │   │   └── src/                   │
│  │   └── project-2/                 │
│  ├── /config/                       │
│  └── /tmp/                          │
│                                     │
│  Accessed via:                      │
│  • LightningFS                      │
│  • LightningFSAdapter               │
│                                     │
└─────────────────────────────────────┘
```

### Electron Mode

```
┌─────────────────────────────────────┐
│      OS Filesystem                  │
├─────────────────────────────────────┤
│                                     │
│  ~/shakespeare/                     │
│  ├── projects/                      │
│  │   ├── project-1/                 │
│  │   │   ├── package.json           │
│  │   │   ├── src/                   │
│  │   │   └── node_modules/          │
│  │   └── project-2/                 │
│  ├── config/                        │
│  └── tmp/                           │
│                                     │
│  Accessed via:                      │
│  • Node.js fs module (main)         │
│  • IPC calls (renderer)             │
│  • ElectronFSAdapter                │
│                                     │
└─────────────────────────────────────┘
```

## Security Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                  Security Layers                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Context Isolation (PRIMARY BOUNDARY)                │
│     ✓ Renderer cannot access Node.js/Electron APIs      │
│     ✓ Only window.electron is exposed                   │
│                                                          │
│  2. Preload Script (CONTROLLED BRIDGE)                  │
│     ✓ Only specific APIs exposed via contextBridge      │
│     ✓ No direct Node.js access from renderer            │
│                                                          │
│  3. IPC Handlers (VALIDATION LAYER)                     │
│     ✓ Validate all inputs                               │
│     ✓ Path resolution and sanitization                  │
│     ✓ Error handling and code preservation              │
│                                                          │
│  4. Filesystem Restrictions                             │
│     ✓ All operations relative to ~/shakespeare          │
│     ✓ No access outside this directory                  │
│                                                          │
│  5. Shell Execution                                     │
│     ✓ Commands run with user's permissions              │
│     ✓ Working directory: ~/shakespeare/projects/{id}    │
│     ✓ No elevation or sudo access                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## API Surface

### Exposed to Renderer

```typescript
interface window.electron {
  // Platform info
  isElectron: boolean;
  platform(): Promise<string>;
  version(): Promise<string>;

  // Filesystem API
  fs: {
    readFile(path: string, encoding?: string): Promise<string | number[]>;
    writeFile(path: string, data: string | number[], encoding?: string): Promise<void>;
    readdir(path: string, withFileTypes?: boolean): Promise<string[] | DirectoryEntry[]>;
    mkdir(path: string, recursive?: boolean): Promise<void>;
    stat(path: string): Promise<StatResult>;
    lstat(path: string): Promise<StatResult>;
    unlink(path: string): Promise<void>;
    rmdir(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    readlink(path: string): Promise<string>;
    symlink(target: string, path: string): Promise<void>;
  };

  // Shell API (NEW)
  shell: {
    exec(command: string, cwd?: string): Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
  };
}
```

## Component Integration

### Terminal Component

```typescript
// Automatic detection and routing
const executeCommand = async (command: string) => {
  if (window.electron?.shell) {
    // Use real OS shell
    const result = await window.electron.shell.exec(command, relativeCwd);
    // Display result
  } else {
    // Use virtual shell
    const result = await shellTool.execute({ command });
    // Display result
  }
};
```

### ShellTool (AI)

```typescript
// Automatic detection and routing
async execute(args: ShellToolParams): Promise<string> {
  if (window.electron?.shell) {
    // Use real OS shell
    return this.executeRealShell(args.command);
  }

  // Use virtual commands
  return this.executeVirtualShell(args.command);
}
```

## Path Resolution

### Virtual to OS Path Conversion

The `projectsPath` is configurable (default: `/projects`), so path conversion respects the configured value:

```
VFS Path:        {projectsPath}/my-app/src/index.ts
                        ↓
Extract:         my-app/src/index.ts
                        ↓
Resolve:         ~/shakespeare/{projectsPath}/my-app/src/index.ts
                        ↓
OS Path:         /Users/username/shakespeare/projects/my-app/src/index.ts
```

### Working Directory

```
Project ID:      abc123
VFS CWD:         {projectsPath}/abc123
Relative CWD:    abc123
OS CWD:          ~/shakespeare/{projectsPath}/abc123
Shell CWD:       /Users/username/shakespeare/projects/abc123
```

**Note**: The `projectsPath` is configurable via the app settings and defaults to `/projects`.

## Error Handling

```
┌─────────────────────────────────────┐
│       Error Flow                    │
├─────────────────────────────────────┤
│                                     │
│  OS Error (e.g., ENOENT)            │
│       ↓                             │
│  Main Process Handler               │
│       ↓                             │
│  Preserve Error Code                │
│       ↓                             │
│  IPC Serialization                  │
│       ↓                             │
│  Preload Script                     │
│       ↓                             │
│  Renderer Process                   │
│       ↓                             │
│  ElectronFSAdapter.unwrapError()    │
│       ↓                             │
│  Restore Original Error Code        │
│       ↓                             │
│  Application Logic                  │
│                                     │
└─────────────────────────────────────┘
```

## Performance Considerations

### Browser Mode
- **Filesystem**: IndexedDB queries (slower for large files)
- **Commands**: JavaScript execution (interpreted)
- **Git**: isomorphic-git (JavaScript implementation)

### Electron Mode
- **Filesystem**: Native fs module (much faster)
- **Commands**: Native OS shell (compiled binaries)
- **Git**: isomorphic-git (same as browser)*

\* Future: Could use native Git CLI for even better performance

## Deployment

```
┌─────────────────────────────────────────────────────────┐
│                Build Process                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. npm run build                                       │
│     • Vite builds React app → dist/                     │
│                                                          │
│  2. npm run electron:build                              │
│     • electron-builder packages:                        │
│       - Main process (main.js)                          │
│       - Preload script (preload.js)                     │
│       - Built React app (dist/)                         │
│       - Icons and resources                             │
│                                                          │
│  3. Platform-specific installers created:               │
│     • macOS: .dmg, .app                                 │
│     • Windows: .exe (NSIS installer)                    │
│     • Linux: .AppImage, .deb, .rpm                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Future Architecture Enhancements

### Planned Improvements

1. **Native Git CLI Integration**
   - Replace isomorphic-git with native Git commands
   - Faster operations, better compatibility
   - Leverage existing Git installations

2. **Multiple Windows**
   - Support multiple project windows
   - Shared state management
   - Inter-window communication

3. **Enhanced Terminal**
   - Persistent shell sessions
   - Terminal tabs and splits
   - Custom shell configuration

4. **Auto-Update**
   - electron-updater integration
   - Automatic update downloads
   - User-controlled update installation

5. **System Integration**
   - System tray icon
   - Native menus
   - File associations
   - Protocol handlers

## References

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
