# Electron Build Documentation

Welcome to the Shakespeare Electron build documentation! This directory contains everything needed to build and run Shakespeare as a native desktop application.

## 📚 Documentation Index

### Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide for building and running Electron builds
  - Development mode setup
  - Building for distribution
  - Platform-specific instructions
  - Icon generation

### Integration
- **[INTEGRATION.md](INTEGRATION.md)** - Guide for integrating Electron features into Shakespeare
  - Detecting Electron environment
  - Using the Electron API
  - Adding new features
  - Security best practices
  - Code examples

### Troubleshooting
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Solutions to common issues
  - Development issues
  - Build issues
  - Runtime issues
  - Platform-specific problems

### Technical Reference
- **[README.md](README.md)** - Complete technical documentation
  - File structure
  - Build configuration
  - Security implementation
  - Customization options
- **[ESM.md](ESM.md)** - Why we use ES Modules (ESM) instead of CommonJS
  - Benefits and rationale
  - Examples and patterns
  - Migration guide

## 🗂️ File Structure

```
electron/
├── INDEX.md                 # This file - documentation index
├── README.md               # Complete technical documentation
├── QUICKSTART.md           # Quick start guide
├── INTEGRATION.md          # Integration guide for developers
├── TROUBLESHOOTING.md      # Troubleshooting guide
├── main.js                 # Electron main process (ESM)
├── preload.js              # Preload script (ESM)
├── builder.config.js       # electron-builder configuration (ESM)
├── electron.d.ts           # TypeScript definitions for Electron API
├── generate-icons.sh       # Script to generate platform icons
├── test-config.js          # Configuration validation script (ESM)
└── resources/              # Build resources (icons, etc.)
    └── .gitkeep
```

## 🚀 Quick Commands

```bash
# Development
npm run electron:dev          # Run in development mode

# Building
npm run electron:build        # Build for current platform
npm run electron:build:mac    # Build for macOS
npm run electron:build:win    # Build for Windows
npm run electron:build:linux  # Build for Linux
npm run electron:build:all    # Build for all platforms

# Utilities
npm run electron:icons        # Generate icons from Shakespeare logo
```

## 🎯 What You Need to Know

### For Users
1. Read [QUICKSTART.md](QUICKSTART.md) to build and run the app
2. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if you encounter issues

### For Developers
1. Start with [QUICKSTART.md](QUICKSTART.md) for basic setup
2. Read [INTEGRATION.md](INTEGRATION.md) to add Electron features
3. Refer to [README.md](README.md) for technical details
4. Use [TROUBLESHOOTING.md](TROUBLESHOOTING.md) when debugging

## 🔒 Security

The Electron build implements security best practices:
- Context isolation enabled (primary security boundary)
- Sandbox mode disabled (required for ESM preload scripts)
- Node integration disabled
- Minimal API surface through preload script
- Navigation and window opening restrictions

See [README.md](README.md) for complete security details.

## 🎨 Icons

Before building for distribution, generate platform-specific icons:

```bash
npm run electron:icons
```

This requires ImageMagick. Alternatively, use online tools or electron-icon-builder.

See [QUICKSTART.md](QUICKSTART.md) for details.

## 📦 Build Output

Built applications are placed in `electron-dist/`:
- macOS: `.dmg` installer and `.app` bundle
- Windows: NSIS installer and portable `.exe`
- Linux: AppImage, `.deb`, and `.rpm` packages

## 🆘 Need Help?

1. Check the documentation files in order:
   - [QUICKSTART.md](QUICKSTART.md)
   - [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
   - [INTEGRATION.md](INTEGRATION.md)
   - [README.md](README.md)

2. Search existing issues on GitLab

3. Create a new issue with:
   - OS and version
   - Steps to reproduce
   - Error messages
   - Relevant logs

## 🔄 Updating

When updating the Electron build:

1. Update Electron version: `npm install electron@latest --save-dev`
2. Update electron-builder: `npm install electron-builder@latest --save-dev`
3. Test thoroughly on all target platforms
4. Update documentation if APIs change

## 🌟 Features

Current Electron features:
- ✅ Platform detection
- ✅ App version info
- ✅ Secure IPC bridge
- ✅ External link handling
- ✅ Native window management

Potential future features (see [README.md](README.md)):
- Auto-updates
- Native menus
- System tray
- File associations
- Native dialogs

## 📝 Contributing

When contributing to the Electron build:

1. Keep the web version working - it should not depend on Electron
2. Use progressive enhancement - Electron features should be optional
3. Follow security best practices
4. Update documentation
5. Test on all platforms if possible

## 📄 License

The Electron build is part of Shakespeare and is licensed under GNU AGPLv3.
