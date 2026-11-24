import type OpenAI from 'openai';
import type { NostrEvent, NostrSigner } from '@nostrify/nostrify';

import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { Tool } from '@/lib/tools/Tool';
import type {
  AIMessage,
  SessionManagerEvents,
  SessionManagerLike,
  SessionSnapshot,
  UserMessageContent,
} from '@/lib/SessionManager';
import { tsc } from '@/lib/tsc';
import { python } from '@/lib/python';

import {
  AGENT_PROTOCOL_VERSION,
  OPEN_PROJECT_EVENT,
  WORKER_AGENT_OVERRIDE_KEY,
  reviveError,
  serializeError,
  type AgentContext,
  type AgentMethod,
  type PageRequest,
  type SignMethod,
  type ToPage,
  type ToWorker,
} from './protocol';

/** How often a page with work running checks in with the worker, which also keeps it awake. */
const PING_INTERVAL_MS = 20_000;

/**
 * Ask the service worker whether the assistant should run there: it says so when Din's running
 * tasks are available to it (`'ongoing' in Notification.prototype`). Resolves to the worker's
 * instance ID if so.
 */
export async function detectWorkerAgent(timeoutMs = 1500): Promise<string | undefined> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return undefined;

  let override: string | null = null;
  try {
    override = localStorage.getItem(WORKER_AGENT_OVERRIDE_KEY);
  } catch {
    // Storage may be unavailable
  }
  if (override === 'off') return undefined;

  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    function finish(instance: string | undefined) {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(instance);
    }
    function onMessage(event: MessageEvent) {
      const data = event.data as ToPage | undefined;
      if (data?.type !== 'agent:hello') return;
      finish(data.version === AGENT_PROTOCOL_VERSION && data.available ? data.instance : undefined);
    }
    navigator.serviceWorker.addEventListener('message', onMessage);
    const hello: ToWorker = { type: 'agent:hello', version: AGENT_PROTOCOL_VERSION, force: override === 'on' };
    controller.postMessage(hello);
  });
}

interface RemoteSessionManagerOptions {
  /** The worker instance that answered `detectWorkerAgent` */
  instance: string;
  /** For `tsc` and `python3`, which run in this page's Web Workers */
  fs: JSRuntimeFS;
  getContext: () => AgentContext;
  /** The signed-in user's signer, for signing the worker can't do itself */
  getSigner: () => { pubkey: string; signer: NostrSigner } | undefined;
}

/**
 * The session manager of a page whose assistant runs in the service worker. It mirrors the worker's
 * sessions from its events, sends it the user's actions, and runs the page-only tools it asks for.
 * Closing the page leaves the worker's sessions running.
 */
export class RemoteSessionManager implements SessionManagerLike {
  private sessions = new Map<string, SessionSnapshot>();
  /** Each project's tools as this page built them, for the ones only a page can run */
  private customTools = new Map<string, Record<string, Tool<unknown>>>();
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  /** Page requests running, by request ID, to cancel when the worker says so */
  private requests = new Map<string, AbortController>();
  private listeners: Partial<Record<keyof SessionManagerEvents, Set<(...args: unknown[]) => void>>> = {};
  private instance: string;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private options: RemoteSessionManagerOptions;
  private askedToNotify = false;

  constructor(options: RemoteSessionManagerOptions) {
    this.options = options;
    this.instance = options.instance;
    navigator.serviceWorker.addEventListener('message', this.onMessage);
  }

  /** Learn the sessions the worker already has (some may have been running since before this page loaded). */
  async sync(): Promise<void> {
    const summaries = await this.call('getAllSessions', []) as SessionSnapshot[];
    const live = new Set(summaries.map((summary) => summary.projectId));
    for (const summary of summaries) {
      this.mergeSummary(summary);
      this.dispatch('sessionCreated', summary.projectId);
    }
    for (const [projectId, session] of this.sessions) {
      if (!live.has(projectId) && session.isLoading) this.markStopped(projectId);
    }
    this.updatePing();
  }

  /** Send the worker the page's latest settings, for the work it's doing now. */
  updateContext(): void {
    this.post({ type: 'agent:context', context: this.options.getContext() });
  }

  async loadSession(
    projectId: string,
    tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>,
    customTools: Record<string, Tool<unknown>>,
    maxSteps?: number,
  ): Promise<SessionSnapshot> {
    this.customTools.set(projectId, customTools);
    const snapshot = await this.call('loadSession', [projectId, tools, maxSteps]) as SessionSnapshot;
    this.sessions.set(projectId, snapshot);
    this.updatePing();
    return snapshot;
  }

  getSession(projectId: string): SessionSnapshot | undefined {
    return this.sessions.get(projectId);
  }

  getAllSessions(): SessionSnapshot[] {
    return [...this.sessions.values()];
  }

  async deleteSession(projectId: string): Promise<void> {
    await this.call('deleteSession', [projectId]);
  }

  async addMessage(projectId: string, message: AIMessage): Promise<void> {
    await this.call('addMessage', [projectId, message]);
  }

  async sendMessage(projectId: string, content: UserMessageContent, providerModel: string): Promise<void> {
    await this.askToNotify();
    await this.call('sendMessage', [projectId, content, providerModel]);
  }

  queueMessage(projectId: string, content: UserMessageContent): void {
    this.call('queueMessage', [projectId, content]).catch((error) => console.error('Failed to queue message:', error));
  }

  removeQueuedMessage(projectId: string, id: string): void {
    this.call('removeQueuedMessage', [projectId, id]).catch((error) => console.error('Failed to remove queued message:', error));
  }

  async startGeneration(projectId: string, providerModel: string): Promise<void> {
    await this.askToNotify();
    await this.call('startGeneration', [projectId, providerModel]);
  }

  /**
   * Ask, once, to show notifications, as a turn is handed to the worker. A turn's notification is
   * what keeps the worker running with the window closed, and where notifications are the site's to
   * ask for (an nsite in Tenna) the worker's is refused until the user has allowed them. Din grants
   * its apps notifications from their manifest, so there it reads `granted` and nothing is asked.
   */
  private async askToNotify(): Promise<void> {
    if (this.askedToNotify || typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    this.askedToNotify = true;
    try {
      await Notification.requestPermission();
    } catch {
      // Not answered: the turn runs without its notification, as it would have.
    }
  }

  stopGeneration(projectId: string): void {
    this.call('stopGeneration', [projectId]).catch((error) => console.error('Failed to stop generation:', error));
  }

  async startNewSession(projectId: string): Promise<void> {
    await this.call('startNewSession', [projectId]);
  }

  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(listener as (...args: unknown[]) => void);
  }

  off<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    this.listeners[event]?.delete(listener as (...args: unknown[]) => void);
  }

  /** Events raised in this page (file changes and commits by its own tools) stay in this page. */
  emit<K extends keyof SessionManagerEvents>(event: K, ...args: Parameters<SessionManagerEvents[K]>): void {
    this.dispatch(event, ...args);
  }

  /** Stop listening. The worker's sessions keep running. */
  async cleanup(): Promise<void> {
    navigator.serviceWorker.removeEventListener('message', this.onMessage);
    clearInterval(this.pingTimer);
    for (const controller of this.requests.values()) controller.abort();
    this.requests.clear();
    for (const { reject } of this.pending.values()) reject(new Error('Session manager closed'));
    this.pending.clear();
    this.listeners = {};
  }

  private dispatch(event: keyof SessionManagerEvents, ...args: unknown[]): void {
    this.listeners[event]?.forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  private post(message: ToWorker): void {
    const controller = navigator.serviceWorker.controller;
    if (!controller) throw new Error('Shakespeare\'s service worker is gone. Reload the page.');
    controller.postMessage(message);
  }

  private call(method: AgentMethod, args: unknown[]): Promise<unknown> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.post({
          type: 'agent:call',
          id,
          method,
          args,
          context: this.options.getContext(),
          toolProjects: [...this.customTools.keys()],
        });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private onMessage = (event: MessageEvent): void => {
    const data = event.data as ToPage | undefined;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('agent:')) return;

    switch (data.type) {
      case 'agent:result': {
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) pending.reject(reviveError(data.error));
        else pending.resolve(data.result);
        return;
      }
      case 'agent:event':
        this.applyEvent(data.event, data.args, data.snapshot);
        return;
      case 'agent:request':
        void this.handleRequest(data.id, data.request);
        return;
      case 'agent:cancel':
        this.requests.get(data.id)?.abort();
        this.requests.delete(data.id);
        return;
      case 'agent:pong':
        this.reconcile(data.instance, data.running);
        return;
      case 'agent:open':
        window.dispatchEvent(new CustomEvent(OPEN_PROJECT_EVENT, { detail: { projectId: data.projectId } }));
        return;
    }
  };

  /** Bring the mirror up to date with an event from the worker, then pass it on. */
  private applyEvent(event: keyof SessionManagerEvents, args: unknown[], snapshot?: SessionSnapshot): void {
    const projectId = args[0] as string;
    const session = this.sessions.get(projectId);

    switch (event) {
      case 'sessionCreated':
        if (snapshot) this.mergeSummary(snapshot);
        break;
      case 'sessionDeleted':
        this.sessions.delete(projectId);
        this.customTools.delete(projectId);
        break;
      case 'messageAdded':
        if (session) {
          session.messages.push(args[1] as AIMessage);
          if ((args[1] as AIMessage).role === 'assistant') session.streamingMessage = undefined;
        }
        break;
      case 'messagesReplaced':
        if (session) session.messages = [...args[1] as AIMessage[]];
        break;
      case 'streamingUpdate':
        if (session) {
          session.streamingMessage = {
            role: 'assistant',
            content: args[1] as string,
            reasoning_content: args[2] as string | undefined,
            tool_calls: args[3] as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined,
          };
        }
        break;
      case 'loadingChanged':
        if (session) {
          session.isLoading = args[1] as boolean;
          if (!session.isLoading) session.streamingMessage = undefined;
        }
        this.updatePing();
        break;
      case 'costUpdated':
        if (session) session.totalCost = args[1] as number;
        break;
      case 'contextUsageUpdated':
        if (session) session.lastInputTokens = args[1] as number;
        break;
      case 'finishReasonChanged':
        if (session) session.lastFinishReason = args[1] as string | null;
        break;
      case 'queueChanged':
        if (session) session.queuedMessages = args[1] as SessionSnapshot['queuedMessages'];
        break;
      case 'projectBuilt':
        // What a build in the page announces itself, for the preview
        window.dispatchEvent(new CustomEvent('buildComplete', { detail: { projectId } }));
        break;
    }

    this.dispatch(event, ...args);
  }

  /** Do what the worker asked of a page, and answer it. */
  private async handleRequest(id: string, request: PageRequest): Promise<void> {
    const controller = new AbortController();
    this.requests.set(id, controller);
    try {
      const result = await this.runRequest(request, controller.signal);
      if (this.requests.has(id)) this.post({ type: 'agent:reply', id, result });
    } catch (error) {
      if (this.requests.has(id)) this.post({ type: 'agent:reply', id, error: serializeError(error) });
    } finally {
      this.requests.delete(id);
    }
  }

  private async runRequest(request: PageRequest, signal: AbortSignal): Promise<unknown> {
    switch (request.kind) {
      case 'tool': {
        const tool = this.customTools.get(request.projectId)?.[request.name];
        if (!tool) {
          throw new Error(`The ${request.name} tool needs this project open in Shakespeare's window.`);
        }
        const args = tool.inputSchema ? tool.inputSchema.parse(request.args) : request.args;
        return await tool.execute(args, { signal });
      }
      case 'sign': {
        const current = this.options.getSigner();
        if (!current || current.pubkey !== request.pubkey) {
          throw new Error('The account the assistant signs for is not signed in to this window.');
        }
        return await sign(current.signer, request.method, request.args);
      }
      case 'tsc':
        return await tsc(this.options.fs, request.options);
      case 'python':
        return await python(this.options.fs, request.options);
    }
  }

  /**
   * Correct the mirror against what the worker says is running. A worker that was stopped (by the
   * browser, or an update) loses its sessions, so they're no longer running here either.
   */
  private reconcile(instance: string, running: string[]): void {
    const restarted = instance !== this.instance;
    this.instance = instance;
    const live = new Set(running);
    for (const [projectId, session] of this.sessions) {
      if (session.isLoading && !live.has(projectId)) this.markStopped(projectId);
    }
    if (restarted) {
      // The worker starts empty; the next action in each project loads its session again.
      void this.sync().catch((error) => console.warn('Failed to sync with the service worker:', error));
    }
    this.updatePing();
  }

  /** Take a session's state from a summary, which comes without its history (the history stays). */
  private mergeSummary(summary: SessionSnapshot): void {
    const session = this.sessions.get(summary.projectId);
    this.sessions.set(summary.projectId, { ...summary, messages: session?.messages ?? summary.messages });
  }

  private markStopped(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) return;
    session.isLoading = false;
    session.streamingMessage = undefined;
    this.dispatch('loadingChanged', projectId, false);
  }

  /** Check in with the worker while something runs, which also keeps it from being stopped as idle. */
  private updatePing(): void {
    const busy = [...this.sessions.values()].some((session) => session.isLoading);
    if (busy && !this.pingTimer) {
      this.pingTimer = setInterval(() => {
        try {
          this.post({ type: 'agent:ping' });
        } catch {
          // No worker to ping
        }
      }, PING_INTERVAL_MS);
    } else if (!busy && this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}

async function sign(signer: NostrSigner, method: SignMethod, args: unknown[]): Promise<unknown> {
  switch (method) {
    case 'signEvent':
      return await signer.signEvent(args[0] as Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>);
    case 'nip04.encrypt':
    case 'nip04.decrypt': {
      if (!signer.nip04) throw new Error('This signer does not support NIP-04 encryption');
      const [pubkey, text] = args as [string, string];
      return method === 'nip04.encrypt' ? await signer.nip04.encrypt(pubkey, text) : await signer.nip04.decrypt(pubkey, text);
    }
    case 'nip44.encrypt':
    case 'nip44.decrypt': {
      if (!signer.nip44) throw new Error('This signer does not support NIP-44 encryption');
      const [pubkey, text] = args as [string, string];
      return method === 'nip44.encrypt' ? await signer.nip44.encrypt(pubkey, text) : await signer.nip44.decrypt(pubkey, text);
    }
  }
}
