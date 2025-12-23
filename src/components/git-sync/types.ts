import type { GitCredential } from '@/contexts/GitSettingsContext';
import type { ReactNode } from 'react';

export interface ProviderOption {
  id: string;
  name: string;
  icon: ReactNode;
  credential?: GitCredential;
}

export type StepType =
  | 'select-provider'
  | 'configure-repo'
  | 'sync'
  | 'init-success';

export interface StepProps {
  projectId: string;
  onChangeStep: (step: StepType) => void;
  onClose: () => void;
}

export interface SelectProviderStepProps extends StepProps {
  onSelectProvider: (provider: ProviderOption) => void;
}

export interface ConfigureRepoStepProps extends StepProps {
  selectedProvider: ProviderOption;
  onBack: () => void;
  onSuccess: () => void;
}

export interface SyncStepProps extends StepProps {
  onRefetchStatus: () => void;
}
