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

## Planned Commands

The following commands are planned for future implementation:

- **ls**: List directory contents
- **cd**: Change directory
- **pwd**: Print working directory
- **rm**: Remove files and directories
- **cp**: Copy files and directories
- **mv**: Move/rename files and directories

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

## Adding New Commands

To add a new command:

1. Create a new file in this directory (e.g., `ls.ts`)
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