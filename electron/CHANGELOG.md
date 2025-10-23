# Electron Build Changelog

All notable changes to the Shakespeare Electron build will be documented in this file.

## [Unreleased]

### Added
- Initial Electron build support
- Main process with secure window management (`main.js`)
- Preload script with minimal API exposure (`preload.js`)
- electron-builder configuration for multi-platform builds (`builder.config.js`)
- TypeScript definitions for Electron API (`electron.d.ts`)
- Icon generation script (`generate-icons.sh`)
- Comprehensive documentation:
  - `INDEX.md` - Documentation index
  - `README.md` - Technical documentation
  - `QUICKSTART.md` - Quick start guide
  - `INTEGRATION.md` - Developer integration guide
  - `TROUBLESHOOTING.md` - Troubleshooting guide
- NPM scripts for development and building:
  - `electron:dev` - Development mode
  - `electron:build` - Build for current platform
  - `electron:build:mac` - Build for macOS
  - `electron:build:win` - Build for Windows
  - `electron:build:linux` - Build for Linux
  - `electron:build:all` - Build for all platforms
  - `electron:icons` - Generate platform icons

### Security
- Enabled context isolation
- Enabled sandbox mode
- Disabled node integration
- Implemented navigation restrictions
- Configured secure window opening behavior
- Minimal IPC API surface through preload script

### Platform Support
- macOS (Intel and Apple Silicon)
  - DMG installer
  - ZIP archive
- Windows (x64 and ARM64)
  - NSIS installer
  - Portable executable
- Linux (x64 and ARM64)
  - AppImage
  - DEB package
  - RPM package

### API
- `window.electron.isElectron` - Detect Electron environment
- `window.electron.platform()` - Get platform information
- `window.electron.version()` - Get app version

## Future Enhancements

Planned features for future releases:

- [ ] Auto-update support
- [ ] Native application menu
- [ ] System tray integration
- [ ] File type associations
- [ ] Custom URL scheme handling
- [ ] Native file dialogs
- [ ] Enhanced offline capabilities
- [ ] Keyboard shortcuts/accelerators
- [ ] Window state persistence
- [ ] Multiple window support
- [ ] Native notifications
- [ ] Deep linking support

## Notes

The Electron build is designed to keep the existing web codebase untouched. All Electron-specific code is contained in the `electron/` directory, and the web version continues to work independently.
