# Real Terminal in Electron

When Shakespeare runs in Electron, it automatically uses the **real OS terminal** instead of the virtual terminal used in the browser version.

## How It Works

### Architecture

1. **Electron Main Process** (`electron/main.js`):
   - Added `shell:exec` IPC handler that spawns real shell processes
   - Uses `child_process.spawn()` to execute commands
   - Automatically detects platform (Windows uses `cmd.exe`, Unix uses `/bin/sh`)
   - All commands execute in the context of `~/shakespeare` directory

2. **Preload Script** (`electron/preload.js`):
   - Exposes `window.electron.shell.exec()` to renderer process
   - Provides secure bridge between renderer and main process

3. **TypeScript Definitions** (`electron/electron.d.ts`):
   - Added `ElectronShellAPI` interface
   - Defines `ShellExecResult` type with stdout, stderr, and exitCode

4. **ShellTool** (`src/lib/tools/ShellTool.ts`):
   - Detects if `window.electron.shell` is available
   - If in Electron, bypasses virtual command system and uses real shell
   - Falls back to virtual commands in browser mode

5. **Terminal Component** (`src/components/Terminal.tsx`):
   - Detects Electron environment
   - Routes commands to real shell when available
   - Shows "Real Terminal (OS Shell)" in welcome message
   - Maintains command history and UI features in both modes

## Features

### Real Shell Execution
- **All OS commands available**: Not limited to Shakespeare's built-in commands
- **Native shell features**: Pipes, redirection, environment variables all work natively
- **Package managers**: Run `npm`, `yarn`, `pnpm`, etc. directly
- **Build tools**: Execute `vite`, `webpack`, `tsc`, etc.
- **Git operations**: Full Git CLI available
- **System utilities**: Access to all system commands (`grep`, `sed`, `awk`, etc.)

### Working Directory
- Commands execute in the project directory: `~/shakespeare/{projectsPath}/{projectId}`
- The `projectsPath` is configurable (default: `projects`)
- Paths are automatically resolved relative to this directory
- Full access to the OS filesystem within the Shakespeare directory

### Platform Support
- **macOS/Linux**: Uses `/bin/sh` for command execution
- **Windows**: Uses `cmd.exe` for command execution
- Commands are platform-aware and work naturally on each OS

## Usage

### In Browser Mode
```bash
# Limited to built-in commands
$ ls
$ cat file.txt
$ git status
```

### In Electron Mode
```bash
# All OS commands available
$ npm install
$ npm run build
$ python script.py
$ make
$ docker ps
$ curl https://api.example.com
$ any-other-command
```

## Security Considerations

### Sandboxing
- Commands execute with the permissions of the Electron app
- Limited to the `~/shakespeare` directory by default
- No special elevation or sudo access

### Command Execution
- Commands run through the platform's default shell
- Environment variables from the Electron process are inherited
- Standard input/output/error streams are captured

## AI Integration

The ShellTool used by AI assistants automatically uses real shell execution in Electron:

```typescript
// AI can execute any OS command
await shellTool.execute({
  command: "npm install lodash"
});

await shellTool.execute({
  command: "git commit -m 'Update dependencies'"
});
```

### ANSI Code Stripping

Output from real shell commands is automatically cleaned for AI consumption:
- **ANSI color codes** are stripped (e.g., `\u001b[31m` for red text)
- **Cursor control sequences** are removed
- **Text formatting codes** are stripped (bold, italic, etc.)
- **Newlines and whitespace** are preserved

This ensures AI receives clean, parseable text without terminal formatting noise.

**Example:**
```
Input:  \u001b[1m\u001b[32madded 142 packages\u001b[39m\u001b[22m in 3s
Output: added 142 packages in 3s
```

The Terminal UI still displays colored output for users - only AI tool output is stripped.

## Differences from Browser Mode

| Feature | Browser Mode | Electron Mode |
|---------|-------------|---------------|
| Available Commands | Built-in only (~30 commands) | All OS commands |
| Shell Features | Simulated | Native |
| Package Managers | Not available | Full support |
| Build Tools | Limited | Full support |
| File System | Virtual (IndexedDB) | Real OS filesystem |
| Performance | JavaScript execution | Native shell |
| Platform Commands | Emulated | Native to OS |

## Terminal UI Features

Both modes share the same terminal UI features:
- Command history (up/down arrows)
- Output formatting with ANSI color support
- Copy to clipboard
- Auto-scroll
- Command execution state
- Error highlighting

## Example Session

```bash
$ pwd
/Users/username/shakespeare/projects/my-app

$ npm install
added 142 packages, and audited 143 packages in 3s

$ npm run build
> my-app@1.0.0 build
> vite build
✓ built in 1.2s

$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

## Troubleshooting

### Commands Not Found
- Ensure the command is installed on your system
- Check your system's PATH environment variable
- Verify the command works in your regular terminal

### Permission Errors
- Electron runs with your user's permissions
- Some commands may require additional permissions
- Use absolute paths if relative paths don't work

### Platform-Specific Issues
- Windows: Some Unix commands may not be available (use Git Bash or WSL)
- macOS: Some commands may require Xcode Command Line Tools
- Linux: Ensure required packages are installed

## Development

To test real terminal execution:

```bash
# Run Electron in development mode
npm run electron:dev

# Open the terminal in a project
# Try executing real OS commands
```

The terminal will show "Real Terminal (OS Shell)" in the welcome message when running in Electron mode.

### Testing the Shell API

A test script is provided in `electron/test-terminal.js` to verify the shell execution works correctly:

```bash
# Start Electron in development mode
npm run electron:dev

# Open DevTools (View > Toggle Developer Tools)
# Copy and paste the contents of electron/test-terminal.js into the console
# The script will run 5 tests to verify shell execution
```

The test script verifies:
1. Basic echo command execution
2. File listing commands
3. Node.js version check
4. Error handling for non-existent commands
5. Working directory verification
