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

The shell supports 25 essential commands for file and directory operations, text processing, content analysis, and system utilities.

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
cd                              # Stay in current directory
cd src/                         # Change to src directory
cd ..                           # Go to parent directory
cd .                            # Stay in current directory
cd /projects/my-project         # Change to absolute path
```

**Features:**
- Changes working directory for subsequent commands
- Supports both relative and absolute paths
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

### head

**Usage:** `head [-n lines] [file...]`

Display the first lines of files. Shows first 10 lines by default.

**Options:**
- `-n lines`: Show specific number of lines (e.g., `-n 5` or `-n5`)

**Examples:**
```bash
head file.txt                   # Show first 10 lines
head -n 5 file.txt             # Show first 5 lines
head -n3 file1.txt file2.txt   # Show first 3 lines of multiple files
```

**Features:**
- Configurable line count with `-n` option
- Supports multiple files with headers
- Proper error handling for missing files and directories
- Rejects absolute paths for security

### tail

**Usage:** `tail [-n lines] [file...]`

Display the last lines of files. Shows last 10 lines by default.

**Options:**
- `-n lines`: Show specific number of lines (e.g., `-n 5` or `-n5`)

**Examples:**
```bash
tail file.txt                   # Show last 10 lines
tail -n 5 file.txt             # Show last 5 lines
tail -n3 file1.txt file2.txt   # Show last 3 lines of multiple files
```

**Features:**
- Configurable line count with `-n` option
- Supports multiple files with headers
- Handles files with or without trailing newlines
- Proper error handling for missing files and directories

### grep

**Usage:** `grep [-i] [-n] [-r] pattern [file...]`

Search for patterns in files using regular expressions.

**Options:**
- `-i`: Case-insensitive search
- `-n`: Show line numbers
- `-r`, `-R`: Search directories recursively

**Examples:**
```bash
grep "error" log.txt            # Search for "error" in log.txt
grep -i "hello" file.txt        # Case-insensitive search
grep -n "function" *.js         # Show line numbers
grep -r "TODO" src/             # Recursive search in directory
```

**Features:**
- Regular expression pattern matching
- Case-insensitive search option
- Line number display
- Recursive directory search
- Multiple file support with filename prefixes
- Returns exit code 1 when no matches found (standard grep behavior)

### find

**Usage:** `find [path...] [-name pattern] [-type f|d]`

Search for files and directories by name and type.

**Options:**
- `-name pattern`: Search by filename pattern (supports * and ? wildcards)
- `-type f`: Find only files
- `-type d`: Find only directories

**Examples:**
```bash
find .                          # List all files and directories
find . -name "*.js"            # Find all JavaScript files
find . -type d                 # Find only directories
find src/ -name "test*" -type f # Find files starting with "test" in src/
```

**Features:**
- Recursive directory traversal
- Glob-style pattern matching with * and ? wildcards
- File type filtering (files vs directories)
- Multiple search paths
- Case-insensitive pattern matching

### wc

**Usage:** `wc [-l] [-w] [-c] [file...]`

Count lines, words, and characters in files.

**Options:**
- `-l`: Count only lines
- `-w`: Count only words
- `-c`: Count only characters
- (no options): Show all counts (lines, words, characters)

**Examples:**
```bash
wc file.txt                     # Show lines, words, and characters
wc -l file.txt                 # Count only lines
wc -w *.txt                    # Count words in all .txt files
wc file1.txt file2.txt         # Show counts and totals for multiple files
```

**Features:**
- Line, word, and character counting
- Multiple file support with totals
- Configurable output (lines, words, characters, or all)
- Proper handling of empty files
- Formatted columnar output

### touch

**Usage:** `touch file...`

Create empty files or update timestamps.

**Examples:**
```bash
touch newfile.txt               # Create empty file
touch file1.txt file2.txt      # Create multiple files
touch existing.txt              # Update timestamp (no-op in this implementation)
```

**Features:**
- Creates empty files if they don't exist
- Handles existing files gracefully
- Multiple file support
- Validates parent directory exists
- Prevents touching directories

### mkdir

**Usage:** `mkdir [-p] directory...`

Create directories.

**Options:**
- `-p`: Create parent directories as needed

**Examples:**
```bash
mkdir newdir                    # Create single directory
mkdir dir1 dir2 dir3           # Create multiple directories
mkdir -p deep/nested/path      # Create nested directories
```

**Features:**
- Single and multiple directory creation
- Recursive directory creation with `-p` option
- Proper error handling for existing files/directories
- Validates parent directory permissions
- Prevents conflicts with existing files

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

### sort

**Usage:** `sort [-r] [-n] [-u] [file...]`

Sort lines of text files.

**Options:**
- `-r`: Sort in reverse order
- `-n`: Sort numerically instead of alphabetically
- `-u`: Remove duplicate lines (unique)

**Examples:**
```bash
sort file.txt                  # Sort lines alphabetically
sort -r file.txt               # Sort in reverse order
sort -n numbers.txt            # Sort numerically
sort -u file.txt               # Sort and remove duplicates
sort -rnu data.txt             # Combine options: reverse, numeric, unique
```

**Features:**
- Alphabetical and numerical sorting
- Reverse order sorting
- Duplicate removal
- Multiple file support
- Configurable sort behavior

### uniq

**Usage:** `uniq [-c] [-d] [-u] [file]`

Report or omit repeated consecutive lines.

**Options:**
- `-c`: Show count of each line
- `-d`: Show only duplicate lines
- `-u`: Show only unique lines (not repeated)

**Examples:**
```bash
uniq file.txt                  # Remove consecutive duplicates
uniq -c file.txt               # Show count of each line
uniq -d file.txt               # Show only duplicated lines
uniq -u file.txt               # Show only unique lines
```

**Features:**
- Removes consecutive duplicate lines
- Line counting with `-c` option
- Filter duplicates or unique lines
- Formatted output with proper spacing
- Note: Only removes consecutive duplicates (use with `sort` for all duplicates)

### cut

**Usage:** `cut -c LIST | -f LIST [-d DELIM] [file...]`

Extract sections from lines of files.

**Options:**
- `-c LIST`: Extract characters at specified positions
- `-f LIST`: Extract fields using delimiter
- `-d DELIM`: Use DELIM as field delimiter (default: tab)

**LIST format:**
- `1,3,5`: Specific positions
- `1-5`: Range of positions
- `1,3-5,7`: Combination of positions and ranges

**Examples:**
```bash
cut -c 1,3,5 file.txt          # Extract characters 1, 3, and 5
cut -c 1-10 file.txt           # Extract characters 1 through 10
cut -f 1,3 data.csv            # Extract fields 1 and 3 (tab-delimited)
cut -f 2-4 -d ',' data.csv     # Extract fields 2-4 using comma delimiter
```

**Features:**
- Character-based extraction
- Field-based extraction with custom delimiters
- Range and list specifications
- Multiple file support

### tr

**Usage:** `tr [-d] SET1 [SET2] [file...]`

Translate or delete characters.

**Options:**
- `-d`: Delete characters in SET1

**SET format:**
- `abc`: Literal characters
- `a-z`: Character ranges
- `0-9`: Numeric ranges

**Examples:**
```bash
tr 'a-z' 'A-Z' file.txt        # Convert lowercase to uppercase
tr -d 'aeiou' file.txt         # Delete all vowels
tr '0-9' 'X' file.txt          # Replace all digits with 'X'
tr 'abc' '123' file.txt        # Replace a→1, b→2, c→3
```

**Features:**
- Character translation with ranges
- Character deletion
- Multiple file support
- Range expansion (a-z, 0-9, etc.)

### diff

**Usage:** `diff [-u] file1 file2`

Compare files line by line.

**Options:**
- `-u`: Use unified diff format

**Examples:**
```bash
diff file1.txt file2.txt       # Compare files in normal format
diff -u file1.txt file2.txt    # Compare files in unified format
```

**Features:**
- Line-by-line file comparison
- Normal and unified diff formats
- Shows additions, deletions, and changes
- Exit code 0 for identical files, 1 for differences

### which

**Usage:** `which command...`

Locate commands and show their paths.

**Examples:**
```bash
which ls                       # Show path to ls command
which cat grep find            # Show paths to multiple commands
```

**Features:**
- Locates available shell commands
- Shows simulated paths (/usr/bin/command)
- Multiple command support
- Exit code 1 if any command not found

### whoami

**Usage:** `whoami`

Display current username.

**Examples:**
```bash
whoami                         # Display current user
```

**Features:**
- Simple username display
- No arguments accepted
- Always returns "user" in this implementation

### date

**Usage:** `date [+FORMAT]`

Display current date and time.

**Format specifiers:**
- `%Y`: 4-digit year
- `%y`: 2-digit year
- `%m`: Month (01-12)
- `%d`: Day of month (01-31)
- `%H`: Hour (00-23)
- `%M`: Minute (00-59)
- `%S`: Second (00-59)
- `%A`: Full weekday name
- `%a`: Abbreviated weekday name
- `%B`: Full month name
- `%b`: Abbreviated month name
- `%s`: Unix timestamp
- `%%`: Literal %

**Examples:**
```bash
date                           # Default format
date '+%Y-%m-%d'              # ISO date format
date '+%H:%M:%S'              # Time only
date '+%A, %B %d, %Y'         # Full date
date '+%s'                    # Unix timestamp
```

**Features:**
- Default and custom date formatting
- Standard format specifiers
- Unix timestamp support
- Weekday and month name formatting

### env

**Usage:** `env`

Display environment variables.

**Examples:**
```bash
env                            # Show all environment variables
```

**Features:**
- Displays simulated environment variables
- Shows common variables (HOME, PATH, USER, PWD, etc.)
- PWD reflects current working directory

### clear

**Usage:** `clear`

Clear terminal screen.

**Examples:**
```bash
clear                          # Clear screen
```

**Features:**
- Sends ANSI escape sequence to clear screen
- Moves cursor to top-left position
- No arguments accepted

## Usage with ShellTool

Commands are executed through the `ShellTool` which handles:

- Command parsing (including quoted arguments)
- Command registration and lookup
- Working directory management
- Error formatting and output handling

```typescript
import { ShellTool } from '@/lib/tools/ShellTool';

// Create shell tool with filesystem and working directory
const shell = new ShellTool(fs, '/project/root', ...rest);

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