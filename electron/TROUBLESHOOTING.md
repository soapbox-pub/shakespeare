# Electron Troubleshooting Guide

## Common Issues and Solutions

### Development Issues

#### Port 5173 Already in Use

**Problem:** Error message: `Port 5173 is already in use`

**Solution:**
1. Check if Vite is already running: `lsof -i :5173` (macOS/Linux) or `netstat -ano | findstr :5173` (Windows)
2. Kill the existing process or stop the dev server
3. Alternatively, change the port in `vite.config.ts`:
   ```typescript
   export default defineConfig({
     server: {
       port: 5174, // Use a different port
     },
   });
   ```
4. Update the URL in `electron/main.js` to match

#### Electron Window Opens But Shows Blank Screen

**Problem:** Electron window opens but displays a blank white screen

**Solutions:**
1. Check the Vite dev server is running: Open http://localhost:5173 in your browser
2. Check the Electron console for errors: DevTools should open automatically in dev mode
3. Verify the URL in `electron/main.js` matches your Vite server
4. Try clearing the cache: Delete `node_modules/.vite` and restart

**In production builds:**
1. Check console.log for "Failed to load resource" errors
2. Verify the file:// protocol is used in loadURL
3. Ensure dist/ directory contains all built files
4. Check that assets are loading from the correct path
5. Ensure `base: './'` is set in vite.config.ts for relative paths

#### Assets Fail to Load: "net::ERR_FILE_NOT_FOUND"

**Problem:** All CSS and JS assets fail to load with `file:///assets/npm/...` errors

**Root Cause:** Vite builds with absolute paths (`/assets/...`) by default, but Electron needs relative paths (`./assets/...`)

**Solution:**
Add `base: './'` to `vite.config.ts`:

```typescript
export default defineConfig(() => ({
  base: './', // Use relative paths for assets (required for Electron)
  // ... rest of config
}))
```

Then rebuild: `npm run build`

This makes all asset references relative to the HTML file, which is required for Electron's `file://` protocol to work correctly.

#### 404 Error: Page Not Found in Electron

**Problem:** App shows "404: Oops! Page not found" immediately on launch

**Root Cause:** `BrowserRouter` uses the actual URL path for routing. In Electron with `file://` protocol, the path is the filesystem path (e.g., `/tmp/.mount_ShakesXXX/resources/app.asar/dist/index.html`), which gets treated as a route.

**Solution:**
The app should already use `HashRouter` in Electron. Verify in `src/AppRouter.tsx`:

```typescript
const Router = window.electron?.isElectron ? HashRouter : BrowserRouter;
```

If you see a 404 error, check:
1. The router is using `HashRouter` when `window.electron?.isElectron` is true
2. The preload script is working (check `window.electron` exists in console)
3. Rebuild the app: `npm run build && npm run electron:build`

#### Service Worker Errors in Electron

**Problem:** Console shows service worker registration errors

**Solution:**
Service workers don't work with `file://` protocol. The app should skip registration in Electron:

```typescript
// In src/main.tsx
if ('serviceWorker' in navigator && !window.electron?.isElectron) {
  // Only register in web environment
}
```

#### CSP Font Errors: "Refused to load the font"

**Problem:** Console shows CSP errors about blocking base64 fonts

**Solution:**
Update the Content Security Policy in `index.html` to allow `data:` URIs:

```html
<meta http-equiv="content-security-policy" content="... font-src 'self' data:; ...">
```

#### Broken Images: SVG Files Not Loading

**Problem:** Logo or other SVG images show as broken, console shows `net::ERR_FILE_NOT_FOUND` for `.svg` files

**Root Cause:** Hardcoded absolute paths like `/shakespeare.svg` don't work with Vite's relative base path in Electron

**Solution:**
Import SVG files properly using Vite's `?url` import:

```typescript
// ❌ Wrong: Hardcoded path
<img src="/shakespeare.svg" alt="Logo" />

// ✅ Correct: Import with ?url
import logo from '/shakespeare.svg?url';
<img src={logo} alt="Logo" />
```

This ensures Vite processes the asset and generates the correct relative path for both web and Electron builds.

#### Preload Script Errors: "Cannot use import statement outside a module"

**Problem:** Error loading preload script with ESM syntax

**Solution:**
This happens when sandbox mode is enabled. The preload script uses ESM, which requires `sandbox: false` in webPreferences. The main.js file should have:

```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,
  contextIsolation: true,  // Still enabled for security
  sandbox: false,          // Disabled to support ESM
  webSecurity: true,
}
```

Context isolation remains enabled as the primary security boundary.

#### DevTools Not Opening

**Problem:** Developer tools don't open automatically in development mode

**Solution:**
- Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)
- Or add this to `electron/main.js` in the `createWindow()` function:
  ```javascript
  mainWindow.webContents.openDevTools({ mode: 'detach' });
  ```

### Build Issues

#### Build Fails with "Cannot find module"

**Problem:** Build fails with errors about missing modules

**Solutions:**
1. Ensure all dependencies are installed: `npm install`
2. Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
3. Ensure the web build completes first: `npm run build`
4. Check that `dist/` directory exists and contains built files
5. Verify configuration: `node electron/test-config.cjs`

#### Module/Import Errors in Electron Files

**Problem:** Errors related to imports or module system

**Solution:**
The project uses ESM (ES Modules) throughout, including Electron files. All files use `import`/`export` syntax:
- `main.js` - ESM
- `preload.js` - ESM
- `builder.config.js` - ESM
- `test-config.js` - ESM

Electron 28+ fully supports ESM, so everything is consistent with the rest of the Shakespeare codebase.

#### Icons Not Appearing in Built App

**Problem:** Built application shows default Electron icon instead of Shakespeare icon

**Solution:**
The build is configured to automatically use `public/shakespeare-512x512.png` and convert it to the appropriate format. This should work out of the box.

If icons still don't appear:
1. Verify `public/shakespeare-512x512.png` exists
2. Check the console output during build for icon conversion errors
3. Try generating platform-specific icons: `npm run electron:icons` (requires ImageMagick)
4. Verify paths in `electron/builder.config.js` are correct

#### Linux Build Fails with Icon Error

**Problem:** `npm run electron:build:linux` fails with icon-related errors

**Solution:**
This was a common issue in earlier versions. The configuration now uses `public/shakespeare-512x512.png` directly, which electron-builder converts automatically.

If you still see errors:
1. Ensure `public/shakespeare-512x512.png` exists
2. Update `electron/builder.config.js` to use the PNG icon (should already be set)
3. Don't specify a directory for Linux icons - use a single PNG file

#### Code Signing Errors (macOS)

**Problem:** Build fails with code signing errors on macOS

**Solutions:**
1. For development/testing, disable code signing in `electron/builder.config.js`:
   ```javascript
   mac: {
     identity: null, // Disable code signing
   }
   ```
2. For distribution, you need an Apple Developer account and certificates
3. See: https://www.electron.build/code-signing

#### Build Succeeds But App Won't Launch

**Problem:** Build completes but the application won't start

**Solutions:**
1. Check the console/terminal for error messages
2. Try the unpacked version first (in `electron-dist/[platform]-unpacked/`)
3. On macOS, check Security & Privacy settings if app is blocked
4. On Windows, check Windows Defender or antivirus logs
5. Verify the `dist/` directory contains valid built files before running electron-builder

### Runtime Issues

#### App Crashes on Startup

**Problem:** Application crashes immediately after launching

**Solutions:**
1. Check crash logs:
   - macOS: `~/Library/Logs/Shakespeare/`
   - Windows: `%APPDATA%\Shakespeare\logs\`
   - Linux: `~/.config/Shakespeare/logs/`
2. Try running from terminal to see error messages:
   - macOS: `./electron-dist/mac/Shakespeare.app/Contents/MacOS/Shakespeare`
   - Windows: `.\electron-dist\win-unpacked\Shakespeare.exe`
   - Linux: `./electron-dist/linux-unpacked/shakespeare`
3. Ensure the web build is working: Test in browser first at http://localhost:5173

#### IndexedDB/Storage Issues

**Problem:** App can't save projects or settings

**Solutions:**
1. Check available disk space
2. Clear Electron's cache:
   - macOS: `~/Library/Application Support/Shakespeare/`
   - Windows: `%APPDATA%\Shakespeare\`
   - Linux: `~/.config/Shakespeare/`
3. Check browser console for storage quota errors
4. Verify permissions on the application support directory

#### External Links Not Opening

**Problem:** Clicking external links does nothing

**Solution:**
This is by design for security. External links should open in the default browser.
If they're not:
1. Check `electron/main.js` has the `setWindowOpenHandler` code
2. Verify the link uses `target="_blank"`
3. Check console for errors

#### Shell Execution Error: "spawn /bin/sh ENOENT"

**Problem:** Terminal or AI shell commands fail with error:
```
Error: Error invoking remote method 'shell:exec': Error: Failed to execute command: spawn /bin/sh ENOENT
```

**Root Cause:** The working directory doesn't exist on the OS filesystem when the shell command is executed.

**Solution:**
This should be fixed in the latest version. The `shell:exec` handler now automatically creates the working directory before spawning the shell process.

**If the issue persists:**
1. Check the Electron console logs to see which directory is being used
2. Verify the directory path is correct (should be under `~/shakespeare/`)
3. Check filesystem permissions on the Shakespeare directory
4. Try manually creating the project directory: `mkdir -p ~/shakespeare/projects/{projectId}`

**Debug Steps:**
1. Open DevTools in Electron (View → Toggle Developer Tools)
2. Look for console logs showing:
   - `Shell exec in directory: ...`
   - `Command: ...`
3. Check for any filesystem errors in the console
4. Verify the directory exists: `ls -la ~/shakespeare/projects/`

**Workaround:**
If the issue continues, you can manually create the directory structure:
```bash
mkdir -p ~/shakespeare/projects
```

Then restart the Electron app.

### Platform-Specific Issues

#### macOS: "App is damaged and can't be opened"

**Problem:** macOS Gatekeeper blocks the app

**Solutions:**
1. For development builds, run: `xattr -cr /path/to/Shakespeare.app`
2. For distribution, you need proper code signing
3. Users can bypass temporarily: Right-click app → Open (instead of double-clicking)

#### Windows: "Windows protected your PC"

**Problem:** Windows SmartScreen blocks the app

**Solutions:**
1. Click "More info" → "Run anyway" (for testing)
2. For distribution, you need code signing with an EV certificate
3. Build reputation by having many users download and run the app

#### Linux: "Permission denied"

**Problem:** AppImage or executable can't be run

**Solutions:**
1. Make the file executable: `chmod +x Shakespeare*.AppImage`
2. For AppImage, you may need FUSE: `sudo apt-get install fuse`
3. Try the .deb or .rpm package instead

### Performance Issues

#### App Feels Slow or Unresponsive

**Solutions:**
1. Close DevTools if open (they impact performance)
2. Check system resources (CPU, RAM)
3. Try the production build instead of dev mode
4. Disable hardware acceleration in `electron/main.js`:
   ```javascript
   app.disableHardwareAcceleration();
   ```

#### High Memory Usage

**Solutions:**
1. This is normal for Chromium-based apps
2. Close unused projects in the app
3. Restart the app periodically
4. Check for memory leaks in the web app code

## Getting Help

If you're still experiencing issues:

1. **Check existing issues:** https://gitlab.com/soapbox-pub/shakespeare/-/issues
2. **Create a new issue:** Include:
   - Operating system and version
   - Electron version (`npm list electron`)
   - Steps to reproduce
   - Error messages or logs
   - Screenshots if applicable
3. **Ask in the community:** Link to Discord/Matrix/forum if available

## Useful Commands

**Clear all caches and rebuild:**
```bash
rm -rf node_modules dist electron-dist package-lock.json
npm install
npm run build
npm run electron:build
```

**Check Electron version:**
```bash
npm list electron
```

**Run with verbose logging:**
```bash
ELECTRON_ENABLE_LOGGING=1 npm run electron:dev
```

**Check what files are included in build:**
```bash
npm run electron:build -- --dir
# Check electron-dist/[platform]-unpacked/ directory
```

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Debugging Electron Apps](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process)
