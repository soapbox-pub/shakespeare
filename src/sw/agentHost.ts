/**
 * The assistant, running in Shakespeare's service worker.
 *
 * Where Din gives the worker running tasks (an `ongoing` notification keeps it running with every
 * window closed: Din's docs/din/background.md), the pages hand it their sessions: it makes the AI
 * requests, keeps the history, and runs every tool that needs no page. While a turn runs, its
 * notification says so, and its Stop stops it. What only a page can do it asks a page for
 * (`pageBridge.ts`).
 */
import LightningFS from '@isomorphic-git/lightning-fs';
import { Decimal } from 'decimal.js';
import { NPool, NRelay1, type NostrEvent, type NostrFilter, type NostrSigner } from '@nostrify/nostrify';
import { NUser, type NLoginType } from '@nostrify/react/login';
import type OpenAI from 'openai';

import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import { Git } from '@/lib/git';
import { getAllSkills } from '@/lib/skills';
import { SessionManager, SESSION_EVENTS, snapshotSession, type AIMessage, type UserMessageContent } from '@/lib/SessionManager';
import { buildProject } from '@/lib/build';
import { Nip07AccountSigner } from '@/lib/nip07';
import { createWorkerTools } from '@/lib/tools/workerTools';
import type { Tool } from '@/lib/tools/Tool';
import {
  AGENT_PROTOCOL_VERSION,
  TASK_TAG_PREFIX,
  serializeError,
  type AgentContext,
  type SignMethod,
  type ToWorker,
} from '@/lib/agent/protocol';

import { hostWindows, isProjectOpen, isWindowFocused, registerHost, requestPage, send, settleRequest } from './pageBridge';
import { sw, type SWClient, type SWMessageEvent, type TaskNotificationOptions } from './types';

/** Changes each time the worker starts, so pages can tell it lost its sessions. */
const INSTANCE = crypto.randomUUID();

/** How long an event without a running task may hold the worker; Chromium stops it at five minutes. */
const MAX_HOLD_MS = 4.5 * 60_000;

/** How often streaming text is sent to pages. */
const STREAM_INTERVAL_MS = 50;

/** The least time between updates of a task's notification. */
const NOTIFICATION_INTERVAL_MS = 2000;

const GIT_KINDS = [30617, 30618, 1617, 1621];

/** Din's running tasks: `ongoing` notifications that keep the worker running. */
function supportsTasks(): boolean {
  return typeof Notification !== 'undefined' && 'ongoing' in Notification.prototype;
}

// ---------------------------------------------------------------------------
// The page's state, as it last sent it
// ---------------------------------------------------------------------------

let context: AgentContext | undefined;

function requireContext(): AgentContext {
  if (!context) throw new Error('No settings from a page yet');
  return context;
}

const pool = new NPool({
  open: (url) => new NRelay1(url),
  reqRouter(filters: NostrFilter[]) {
    const routes = new Map<string, NostrFilter[]>();
    if (!context) return routes;
    for (const relay of context.config.relayMetadata.relays) {
      if (relay.read) routes.set(relay.url, filters);
    }
    if (filters.every((filter) => filter.kinds?.every((kind) => GIT_KINDS.includes(kind)))) {
      for (const relay of context.config.graspMetadata.relays) routes.set(relay.url, filters);
    }
    return routes;
  },
  eventRouter(event: NostrEvent) {
    if (!context) return [];
    const relays = new Set(context.config.relayMetadata.relays.filter((relay) => relay.write).map((relay) => relay.url));
    if (GIT_KINDS.includes(event.kind)) {
      for (const relay of context.config.graspMetadata.relays) relays.add(relay.url);
    }
    return [...relays];
  },
});

/** Signs with the signer of a page (a NIP-07 signer exists only there). */
class PageSigner implements NostrSigner {
  constructor(private pubkey: string) {}

  getPublicKey(): Promise<string> {
    return Promise.resolve(this.pubkey);
  }

  signEvent(event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>): Promise<NostrEvent> {
    return this.ask('signEvent', [event]) as Promise<NostrEvent>;
  }

  readonly nip04 = {
    encrypt: (pubkey: string, plaintext: string) => this.ask('nip04.encrypt', [pubkey, plaintext]) as Promise<string>,
    decrypt: (pubkey: string, ciphertext: string) => this.ask('nip04.decrypt', [pubkey, ciphertext]) as Promise<string>,
  };

  readonly nip44 = {
    encrypt: (pubkey: string, plaintext: string) => this.ask('nip44.encrypt', [pubkey, plaintext]) as Promise<string>,
    decrypt: (pubkey: string, ciphertext: string) => this.ask('nip44.decrypt', [pubkey, ciphertext]) as Promise<string>,
  };

  private ask(method: SignMethod, args: unknown[]): Promise<unknown> {
    return requestPage({ kind: 'sign', pubkey: this.pubkey, method, args });
  }
}

let cachedUser: { key: string; user: NUser } | undefined;

/**
 * The signed-in user. nsec and bunker logins sign here. NIP-07 logins sign with the worker's own
 * `self.nostr` (Din gives workers one): pinned to the login's account where it has `getSigner`, or while
 * it's on that account; otherwise a page signs.
 */
function currentUser(): NUser | undefined {
  const login = context?.login;
  if (!login) return undefined;
  const key = JSON.stringify(login);
  if (cachedUser?.key === key) return cachedUser.user;

  let user: NUser;
  try {
    if (login.type === 'nsec') user = NUser.fromNsecLogin(login as unknown as Extract<NLoginType, { type: 'nsec' }>);
    else if (login.type === 'bunker') user = NUser.fromBunkerLogin(login as unknown as Extract<NLoginType, { type: 'bunker' }>, pool);
    else user = new NUser(login.type as NUser['method'], login.pubkey, new Nip07AccountSigner(login.pubkey, new PageSigner(login.pubkey)));
  } catch (error) {
    console.warn('Failed to load the login, signing elsewhere instead:', error);
    user = new NUser(login.type as NUser['method'], login.pubkey, new Nip07AccountSigner(login.pubkey, new PageSigner(login.pubkey)));
  }
  cachedUser = { key, user };
  return user;
}

let cachedModels: { from: AgentContext['models']; models: Array<{ id: string; provider: string; contextLength?: number; pricing?: { prompt: Decimal; completion: Decimal } }> } | undefined;

function providerModels() {
  const models = context?.models ?? [];
  if (cachedModels?.from !== models) {
    cachedModels = {
      from: models,
      models: models.map((model) => ({
        ...model,
        pricing: model.pricing && { prompt: new Decimal(model.pricing.prompt), completion: new Decimal(model.pricing.completion) },
      })),
    };
  }
  return cachedModels.models;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const fs = new LightningFSAdapter(new LightningFS('shakespeare-fs').promises);

const manager = new SessionManager(
  fs,
  pool,
  () => requireContext().settings,
  () => requireContext().config,
  () => requireContext().defaultConfig,
  providerModels,
  () => ({ user: currentUser(), metadata: context?.metadata }),
);

function makeGit(): Git {
  const { config, gitCredentials } = requireContext();
  const urls = <T extends { url: string }>(relays: T[]) => relays.flatMap((relay) => {
    try {
      return [{ ...relay, url: new URL(relay.url) }];
    } catch {
      return [];
    }
  });
  return new Git({
    fs,
    nostr: pool,
    corsProxy: config.corsProxy,
    gitProxyOrigins: config.gitProxyOrigins,
    relayList: urls(config.relayMetadata.relays),
    graspList: urls(config.graspMetadata.relays),
    credentials: gitCredentials,
    signer: currentUser()?.signer,
  });
}

/** Projects whose files the assistant changed since they were last built here. */
const unbuilt = new Set<string>();
manager.on('fileChanged', (projectId) => unbuilt.add(projectId));

/**
 * Build a project whose files changed in a turn when no window has it open to build it (as the
 * page's auto-build does), so its preview and dist are up to date when it's next opened. Returns
 * the error if the build failed.
 */
async function buildInBackground(projectId: string): Promise<unknown> {
  if (!unbuilt.has(projectId) || await isProjectOpen(projectId)) return undefined;
  const { config } = requireContext();
  try {
    await buildProject({ fs, projectPath: `${config.fsPathProjects}/${projectId}`, esmUrl: config.esmUrl });
    unbuilt.delete(projectId);
    manager.emit('projectBuilt', projectId);
    return undefined;
  } catch (error) {
    console.warn(`Failed to build ${projectId} in the background:`, error);
    return error;
  }
}

/** A tool only a page can run, run by one. */
function pageTool(projectId: string, name: string): Tool<unknown> {
  return {
    description: '',
    execute: async (args, options) => {
      return await requestPage({ kind: 'tool', projectId, name, args }, options?.signal) as Awaited<ReturnType<Tool<unknown>['execute']>>;
    },
  };
}

/** The tools of a project: the page's list, each run here if it can be and by a page if not. */
async function buildTools(projectId: string, schemas: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>): Promise<Record<string, Tool<unknown>>> {
  const { config, imageGeneration } = requireContext();
  const cwd = `${config.fsPathProjects}/${projectId}`;
  const user = currentUser();
  const local = createWorkerTools({
    fs,
    git: makeGit(),
    projectId,
    cwd,
    projectsPath: config.fsPathProjects,
    tmpPath: config.fsPathTmp,
    corsProxy: config.corsProxy,
    esmUrl: config.esmUrl,
    writeRelays: config.relayMetadata.relays.filter((relay) => relay.write).map((relay) => relay.url),
    user,
    signer: user?.signer,
    skills: await getAllSkills(fs, config.fsPathPlugins, cwd).catch(() => []),
    imageGeneration,
    onFileChanged: (filePath) => manager.emit('fileChanged', projectId, filePath),
    onCommit: () => manager.emit('committed', projectId),
    onBuilt: () => {
      unbuilt.delete(projectId);
      manager.emit('projectBuilt', projectId);
    },
  });

  const tools: Record<string, Tool<unknown>> = {};
  for (const name of Object.keys(schemas)) {
    tools[name] = local[name] ?? pageTool(projectId, name);
  }
  return tools;
}

// Every event goes to every page. Streaming text comes many times a second, so it's sent at most
// every STREAM_INTERVAL_MS, and any other event of the project sends what's waiting first.
const streaming = new Map<string, { args: unknown[]; timer: ReturnType<typeof setTimeout> }>();

function flushStreaming(projectId: string): void {
  const waiting = streaming.get(projectId);
  if (!waiting) return;
  clearTimeout(waiting.timer);
  streaming.delete(projectId);
  send('all', { type: 'agent:event', event: 'streamingUpdate', args: waiting.args });
}

for (const event of SESSION_EVENTS) {
  manager.on(event, ((...args: unknown[]) => {
    const projectId = args[0] as string;
    if (event === 'streamingUpdate') {
      const waiting = streaming.get(projectId);
      if (waiting) {
        waiting.args = args;
      } else {
        streaming.set(projectId, { args, timer: setTimeout(() => flushStreaming(projectId), STREAM_INTERVAL_MS) });
      }
      return;
    }
    flushStreaming(projectId);
    const session = event === 'sessionCreated' ? manager.getSession(projectId) : undefined;
    send('all', { type: 'agent:event', event, args, snapshot: session && summarizeSession(session) });
    onSessionEvent(event, args);
  }) as never);
}

/**
 * A session without its history, for pages that only need to know it's there and whether it's
 * running. Histories can be large (images), and a page that shows one loads it in full.
 */
function summarizeSession(session: Parameters<typeof snapshotSession>[0]) {
  return { ...snapshotSession(session), messages: [] };
}

function runningProjects(): string[] {
  return manager.getAllSessions().filter((session) => session.isLoading).map((session) => session.projectId);
}

/** Resolves once no session is running. */
function idle(): Promise<void> {
  if (runningProjects().length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const check = (_projectId: string, loading: boolean) => {
      if (!loading && runningProjects().length === 0) {
        manager.off('loadingChanged', check);
        resolve();
      }
    };
    manager.on('loadingChanged', check);
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Running tasks: a notification for each turn
// ---------------------------------------------------------------------------

interface Task {
  /** What the notification says now */
  body: string;
  shownAt: number;
  timer?: ReturnType<typeof setTimeout>;
  /** The user stopped it (in a window, or with the notification's Stop) */
  stopped: boolean;
}

const tasks = new Map<string, Task>();

const taskTag = (projectId: string) => `${TASK_TAG_PREFIX}${projectId}`;

function showTask(projectId: string, task: Task): void {
  task.shownAt = Date.now();
  const options: TaskNotificationOptions = {
    tag: taskTag(projectId),
    body: task.body,
    icon: '/shakespeare-192x192.png',
    data: { projectId },
    ongoing: true,
    silent: true,
  };
  sw.registration.showNotification(`Working on ${projectId}`, options).catch((error) => {
    console.warn('Failed to show the task notification:', error);
  });
}

/** Say what a running task is doing, at most every NOTIFICATION_INTERVAL_MS. */
function updateTask(projectId: string, body: string): void {
  const task = tasks.get(projectId);
  if (!task || task.body === body) return;
  task.body = body;
  if (task.timer) return;
  const wait = Math.max(0, task.shownAt + NOTIFICATION_INTERVAL_MS - Date.now());
  task.timer = setTimeout(() => {
    task.timer = undefined;
    if (tasks.get(projectId) === task) showTask(projectId, task);
  }, wait);
}

function describeToolCalls(message: AIMessage): string | undefined {
  if (message.role !== 'assistant' || !('tool_calls' in message) || !message.tool_calls?.length) return undefined;
  const names = message.tool_calls.flatMap((call) => call.type === 'function' ? [call.function.name] : []);
  const labels: Record<string, string> = {
    read: 'Reading files', write: 'Writing files', edit: 'Editing files', glob: 'Looking through files',
    grep: 'Searching the code', shell: 'Running commands', build_project: 'Building the project',
    preview: 'Checking the preview', git_commit: 'Committing changes', npm_add_package: 'Adding packages',
    npm_remove_package: 'Removing packages', webfetch: 'Reading the web', websearch: 'Searching the web',
    generate_image: 'Making an image', edit_image: 'Editing an image', todowrite: 'Planning',
  };
  const name = names.find((n) => labels[n]) ?? names[0];
  return name ? labels[name] ?? `Using ${name}` : undefined;
}

function onSessionEvent(event: string, args: unknown[]): void {
  const projectId = args[0] as string;
  if (event === 'loadingChanged' && args[1] === true) {
    // A turn started right after one was stopped keeps its notification.
    const task: Task = tasks.get(projectId) ?? { body: 'Thinking…', shownAt: 0, stopped: false };
    task.stopped = false;
    tasks.set(projectId, task);
    showTask(projectId, task);
  } else if (event === 'messageAdded') {
    const description = describeToolCalls(args[1] as AIMessage);
    if (description) updateTask(projectId, description);
  }
}

async function closeTaskNotification(projectId: string): Promise<void> {
  const notifications = await sw.registration.getNotifications({ tag: taskTag(projectId) });
  for (const notification of notifications) notification.close();
}

/** A turn is over: the notification goes, or, if the user isn't looking, says how it went. */
async function endTask(projectId: string, error?: unknown, buildError?: unknown): Promise<void> {
  const task = tasks.get(projectId);
  if (!task) return;
  tasks.delete(projectId);
  clearTimeout(task.timer);

  try {
    if (task.stopped || await isWindowFocused()) {
      await closeTaskNotification(projectId);
      return;
    }
    const failed = error !== undefined;
    const message = error instanceof Error ? error.message : String(error);
    const buildMessage = buildError instanceof Error ? buildError.message : String(buildError);
    const options: TaskNotificationOptions = {
      tag: taskTag(projectId),
      body: failed
        ? `Stopped with an error: ${message}`
        : buildError !== undefined
          ? `Done, but the build failed: ${buildMessage}`
          : 'Done. Open the project to see what changed.',
      icon: '/shakespeare-192x192.png',
      data: { projectId },
    };
    await sw.registration.showNotification(failed ? `Shakespeare stopped working on ${projectId}` : `Finished ${projectId}`, options);
  } catch (notificationError) {
    console.warn('Failed to update the task notification:', notificationError);
  }
}

/** Run something that may start a turn, and end its task when the turn is over. */
async function runTurn(projectId: string, run: () => Promise<void>): Promise<void> {
  let failure: unknown;
  try {
    await run();
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    // A message sent during a turn is queued, and the turn that's running goes on.
    if (!manager.getSession(projectId)?.isLoading) {
      // Not after a Stop, which leaves the worker only seconds
      const stopped = tasks.get(projectId)?.stopped ?? false;
      if (!stopped && tasks.has(projectId)) updateTask(projectId, 'Building the project');
      const buildError = stopped ? undefined : await buildInBackground(projectId);
      await endTask(projectId, failure, buildError);
    }
  }
}

sw.addEventListener('notificationclose', (event) => {
  const tag = event.notification.tag;
  if (!tag.startsWith(TASK_TAG_PREFIX)) return;
  const projectId = tag.slice(TASK_TAG_PREFIX.length);
  const task = tasks.get(projectId);
  if (!task || !manager.getSession(projectId)?.isLoading) return;
  // Din's Stop: stop the turn. The worker has ten seconds left.
  task.stopped = true;
  manager.stopGeneration(projectId);
});

sw.addEventListener('notificationclick', (event) => {
  const tag = event.notification.tag;
  if (!tag.startsWith(TASK_TAG_PREFIX)) return;
  const projectId = tag.slice(TASK_TAG_PREFIX.length);
  // A finished task's notification is news, read once it's clicked; a running one stays.
  if (!tasks.has(projectId)) event.notification.close();
  event.waitUntil((async () => {
    const windows = await hostWindows();
    const target = windows.find((client) => client.focused) ?? windows[0];
    if (target) {
      send(target, { type: 'agent:open', projectId });
      await target.focus().catch(() => {});
    } else {
      await sw.clients.openWindow(`/project/${encodeURIComponent(projectId)}`);
    }
  })());
});

// ---------------------------------------------------------------------------
// Messages from pages
// ---------------------------------------------------------------------------

async function handleCall(source: SWClient, message: ToWorker & { type: 'agent:call' }): Promise<void> {
  const { id, method, args } = message;
  try {
    let result: unknown;
    switch (method) {
      case 'loadSession': {
        const [projectId, schemas, maxSteps] = args as [string, Record<string, OpenAI.Chat.Completions.ChatCompletionTool>, number | undefined];
        const tools = await buildTools(projectId, schemas);
        result = snapshotSession(await manager.loadSession(projectId, schemas, tools, maxSteps));
        break;
      }
      case 'getAllSessions':
        result = manager.getAllSessions().map(summarizeSession);
        break;
      case 'deleteSession':
        await manager.deleteSession(args[0] as string);
        break;
      case 'addMessage':
        await manager.addMessage(args[0] as string, args[1] as AIMessage);
        break;
      case 'sendMessage': {
        const [projectId, content, providerModel] = args as [string, UserMessageContent, string];
        await runTurn(projectId, () => manager.sendMessage(projectId, content, providerModel));
        break;
      }
      case 'startGeneration': {
        const [projectId, providerModel] = args as [string, string];
        await runTurn(projectId, () => manager.startGeneration(projectId, providerModel));
        break;
      }
      case 'queueMessage':
        manager.queueMessage(args[0] as string, args[1] as UserMessageContent);
        break;
      case 'removeQueuedMessage':
        manager.removeQueuedMessage(args[0] as string, args[1] as string);
        break;
      case 'stopGeneration': {
        const task = tasks.get(args[0] as string);
        if (task) task.stopped = true;
        manager.stopGeneration(args[0] as string);
        break;
      }
      case 'startNewSession':
        await manager.startNewSession(args[0] as string);
        break;
    }
    send(source, { type: 'agent:result', id, result });
  } catch (error) {
    send(source, { type: 'agent:result', id, error: serializeError(error) });
  }
}

sw.addEventListener('message', (event: SWMessageEvent) => {
  const message = event.data as ToWorker | undefined;
  if (!message || typeof message.type !== 'string' || !message.type.startsWith('agent:')) return;
  const source = event.source;
  if (!source) return;

  switch (message.type) {
    case 'agent:hello':
      if (message.version !== AGENT_PROTOCOL_VERSION) {
        send(source, { type: 'agent:hello', version: AGENT_PROTOCOL_VERSION, available: false, instance: INSTANCE });
        return;
      }
      registerHost(source.id);
      send(source, { type: 'agent:hello', version: AGENT_PROTOCOL_VERSION, available: supportsTasks() || message.force === true, instance: INSTANCE });
      return;

    case 'agent:context':
      context = message.context;
      return;

    case 'agent:call': {
      context = message.context;
      registerHost(source.id, message.toolProjects);
      // A turn can take a long time. Once its task is granted, Din keeps the worker running and lets
      // this event go; without one, Chromium would stop the worker past five minutes.
      const call = handleCall(source, message);
      event.waitUntil(Promise.race([call, sleep(MAX_HOLD_MS)]));
      return;
    }

    case 'agent:reply':
      settleRequest(message.id, message.result, message.error);
      return;

    case 'agent:ping':
      registerHost(source.id);
      // A page with work running pings, which holds the worker between pings too.
      event.waitUntil(Promise.race([idle(), sleep(25_000)]));
      send(source, { type: 'agent:pong', instance: INSTANCE, running: runningProjects() });
      return;
  }
});
