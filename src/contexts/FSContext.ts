import { createContext } from 'react';
import type LightningFS from '@isomorphic-git/lightning-fs';

export interface FSContextType {
  fs: LightningFS.PromisifiedFS;
}

export const FSContext = createContext<FSContextType | undefined>(undefined);