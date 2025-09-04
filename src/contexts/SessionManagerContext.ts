import { createContext } from 'react';
import type { SessionManager } from '@/lib/SessionManager';

export const SessionManagerContext = createContext<SessionManager | null>(null);