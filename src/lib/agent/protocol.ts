/**
 * Messages between Shakespeare's pages and its service worker, when the assistant runs in the worker.
 *
 * On Din (an app on `din://` or `din+file://`), a service worker can run a task with its windows
 * closed while an `ongoing` notification shows it (Din's docs/din/background.md, "Running a task").
 * There, the assistant's sessions live in the worker (`src/sw/agentHost.ts`): the AI requests, the
 * history, and every tool that needs no page. A page mirrors the sessions it shows
 * (`RemoteSessionManager`) and does what only a page can when the worker asks: tools that need the
 * DOM or the page's state, signing with a signer only the page has, and `tsc` and `python3`, which
 * run in Web Workers a service worker can't start.
 */
import { APIConnectionError, APIError, APIUserAbortError } from 'openai';
import type { NostrMetadata } from '@nostrify/nostrify';

import type { AISettings } from '@/contexts/AISettingsContext';
import type { AppConfig } from '@/contexts/AppContext';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import type { PythonOptions } from '@/lib/python';
import type { TscOptions } from '@/lib/tsc';
import type { ImageGeneration } from '@/lib/tools/workerTools';
import type { SessionManagerEvents, SessionSnapshot } from '@/lib/SessionManager';
import { nostrAuthError } from '@/lib/ai-client';
import { EmptyMessageError } from '@/lib/errors/EmptyMessageError';
import { MalformedToolCallError } from '@/lib/errors/MalformedToolCallError';

/** Bumped whenever the messages change, so a page never talks to a worker from another version. */
export const AGENT_PROTOCOL_VERSION = 2;

/** localStorage key: `on` runs the assistant in the worker even without Din's tasks (for testing), `off` never. */
export const WORKER_AGENT_OVERRIDE_KEY = 'shakespeare:workerAgent';

/** Notification tags of running tasks: this, then the project ID. */
export const TASK_TAG_PREFIX = 'shakespeare-task:';

/** Window event asking the app to show a project (from a click on its notification). */
export const OPEN_PROJECT_EVENT = 'shakespeare:open-project';

/** Everything the worker needs from the page's state, sent with every call and whenever it changes. */
export interface AgentContext {
  config: AppConfig;
  defaultConfig: AppConfig;
  settings: Pick<AISettings, 'providers' | 'imageModel' | 'reasoningEffort'>;
  /** Models with their prices as strings (Decimal doesn't survive structured cloning) */
  models: Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: string; completion: string } }>;
  /**
   * The signed-in account. The worker signs for nsec and bunker logins itself, so their work goes on
   * with the windows closed; for others (a NIP-07 signer) it asks a page.
   */
  login?: { type: string; pubkey: string; data?: unknown };
  metadata?: NostrMetadata;
  gitCredentials: GitCredential[];
  imageGeneration?: ImageGeneration;
}

/** The session manager methods a page calls in the worker. */
export type AgentMethod =
  | 'loadSession'
  | 'getAllSessions'
  | 'deleteSession'
  | 'addMessage'
  | 'sendMessage'
  | 'queueMessage'
  | 'removeQueuedMessage'
  | 'startGeneration'
  | 'stopGeneration'
  | 'startNewSession';

export type SignMethod = 'signEvent' | 'nip04.encrypt' | 'nip04.decrypt' | 'nip44.encrypt' | 'nip44.decrypt';

/** What the worker asks a page to do. */
export type PageRequest =
  | { kind: 'tool'; projectId: string; name: string; args: unknown }
  | { kind: 'sign'; pubkey: string; method: SignMethod; args: unknown[] }
  | { kind: 'tsc'; options: TscOptions }
  | { kind: 'python'; options: PythonOptions };

export interface SerializedError {
  name: string;
  message: string;
  kind: 'error' | 'api' | 'connection' | 'abort' | 'malformed' | 'empty';
  status?: number;
  body?: unknown;
  toolCallId?: string;
  providerModel?: string;
}

/** Page to worker */
export type ToWorker =
  | { type: 'agent:hello'; version: number; force?: boolean }
  | {
    type: 'agent:call';
    id: string;
    method: AgentMethod;
    args: unknown[];
    context: AgentContext;
    /** Projects whose page-only tools this page can run */
    toolProjects: string[];
  }
  | { type: 'agent:context'; context: AgentContext }
  | { type: 'agent:reply'; id: string; result?: unknown; error?: SerializedError }
  | { type: 'agent:ping' };

/** Worker to page */
export type ToPage =
  | { type: 'agent:hello'; version: number; available: boolean; instance: string }
  | { type: 'agent:result'; id: string; result?: unknown; error?: SerializedError }
  /** `snapshot` (with `sessionCreated`) is the session without its history */
  | { type: 'agent:event'; event: keyof SessionManagerEvents; args: unknown[]; snapshot?: SessionSnapshot }
  | { type: 'agent:request'; id: string; request: PageRequest }
  | { type: 'agent:cancel'; id: string }
  | { type: 'agent:pong'; instance: string; running: string[] }
  | { type: 'agent:open'; projectId: string };

export function serializeError(error: unknown): SerializedError {
  if (error instanceof MalformedToolCallError) {
    return { kind: 'malformed', name: error.name, message: error.message, toolCallId: error.toolCallId, providerModel: error.providerModel };
  }
  if (error instanceof EmptyMessageError) {
    return { kind: 'empty', name: error.name, message: error.message, providerModel: error.providerModel };
  }
  if (error instanceof APIUserAbortError || (error instanceof Error && error.name === 'AbortError')) {
    return { kind: 'abort', name: 'AbortError', message: error.message };
  }
  const authError = nostrAuthError(error);
  if (authError) {
    return { kind: 'error', name: authError.name, message: authError.message };
  }
  if (error instanceof APIConnectionError) {
    return { kind: 'connection', name: error.name, message: error.message };
  }
  if (error instanceof APIError) {
    return { kind: 'api', name: error.name, message: error.message, status: error.status, body: error.error };
  }
  if (error instanceof Error) {
    return { kind: 'error', name: error.name, message: error.message };
  }
  return { kind: 'error', name: 'Error', message: String(error) };
}

/** Rebuild an error with the class the UI recognizes (`Quilly` picks its advice by class). */
export function reviveError(error: SerializedError): Error {
  switch (error.kind) {
    case 'malformed':
      return new MalformedToolCallError(error.message, error.toolCallId ?? '', error.providerModel ?? '');
    case 'empty':
      return new EmptyMessageError(error.message, error.providerModel ?? '');
    case 'abort':
      return new APIUserAbortError({ message: error.message });
    case 'connection':
      return new APIConnectionError({ message: error.message });
    case 'api':
      return APIError.generate(
        error.status,
        (error.body ?? undefined) as object | undefined,
        error.message,
        new Headers(),
      );
    default: {
      const revived = new Error(error.message);
      revived.name = error.name;
      return revived;
    }
  }
}
