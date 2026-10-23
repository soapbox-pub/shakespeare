import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git grep', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q');
    await sh.ok("printf 'one\\ntwo\\nthree\\nfour foo\\nfive\\nsix\\nseven\\neight\\nnine Foo\\nten\\n' > a.txt");
    await sh.ok("mkdir src; printf 'foo bar\\nbaz\\n' > src/x.ts; printf 'b\\0inary foo' > bin.dat");
    await sh.ok('git add -A && git commit -qm first');
    await sh.ok('echo "eleven foo" >> a.txt && git commit -qam second');
    await sh.ok('echo "untracked foo" > u.txt; echo "wip foo" >> src/x.ts');
  });

  afterEach(() => sh.dispose());

  it('searches tracked files in the working tree', async () => {
    expect(await sh.run('git grep foo')).toBe([
      'a.txt:four foo',
      'a.txt:eleven foo',
      'Binary file bin.dat matches',
      'src/x.ts:foo bar',
      'src/x.ts:wip foo',
      '',
    ].join('\n'));
  });

  it('shows line numbers and context with separators', async () => {
    expect(await sh.run('git grep -n -C1 foo')).toBe([
      'a.txt-3-three',
      'a.txt:4:four foo',
      'a.txt-5-five',
      '--',
      'a.txt-10-ten',
      'a.txt:11:eleven foo',
      'Binary file bin.dat matches',
      '--',
      'src/x.ts:1:foo bar',
      'src/x.ts-2-baz',
      'src/x.ts:3:wip foo',
      '',
    ].join('\n'));
    expect(await sh.run('git grep -n -A1 -e four -e nine')).toBe('a.txt:4:four foo\na.txt-5-five\n--\na.txt:9:nine Foo\na.txt-10-ten\n');
  });

  it('lists and counts', async () => {
    expect(await sh.run('git grep -l foo')).toBe('a.txt\nbin.dat\nsrc/x.ts\n');
    expect(await sh.run('git grep -c foo')).toBe('a.txt:2\nbin.dat:1\nsrc/x.ts:2\n');
    expect(await sh.run('git grep -v -c o')).toBe('a.txt:6\nsrc/x.ts:1\n');
    expect(await sh.run('git grep -L zzz')).toBe('a.txt\nbin.dat\nsrc/x.ts\n');
    expect(await sh.run('git grep -L foo')).toBe('Exit code: 1');
  });

  it('searches the index and revisions', async () => {
    expect(await sh.run('git grep --cached foo')).not.toContain('wip foo');
    expect(await sh.run('git grep foo HEAD~1')).toBe('HEAD~1:a.txt:four foo\nBinary file HEAD~1:bin.dat matches\nHEAD~1:src/x.ts:foo bar\n');
    expect(await sh.run('git grep -n foo HEAD:src')).toBe('HEAD:src:x.ts:1:foo bar\n');
    expect(await sh.run('git grep -n -B1 eleven HEAD a.txt')).toBe('HEAD:a.txt-10-ten\nHEAD:a.txt:11:eleven foo\n');
  });

  it('supports matching options', async () => {
    expect(await sh.run('git grep -o -i fo. a.txt')).toBe('a.txt:fou\na.txt:foo\na.txt:Foo\na.txt:foo\n');
    expect(await sh.run('git grep -w fo')).toBe('Exit code: 1');
    expect(await sh.run('git grep -h -I foo')).toBe('four foo\neleven foo\nfoo bar\nwip foo\n');
    expect(await sh.run("git grep 'f\\(o\\)\\+' a.txt")).toBe('a.txt:four foo\na.txt:eleven foo\n');
    expect(await sh.run("git grep -E 'f(o)+$' a.txt")).toBe('a.txt:four foo\na.txt:eleven foo\n');
    expect(await sh.run("git grep -F 'o.' a.txt")).toBe('Exit code: 1');
    expect(await sh.run("git grep -c '[[:upper:]]oo' a.txt")).toBe('a.txt:1\n');
  });

  it('limits by pathspec and includes untracked files on request', async () => {
    expect(await sh.run("git grep foo -- '*.ts'")).toBe('src/x.ts:foo bar\nsrc/x.ts:wip foo\n');
    expect(await sh.run('git grep -n foo -- src')).toBe('src/x.ts:1:foo bar\nsrc/x.ts:3:wip foo\n');
    expect(await sh.run('git grep foo')).not.toContain('u.txt');
    expect(await sh.run('git grep --untracked foo')).toContain('u.txt:untracked foo');
  });

  it('exits like git', async () => {
    expect(await sh.run('git grep -q foo; echo $?')).toBe('0\n');
    expect(await sh.run('git grep zzz')).toBe('Exit code: 1');
    expect(await sh.run('git grep')).toBe('fatal: no pattern given\nExit code: 128');
    expect(await sh.run('git grep foo nosuch')).toContain("fatal: ambiguous argument 'nosuch'");
  });
});
