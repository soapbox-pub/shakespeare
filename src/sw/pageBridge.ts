/**
 * The service worker's line to Shakespeare's pages: delivering messages to them in order, and asking
 * one to do what only a page can.
 */
import { reviveError, type PageRequest, type SerializedError, type ToPage } from '@/lib/agent/protocol';

import { sw, type SWClient, type SWWindowClient } from './types';

/** Pages that speak the protocol, and the projects whose page-only tools each can run. */
const hosts = new Map<string, Set<string>>();

const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

/** How often a request checks that the page it's waiting on is still open. */
const WATCH_INTERVAL_MS = 3000;

export class WindowClosedError extends Error {
  constructor(message = 'This needs Shakespeare open in a window, and none is open.') {
    super(message);
    this.name = 'WindowClosedError';
  }
}

/** Note a page that speaks the protocol, and the projects whose tools it has. */
export function registerHost(clientId: string, toolProjects?: string[]): void {
  const projects = hosts.get(clientId) ?? new Set<string>();
  if (toolProjects) {
    projects.clear();
    for (const projectId of toolProjects) projects.add(projectId);
  }
  hosts.set(clientId, projects);
}

/** The open windows that speak the protocol. */
export async function hostWindows(): Promise<SWWindowClient[]> {
  const windows = await sw.clients.matchAll({ type: 'window' });
  const open = new Set(windows.map((client) => client.id));
  for (const id of hosts.keys()) {
    if (!open.has(id)) hosts.delete(id);
  }
  return windows.filter((client) => hosts.has(client.id));
}

/** Whether the user is looking at Shakespeare now. */
export async function isWindowFocused(): Promise<boolean> {
  return (await hostWindows()).some((client) => client.focused && client.visibilityState === 'visible');
}

/** The best window to ask: the one the user is in, then one on screen, then any. */
async function pickHost(projectId?: string): Promise<SWWindowClient | undefined> {
  const windows = (await hostWindows()).filter((client) => !projectId || hosts.get(client.id)?.has(projectId));
  return windows.find((client) => client.focused)
    ?? windows.find((client) => client.visibilityState === 'visible')
    ?? windows[0];
}

// Every message to pages goes through one queue, so pages get them in the order they were sent:
// a page applies events to its copy of a session, and a reply with a session in it must not
// overtake events that came before it.
let queue: Promise<void> = Promise.resolve();

/** Send a message to one page, or to every page. */
export function send(target: SWClient | 'all', message: ToPage): void {
  queue = queue.then(async () => {
    try {
      if (target === 'all') {
        for (const client of await hostWindows()) client.postMessage(message);
      } else {
        target.postMessage(message);
      }
    } catch (error) {
      console.warn('Failed to message a page:', error);
    }
  });
}

/** Ask a page to do something, and wait for its answer. */
export async function requestPage(request: PageRequest, signal?: AbortSignal): Promise<unknown> {
  signal?.throwIfAborted();
  const client = await pickHost(request.kind === 'tool' ? request.projectId : undefined);
  if (!client) {
    throw new WindowClosedError(request.kind === 'tool'
      ? `The ${request.name} tool needs Shakespeare open in a window with this project, and none is. Carry on without it, or ask the user to open the project.`
      : undefined);
  }

  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const finish = () => {
      pending.delete(id);
      clearInterval(watch);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      send(client, { type: 'agent:cancel', id });
      reject(signal?.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
    };
    // A page that closes before it answers never will.
    const watch = setInterval(async () => {
      if (!pending.has(id)) return;
      if (!(await sw.clients.get(client.id))) {
        finish();
        reject(new WindowClosedError('Shakespeare\'s window was closed before it finished.'));
      }
    }, WATCH_INTERVAL_MS);

    pending.set(id, {
      resolve: (value) => {
        finish();
        resolve(value);
      },
      reject: (error) => {
        finish();
        reject(error);
      },
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    send(client, { type: 'agent:request', id, request });
  });
}

/** A page's answer to `requestPage`. */
export function settleRequest(id: string, result: unknown, error?: SerializedError): void {
  const request = pending.get(id);
  if (!request) return;
  if (error) request.reject(reviveError(error));
  else request.resolve(result);
}
