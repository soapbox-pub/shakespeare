import { createContext } from 'react';
import { ProjectPreviewConsoleError } from '@/lib/tools/ReadConsoleMessagesTool';

export interface ConsoleErrorContextValue {
  hasErrors: boolean;
  consoleError: ProjectPreviewConsoleError | null;
  clearErrors: () => void;
  dismissConsoleError: () => void;
}

export const ConsoleErrorContext = createContext<ConsoleErrorContextValue | undefined>(undefined);