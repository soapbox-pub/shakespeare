export interface ConsoleMessage {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp?: number;
}