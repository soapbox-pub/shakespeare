# Electron Features

Shakespeare's Electron desktop app provides several powerful features beyond the browser version.

## Real OS Filesystem

Projects are stored at `~/shakespeare` on your local filesystem instead of in the browser's IndexedDB.

**Benefits:**
- Use any code editor (VS Code, Sublime, etc.)
- Use any Git client
- No storage limits (only disk space)
- Easy backup and version control
- Better performance for large projects
- Direct file access with file manager

**Location:**
```
~/shakespeare/
├── projects/
│   ├── project-1/
│   ├── project-2/
│   └── ...
└── ...
```

See [FILESYSTEM.md](./FILESYSTEM.md) for details.

## Real OS Terminal

The terminal executes real shell commands on your operating system instead of using virtual commands.

**Benefits:**
- **All OS commands available** - Not limited to ~30 built-in commands
- **Package managers work** - `npm install`, `yarn add`, `pnpm install`
- **Build tools available** - `vite`, `webpack`, `tsc`, `rollup`, etc.
- **System utilities** - `grep`, `sed`, `awk`, `curl`, `wget`, etc.
- **Native shell features** - Pipes, redirection, environment variables
- **Python/Ruby/etc.** - Run scripts in any installed language

**Examples:**

```bash
# Install dependencies
$ npm install

# Run build scripts
$ npm run build

# Use system commands
$ curl https://api.example.com
$ grep -r "TODO" src/
$ python scripts/deploy.py

# Chain commands with pipes
$ cat package.json | grep dependencies
$ ls -la | wc -l
```

**AI Integration:**
AI assistants can also execute real OS commands through the ShellTool, making them much more powerful in Electron.

See [REAL_TERMINAL.md](./REAL_TERMINAL.md) for details.

## Native Window Management

- **Resizable windows** with native OS controls
- **Clean interface** - No default menu bar (File/Edit/View/etc.)
- **Frameless app** - Shakespeare UI fills the entire window
- **Multiple windows** support (planned)
- **System tray integration** (planned)
- **OS notifications** (planned)

## Offline First

- **No internet required** for core functionality
- **Local AI models** support (planned)
- **Cached dependencies** for faster builds
- **Git operations** work offline (local commits)

## Better Performance

- **Faster file operations** - Direct OS filesystem access
- **Faster builds** - Native Node.js instead of browser environment
- **Lower memory usage** - No browser overhead
- **Faster Git operations** - Native Git commands (planned)

## Security & Privacy

- **No cloud storage** - Everything stays on your machine
- **No telemetry** - No data sent to servers
- **Local API keys** - Stored securely on your OS
- **Full control** - You own your data and code

## Platform Support

- **macOS** - Native .app bundle
- **Windows** - Native .exe installer
- **Linux** - AppImage, .deb, .rpm packages

## Comparison: Browser vs Electron

| Feature | Browser | Electron |
|---------|---------|----------|
| **Filesystem** | Virtual (IndexedDB) | Real OS filesystem |
| **Terminal** | ~30 built-in commands | All OS commands |
| **Storage Limit** | Browser quota (~50GB) | Disk space |
| **File Access** | Only in browser | Any editor/tool |
| **Package Managers** | Not available | Full support |
| **Build Tools** | Limited | Full support |
| **Performance** | Good | Better |
| **Git** | isomorphic-git | isomorphic-git* |
| **Offline** | Yes | Yes |
| **Updates** | Automatic | Manual/Auto-update |

\* Native Git CLI support planned

## Getting Started

### Installation

Download the latest release for your platform:
- **macOS**: `Shakespeare-{version}.dmg`
- **Windows**: `Shakespeare-Setup-{version}.exe`
- **Linux**: `Shakespeare-{version}.AppImage`

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/shakespeare.git
cd shakespeare

# Install dependencies
npm install

# Build for your platform
npm run electron:build

# Or build for all platforms
npm run electron:build:all
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed build instructions.

## Roadmap

Planned features for future releases:

- [ ] Native Git CLI integration
- [ ] Multiple window support
- [ ] System tray integration
- [ ] Auto-update mechanism
- [ ] Local AI model support
- [ ] Enhanced terminal (tabs, splits)
- [ ] File watcher integration
- [ ] Native notifications
- [ ] Keyboard shortcuts customization
- [ ] Theme customization

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Create an issue](https://github.com/yourusername/shakespeare/issues)
- Documentation: See other `.md` files in this directory
- Community: Join our Discord/Matrix (links TBD)
