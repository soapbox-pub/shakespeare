import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

const DATE = '\\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d:\\d\\d [+-]\\d{4}';

describe('git blame', () => {
  let sh: GitShell;
  let root: string;
  let second: string;
  let third: string;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q');
    await sh.ok("printf 'one\\ntwo\\nthree\\nfour\\n' > a.txt && git add a.txt");
    await sh.ok('git commit -qm first --author="Alice Smith <alice@example.com>"');
    await sh.ok('echo five >> a.txt && git commit -qam second --author="Bob <bob@example.com>"');
    await sh.ok("printf 'one\\nTWO!\\nthree\\nfour\\nfive\\n' > a.txt && git commit -qam 'third change' --author='Alice Smith <alice@example.com>'");
    [root, second, third] = await Promise.all(['HEAD~2', 'HEAD~1', 'HEAD'].map(async (rev) => (await sh.ok(`git rev-parse ${rev}`)).trim()));
  });

  afterEach(() => sh.dispose());

  it('attributes each line to the commit that last changed it', async () => {
    const lines = (await sh.ok('git blame a.txt')).trimEnd().split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(new RegExp(`^\\^${root.slice(0, 7)} \\(Alice Smith ${DATE} 1\\) one$`));
    expect(lines[1]).toMatch(new RegExp(`^${third.slice(0, 8)} \\(Alice Smith ${DATE} 2\\) TWO!$`));
    expect(lines[2]).toMatch(new RegExp(`^\\^${root.slice(0, 7)} \\(Alice Smith ${DATE} 3\\) three$`));
    expect(lines[4]).toMatch(new RegExp(`^${second.slice(0, 8)} \\(Bob {9}${DATE} 5\\) five$`));
  });

  it('blames a revision', async () => {
    const out = await sh.ok('git blame HEAD~1 -- a.txt');
    expect(out).toContain(') two\n');
    expect(out).not.toContain('TWO');
    expect(await sh.ok('git blame -s HEAD~2 a.txt')).toBe(
      [1, 2, 3, 4].map((n, i) => `^${root.slice(0, 7)} ${n}) ${['one', 'two', 'three', 'four'][i]}`).join('\n') + '\n',
    );
  });

  it('supports -L, -s, -e and -l', async () => {
    expect(await sh.ok('git blame -s -L 2,3 a.txt')).toBe(`${third.slice(0, 8)} 2) TWO!\n^${root.slice(0, 7)} 3) three\n`);
    expect(await sh.ok('git blame -s -L 4,+2 a.txt')).toBe(`^${root.slice(0, 7)} 4) four\n${second.slice(0, 8)} 5) five\n`);
    expect(await sh.ok('git blame -e -L 5 a.txt')).toMatch(new RegExp(`^${second.slice(0, 8)} \\(<bob@example.com> ${DATE} 5\\) five\n$`));
    expect(await sh.ok('git blame -l -s -L 1,1 a.txt')).toBe(`^${root.slice(0, 39)} 1) one\n`);
    expect(await sh.run('git blame -L 20,30 a.txt')).toBe('fatal: file a.txt has only 5 lines\nExit code: 128');
  });

  it('shows uncommitted changes as Not Committed Yet', async () => {
    await sh.ok('echo six >> a.txt');
    const lines = (await sh.ok('git blame a.txt')).trimEnd().split('\n');
    expect(lines[5]).toMatch(new RegExp(`^00000000 \\(Not Committed Yet ${DATE} 6\\) six$`));
    expect(lines[0]).toMatch(/^\^\w{7} \(Alice Smith {7}/);
  });

  it('prints porcelain output', async () => {
    const out = await sh.ok('git blame --porcelain -L 1,3 a.txt');
    expect(out).toContain(`${root} 1 1 1\nauthor Alice Smith\nauthor-mail <alice@example.com>\n`);
    expect(out).toContain('summary first\nboundary\nfilename a.txt\n\tone\n');
    expect(out).toContain(`${third} 2 2 1\n`);
    expect(out).toContain(`summary third change\nprevious ${second} a.txt\nfilename a.txt\n\tTWO!\n`);
    expect(out).toMatch(new RegExp(`${root} 3 3 1\n\tthree\n$`));
    expect((await sh.ok('git blame --line-porcelain -L 1,3 a.txt')).match(/^author /gm)).toHaveLength(3);
  });

  it('follows lines through a merge', async () => {
    await sh.ok('git branch side && git switch -q side');
    await sh.ok("printf 'zero\\none\\nTWO!\\nthree\\nfour\\nfive\\n' > a.txt && git commit -qam side --author='Carol <c@example.com>'");
    await sh.ok('git switch -q main && echo six >> a.txt && git commit -qam main');
    // Commit the merge directly so this test only depends on blame.
    const parents = await Promise.all(['main', 'side'].map(async (rev) => (await sh.ok(`git rev-parse ${rev}`)).trim()));
    await sh.ok("printf 'zero\\none\\nTWO!\\nthree\\nfour\\nfive\\nsix\\n' > a.txt && git add a.txt");
    await sh.git.commit({ dir: '/projects/repo', message: 'merge', author: { name: 'Dan', email: 'd@example.com' }, parent: parents });
    const out = await sh.ok('git blame a.txt');
    expect(out).toMatch(/\(Carol .* 1\) zero/);
    expect(out).toMatch(/\(Bob .* 6\) five/);
    expect(out).toMatch(/\^\w{7} \(Alice Smith .* 2\) one/);
  });

  it('fails like git', async () => {
    expect(await sh.run('git blame nosuch')).toBe("fatal: no such path 'nosuch' in HEAD\nExit code: 128");
    await sh.ok('echo new > new.txt');
    expect(await sh.run('git blame new.txt')).toBe("fatal: no such path 'new.txt' in HEAD\nExit code: 128");
  });
});
