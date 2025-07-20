import { ReactNode } from 'react';
import { JSRuntimeContext, type JSRuntimeContextType } from '@/contexts/JSRuntimeContext';
import type { JSRuntime } from '@/lib/JSRuntime';

interface JSRuntimeProviderProps {
  children: ReactNode;
  runtime: JSRuntime;
}

export function JSRuntimeProvider({ children, runtime }: JSRuntimeProviderProps) {
  const contextValue: JSRuntimeContextType = { runtime };

  return (
    <JSRuntimeContext.Provider value={contextValue}>
      {children}
    </JSRuntimeContext.Provider>
  );
}