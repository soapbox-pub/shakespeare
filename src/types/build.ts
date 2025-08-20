export const BuildActionType = {
  BUILD: 'build',
  DEPLOY: 'deploy',
  AUTO_BUILD: 'auto-build',
} as const;

export type BuildActionType = keyof typeof BuildActionType;

export const BuildActionStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  RUNNING: 'running',
  PENDING: 'pending',
} as const;

export type BuildActionStatus = keyof typeof BuildActionStatus;

export interface BuildActionContent {
  type: 'build-action';
  action: BuildActionType;
  status: BuildActionStatus;
  message: string;
  timestamp: number;
}

export interface BuildActionComponentProps {
  action: BuildActionType;
  result?: string;
  status?: BuildActionStatus;
  isError?: boolean;
  isLoading?: boolean;
}

