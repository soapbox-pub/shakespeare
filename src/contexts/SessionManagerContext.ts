import { createContext } from 'react';
import type { SessionManagerLike } from '@/lib/SessionManager';

export const SessionManagerContext = createContext<SessionManagerLike | null>(null);
