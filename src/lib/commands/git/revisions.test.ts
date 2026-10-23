import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';
import { resolveRevision, resolveCommit, resolveTree, RevisionError } from './revisions';
import { parseArgs } from './args';

const dir = '/projects/repo';

describe('resolveRevision', () => {
  let sh: GitShell;
  let first: string;
  let second: string;
  let third: string;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && git commit -qam second');
    await sh.ok('echo c >> a.txt && git commit -qam third && git tag v1 HEAD~1');
    [third, second, first] = (await sh.ok('git log --format=%H')).trim().split('\n');
  });

  afterEach(() => sh.dispose());

  it('resolves names, full and short hashes', async () => {
    expect(await resolveRevision(sh.git, dir, 'HEAD')).toBe(third);
    expect(await resolveRevision(sh.git, dir, '@')).toBe(third);
    expect(await resolveRevision(sh.git, dir, 'main')).toBe(third);
    expect(await resolveRevision(sh.git, dir, 'refs/heads/main')).toBe(third);
    expect(await resolveRevision(sh.git, dir, first)).toBe(first);
    expect(await resolveRevision(sh.git, dir, first.slice(0, 7))).toBe(first);
    expect(await resolveRevision(sh.git, dir, first.slice(0, 4).toUpperCase())).toBe(first);
    expect(await resolveCommit(sh.git, dir, 'v1')).toBe(second);
  });

  it('follows ancestry suffixes', async () => {
    expect(await resolveRevision(sh.git, dir, 'HEAD~')).toBe(second);
    expect(await resolveRevision(sh.git, dir, 'HEAD~2')).toBe(first);
    expect(await resolveRevision(sh.git, dir, 'HEAD^')).toBe(second);
    expect(await resolveRevision(sh.git, dir, 'HEAD^^')).toBe(first);
    expect(await resolveRevision(sh.git, dir, 'main~1^1')).toBe(first);
    expect(await resolveRevision(sh.git, dir, `${third.slice(0, 7)}~2`)).toBe(first);
    expect(await resolveRevision(sh.git, dir, 'HEAD^0')).toBe(third);
    await expect(resolveRevision(sh.git, dir, 'HEAD~3')).rejects.toThrow(RevisionError);
  });

  it('resolves trees and paths', async () => {
    const tree = await resolveTree(sh.git, dir, 'HEAD');
    expect(await resolveRevision(sh.git, dir, 'HEAD^{tree}')).toBe(tree);
    expect(await resolveRevision(sh.git, dir, 'HEAD:')).toBe(tree);
    const blob = await resolveRevision(sh.git, dir, `${first.slice(0, 7)}:a.txt`);
    const { blob: bytes } = await sh.git.readBlob({ dir, oid: blob });
    expect(new TextDecoder().decode(bytes)).toBe('a\n');
    expect(await resolveRevision(sh.git, dir, 'HEAD:./src/x.ts')).toBe(await resolveRevision(sh.git, dir, 'HEAD~2:src/x.ts'));
    await expect(resolveRevision(sh.git, dir, 'HEAD:nope')).rejects.toThrow("path 'nope' does not exist in 'HEAD'");
  });

  it('resolves index paths', async () => {
    await sh.ok('echo staged > a.txt && git add a.txt');
    const oid = await resolveRevision(sh.git, dir, ':a.txt');
    const { blob } = await sh.git.readBlob({ dir, oid });
    expect(new TextDecoder().decode(blob)).toBe('staged\n');
  });

  it('rejects unknown revisions with git wording', async () => {
    await expect(resolveRevision(sh.git, dir, 'nope')).rejects.toThrow(
      "fatal: ambiguous argument 'nope': unknown revision or path not in the working tree.",
    );
  });
});

describe('parseArgs', () => {
  const spec = {
    flags: { a: 'all', q: 'quiet', all: 'all', amend: 'amend' },
    values: { m: 'message', message: 'message' },
  };

  it('splits bundled short options and attached values', () => {
    const parsed = parseArgs(['-qam', 'msg', '-mother', '--message=third', 'path'], spec);
    expect(parsed.has('quiet')).toBe(true);
    expect(parsed.has('all')).toBe(true);
    expect(parsed.getAll('message')).toEqual(['msg', 'other', 'third']);
    expect(parsed.positionals).toEqual(['path']);
  });

  it('negates flags and stops at --', () => {
    const parsed = parseArgs(['--amend', '--no-amend', '--', '-a', 'x'], spec);
    expect(parsed.has('amend')).toBe(false);
    expect(parsed.negated('amend')).toBe(true);
    expect(parsed.paths).toEqual(['-a', 'x']);
  });

  it('collects unknown options', () => {
    expect(parseArgs(['-z', '--bogus'], spec).unknown).toEqual(['-z', '--bogus']);
  });
});
