import type { ConsoleMessage } from '@/contexts/ConsoleContext';

/**
 * Custom error class for project preview console errors
 */
export class ProjectPreviewConsoleError extends Error {
  public readonly logs: ConsoleMessage[];

  constructor(message: string, logs: ConsoleMessage[]) {
    super(message);
    this.name = 'ProjectPreviewConsoleError';
    this.logs = logs;
  }
}