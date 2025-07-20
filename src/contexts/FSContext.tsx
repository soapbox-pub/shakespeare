import { createContext, useContext, type ReactNode } from 'react';
import LightningFS from '@isomorphic-git/lightning-fs';

interface FSContextType {
  fs: LightningFS.PromisifiedFS;
}

const FSContext = createContext<FSContextType | undefined>(undefined);

interface FSProviderProps {
  children: ReactNode;
  fs: LightningFS.PromisifiedFS;
}

export function FSProvider({ children, fs }: FSProviderProps) {
  return (
    <FSContext.Provider value={{ fs }}>
      {children}
    </FSContext.Provider>
  );
}

export function useFS(): FSContextType {
  const context = useContext(FSContext);
  if (context === undefined) {
    throw new Error('useFS must be used within a FSProvider');
  }
  return context;
}