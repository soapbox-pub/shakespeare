# Shakespeare Electron Build

This directory contains the Electron-specific files for building Shakespeare as a desktop application.

## Structure

```
electron/
├── main.js              # Electron main process (ESM)
├── preload.js           # Preload script for secure IPC (ESM)
├── builder.config.js    # electron-builder configuration (ESM)
├── resources/           # Build resources (icons, etc.)
└── README.md           # This file
```

## Development

Run Shakespeare in Electron development mode:

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server
2. Wait for it to be ready
3. Launch Electron pointing to the dev server

## Building

Build Shakespeare for your current platform:

```bash
npm run electron:build
```

Build for specific platforms:

```bash
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
```

Build for all platforms:

```bash
npm run electron:build:all
```

## Output

Built applications will be in the `electron-dist/` directory.

## Platform-Specific Notes

### macOS

- Requires `.icns` icon file in `electron/resources/icon.icns`
- Builds both Intel (x64) and Apple Silicon (arm64) versions
- Creates DMG installer and ZIP archive

### Windows

- Requires `.ico` icon file in `electron/resources/icon.ico`
- Builds both x64 and ARM64 versions
- Creates NSIS installer and portable executable

### Linux

- Requires PNG icons in `electron/resources/icons/` (multiple sizes)
- Builds both x64 and ARM64 versions
- Creates AppImage, DEB, and RPM packages

## Icon Resources

The build is configured to use `public/shakespeare-512x512.png` as the icon source. electron-builder will automatically convert this PNG to the appropriate format for each platform:

- **macOS**: Converts to `.icns`
- **Windows**: Converts to `.ico`
- **Linux**: Uses the PNG directly (generates multiple sizes)

**No additional icon preparation is needed!** The existing Shakespeare logo will be used automatically.

If you want to use custom icons instead, you can:
1. Place platform-specific icons in `electron/resources/`:
   - `icon.icns` for macOS
   - `icon.ico` for Windows
   - `icons/*.png` for Linux (multiple sizes)
2. Update `electron/builder.config.js` to point to these files

## Security

The Electron build implements several security best practices:

- **Context Isolation**: Enabled to prevent renderer from accessing Node.js
- **Sandbox**: Disabled to support ESM in preload (context isolation still provides security)
- **Web Security**: Enabled to enforce same-origin policy
- **Navigation Protection**: Prevents navigation to external sites
- **Window Opening**: External links open in default browser
- **Preload Script**: Minimal API exposure through contextBridge

## Customization

### Main Process (`main.js`)

The main process handles:
- Window creation and management
- App lifecycle events
- Security policies
- IPC communication

### Preload Script (`preload.js`)

The preload script exposes a minimal API to the renderer:
- `window.electron.isElectron` - Flag to detect Electron environment
- `window.electron.platform()` - Get platform information
- `window.electron.version()` - Get app version

Add additional IPC handlers here if you need Electron-specific features.

### Builder Configuration (`builder.config.js`)

Customize the build process:
- App metadata (ID, name, category)
- Platform-specific settings
- Installer options
- Auto-update configuration (if needed)

## Future Enhancements

Potential features to add:

- **Auto-updates**: Configure publish settings in builder.config.js
- **Native menus**: Add custom application menu
- **Tray icon**: Add system tray support
- **File associations**: Associate file types with the app
- **Deep linking**: Handle custom URL schemes
- **Native dialogs**: Use Electron's native file/message dialogs
- **Offline mode**: Enhanced offline capabilities
- **Local storage**: Use Electron's native storage APIs
