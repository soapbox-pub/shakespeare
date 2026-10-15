import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShellTool } from './ShellTool';
import { Git } from '../git';
import { NPool } from '@nostrify/nostrify';
import { HostFS } from '@/test/HostFS';

const createMockNostr = (): NPool => ({
  req: vi.fn(),
  query: vi.fn(),
  event: vi.fn(),
  group: vi.fn(),
  relay: vi.fn(),
  relays: new Map(),
  close: vi.fn(),
}) as unknown as NPool;

describe('ShellTool', () => {
  let fs: HostFS;
  let shellTool: ShellTool;
  const testCwd = '/test/dir';
  const testCorsProxy = 'https://proxy.shakespeare.diy/?url={href}';

  const run = async (command: string) => (await shellTool.execute({ command })).content;
  const read = (path: string) => fs.readFile(path, 'utf8');

  beforeEach(async () => {
    fs = new HostFS();
    await fs.mkdirp(testCwd);
    await fs.mkdirp('/tmp');
    const git = new Git({ fs, nostr: createMockNostr() });
    shellTool = new ShellTool(fs, testCwd, git, testCorsProxy);
  });

  afterEach(() => {
    fs.dispose();
  });

  it('should have correct tool properties', () => {
    expect(shellTool.description).toContain('bash');
    expect(shellTool.description).toContain('pipes');
    expect(shellTool.description).toContain('cat');
    expect(shellTool.inputSchema).toBeDefined();
  });

  it('should return error for empty command', async () => {
    expect(await run('')).toBe('Error: Empty command');
  });

  it('should return error for whitespace-only command', async () => {
    expect(await run('   ')).toBe('Error: Empty command');
  });

  it('should return error for unknown command', async () => {
    const result = await run('unknowncommand');
    expect(result).toContain('unknowncommand: command not found');
    expect(result).toContain('Available commands:');
    expect(result).toContain('cat');
    expect(result).toContain('Exit code: 127');
  });

  it('should execute cat command successfully', async () => {
    await fs.seed({ '/test/dir/test.txt': 'Hello, World!' });
    expect(await run('cat test.txt')).toBe('Hello, World!');
  });

  it('should concatenate several files', async () => {
    await fs.seed({ '/test/dir/file1.txt': 'File 1\n', '/test/dir/file2.txt': 'File 2\n' });
    expect(await run('cat file1.txt file2.txt')).toBe('File 1\nFile 2\n');
  });

  it('should handle quoted arguments', async () => {
    await fs.seed({ '/test/dir/file with spaces.txt': 'Content' });
    expect(await run('cat "file with spaces.txt"')).toBe('Content');
  });

  it('should return current working directory', () => {
    expect(shellTool.getCurrentWorkingDirectory()).toBe(testCwd);
  });

  it('should allow setting working directory', async () => {
    await fs.mkdirp('/new/dir');
    shellTool.setCurrentWorkingDirectory('/new/dir');
    expect(shellTool.getCurrentWorkingDirectory()).toBe('/new/dir');
    expect(await run('pwd')).toBe('/new/dir\n');
  });

  it('should return available commands', () => {
    const names = shellTool.getAvailableCommands().map((cmd) => cmd.name);
    for (const name of ['ls', 'pwd', 'echo', 'rm', 'cp', 'mv', 'cat', 'grep', 'sed', 'awk', 'jq', 'git', 'tsc', 'python3']) {
      expect(names).toContain(name);
    }
    expect(names).not.toContain('sqlite3');
    expect(shellTool.getAvailableCommands().find((cmd) => cmd.name === 'git')?.description).toBeTruthy();
  });

  it('should report a missing file', async () => {
    const result = await run('cat nonexistent.txt');
    expect(result).toContain('No such file or directory');
    expect(result).toContain('Exit code: 1');
  });

  it('should execute echo command', async () => {
    expect(await run('echo hello world')).toBe('hello world\n');
  });

  it('should execute pwd command', async () => {
    expect(await run('pwd')).toBe(testCwd + '\n');
  });

  it('should keep the working directory after cd', async () => {
    await fs.mkdirp('/test/dir/subdir');
    expect(await run('cd subdir')).toBe('(no output)');
    expect(shellTool.getCurrentWorkingDirectory()).toBe('/test/dir/subdir');
    expect(await run('pwd')).toBe('/test/dir/subdir\n');
  });

  it('should not keep variables between calls', async () => {
    await run('X=1; f() { echo hi; }');
    expect(await run('echo "[$X]"; type f >/dev/null 2>&1 || echo nofunc')).toBe('[]\nnofunc\n');
  });

  describe('output redirection', () => {
    it('should redirect output to file with > operator', async () => {
      expect(await run('echo "hello world" > test.txt')).toBe('(no output)');
      expect(await read('/test/dir/test.txt')).toBe('hello world\n');
    });

    it('should append output to file with >> operator', async () => {
      await fs.seed({ '/test/dir/test.txt': 'existing content\n' });
      expect(await run('echo "new line" >> test.txt')).toBe('(no output)');
      expect(await read('/test/dir/test.txt')).toBe('existing content\nnew line\n');
    });

    it('should create new file with >> operator if file does not exist', async () => {
      await run('echo "first line" >> newfile.txt');
      expect(await read('/test/dir/newfile.txt')).toBe('first line\n');
    });

    it('should handle quoted filenames in redirection', async () => {
      await run('echo test > "file with spaces.txt"');
      expect(await read('/test/dir/file with spaces.txt')).toBe('test\n');
    });

    it('should handle absolute paths in redirection', async () => {
      await run('echo test > /tmp/absolute.txt');
      expect(await read('/tmp/absolute.txt')).toBe('test\n');
    });

    it('should create missing parent directories', async () => {
      await run('echo x > a/b/c.txt');
      expect(await read('/test/dir/a/b/c.txt')).toBe('x\n');
    });

    it('should discard output sent to /dev/null', async () => {
      expect(await run('echo hidden > /dev/null; cat nope 2>/dev/null; echo shown')).toBe('shown\n');
    });

    it('should reject redirection to denied paths', async () => {
      const result = await run('echo test > /readonly/file.txt');
      expect(result).toContain('permission denied');
      expect(result).toContain('Exit code: 1');
      await expect(fs.stat('/readonly/file.txt')).rejects.toThrow(/ENOENT/);
    });

    it('should reject commands that write to denied paths', async () => {
      const result = await run('touch /readonly.txt; mkdir /nope; echo after');
      expect(result).toContain('after');
      await expect(fs.stat('/readonly.txt')).rejects.toThrow(/ENOENT/);
      await expect(fs.stat('/nope')).rejects.toThrow(/ENOENT/);
    });

    it('should write heredocs verbatim', async () => {
      await run([
        "cat > x.ts <<'E'",
        'function f() {',
        '  return `${n}s`; // it\'s "fine"',
        '}',
        'E',
        "cat > y.ts <<'E'",
        "const re = /(https?:\\/\\/[^\\s]+|#\\w+)/g;",
        'E',
      ].join('\n'));
      expect(await read('/test/dir/x.ts')).toBe('function f() {\n  return `${n}s`; // it\'s "fine"\n}\n');
      expect(await read('/test/dir/y.ts')).toBe("const re = /(https?:\\/\\/[^\\s]+|#\\w+)/g;\n");
    });
  });

  describe('compound commands', () => {
    it('should execute commands with && operator (success case)', async () => {
      expect(await run('pwd && echo hello')).toBe(`${testCwd}\nhello\n`);
    });

    it('should execute commands with && operator (failure case)', async () => {
      const result = await run('cat nonexistent.txt && echo should not run');
      expect(result).toContain('No such file or directory');
      expect(result).not.toContain('should not run');
    });

    it('should execute commands with || operator (success case)', async () => {
      const result = await run('pwd || echo fallback');
      expect(result).toContain(testCwd);
      expect(result).not.toContain('fallback');
    });

    it('should execute commands with || operator (failure case)', async () => {
      const result = await run('cat nonexistent.txt || echo fallback');
      expect(result).toContain('No such file or directory');
      expect(result).toContain('fallback');
    });

    it('should execute commands with ; operator', async () => {
      expect(await run('echo first; echo second')).toBe('first\nsecond\n');
    });

    it('should execute commands with pipe operator', async () => {
      expect(await run('echo "hello world" | cat')).toBe('hello world\n');
    });

    it('should handle complex compound commands', async () => {
      expect(await run('printf "line1\\nline2\\nline3\\n" | head -n 2')).toBe('line1\nline2\n');
    });

    it('should parse quoted strings in compound commands', async () => {
      expect(await run('echo "hello && world" && echo success')).toBe('hello && world\nsuccess\n');
    });
  });

  describe('bash language', () => {
    it('should assign command substitution results', async () => {
      expect(await run('X=$(echo hi); echo "$X"')).toBe('hi\n');
    });

    it('should handle nested quotes in command substitution', async () => {
      expect(await run('echo "$(echo "inner $(echo deep)")"')).toBe('inner deep\n');
    });

    it('should test files', async () => {
      await fs.seed({ '/test/dir/a.txt': 'A' });
      expect(await run('[ -f a.txt ] && echo f; [ -d . ] && echo d; [ -e nope ] || echo missing')).toBe('f\nd\nmissing\n');
    });

    it('should support [[ ]], functions, locals and arrays', async () => {
      expect(await run('f() { local x=$1; echo "hi $x"; }; f there; a=(1 2 3); echo ${a[1]} ${#a[@]}; [[ foo.ts == *.ts ]] && echo ts'))
        .toBe('hi there\n2 3\nts\n');
    });

    it('should support parameter expansion', async () => {
      expect(await run('F=a/b.tsx; echo ${UNSET:-def} ${#F} ${F%.*} ${F##*/} ${F//b/c}')).toBe('def 7 a/b b.tsx a/c.tsx\n');
    });

    it('should support loops with break, C-style for and while read', async () => {
      expect(await run('for i in 1 2 3; do [ $i = 2 ] && break; echo $i; done; for ((i=0;i<2;i++)); do echo c$i; done; printf "a\\nb\\n" | while read -r l; do echo "<$l>"; done'))
        .toBe('1\nc0\nc1\n<a>\n<b>\n');
    });

    it('should isolate subshells', async () => {
      await fs.mkdirp('/test/dir/src');
      expect(await run('(cd src && pwd); pwd; (X=inner); echo "[$X]"; (exit 3); echo after $?'))
        .toBe('/test/dir/src\n/test/dir\n[]\nafter 3\n');
    });

    it('should stop on errors with set -e', async () => {
      const result = await run('set -e; false; echo should-not-print');
      expect(result).not.toContain('should-not-print');
      expect(result).toContain('Exit code: 1');
    });

    it('should support here-strings and process substitution', async () => {
      expect(await run('cat <<< "hi there"; diff <(echo a) <(echo a) && echo same')).toBe('hi there\nsame\n');
    });

    it('should find custom commands with which and command -v', async () => {
      expect(await run('which git; command -v tsc')).toBe('/usr/bin/git\n/usr/bin/tsc\n');
    });

    it('should pass piped stdin to custom commands', async () => {
      expect(await run('printf ab | hexdump -C')).toContain('61 62');
    });
  });

  describe('glob expansion', () => {
    beforeEach(async () => {
      await fs.seed({
        '/test/dir/a.tsx': 'a',
        '/test/dir/b.tsx': 'b',
        '/test/dir/readme.md': 'r',
        '/test/dir/.hidden.tsx': 'h',
        '/test/dir/src/foo.ts': 'foo',
        '/test/dir/src/bar.ts': 'bar',
      });
    });

    it('should expand * wildcard to matching filenames', async () => {
      expect(await run('cat *.tsx')).toBe('ab');
    });

    it('should expand globs across path segments', async () => {
      expect(await run('echo src/*.ts')).toBe('src/bar.ts src/foo.ts\n');
    });

    it('should not expand quoted patterns', async () => {
      expect(await run('cat "*.tsx"')).toContain('No such file or directory');
    });

    it('should leave pattern unchanged when no files match', async () => {
      const result = await run('cat *.nothing');
      expect(result).toContain('*.nothing');
      expect(result).toContain('No such file or directory');
    });

    it('should skip hidden files unless pattern starts with dot', async () => {
      expect(await run('echo *.tsx; echo .*.tsx')).toBe('a.tsx b.tsx\n.hidden.tsx\n');
    });

    it('should not expand option flags starting with -', async () => {
      const result = await run('ls -la');
      expect(result).toContain('a.tsx');
      expect(result).not.toContain('Exit code');
    });
  });
});
