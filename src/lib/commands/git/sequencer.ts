import type { JSRuntimeFS } from '../../JSRuntime';

/**
 * State files git leaves in `.git` while a cherry-pick, revert, or merge
 * stops on conflicts. `git commit` reads MERGE_MSG and clears them all.
 */
const STATE_FILES = ['MERGE_MSG', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'MERGE_HEAD', 'MERGE_MODE'];

export type SequencerOperation = 'cherry-pick' | 'revert';

const HEAD_FILE: Record<SequencerOperation, string> = {
  'cherry-pick': 'CHERRY_PICK_HEAD',
  revert: 'REVERT_HEAD',
};

export async function readMergeMessage(fs: JSRuntimeFS, dir: string): Promise<string | undefined> {
  try {
    return await fs.readFile(`${dir}/.git/MERGE_MSG`, 'utf8');
  } catch {
    return undefined;
  }
}

/** Record a stopped operation so `--continue`, `--abort` and `git commit` can finish it. */
export async function saveSequencerState(fs: JSRuntimeFS, dir: string, operation: SequencerOperation, oid: string, message: string): Promise<void> {
  await fs.writeFile(`${dir}/.git/${HEAD_FILE[operation]}`, `${oid}\n`);
  await fs.writeFile(`${dir}/.git/MERGE_MSG`, message);
}

/** The commit a stopped operation was applying, if one is in progress. */
export async function readSequencerHead(fs: JSRuntimeFS, dir: string, operation: SequencerOperation): Promise<string | undefined> {
  try {
    return (await fs.readFile(`${dir}/.git/${HEAD_FILE[operation]}`, 'utf8')).trim();
  } catch {
    return undefined;
  }
}

/** The commit being merged when a merge stopped on conflicts. */
export async function readMergeHead(fs: JSRuntimeFS, dir: string): Promise<string | undefined> {
  try {
    return (await fs.readFile(`${dir}/.git/MERGE_HEAD`, 'utf8')).trim().split('\n')[0] || undefined;
  } catch {
    return undefined;
  }
}

export async function clearSequencerState(fs: JSRuntimeFS, dir: string): Promise<void> {
  for (const name of STATE_FILES) {
    try {
      await fs.unlink(`${dir}/.git/${name}`);
    } catch {
      // Not there.
    }
  }
}
