# Shakespeare Electron Desktop App

Shakespeare can run as a native desktop application on macOS, Windows, and Linux using Electron. The desktop version provides enhanced features over the browser version, including real OS filesystem access and native terminal execution.

## Quick Start

### Development Mode
```bash
npm run electron:dev
```

### Build for Distribution
```bash
# Build for your current platform
npm run electron:build

# Build for specific platforms
npm run electron:build:mac     # macOS (DMG + ZIP)
npm run electron:build:win     # Windows (NSIS + Portable)
npm run electron:build:linux   # Linux (AppImage, DEB, RPM)
npm run electron:build:all     # All platforms
```

Built applications will be in the `electron-dist/` directory.

## Key Features

### 1. Real OS Filesystem

Projects are stored at `~/shakespeare` on your local filesystem instead of browser IndexedDB:

- **No storage limits** - Only limited by disk space
- **Direct file access** - Use any code editor, file manager, or Git client
- **Easy backup** - Standard filesystem backup tools work
- **Better performance** - Faster for large projects

**Directory Structure:**
```
~/shakespeare/
├── projects/          # Your Shakespeare projects
├── config/           # AI and Git settings
└── tmp/              # Temporary files
```

**Opening the directory:**
- macOS: `open ~/shakespeare`
- Linux: `xdg-open ~/shakespeare`
- Windows: `explorer %USERPROFILE%\shakespeare`

### 2. Real OS Terminal

All OS commands are available, not just built-in commands:

- **Package managers**: `npm`, `yarn`, `pnpm` work directly
- **Build tools**: `vite`, `webpack`, `tsc`, etc.
- **Git CLI**: Full Git command-line interface
- **Native shell features**: Pipes, redirection, environment variables
- **System utilities**: All your favorite command-line tools

Commands execute in the project directory at `~/shakespeare/projects/{projectId}` with your user's permissions.

### 3. Clean UI

- **No menu bar** - Frameless interface focused on Shakespeare
- **Native window controls** - Standard minimize/maximize/close buttons
- **Auto-updates ready** - Can be configured for automatic updates

## Project Structure

```
electron/
├── main.js              # Main process (window management, IPC)
├── preload.js           # Secure IPC bridge
├── builder.config.js    # Build configuration
├── resources/           # Icons and build assets
├── test-config.js       # Configuration validator
├── test-terminal.js     # Terminal testing script
├── generate-icons.sh    # Icon generation script
├── README.md           # This file
└── GUIDE.md            # Detailed guide and troubleshooting
```

## Icons

No icon setup required! The build automatically uses `public/shakespeare-512x512.png` and converts it for each platform:

- **macOS**: Converts to `.icns`
- **Windows**: Converts to `.ico`  
- **Linux**: Uses PNG directly

For custom icons, run `npm run electron:icons` (requires ImageMagick) or place platform-specific icons in `electron/resources/`.

## Platform-Specific Builds

### macOS
- Creates DMG installer and ZIP archive
- Builds for both Intel (x64) and Apple Silicon (arm64)
- Requires macOS for code signing (optional for development)

### Windows
- Creates NSIS installer and portable executable
- Builds for both x64 and ARM64
- No code signing required for development

### Linux
- Creates AppImage, DEB, and RPM packages
- Builds for both x64 and ARM64
- Works from any platform

## Security

The Electron build follows security best practices:

- **Context Isolation**: Enabled to prevent renderer access to Node.js
- **Web Security**: Enforces same-origin policy
- **Navigation Protection**: Blocks navigation to external sites
- **Minimal IPC API**: Only essential functionality exposed
- **Sandboxed Execution**: Commands run with user permissions

## API Exposed to Renderer

The preload script exposes a minimal API via `window.electron`:

```typescript
window.electron.isElectron           // Boolean: true in Electron
window.electron.platform()           // Returns: 'darwin' | 'win32' | 'linux'
window.electron.version()            // Returns app version
window.electron.fs.*                 // Filesystem operations
window.electron.shell.exec()         // Execute shell commands
```

## Customization

### Window Configuration
Edit `electron/main.js` to customize:
- Window size and position
- Minimum/maximum dimensions
- Background color
- Title bar style

### Build Settings
Edit `electron/builder.config.js` to configure:
- App metadata (ID, name, category)
- Platform-specific options
- Installer settings
- Auto-update configuration

### Additional Features
Add to `electron/main.js` and `electron/preload.js`:
- Native menus
- System tray icon
- File associations
- Custom URL schemes
- Native dialogs

## Development vs Production

**Development Mode** (`npm run electron:dev`):
- Loads from Vite dev server (http://localhost:5173)
- Hot reload enabled
- DevTools open automatically
- Faster iteration

**Production Build** (`npm run electron:build`):
- Loads from built files (file:// protocol)
- Optimized and minified
- No DevTools by default
- Ready for distribution

## Common Issues

See [GUIDE.md](./GUIDE.md) for detailed troubleshooting, including:
- Port conflicts
- Blank screen issues
- Asset loading errors
- Build failures
- Platform-specific problems

## Next Steps

1. **Try it out**: Run `npm run electron:dev` to test locally
2. **Build it**: Create a distributable with `npm run electron:build`
3. **Customize**: Modify window settings, add native features
4. **Distribute**: Set up code signing and auto-updates for production

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Shakespeare Main Documentation](../README.md)
- [Detailed Guide](./GUIDE.md)

---

**Note:** For comprehensive documentation including filesystem details, terminal usage, and troubleshooting, see [GUIDE.md](./GUIDE.md).
