import type OpenAI from 'openai';

import type { Tool } from '@/lib/tools/Tool';
import {
  SESSION_EVENTS,
  type AIMessage,
  type SessionManagerEvents,
  type SessionManagerLike,
  type UserMessageContent,
} from '@/lib/SessionManager';

/**
 * A session manager that stands in for the real one until the app knows where the assistant runs:
 * in the page, or in the service worker (which takes a message to ask). Calls wait for it; until
 * then there are no sessions, and listeners hear the real one's events once it's there.
 */
export class DeferredSessionManager implements SessionManagerLike {
  private impl?: SessionManagerLike;
  private ready: Promise<SessionManagerLike>;
  private listeners: Partial<Record<keyof SessionManagerEvents, Set<(...args: unknown[]) => void>>> = {};
  private closed = false;

  /** `create` makes the real manager; `start` runs once this one hears its events. */
  constructor(create: () => Promise<SessionManagerLike>, start?: (impl: SessionManagerLike) => Promise<void>) {
    this.ready = create().then(async (impl) => {
      for (const event of SESSION_EVENTS) {
        impl.on(event, ((...args: unknown[]) => this.dispatch(event, ...args)) as SessionManagerEvents[typeof event]);
      }
      if (this.closed) {
        await impl.cleanup();
        return impl;
      }
      this.impl = impl;
      await start?.(impl);
      return impl;
    });
  }

  /** The real manager, once it's known. */
  get current(): SessionManagerLike | undefined {
    return this.impl;
  }

  loadSession(
    projectId: string,
    tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>,
    customTools: Record<string, Tool<unknown>>,
    maxSteps?: number,
  ) {
    return this.ready.then((impl) => impl.loadSession(projectId, tools, customTools, maxSteps));
  }

  getSession(projectId: string) {
    return this.impl?.getSession(projectId);
  }

  getAllSessions() {
    return this.impl?.getAllSessions() ?? [];
  }

  deleteSession(projectId: string): Promise<void> {
    return this.ready.then((impl) => impl.deleteSession(projectId));
  }

  addMessage(projectId: string, message: AIMessage): Promise<void> {
    return this.ready.then((impl) => impl.addMessage(projectId, message));
  }

  sendMessage(projectId: string, content: UserMessageContent, providerModel: string): Promise<void> {
    return this.ready.then((impl) => impl.sendMessage(projectId, content, providerModel));
  }

  queueMessage(projectId: string, content: UserMessageContent): void {
    void this.ready.then((impl) => impl.queueMessage(projectId, content));
  }

  removeQueuedMessage(projectId: string, id: string): void {
    void this.ready.then((impl) => impl.removeQueuedMessage(projectId, id));
  }

  startGeneration(projectId: string, providerModel: string): Promise<void> {
    return this.ready.then((impl) => impl.startGeneration(projectId, providerModel));
  }

  stopGeneration(projectId: string): void {
    if (this.impl) this.impl.stopGeneration(projectId);
    else void this.ready.then((impl) => impl.stopGeneration(projectId));
  }

  startNewSession(projectId: string): Promise<void> {
    return this.ready.then((impl) => impl.startNewSession(projectId));
  }

  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(listener as (...args: unknown[]) => void);
  }

  off<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    this.listeners[event]?.delete(listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof SessionManagerEvents>(event: K, ...args: Parameters<SessionManagerEvents[K]>): void {
    // The real manager's own listeners hear it too, and pass it back here.
    if (this.impl) this.impl.emit(event, ...args);
    else this.dispatch(event, ...args);
  }

  async cleanup(): Promise<void> {
    this.closed = true;
    this.listeners = {};
    await this.impl?.cleanup();
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
}
