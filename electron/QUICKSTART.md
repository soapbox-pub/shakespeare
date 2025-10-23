# Electron Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Development

To run Shakespeare as an Electron desktop app in development mode:

```bash
npm run electron:dev
```

This will:
1. Start the Vite development server on http://localhost:5173
2. Launch Electron with hot-reload support
3. Open DevTools automatically for debugging

## Building for Distribution

### Build for Your Current Platform

```bash
npm run electron:build
```

This will create an installer/package for your current operating system in the `electron-dist/` directory.

### Build for Specific Platforms

**macOS:**
```bash
npm run electron:build:mac
```
Produces: `.dmg` installer and `.zip` archive for both Intel and Apple Silicon

**Windows:**
```bash
npm run electron:build:win
```
Produces: NSIS installer and portable `.exe` for both x64 and ARM64

**Linux:**
```bash
npm run electron:build:linux
```
Produces: AppImage, `.deb`, and `.rpm` packages for both x64 and ARM64

### Build for All Platforms

```bash
npm run electron:build:all
```

⚠️ **Note:** Cross-platform builds have limitations:
- Building for macOS requires macOS (for code signing)
- Building Windows `.exe` from macOS/Linux works but may have limitations
- Building for Linux works from any platform

## Icon Setup

**Good news!** No icon setup is required. The build automatically uses `public/shakespeare-512x512.png` and converts it to the appropriate format for each platform.

If you want to customize the icons:
1. Run `npm run electron:icons` (requires ImageMagick)
2. Or manually place custom icons in `electron/resources/`
3. Update `electron/builder.config.js` to use the custom icons

But for most users, the default setup works perfectly!

## Output Location

All built applications will be in the `electron-dist/` directory:

```
electron-dist/
├── mac/                    # macOS builds
│   ├── Shakespeare.app     # Application bundle
│   └── Shakespeare.dmg     # DMG installer
├── win-unpacked/           # Windows unpacked
│   └── Shakespeare.exe     # Executable
├── Shakespeare Setup.exe   # Windows NSIS installer
├── Shakespeare Portable.exe # Windows portable
└── shakespeare-*.AppImage  # Linux AppImage
```

## Troubleshooting

### Port 5173 Already in Use

If you get an error that port 5173 is already in use:
1. Stop any running Vite dev servers
2. Or change the port in `vite.config.ts`

### Build Fails

If the build fails:
1. Ensure you've run `npm run build` successfully first
2. Check that all dependencies are installed: `npm install`
3. Clear the dist folder: `rm -rf dist electron-dist`
4. Try building again

### Icons Not Showing

If icons don't appear in the built app:
1. Verify icon files exist in `electron/resources/`
2. Check file names match the builder config
3. Ensure icons are in the correct format (icns for Mac, ico for Windows, png for Linux)

## What's Different in Electron?

When running in Electron, the app has access to:

- `window.electron.isElectron` - Boolean flag (always `true` in Electron)
- `window.electron.platform()` - Returns platform: 'darwin', 'win32', or 'linux'
- `window.electron.version()` - Returns app version from package.json

You can use these in your code to detect the Electron environment:

```javascript
if (window.electron?.isElectron) {
  console.log('Running in Electron!');
  const platform = await window.electron.platform();
  console.log('Platform:', platform);
}
```

## Next Steps

- Customize the window size and appearance in `electron/main.js`
- Add native menus, dialogs, or other Electron features
- Configure auto-updates (see `electron/README.md`)
- Set up code signing for distribution (required for macOS)

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Shakespeare Documentation](../README.md)
