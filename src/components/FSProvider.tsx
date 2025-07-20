import { ReactNode } from 'react';
import type LightningFS from '@isomorphic-git/lightning-fs';
import { FSContext, type FSContextType } from '@/contexts/FSContext';

interface FSProviderProps {
  children: ReactNode;
  fs: LightningFS.PromisifiedFS;
}

export function FSProvider({ children, fs }: FSProviderProps) {
  const contextValue: FSContextType = { fs };

  return (
    <FSContext.Provider value={contextValue}>
      {children}
    </FSContext.Provider>
  );
}