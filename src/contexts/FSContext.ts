import { createContext } from 'react';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

export interface FSContextType {
  fs: JSRuntimeFS;
}

export const FSContext = createContext<FSContextType | undefined>(undefined);