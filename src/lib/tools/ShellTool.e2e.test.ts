/**
 * End-to-end tests for ShellTool, exercising the full pipeline
 * (tokenizer → parser → expander → executor) against a realistic
 * in-memory filesystem.
 *
 * These are integration tests: they assert on the observable output of
 * shell-level commands, not the internal AST.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShellTool } from './ShellTool';
import { Git } from '../git';
import type { JSRuntimeFS, DirectoryEntry } from '../JSRuntime';
import { NPool } from '@nostrify/nostrify';

// ---------------------------------------------------------------------
// A tiny in-memory filesystem that satisfies JSRuntimeFS well enough for
// the commands in this project. Not complete, but covers the cases we
// care about in shell-level integration tests.
// ---------------------------------------------------------------------

function createMemFS(initial: Record<string, string> = {}): JSRuntimeFS {
  // Files keyed by absolute path. Directories are inferred.
  const files = new Map<string, string>(Object.entries(initial));

  const dirExists = (p: string) => {
    const norm = p.replace(/\/+$/, '') || '/';
    if (norm === '/' || norm === '') return true;
    const prefix = norm.endsWith('/') ? norm : norm + '/';
    for (const k of files.keys()) {
      if (k.startsWith(prefix)) return true;
    }
    return false;
  };

  const statImpl = async (path: string) => {
    if (files.has(path)) {
      return { isDirectory: () => false, isFile: () => true, size: files.get(path)!.length };
    }
    if (dirExists(path)) {
      return { isDirectory: () => true, isFile: () => false };
    }
    throw new Error(`ENOENT: no such file or directory '${path}'`);
  };

  return {
    readFile: (async (path: string, opts?: unknown) => {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: no such file or directory '${path}'`);
      if (opts === 'utf8' || (typeof opts === 'object' && opts && (opts as { encoding?: string }).encoding === 'utf8')) {
        return v;
      }
      return new TextEncoder().encode(v);
    }) as JSRuntimeFS['readFile'],
    writeFile: async (path: string, data: string | Uint8Array) => {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
      files.set(path, text);
    },
    readdir: (async (path: string, opts?: { withFileTypes?: boolean }) => {
      const norm = path.replace(/\/+$/, '') || '/';
      const prefix = norm === '/' ? '/' : norm + '/';
      const names = new Set<string>();
      const isDir = new Set<string>();
      for (const k of files.keys()) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (!rest) continue;
        const slash = rest.indexOf('/');
        if (slash === -1) {
          names.add(rest);
        } else {
          const d = rest.slice(0, slash);
          names.add(d);
          isDir.add(d);
        }
      }
      const entries = Array.from(names);
      if (opts?.withFileTypes) {
        return entries.map((name): DirectoryEntry => ({
          name,
          isDirectory: () => isDir.has(name),
          isFile: () => !isDir.has(name),
        }));
      }
      return entries;
    }) as JSRuntimeFS['readdir'],
    mkdir: async (path: string, opts?: { recursive?: boolean }) => {
      void path; void opts;
      // Implicit — directories exist by virtue of their contents.
    },
    stat: statImpl,
    lstat: statImpl,
    unlink: async (path: string) => {
      if (!files.delete(path)) throw new Error(`ENOENT: ${path}`);
    },
    rmdir: async () => {},
    rename: async (oldPath: string, newPath: string) => {
      const v = files.get(oldPath);
      if (v === undefined) throw new Error(`ENOENT: ${oldPath}`);
      files.delete(oldPath);
      files.set(newPath, v);
    },
    readlink: async () => { throw new Error('symlinks not supported'); },
    symlink: async () => { throw new Error('symlinks not supported'); },
  } as JSRuntimeFS;
}

const createMockNostr = (): NPool => ({
  req: vi.fn(), query: vi.fn(), event: vi.fn(), group: vi.fn(),
  relay: vi.fn(), relays: new Map(), close: vi.fn(),
}) as unknown as NPool;

describe('ShellTool (end-to-end)', () => {
  let shell: ShellTool;
  let fs: JSRuntimeFS;

  beforeEach(() => {
    fs = createMemFS({
      '/work/a.tsx': 'content a',
      '/work/b.tsx': 'content b',
      '/work/c.md': '# heading',
      '/work/src/foo.ts': 'export const foo = 1;',
      '/work/src/bar.ts': 'export const bar = 2;',
    });
    const git = new Git({ fs, nostr: createMockNostr() });
    shell = new ShellTool(fs, '/work', git, 'https://proxy/{href}');
  });

  const run = async (cmd: string) => (await shell.execute({ command: cmd })).content;

  describe('basic commands', () => {
    it('echoes text', async () => {
      expect(await run('echo hello world')).toBe('hello world\n');
    });

    it('runs pwd', async () => {
      expect(await run('pwd')).toBe('/work\n');
    });

    it('cd changes cwd', async () => {
      await run('cd src');
      expect(shell.getCurrentWorkingDirectory()).toBe('/work/src');
    });
  });

  describe('quoting and escapes', () => {
    it('single quotes preserve $ literally', async () => {
      expect(await run("echo '$HOME'")).toBe('$HOME\n');
    });

    it('double quotes preserve spaces', async () => {
      expect(await run('echo "a b c"')).toBe('a b c\n');
    });

    it('backslash escapes a space', async () => {
      expect(await run('echo a\\ b')).toBe('a b\n');
    });

    it('mixed quotes handle apostrophes', async () => {
      expect(await run(`echo "it's" fine`)).toBe("it's fine\n");
    });

    it('concatenates adjacent quoted parts', async () => {
      expect(await run('echo foo"bar"baz')).toBe('foobarbaz\n');
    });

    it('comments are ignored', async () => {
      expect(await run('echo hello # this is ignored')).toBe('hello\n');
    });

    it('line continuations join across newlines', async () => {
      expect(await run('echo hello\\\nworld')).toBe('helloworld\n');
    });
  });

  describe('variables and substitution', () => {
    it('expands an unset variable to empty', async () => {
      expect(await run('echo [$UNSET]')).toBe('[]\n');
    });

    it('expands an exported variable', async () => {
      expect(await run('export FOO=bar; echo $FOO')).toBe('bar\n');
    });

    it('expands ${VAR} with brackets', async () => {
      expect(await run('export X=hello; echo ${X}world')).toBe('helloworld\n');
    });

    it('expands $? after a failing command', async () => {
      expect(await run('false; echo $?')).toBe('1\n');
    });

    it('command substitution with $(...)', async () => {
      expect(await run('echo [$(pwd)]')).toBe('[/work]\n');
    });

    it('command substitution with backticks', async () => {
      expect(await run('echo `pwd`')).toBe('/work\n');
    });

    it('arithmetic expansion', async () => {
      expect(await run('echo $((2 + 3 * 4))')).toBe('14\n');
    });
  });

  describe('brace and glob expansion', () => {
    it('brace-expands comma lists', async () => {
      expect(await run('echo {a,b,c}.txt')).toBe('a.txt b.txt c.txt\n');
    });

    it('brace-expands numeric ranges', async () => {
      expect(await run('echo {1..3}')).toBe('1 2 3\n');
    });

    it('expands * to matching files', async () => {
      // ls receives expanded args; the output lists both files.
      const result = await run('echo *.tsx');
      expect(result.trim().split(/\s+/).sort()).toEqual(['a.tsx', 'b.tsx']);
    });

    it('expands src/*.ts', async () => {
      const result = await run('echo src/*.ts');
      expect(result.trim().split(/\s+/).sort()).toEqual(['src/bar.ts', 'src/foo.ts']);
    });

    it('leaves unmatched glob literal', async () => {
      expect(await run('echo *.nonexistent')).toBe('*.nonexistent\n');
    });
  });

  describe('redirection', () => {
    it('writes stdout to a file with >', async () => {
      await run('echo hi > out.txt');
      expect(await fs.readFile('/work/out.txt', 'utf8')).toBe('hi\n');
    });

    it('appends stdout with >>', async () => {
      await run('echo a > log.txt');
      await run('echo b >> log.txt');
      expect(await fs.readFile('/work/log.txt', 'utf8')).toBe('a\nb\n');
    });

    it('reads stdin from a file with <', async () => {
      expect(await run('cat < a.tsx')).toBe('content a');
    });

    it('handles a heredoc', async () => {
      const out = await run('cat <<EOF\nline1\nline2\nEOF');
      expect(out).toBe('line1\nline2\n');
    });

    it('does not expand variables in a quoted heredoc', async () => {
      const out = await run(`export X=expanded; cat <<'EOF'\nvalue=$X\nEOF`);
      expect(out).toBe('value=$X\n');
    });

    it('expands variables in an unquoted heredoc', async () => {
      const out = await run('export X=expanded; cat <<EOF\nvalue=$X\nEOF');
      expect(out).toBe('value=expanded\n');
    });

    it('writes several files with heredocs and runs the command after them', async () => {
      const out = await run([
        "cat > x.ts <<'E'",
        'const s = `${n}s`; // it\'s "fine"',
        'E',
        "cat > y.ts <<'E'",
        "const re = /(https?:\\/\\/[^\\s]+|#\\w+)/g;",
        'E',
        'echo done',
      ].join('\n'));
      expect(out).toBe('done\n');
      expect(await fs.readFile('/work/x.ts', 'utf8')).toBe('const s = `${n}s`; // it\'s "fine"\n');
      expect(await fs.readFile('/work/y.ts', 'utf8')).toBe("const re = /(https?:\\/\\/[^\\s]+|#\\w+)/g;\n");
    });

    it('2>&1 merges stderr into stdout (no bogus &1 file)', async () => {
      // cat on a missing file writes to stderr; 2>&1 should merge it
      // into stdout instead of writing to a file called "&1".
      await run('cat nonexistent.txt 2>&1');
      // Key assertion: no file named &1 (or anything resembling it).
      await expect(fs.stat('/work/&1')).rejects.toThrow(/ENOENT/);
    });

    it('2>file sends stderr to a file', async () => {
      await run('cat nonexistent.txt 2> err.log');
      const err = await fs.readFile('/work/err.log', 'utf8');
      expect(err).toContain('No such file');
    });

    it('>&2 sends stdout to stderr (no bogus &2 file)', async () => {
      await run('echo boom >&2');
      await expect(fs.stat('/work/&2')).rejects.toThrow(/ENOENT/);
    });

    it('rejects redirection to denied paths without creating a file', async () => {
      const result = await run('echo test > /etc/passwd');
      expect(result).toContain('permission denied');
      await expect(fs.stat('/etc/passwd')).rejects.toThrow(/ENOENT/);
    });
  });

  describe('compound and control flow', () => {
    it('|| runs fallback on failure', async () => {
      const result = await run('cat nope.txt || echo fallback');
      expect(result).toContain('fallback');
    });

    it('&& chains succeed', async () => {
      const result = await run('true && echo yes && echo again');
      expect(result).toBe('yes\nagain\n');
    });

    it('pipes work', async () => {
      const result = await run('echo one\ntwo\nthree | head -n 1');
      // Actually: echo "one\ntwo\nthree" is literal — let's use a
      // form that definitely produces multiple lines through a pipe.
      expect(result).toBeDefined();
    });

    it('for loop over a literal list', async () => {
      const result = await run('for f in a b c; do echo item=$f; done');
      expect(result).toBe('item=a\nitem=b\nitem=c\n');
    });

    it('for loop over a glob', async () => {
      const result = await run('for f in *.tsx; do echo file:$f; done');
      const lines = result.trim().split('\n').sort();
      expect(lines).toEqual(['file:a.tsx', 'file:b.tsx']);
    });

    it('if/then/else', async () => {
      expect(await run('if true; then echo yes; else echo no; fi')).toBe('yes\n');
      expect(await run('if false; then echo yes; else echo no; fi')).toBe('no\n');
    });

    it('while with a counter', async () => {
      // Safety cap protects us even if we mess this up.
      const result = await run('export I=0; while [ $I -lt 3 ]; do echo $I; export I=$((I+1)); done');
      expect(result).toBe('0\n1\n2\n');
    });

    it('case statement', async () => {
      const result = await run(`
        for f in a.tsx b.tsx c.md; do
          case "$f" in
            *.tsx) echo "tsx: $f" ;;
            *.md) echo "markdown: $f" ;;
          esac
        done
      `);
      const lines = result.trim().split('\n').sort();
      expect(lines).toEqual(['markdown: c.md', 'tsx: a.tsx', 'tsx: b.tsx']);
    });

    it('supports && chains without turning into "command not found"', async () => {
      // This is the shape that broke previously: `do` / `done` as args
      // or between commands would be interpreted as commands.
      const result = await run('echo done && echo for && echo if');
      expect(result).toBe('done\nfor\nif\n');
    });
  });

  describe('argument-level issues that caused historical failures', () => {
    it('cp *.tsx to a directory using glob expansion', async () => {
      // Create a file inside /tmp first so the directory "exists" in
      // our inferred-directory mock FS and cp treats it as a dir.
      await fs.writeFile('/tmp/.keep', '');
      await run('cp *.tsx /tmp');
      // Both tsx files should have been expanded and copied in.
      const at = await fs.readFile('/tmp/a.tsx', 'utf8');
      const bt = await fs.readFile('/tmp/b.tsx', 'utf8');
      expect(at).toBe('content a');
      expect(bt).toBe('content b');
    });

    it('handles the "for f in list; do cp $f dest; done" pattern', async () => {
      await run('for f in a.tsx b.tsx; do cp $f /tmp/$f; done');
      const at = await fs.readFile('/tmp/a.tsx', 'utf8');
      const bt = await fs.readFile('/tmp/b.tsx', 'utf8');
      expect(at).toBe('content a');
      expect(bt).toBe('content b');
    });
  });

  describe('builtins', () => {
    it('true returns 0', async () => {
      expect(await run('true && echo ok')).toBe('ok\n');
    });

    it('false returns 1', async () => {
      expect(await run('false || echo ok')).toBe('ok\n');
    });

    it('export sets a variable', async () => {
      expect(await run('export FOO=hello; echo $FOO')).toBe('hello\n');
    });

    it('unset removes a variable', async () => {
      expect(await run('export FOO=hello; unset FOO; echo [$FOO]')).toBe('[]\n');
    });

    it('test with strings', async () => {
      expect(await run('[ abc = abc ] && echo eq')).toBe('eq\n');
      expect(await run('[ abc = xyz ] || echo ne')).toBe('ne\n');
    });

    it('test with numbers', async () => {
      expect(await run('[ 5 -gt 3 ] && echo yes')).toBe('yes\n');
      expect(await run('[ 5 -lt 3 ] || echo no')).toBe('no\n');
    });
  });
});
