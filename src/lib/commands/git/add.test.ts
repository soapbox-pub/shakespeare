import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git add', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && echo "*.log" > .gitignore && git add -A && git commit -qm first');
  });

  afterEach(() => sh.dispose());

  it('stages new, modified and removed files under a pathspec', async () => {
    await sh.ok('echo b >> a.txt && rm src/x.ts && echo y > src/y.ts && echo l > debug.log');
    expect(await sh.ok('git add -v .')).toBe("add 'a.txt'\nremove 'src/x.ts'\nadd 'src/y.ts'\n");
    expect(await sh.ok('git status -s')).toBe('M  a.txt\nD  src/x.ts\nA  src/y.ts\n');
  });

  it('-u stages only tracked files, -A everything', async () => {
    await sh.ok('echo b >> a.txt && echo n > new.txt');
    await sh.ok('git add -u');
    expect(await sh.ok('git status -s')).toBe('M  a.txt\n?? new.txt\n');
    await sh.ok('git add -A');
    expect(await sh.ok('git status -s')).toBe('M  a.txt\nA  new.txt\n');
  });

  it('--dry-run lists without staging', async () => {
    await sh.ok('echo n > new.txt');
    expect(await sh.ok('git add -n .')).toBe("add 'new.txt'\n");
    expect(await sh.ok('git status -s')).toBe('?? new.txt\n');
  });

  it('matches globs and directories', async () => {
    await sh.ok('echo y > src/y.ts && echo z > src/z.md');
    await sh.ok("git add 'src/*.ts'");
    expect(await sh.ok('git status -s')).toBe('A  src/y.ts\n?? src/z.md\n');
    await sh.ok('git add src');
    expect(await sh.ok('git status -s')).toBe('A  src/y.ts\nA  src/z.md\n');
  });

  it('refuses ignored files unless forced', async () => {
    await sh.ok('echo l > debug.log');
    expect(await sh.run('git add debug.log')).toBe(
      'The following paths are ignored by one of your .gitignore files:\ndebug.log\n' +
      'hint: Use -f if you really want to add them.\nhint: Disable this message with "git config set advice.addIgnoredFile false"\nExit code: 1',
    );
    await sh.ok('git add -f debug.log');
    expect(await sh.ok('git status -s')).toBe('A  debug.log\n');
  });

  it('reports git\'s errors and hints', async () => {
    expect(await sh.ok('git add')).toBe(
      "Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?\nhint: Disable this message with \"git config set advice.addEmptyPathspec false\"\n",
    );
    await sh.ok('echo b >> a.txt');
    expect(await sh.run('git add nope a.txt')).toBe("fatal: pathspec 'nope' did not match any files\nExit code: 128");
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n');
    expect(await sh.run('git add /etc/passwd')).toMatch(/is outside repository[\s\S]*Exit code: 128/);
    expect(await sh.run('git add -p')).toMatch(/not supported[\s\S]*Exit code: 128/);
  });

  it('accepts absolute paths inside the repository', async () => {
    await sh.ok('echo n > new.txt');
    await sh.ok('git add /projects/repo/new.txt');
    expect(await sh.ok('git status -s')).toBe('A  new.txt\n');
  });
});
