import { memo } from 'react';
import { ActionCard } from './shared/ActionCard';

interface BuildActionProps {
  action: 'build' | 'deploy' | 'auto-build';
  result?: string;
  status?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PENDING';
  isError?: boolean;
  isLoading?: boolean;
}

export const BuildAction = memo(({ action, result, status, isError, isLoading }: BuildActionProps) => {
  const actionConfig = {
    build: { title: 'Build Project', verb: 'build' },
    deploy: { title: 'Deploy Project', verb: 'deploy' },
    'auto-build': { title: 'Auto-Build Project', verb: 'auto-build' },
  }[action] || { title: 'Build Action', verb: 'process' };

  const getActionDescription = () => {
    const effectiveStatus = status || (
      isLoading ? 'RUNNING' :
      isError ? 'FAILED' : 'SUCCESS'
    );

    if (effectiveStatus === 'RUNNING') return `${actionConfig.verb.charAt(0).toUpperCase() + actionConfig.verb.slice(1)}ing project...`;
    if (effectiveStatus === 'FAILED') return `${actionConfig.verb.charAt(0).toUpperCase() + actionConfig.verb.slice(1)} failed`;
    if (effectiveStatus === 'SUCCESS') return `${actionConfig.verb.charAt(0).toUpperCase() + actionConfig.verb.slice(1)} completed`;
    return `Starting ${actionConfig.verb} process...`;
  };

  return (
    <ActionCard
      title={actionConfig.title}
      description={getActionDescription()}
      result={result}
      status={status}
      isError={isError}
      isLoading={isLoading}
      successLabel="Completed"
    />
  );
});

BuildAction.displayName = 'BuildAction';