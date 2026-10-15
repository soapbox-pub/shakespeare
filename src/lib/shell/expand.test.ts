import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenizer';
import { parse } from './parser';
import { expandWord, expandWordToString, type ShellEnv } from './expand';
import type { JSRuntimeFS } from '../JSRuntime';
import type { SimpleCommand, Word } from './ast';

function wordFrom(src: string, argIndex = 1): Word {
  const ast = parse(tokenize(src));
  const cmd = ast.commands[0] as SimpleCommand;
  return cmd.words[argIndex];
}

function makeEnv(overrides: Partial<ShellEnv> & { vars?: Record<string, string>; files?: Record<string, string[]> } = {}): ShellEnv {
  const vars = overrides.vars ?? {};
  const files = overrides.files ?? {};
  const fs = {
    readFile: async () => '',
    writeFile: async () => {},
    readdir: async (p: string) => files[p] ?? [],
    mkdir: async () => {},
    stat: async () => ({ isDirectory: () => false, isFile: () => true }),
    lstat: async () => ({ isDirectory: () => false, isFile: () => true }),
    unlink: async () => {},
    rmdir: async () => {},
    rename: async () => {},
    readlink: async () => '',
    symlink: async () => {},
  } as unknown as JSRuntimeFS;
  return {
    getVar: (n) => vars[n] ?? '',
    getCwd: () => '/work',
    getHome: () => '/home/user',
    runSubshell: async () => '',
    getFS: () => fs,
    ...overrides,
  };
}

describe('expandWord', () => {
  it('expands a plain literal', async () => {
    const w = wordFrom('echo hello');
    expect(await expandWord(w, makeEnv())).toEqual(['hello']);
  });

  it('expands a $VAR', async () => {
    const w = wordFrom('echo $HOME');
    const env = makeEnv({ vars: { HOME: '/h' } });
    expect(await expandWord(w, env)).toEqual(['/h']);
  });

  it('expands a ${VAR}', async () => {
    const w = wordFrom('echo ${USER}x');
    const env = makeEnv({ vars: { USER: 'alex' } });
    expect(await expandWord(w, env)).toEqual(['alexx']);
  });

  it('does not expand variables in single quotes', async () => {
    const w = wordFrom("echo '$HOME'");
    const env = makeEnv({ vars: { HOME: '/h' } });
    expect(await expandWord(w, env)).toEqual(['$HOME']);
  });

  it('does expand variables in double quotes', async () => {
    const w = wordFrom('echo "home: $HOME"');
    const env = makeEnv({ vars: { HOME: '/h' } });
    expect(await expandWord(w, env)).toEqual(['home: /h']);
  });

  it('splits unquoted variable values on whitespace', async () => {
    const w = wordFrom('echo $LIST');
    const env = makeEnv({ vars: { LIST: 'a b c' } });
    expect(await expandWord(w, env)).toEqual(['a', 'b', 'c']);
  });

  it('does NOT split quoted variable values', async () => {
    const w = wordFrom('echo "$LIST"');
    const env = makeEnv({ vars: { LIST: 'a b c' } });
    expect(await expandWord(w, env)).toEqual(['a b c']);
  });

  it('expands tilde to HOME', async () => {
    const w = wordFrom('echo ~/foo');
    expect(await expandWord(w, makeEnv())).toEqual(['/home/user/foo']);
  });

  it('does not expand tilde in quotes', async () => {
    const w = wordFrom('echo "~/foo"');
    expect(await expandWord(w, makeEnv())).toEqual(['~/foo']);
  });

  it('expands command substitution', async () => {
    const w = wordFrom('echo $(pwd)');
    const env = makeEnv({ runSubshell: async () => '/tmp\n' });
    expect(await expandWord(w, env)).toEqual(['/tmp']);
  });

  it('expands backticks like $(...)', async () => {
    const w = wordFrom('echo `pwd`');
    const env = makeEnv({ runSubshell: async () => '/tmp\n' });
    expect(await expandWord(w, env)).toEqual(['/tmp']);
  });

  it('expands $? via getVar', async () => {
    const w = wordFrom('echo $?');
    const env = makeEnv({ vars: { '?': '42' } });
    expect(await expandWord(w, env)).toEqual(['42']);
  });

  it('expands arithmetic', async () => {
    const w = wordFrom('echo $((1 + 2 * 3))');
    expect(await expandWord(w, makeEnv())).toEqual(['7']);
  });

  it('expands arithmetic with variables', async () => {
    const w = wordFrom('echo $((N + 1))');
    const env = makeEnv({ vars: { N: '10' } });
    expect(await expandWord(w, env)).toEqual(['11']);
  });

  it('expands brace list', async () => {
    const w = wordFrom('echo {a,b,c}.txt');
    expect(await expandWord(w, makeEnv())).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('expands numeric brace range', async () => {
    const w = wordFrom('echo {1..3}');
    expect(await expandWord(w, makeEnv())).toEqual(['1', '2', '3']);
  });

  it('expands globs against the virtual filesystem', async () => {
    const w = wordFrom('echo *.tsx');
    const env = makeEnv({ files: { '/work': ['a.tsx', 'b.tsx', 'readme.md'] } });
    const result = await expandWord(w, env);
    expect(result.sort()).toEqual(['a.tsx', 'b.tsx']);
  });

  it('leaves glob pattern literal when nothing matches', async () => {
    const w = wordFrom('echo *.xyz');
    const env = makeEnv({ files: { '/work': ['a.tsx'] } });
    expect(await expandWord(w, env)).toEqual(['*.xyz']);
  });

  it('does not glob quoted patterns', async () => {
    const w = wordFrom('echo "*.tsx"');
    const env = makeEnv({ files: { '/work': ['a.tsx', 'b.tsx'] } });
    expect(await expandWord(w, env)).toEqual(['*.tsx']);
  });

  it('expands empty unquoted variable to zero args', async () => {
    const w = wordFrom('echo $MISSING');
    expect(await expandWord(w, makeEnv())).toEqual([]);
  });

  it('preserves empty double-quoted string as an empty arg', async () => {
    const w = wordFrom('echo ""');
    expect(await expandWord(w, makeEnv())).toEqual(['']);
  });

  it('concatenates quoted+unquoted parts', async () => {
    const w = wordFrom('echo foo"bar"baz');
    expect(await expandWord(w, makeEnv())).toEqual(['foobarbaz']);
  });

  it('handles "it\'s" style mixed quoting', async () => {
    const w = wordFrom(`echo "it's" fine`);
    expect(await expandWord(w, makeEnv())).toEqual(["it's"]);
  });
});

describe('expandWordToString', () => {
  it('joins all pieces without splitting', async () => {
    const w = wordFrom('echo $LIST');
    const env = makeEnv({ vars: { LIST: 'a b c' } });
    expect(await expandWordToString(w, env)).toBe('a b c');
  });
});
