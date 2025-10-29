# Shakespeare Electron - Complete Guide

This guide provides comprehensive documentation for developing, building, and troubleshooting the Shakespeare Electron desktop application.

## Table of Contents

1. [Filesystem Architecture](#filesystem-architecture)
2. [Terminal Integration](#terminal-integration)
3. [Development Workflow](#development-workflow)
4. [Building for Distribution](#building-for-distribution)
5. [Troubleshooting](#troubleshooting)

---

## Filesystem Architecture

### Overview

The Electron version uses your local OS filesystem at `~/shakespeare` instead of IndexedDB, providing direct file access and unlimited storage.

### Path Resolution

All paths are relative to `~/shakespeare`:
- `/projects/my-app/` → `~/shakespeare/projects/my-app/`
- `/tmp/upload.txt` → `~/shakespeare/tmp/upload.txt`
- `/config/ai.json` → `~/shakespeare/config/ai.json`

### Implementation

**Automatic Adapter Selection** (`src/App.tsx`):
```typescript
const fs = window.electron?.isElectron
  ? new NodeFSAdapter()      // Real filesystem
  : new LightningFSAdapter(new LightningFS('shakespeare-fs').promises);
```

**IPC Communication Flow:**
1. **Renderer** (`NodeFSAdapter.ts`) - Calls `window.electron.fs.*` methods
2. **Preload** (`preload.js`) - Exposes API via `contextBridge`
3. **Main** (`main.js`) - Handles IPC with `ipcMain.handle()`, performs filesystem operations

### Supported Operations

All standard filesystem operations are supported:
- **Files**: `readFile`, `writeFile`, `unlink`, `rename`
- **Directories**: `readdir`, `mkdir`, `rmdir`
- **Metadata**: `stat`, `lstat`
- **Symlinks**: `readlink`, `symlink`

### Benefits

✅ **No storage limits** - Only limited by disk space  
✅ **Direct access** - Use any editor, file manager, or Git client  
✅ **Easy backup** - Standard backup tools work  
✅ **Better performance** - Faster for large projects  
✅ **Data portability** - Copy projects between machines  

### Data Migration

**Browser to Electron:**
1. Export project as ZIP from browser
2. Import ZIP in Electron version

**Electron to Browser:**
1. Export project as ZIP from Electron
2. Import ZIP in browser version

---

## Terminal Integration

### Overview

The Electron version uses the **real OS terminal** instead of the virtual terminal, providing access to all system commands.

### Architecture

**ShellTool Detection** (`src/lib/tools/ShellTool.ts`):
```typescript
if (window.electron?.shell) {
  // Use real OS shell
  const result = await window.electron.shell.exec(command, workingDir);
} else {
  // Use virtual command system
  const result = await executeCommand(command, workingDir, fs);
}
```

**Shell Execution** (`electron/main.js`):
- Uses `child_process.spawn()` to execute commands
- Windows: Uses `cmd.exe`
- macOS/Linux: Uses `/bin/sh`
- Executes in project directory: `~/shakespeare/projects/{projectId}`

### Features

**All OS Commands Available:**
```bash
# Package managers
$ npm install
$ yarn add lodash
$ pnpm update

# Build tools
$ vite build
$ webpack --config webpack.config.js
$ tsc --noEmit

# Git operations
$ git commit -m "Update"
$ git push origin main

# System utilities
$ grep -r "TODO" src/
$ curl https://api.example.com
$ python script.py
```

**Native Shell Features:**
- Pipes: `ls | grep ".ts$"`
- Redirection: `echo "test" > file.txt`
- Environment variables: `$PATH`, `$HOME`
- Command chaining: `npm install && npm run build`

### ANSI Code Stripping

Output from shell commands is cleaned for AI consumption:
- Color codes removed (e.g., `\u001b[31m`)
- Cursor control sequences stripped
- Text formatting removed (bold, italic)
- Newlines preserved

**Example:**
```
Input:  \u001b[1m\u001b[32madded 142 packages\u001b[39m\u001b[22m in 3s
Output: added 142 packages in 3s
```

Terminal UI still shows colored output for users.

### Platform Support

| Platform | Shell | Notes |
|----------|-------|-------|
| macOS | `/bin/sh` | All Unix commands available |
| Linux | `/bin/sh` | Standard Linux utilities |
| Windows | `cmd.exe` | Windows commands, consider Git Bash for Unix tools |

### Security

- Commands run with user permissions (no sudo/elevation)
- Working directory sandboxed to `~/shakespeare`
- Environment variables inherited from Electron process

---

## Development Workflow

### Running in Development Mode

```bash
npm run electron:dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Wait for server to be ready
3. Launch Electron with hot reload
4. Open DevTools automatically

### Testing Shell Execution

Use the provided test script to verify shell functionality:

```bash
# Start Electron in dev mode
npm run electron:dev

# Open DevTools (View > Toggle Developer Tools)
# Paste contents of electron/test-terminal.js into console
```

The test script verifies:
- Basic command execution
- File listing
- Node.js version check
- Error handling
- Working directory

### Debugging

**Renderer Process:**
- DevTools open automatically in dev mode
- Or press `Cmd+Option+I` (macOS) / `Ctrl+Shift+I` (Windows/Linux)

**Main Process:**
```bash
# Enable verbose logging
ELECTRON_ENABLE_LOGGING=1 npm run electron:dev
```

**Check Configuration:**
```bash
node electron/test-config.js
```

### File Watching

In development mode:
- Vite provides hot module replacement
- Changes to React components reload instantly
- Electron process restarts on main.js changes (via `nodemon` in the script)

---

## Building for Distribution

### Prerequisites

- Node.js 18+ installed
- All dependencies installed: `npm install`
- Web build completed: `npm run build`

### Build Commands

**Current Platform:**
```bash
npm run electron:build
```

**Specific Platforms:**
```bash
npm run electron:build:mac      # macOS (DMG + ZIP)
npm run electron:build:win      # Windows (NSIS + Portable)
npm run electron:build:linux    # Linux (AppImage, DEB, RPM)
npm run electron:build:all      # All platforms
```

### Build Output

```
electron-dist/
├── mac/
│   ├── Shakespeare.app          # macOS application bundle
│   ├── Shakespeare.dmg          # DMG installer
│   └── Shakespeare-mac.zip      # ZIP archive
├── win-unpacked/
│   └── Shakespeare.exe          # Windows executable
├── Shakespeare Setup.exe        # NSIS installer
├── Shakespeare Portable.exe     # Portable executable
├── shakespeare-*.AppImage       # Linux AppImage
├── shakespeare_*.deb            # Debian package
└── shakespeare-*.rpm            # RPM package
```

### Platform-Specific Notes

**macOS:**
- Builds for Intel (x64) and Apple Silicon (arm64)
- Code signing optional for development
- For distribution: Requires Apple Developer account

**Windows:**
- Builds for x64 and ARM64
- No code signing required for development
- For distribution: EV certificate recommended for SmartScreen

**Linux:**
- Builds for x64 and ARM64
- AppImage requires FUSE: `sudo apt-get install fuse`
- DEB/RPM packages can be installed with package managers

### Cross-Platform Limitations

- **macOS builds require macOS** (for code signing)
- Windows/Linux can be built from any platform
- Use GitHub Actions or CI/CD for multi-platform builds

### Code Signing

**Development (Disable Signing):**

Edit `electron/builder.config.js`:
```javascript
mac: {
  identity: null,  // Disable code signing
}
```

**Production (macOS):**
1. Obtain Apple Developer account
2. Create certificates in Xcode
3. Configure signing in builder.config.js
4. See: https://www.electron.build/code-signing

**Production (Windows):**
1. Obtain EV code signing certificate
2. Configure in builder.config.js
3. Builds reputation with SmartScreen over time

---

## Troubleshooting

### Development Issues

#### Port 5173 Already in Use

**Solution:**
```bash
# Find and kill the process
lsof -i :5173                    # macOS/Linux
netstat -ano | findstr :5173     # Windows

# Or change the port in vite.config.ts
export default defineConfig({
  server: { port: 5174 },
});
```

#### Blank Screen on Launch

**Browser Mode:**
1. Check Vite server is running: http://localhost:5173
2. Check Electron console for errors
3. Verify URL in `electron/main.js` matches Vite server
4. Clear cache: Delete `node_modules/.vite`

**Production Build:**
1. Ensure `base: './'` is set in `vite.config.ts`
2. Check `dist/` directory contains all files
3. Look for "Failed to load resource" errors in console
4. Verify file:// protocol is used in loadURL

#### Assets Fail to Load: "net::ERR_FILE_NOT_FOUND"

**Problem:** CSS/JS fail to load with `file:///assets/npm/...` errors

**Solution:** Add to `vite.config.ts`:
```typescript
export default defineConfig(() => ({
  base: './',  // Required for Electron
  // ... rest of config
}))
```

Then rebuild: `npm run build`

#### 404 Error: Page Not Found

**Problem:** App shows "404: Oops! Page not found" on launch

**Solution:** Verify `HashRouter` is used in Electron.

Check `src/AppRouter.tsx`:
```typescript
const Router = window.electron?.isElectron ? HashRouter : BrowserRouter;
```

Rebuild: `npm run build && npm run electron:build`

#### Service Worker Errors

**Solution:** Service workers don't work with `file://` protocol.

Check `src/main.tsx`:
```typescript
if ('serviceWorker' in navigator && !window.electron?.isElectron) {
  // Only register in web environment
}
```

#### CSP Font Errors

**Solution:** Update CSP in `index.html`:
```html
<meta http-equiv="content-security-policy" 
      content="... font-src 'self' data:; ...">
```

#### Broken SVG Images

**Problem:** Logo/SVG files show as broken

**Solution:** Import SVG files properly:
```typescript
// ❌ Wrong
<img src="/shakespeare.svg" alt="Logo" />

// ✅ Correct
import logo from '/shakespeare.svg?url';
<img src={logo} alt="Logo" />
```

#### Preload Script ESM Errors

**Solution:** Requires `sandbox: false` in webPreferences.

Check `electron/main.js`:
```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,
  contextIsolation: true,   // Still enabled
  sandbox: false,           // Disabled for ESM
  webSecurity: true,
}
```

### Build Issues

#### Build Fails with "Cannot find module"

**Solutions:**
1. Install dependencies: `npm install`
2. Clear and reinstall: `rm -rf node_modules package-lock.json && npm install`
3. Build web first: `npm run build`
4. Verify `dist/` exists
5. Check config: `node electron/test-config.js`

#### Icons Not Appearing

**Solution:** Should work automatically with `public/shakespeare-512x512.png`.

If not:
1. Verify PNG exists
2. Check build output for icon errors
3. Try: `npm run electron:icons` (requires ImageMagick)
4. Check paths in `electron/builder.config.js`

#### Code Signing Errors (macOS)

**Development:** Disable signing:
```javascript
mac: {
  identity: null,
}
```

**Production:** Requires Apple Developer account and certificates.

#### App Won't Launch After Build

**Solutions:**
1. Check console/terminal for errors
2. Try unpacked version first
3. macOS: Check Security & Privacy settings
4. Windows: Check Windows Defender logs
5. Verify `dist/` contains valid files

### Runtime Issues

#### App Crashes on Startup

**Solutions:**
1. Check crash logs:
   - macOS: `~/Library/Logs/Shakespeare/`
   - Windows: `%APPDATA%\Shakespeare\logs\`
   - Linux: `~/.config/Shakespeare/logs/`
2. Run from terminal to see errors
3. Test web build in browser first

#### Shell Execution Error: "spawn /bin/sh ENOENT"

**Problem:** Terminal commands fail with spawn error

**Root Cause:** Working directory doesn't exist

**Solution:** Should be fixed - main.js creates directories automatically.

**Debug:**
1. Open DevTools
2. Check console for "Shell exec in directory: ..."
3. Verify directory exists: `ls -la ~/shakespeare/projects/`
4. Manually create if needed: `mkdir -p ~/shakespeare/projects`

#### External Links Not Opening

**Solution:** Should open in default browser automatically.

Check `electron/main.js` has:
```javascript
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url);
  return { action: 'deny' };
});
```

### Platform-Specific Issues

#### macOS: "App is damaged and can't be opened"

**Solutions:**
1. Development: `xattr -cr /path/to/Shakespeare.app`
2. Distribution: Requires code signing
3. Users: Right-click → Open (instead of double-click)

#### Windows: "Windows protected your PC"

**Solutions:**
1. Testing: Click "More info" → "Run anyway"
2. Distribution: Requires EV code signing
3. Build reputation over time

#### Linux: "Permission denied"

**Solutions:**
1. Make executable: `chmod +x Shakespeare*.AppImage`
2. Install FUSE: `sudo apt-get install fuse`
3. Try DEB/RPM package instead

### Performance Issues

#### App Feels Slow

**Solutions:**
1. Close DevTools
2. Check system resources
3. Use production build
4. Disable hardware acceleration in `main.js`:
   ```javascript
   app.disableHardwareAcceleration();
   ```

#### High Memory Usage

**Solutions:**
1. Normal for Chromium-based apps
2. Close unused projects
3. Restart app periodically
4. Check for memory leaks in web code

---

## Getting Help

If issues persist:

1. **Check existing issues:** https://gitlab.com/soapbox-pub/shakespeare/-/issues
2. **Create new issue** with:
   - OS and version
   - Electron version: `npm list electron`
   - Steps to reproduce
   - Error messages/logs
   - Screenshots
3. **Community support:** Check project README for links

## Useful Commands

**Complete rebuild:**
```bash
rm -rf node_modules dist electron-dist package-lock.json
npm install
npm run build
npm run electron:build
```

**Check versions:**
```bash
npm list electron
node --version
npm --version
```

**Verbose logging:**
```bash
ELECTRON_ENABLE_LOGGING=1 npm run electron:dev
```

**Check build contents:**
```bash
npm run electron:build -- --dir
ls -la electron-dist/[platform]-unpacked/
```

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Debugging Electron](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process)
- [Shakespeare Main Docs](../README.md)
