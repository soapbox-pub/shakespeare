import type { DeployProgress, DeployResult } from './types';

/**
 * A project's deploy, as far as it has got.
 *
 * Kept outside React so a deploy outlives whatever started it: closing the
 * deploy popover, or leaving the project, does not stop an upload.
 */
export type DeployJob =
  | { status: 'running'; providerId: string; progress?: DeployProgress }
  | { status: 'succeeded'; providerId: string; result: DeployResult }
  | { status: 'failed'; providerId: string; error: string };

interface Entry {
  job: DeployJob;
  controller?: AbortController;
}

/** What a deploy task is handed to report through and to stop on. */
export interface DeployTaskContext {
  signal: AbortSignal;
  onProgress: (progress: DeployProgress) => void;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const watchers = new Map<string, number>();

function set(projectId: string, entry: Entry | undefined): void {
  if (entry) entries.set(projectId, entry);
  else entries.delete(projectId);
  for (const listener of listeners) listener();
}

export function getDeployJob(projectId: string): DeployJob | undefined {
  return entries.get(projectId)?.job;
}

export function subscribeDeployJobs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Run a deploy for a project, replacing whatever finished one it had.
 *
 * Resolves with the job it ended as, or `undefined` when it was cancelled.
 * Never rejects: a failure is a state of the job, not an exception.
 */
export async function runDeploy(
  projectId: string,
  providerId: string,
  task: (context: DeployTaskContext) => Promise<DeployResult>,
): Promise<DeployJob | undefined> {
  const controller = new AbortController();
  const entry: Entry = { job: { status: 'running', providerId }, controller };
  set(projectId, entry);

  // Cancelling removes the entry, so anything arriving after is for nobody.
  const current = () => entries.get(projectId) === entry;

  const onProgress = (progress: DeployProgress) => {
    if (!current() || entry.job.status !== 'running') return;
    // Later stages say what they are doing without a measure of their own,
    // so the upload figures stay up rather than the bar vanishing.
    entry.job = { ...entry.job, progress: { ...entry.job.progress, ...progress } };
    set(projectId, entry);
  };

  let job: DeployJob;
  try {
    const result = await task({ signal: controller.signal, onProgress });
    job = { status: 'succeeded', providerId, result };
  } catch (err) {
    job = { status: 'failed', providerId, error: err instanceof Error ? err.message : 'Deployment failed' };
  }

  if (!current()) return undefined;
  set(projectId, { job });
  return job;
}

/** Stop a running deploy and forget it. */
export function cancelDeploy(projectId: string): void {
  const entry = entries.get(projectId);
  if (entry?.job.status !== 'running') return;
  entry.controller?.abort();
  set(projectId, undefined);
}

/** Forget a finished deploy. A running one is left alone. */
export function clearDeployJob(projectId: string): void {
  if (entries.get(projectId)?.job.status === 'running') return;
  if (entries.has(projectId)) set(projectId, undefined);
}

/**
 * Mark a project's deploy as being looked at, for as long as the returned
 * function goes uncalled. A deploy that finishes unwatched is worth a toast;
 * one that finishes in front of someone is not.
 */
export function watchDeploy(projectId: string): () => void {
  watchers.set(projectId, (watchers.get(projectId) ?? 0) + 1);
  return () => {
    const count = (watchers.get(projectId) ?? 1) - 1;
    if (count > 0) watchers.set(projectId, count);
    else watchers.delete(projectId);
  };
}

export function isDeployWatched(projectId: string): boolean {
  return (watchers.get(projectId) ?? 0) > 0;
}
