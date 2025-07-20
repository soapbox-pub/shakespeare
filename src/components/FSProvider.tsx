import { ReactNode } from 'react';
import { FSContext, type FSContextType } from '@/contexts/FSContext';
import { JSRuntimeFS } from '@/lib/JSRuntime';

interface FSProviderProps {
  children: ReactNode;
  fs: JSRuntimeFS;
}

export function FSProvider({ children, fs }: FSProviderProps) {
  const contextValue: FSContextType = {
    fs,
  };

  return (
    <FSContext.Provider value={contextValue}>
      {children}
    </FSContext.Provider>
  );
}