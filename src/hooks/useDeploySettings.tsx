import { useContext } from 'react';
import { DeploySettingsContext } from '@/contexts/DeploySettingsContext';

export function useDeploySettings() {
  const context = useContext(DeploySettingsContext);
  if (!context) {
    throw new Error('useDeploySettings must be used within DeploySettingsProvider');
  }
  return context;
}
