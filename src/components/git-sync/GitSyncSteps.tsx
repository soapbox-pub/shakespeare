import { useState, useEffect, useMemo } from 'react';
import { useGitStatus } from '@/hooks/useGitStatus';
import { SelectProviderStep } from './steps/SelectProviderStep';
import { ConfigureRepoStep } from './steps/ConfigureRepoStep';
import { SyncStep } from './steps/SyncStep';
import { InitSuccessStep } from './steps/InitSuccessStep';
import type { StepType, ProviderOption } from './types';

interface GitSyncStepsProps {
  projectId: string;
  onClose: () => void;
}

export function GitSyncSteps({ projectId, onClose }: GitSyncStepsProps) {
  const { data: gitStatus, isLoading: isGitStatusLoading } = useGitStatus(projectId);

  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');

  const remoteUrl = useMemo(() => {
    if (originRemote) {
      try {
        return new URL(originRemote.url);
      } catch {
        return;
      }
    }
  }, [originRemote]);

  const hasRemote = !!remoteUrl;

  const [currentStep, setCurrentStep] = useState<StepType>(hasRemote ? 'sync' : 'select-provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);

  // Handle a remote being added after loading
  useEffect(() => {
    if (hasRemote && currentStep === 'select-provider') {
      setCurrentStep('sync');
    } else if (!hasRemote && currentStep === 'sync') {
      setCurrentStep('select-provider');
    }
  }, [hasRemote, currentStep]);

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

  // Don't render anything while loading git status
  if (isGitStatusLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Render the appropriate step
  if (!remoteUrl || currentStep === 'select-provider') {
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
      />
    );
  }

  if (currentStep === 'sync') {
    return (
      <SyncStep
        projectId={projectId}
        remoteUrl={remoteUrl}
        onChangeStep={setCurrentStep}
        onClose={onClose}
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
