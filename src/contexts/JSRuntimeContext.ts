import { createContext } from 'react';
import type { JSRuntime } from '@/lib/JSRuntime';

export interface JSRuntimeContextType {
  runtime: JSRuntime;
}

export const JSRuntimeContext = createContext<JSRuntimeContextType | undefined>(undefined);