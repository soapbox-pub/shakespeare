/**
 * The parts of the service worker's global scope Shakespeare uses. The project compiles against the
 * DOM lib, which the WebWorker lib conflicts with, so these are declared here instead.
 */

export interface SWClient {
  id: string;
  type: 'window' | 'worker' | 'sharedworker';
  url: string;
  postMessage(message: unknown): void;
}

export interface SWWindowClient extends SWClient {
  focused: boolean;
  visibilityState: DocumentVisibilityState;
  focus(): Promise<SWWindowClient>;
}

export interface SWClients {
  matchAll(options?: { type?: 'window' | 'worker' | 'sharedworker' | 'all'; includeUncontrolled?: boolean }): Promise<SWWindowClient[]>;
  get(id: string): Promise<SWClient | undefined>;
  openWindow(url: string): Promise<SWWindowClient | null>;
  claim(): Promise<void>;
}

export interface SWExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

export interface SWMessageEvent extends SWExtendableEvent {
  data: unknown;
  source: SWClient | null;
}

export interface SWNotificationEvent extends SWExtendableEvent {
  notification: Notification & { close(): void };
  action: string;
}

/** Din's additions to notification options: a running task, and a progress bar. */
export interface TaskNotificationOptions extends NotificationOptions {
  ongoing?: boolean;
  progress?: number;
  renotify?: boolean;
}

export interface SWGlobalScope {
  clients: SWClients;
  registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
  addEventListener(type: 'message', listener: (event: SWMessageEvent) => void): void;
  addEventListener(type: 'notificationclick' | 'notificationclose', listener: (event: SWNotificationEvent) => void): void;
  addEventListener(type: 'install' | 'activate', listener: (event: SWExtendableEvent) => void): void;
}

export const sw = self as unknown as SWGlobalScope;
