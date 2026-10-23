# Shell Commands

The shell behind `ShellTool` is [just-bash](https://github.com/vercel-labs/just-bash), a bash interpreter written in TypeScript. It provides the bash language and the standard Unix utilities (`cat`, `ls`, `grep`, `sed`, `awk`, `jq`, `find`, `xargs`, ...), running over Shakespeare's VFS through `src/lib/shell/BashFS.ts`.

This directory holds the commands just-bash doesn't have, which `ShellTool` registers with it as custom commands.

## ShellCommand Interface

Each command implements `ShellCommand`:

- `name`: The command name (e.g. `git`)
- `description`: Brief description of what the command does
- `usage`: Usage syntax for the command
- `execute(args, cwd, input?)`: Runs the command and returns a `ShellCommandResult` (`exitCode`, `stdout`, `stderr`). `input` is stdin, or `undefined` when nothing was piped in.

## Commands

### git

Git over isomorphic-git, with subcommands in `git/` (`add`, `commit`, `push`, `pull`, `status`, `log`, `diff`, `branch`, `checkout`, `switch`, `merge`, `revert`, `rm`, `mv`, `restore`, `rev-parse`, `ls-files`, `tag`, `stash`, `fetch`, `clone`, `init`, `reset`, `show`, `remote`, `config`).

### curl

HTTP requests through Shakespeare's CORS proxy.

### unzip

Extract ZIP archives (JSZip).

### hexdump

Display file contents in hexadecimal.

### tsc

**Usage:** `tsc [--noEmit] [-p project] [--pretty] [options] [file...]`

Run the TypeScript compiler. This is the real `tsc` CLI, running in a Web Worker with the project's own TypeScript version and its dependencies' type declarations (see `src/lib/tsc/`).

**Examples:**
```bash
tsc --noEmit                   # Typecheck the project using tsconfig.json
tsc --noEmit --pretty          # Colored output with code frames
tsc -v                         # Show the TypeScript version
```

**Features:**
- Same output and exit codes as `tsc` (2 when there are type errors)
- Downloads dependency types once and caches them in IndexedDB
- Checks incrementally: after an edit, only affected files are checked again
- Writes emitted files back to the project
- `--watch` is not supported

### npx

**Usage:** `npx [-y] command [args...]`

Run a built-in command, e.g. `npx tsc --noEmit`. Packages can't be installed, so anything else fails with exit code 127.

### python3

**Usage:** `python3 [-c cmd | -m module | file | -] [arg...]` (also available as `python`)

Run CPython 3.14 compiled to WebAssembly ([Pyodide](https://pyodide.org)), in a Web Worker (see `src/lib/python/`). Pyodide is loaded from jsDelivr on first use.

**Examples:**
```bash
python3 script.py arg           # Run a script
python3 -c 'print(1 + 1)'       # Run a one-liner
python3 - <<'EOF'               # Run a heredoc
print("hi")
EOF
echo '{"a":1}' | python3 -m json.tool
```

**Features:**
- Scripts see the project (except `node_modules` and `.git`) and `/tmp` at their real paths; files they create, change, or delete there are saved back to the VFS
- Only files changed since the last run are sent to the worker
- Packages Pyodide provides (numpy, pandas, ...) are loaded automatically when the script imports them
- Local modules are reloaded on every run, so edits are picked up
- Scripts are stopped after 2 minutes of running (exit code 124)
- HTTP requests (`urllib.request`, `requests`, `pyodide.http.pyfetch`) go through the CORS proxy, like `curl`; Pyodide's CDN and PyPI are reached directly
- No raw sockets or subprocesses; no interactive mode

### pip / pip3

**Usage:** `pip install package...`

Install packages with micropip (pure-Python wheels from PyPI and Pyodide's own packages). Installed packages last until the page is reloaded.

## Usage with ShellTool

```typescript
import { ShellTool } from '@/lib/tools/ShellTool';

const shell = new ShellTool(fs, '/projects/my-project', git, corsProxy);
const result = await shell.execute({ command: 'grep -rl useState src | xargs wc -l' });
```

The working directory carries over between `execute` calls; shell variables and functions don't.

## Adding New Commands

Prefer just-bash's built-ins. For something only Shakespeare can provide:

1. Create a file in this directory implementing `ShellCommand`
2. Export it from `index.ts`
3. Add it to the `custom` list in `ShellTool`'s constructor
