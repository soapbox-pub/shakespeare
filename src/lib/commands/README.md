# Shell Commands

This directory contains pure TypeScript implementations of basic shell commands that can be executed through the `ShellTool`.

## Architecture

### ShellCommand Interface

All commands implement the `ShellCommand` interface which defines:

- `name`: The command name (e.g., 'cat', 'ls', 'cd')
- `description`: Brief description of what the command does
- `usage`: Usage syntax for the command
- `execute(args, cwd)`: Executes the command and returns a `ShellCommandResult`

### ShellCommandResult

Commands return a `ShellCommandResult` object containing:

- `exitCode`: 0 for success, non-zero for error
- `stdout`: Standard output content
- `stderr`: Standard error content
- `newCwd`: Optional new working directory (for commands like 'cd')

## Available Commands

### cat

**Usage:** `cat [file...]`

Concatenate and display file contents. Supports multiple files which will be concatenated in order.

**Examples:**
```bash
cat file.txt                    # Display single file
cat file1.txt file2.txt        # Concatenate multiple files
```

**Features:**
- Reads and displays file contents
- Supports multiple files (concatenated output)
- Proper error handling for missing files, directories, and permission issues
- Rejects absolute paths for security

### ls

**Usage:** `ls [-la] [file...]`

List directory contents with support for long format and hidden files.

**Options:**
- `-l`: Use long listing format (shows permissions, size, modification time)
- `-a`: Show hidden files (files starting with '.')

**Examples:**
```bash
ls                              # List current directory
ls src/                         # List specific directory
ls -l                           # Long format listing
ls -la                          # Long format with hidden files
ls file.txt                     # Show info for specific file
```

**Features:**
- Simple and long format listings
- Shows file types (directories have trailing `/`)
- Sorts directories first, then files alphabetically
- Filters hidden files by default
- Handles both files and directories as arguments

### cd

**Usage:** `cd [directory]`

Change the current working directory.

**Examples:**
```bash
cd                              # Go to project root
cd src/                         # Change to src directory
cd ..                           # Go to parent directory
cd .                            # Stay in current directory
```

**Features:**
- Changes working directory for subsequent commands
- Supports relative paths (., .., subdirectories)
- Validates target exists and is a directory
- Updates shell working directory state

### pwd

**Usage:** `pwd`

Print the current working directory path.

**Examples:**
```bash
pwd                             # Show current directory
```

**Features:**
- Simple, no-argument command
- Always shows absolute path of current directory

### echo

**Usage:** `echo [text...]`

Display text to output.

**Examples:**
```bash
echo hello world                # Output: hello world
echo "quoted text"              # Output: quoted text
echo                            # Output: (empty line)
```

**Features:**
- Joins arguments with spaces
- Adds trailing newline
- Handles special characters
- Always succeeds (exit code 0)

### rm

**Usage:** `rm [-rf] file...`

Remove files and directories.

**Options:**
- `-r`, `-R`: Remove directories recursively
- `-f`: Force removal, ignore non-existent files

**Examples:**
```bash
rm file.txt                     # Remove single file
rm file1.txt file2.txt         # Remove multiple files
rm -r directory/               # Remove directory recursively
rm -rf temp/                   # Force remove directory
```

**Features:**
- Removes files and directories
- Recursive directory removal with `-r`
- Force flag `-f` ignores missing files
- Prevents removal of `.` and `..`
- Proper error handling for permissions and missing files

### cp

**Usage:** `cp [-r] source... destination`

Copy files and directories.

**Options:**
- `-r`, `-R`: Copy directories recursively

**Examples:**
```bash
cp file.txt backup.txt          # Copy file
cp file.txt dir/                # Copy file into directory
cp -r src/ backup/              # Copy directory recursively
cp file1.txt file2.txt dest/    # Copy multiple files to directory
```

**Features:**
- Copies files and directories
- Recursive directory copying with `-r`
- Supports copying into existing directories
- Creates target directories as needed
- Handles multiple source files

### mv

**Usage:** `mv source... destination`

Move or rename files and directories.

**Examples:**
```bash
mv old.txt new.txt              # Rename file
mv file.txt dir/                # Move file into directory
mv dir1/ dir2/                  # Rename directory
mv file1.txt file2.txt dest/    # Move multiple files to directory
```

**Features:**
- Moves/renames files and directories
- Supports moving into existing directories
- Creates target directories as needed
- Handles multiple source files
- Prevents overwriting existing files

## Usage with ShellTool

Commands are executed through the `ShellTool` which handles:

- Command parsing (including quoted arguments)
- Command registration and lookup
- Working directory management
- Error formatting and output handling

```typescript
import { ShellTool } from '@/lib/tools/ShellTool';

// Create shell tool with filesystem and working directory
const shell = new ShellTool(fs, '/project/root');

// Execute commands
const result = await shell.execute({ command: 'cat package.json' });
console.log(result); // File contents or error message
```

## Testing

All commands have comprehensive test coverage. Some complex integration tests for `cp` and `mv` commands are currently skipped due to the complexity of mocking filesystem operations with multiple interdependent calls. The basic functionality and error handling is well tested.

To run tests:
```bash
npm test
```

## Adding New Commands

To add a new command:

1. Create a new file in this directory (e.g., `newcommand.ts`)
2. Implement the `ShellCommand` interface
3. Register the command in `ShellTool.ts` constructor
4. Add exports to `index.ts`
5. Write tests for the command

Example command structure:

```typescript
import type { ShellCommand, ShellCommandResult } from './ShellCommand';
import { createSuccessResult, createErrorResult } from './ShellCommand';

export class MyCommand implements ShellCommand {
  name = 'mycommand';
  description = 'Description of what the command does';
  usage = 'mycommand [options] [args]';

  constructor(private fs: JSRuntimeFS) {}

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    // Implementation here
    return createSuccessResult('output');
  }
}
```