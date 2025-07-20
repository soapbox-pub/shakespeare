import { ReactNode } from 'react';
import type LightningFS from '@isomorphic-git/lightning-fs';
import { FSContext, type FSContextType } from '@/contexts/FSContext';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';

interface FSProviderProps {
  children: ReactNode;
  fs: LightningFS.PromisifiedFS;
}

export function FSProvider({ children, fs }: FSProviderProps) {
  const contextValue: FSContextType = {
    fs: new LightningFSAdapter(fs)
  };

  return (
    <FSContext.Provider value={contextValue}>
      {children}
    </FSContext.Provider>
  );
}