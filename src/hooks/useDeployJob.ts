import { useCallback, useSyncExternalStore } from 'react';
import { getDeployJob, subscribeDeployJobs, type DeployJob } from '@/lib/deploy/deployJobs';

/** The project's current deploy, running or finished, if it has one. */
export function useDeployJob(projectId: string): DeployJob | undefined {
  const getSnapshot = useCallback(() => getDeployJob(projectId), [projectId]);
  return useSyncExternalStore(subscribeDeployJobs, getSnapshot);
}
