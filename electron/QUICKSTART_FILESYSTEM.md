# Quick Start: Filesystem Access

## Where Are My Files?

When running Shakespeare as an Electron desktop app, all your projects are stored at:

```
~/shakespeare/
```

This expands to:
- **macOS/Linux**: `/Users/yourname/shakespeare/` or `/home/yourname/shakespeare/`
- **Windows**: `C:\Users\yourname\shakespeare\`

## Opening the Directory

### macOS
```bash
open ~/shakespeare
```

### Linux
```bash
xdg-open ~/shakespeare
# or
nautilus ~/shakespeare
```

### Windows
```cmd
explorer %USERPROFILE%\shakespeare
```

## What's Inside?

```
~/shakespeare/
├── projects/              ← Your Shakespeare projects
│   ├── my-react-app/
│   ├── todo-app/
│   └── ...
├── config/                ← Settings (AI keys, Git credentials)
│   ├── ai.json
│   └── git.json
└── tmp/                   ← Temporary files
```

## Working with Your Files

### Use Any Editor

Open your projects in VS Code, Sublime, or any code editor:

```bash
code ~/shakespeare/projects/my-react-app
```

### Use Git Clients

Use GitHub Desktop, GitKraken, or command-line Git:

```bash
cd ~/shakespeare/projects/my-react-app
git status
git commit -am "Update homepage"
```

### Backup Your Work

Use Time Machine, rsync, Dropbox, iCloud, or any backup tool:

```bash
# Example: Backup to external drive
rsync -av ~/shakespeare /Volumes/Backup/

# Example: Create archive
tar -czf shakespeare-backup.tar.gz ~/shakespeare
```

### Share Projects

Copy project folders to share with others:

```bash
# Create shareable archive
cd ~/shakespeare/projects
tar -czf my-react-app.tar.gz my-react-app/

# Or use zip
zip -r my-react-app.zip my-react-app/
```

## Tips

### 1. Keep It Synced

Use cloud sync services to sync `~/shakespeare` across devices:
- Dropbox
- Google Drive
- iCloud Drive
- OneDrive

Just move or symlink the directory to your sync folder.

### 2. Use .gitignore

Each project has a `.gitignore` file. Add files you don't want to commit:

```
node_modules/
dist/
.env
```

### 3. External Tools

Since files are on your real filesystem, you can use:
- File search tools (Spotlight, Everything, etc.)
- Diff tools (Beyond Compare, Meld, etc.)
- Backup software
- Antivirus scanning
- File recovery tools

### 4. Performance

Large projects perform better on the local filesystem than in IndexedDB:
- Faster file operations
- Better for thousands of files
- No browser storage quota limits

## Migrating from Browser Version

If you were using Shakespeare in the browser before:

1. **Export** your projects as ZIP files in the browser version
2. **Import** the ZIP files in the Electron version
3. Your projects will be extracted to `~/shakespeare/projects/`

## Troubleshooting

### Can't Find Directory

The directory is created automatically when you first run the Electron app. If it's missing:

```bash
mkdir -p ~/shakespeare
```

### Permission Denied

Ensure you have read/write permissions:

```bash
ls -la ~/shakespeare
chmod -R u+rw ~/shakespeare
```

### Deleted Files

Files deleted in Shakespeare are permanently removed (not moved to Trash). Use:
- Version control (Git) to recover committed files
- Backup software to restore from backups
- File recovery tools for recently deleted files

## Questions?

See the full documentation:
- [FILESYSTEM.md](./FILESYSTEM.md) - Complete technical details
- [README.md](./README.md) - Electron build overview
- [QUICKSTART.md](./QUICKSTART.md) - Building and running Shakespeare
