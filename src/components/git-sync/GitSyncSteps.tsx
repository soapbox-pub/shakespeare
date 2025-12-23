import { useState, useEffect } from 'react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { SelectProviderStep } from './steps/SelectProviderStep';
import { ConfigureRepoStep } from './steps/ConfigureRepoStep';
import { SyncStep } from './steps/SyncStep';
import { InitSuccessStep } from './steps/InitSuccessStep';
import type { StepType, ProviderOption } from './types';

interface GitSyncStepsProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GitSyncSteps({ projectId, isOpen, onClose }: GitSyncStepsProps) {
  const [currentStep, setCurrentStep] = useState<StepType>('select-provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);

  const { data: gitStatus, isLoading: isGitStatusLoading, refetch: refetchGitStatus } = useGitStatus(projectId);

  // Determine if we have a remote configured
  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');
  const hasRemote = !!originRemote;

  // Reset state when popover opens/closes
  useEffect(() => {
    if (isOpen) {
      if (hasRemote) {
        setCurrentStep('sync');
      } else {
        setCurrentStep('select-provider');
      }
      setSelectedProvider(null);
    }
  }, [isOpen, hasRemote]);

  // Auto-reset success state after 2 seconds
  useEffect(() => {
    if (currentStep === 'init-success') {
      const timer = setTimeout(() => {
        setCurrentStep('sync');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handleSelectProvider = (provider: ProviderOption) => {
    setSelectedProvider(provider);
    setCurrentStep('configure-repo');
  };

  const handleBack = () => {
    setCurrentStep('select-provider');
    setSelectedProvider(null);
  };

  const handleSuccess = () => {
    setCurrentStep('init-success');
  };

  const handleRefetchStatus = async () => {
    await refetchGitStatus();
  };

  // Don't render anything while loading git status
  if (isGitStatusLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Render the appropriate step
  if (currentStep === 'select-provider') {
    return (
      <SelectProviderStep
        projectId={projectId}
        onSelectProvider={handleSelectProvider}
        onChangeStep={setCurrentStep}
        onClose={onClose}
      />
    );
  }

  if (currentStep === 'configure-repo' && selectedProvider) {
    return (
      <ConfigureRepoStep
        projectId={projectId}
        selectedProvider={selectedProvider}
        onBack={handleBack}
        onSuccess={handleSuccess}
        onChangeStep={setCurrentStep}
        onClose={onClose}
        onRefetchStatus={handleRefetchStatus}
      />
    );
  }

  if (currentStep === 'sync') {
    return (
      <SyncStep
        projectId={projectId}
        onChangeStep={setCurrentStep}
        onClose={onClose}
        onRefetchStatus={handleRefetchStatus}
      />
    );
  }

  if (currentStep === 'init-success') {
    return (
      <InitSuccessStep
        projectId={projectId}
        onChangeStep={setCurrentStep}
        onClose={onClose}
      />
    );
  }

  return null;
}
