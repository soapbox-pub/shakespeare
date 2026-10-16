import { getPreviewAgentScript } from './agentScript';
import { servePreviewFile } from './servePreviewFile';
import { getPreviewInjectedScript } from '../previewInjectedScript';

export type Viewport = 'desktop' | 'mobile';

const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

/** Close the frame after this long without a call, to free its memory. */
const IDLE_MS = 10 * 60 * 1000;
const LOAD_TIMEOUT_MS = 20_000;
const MAX_LOGS = 200;

export interface AgentCall {
  action: string;
  ref?: string;
  path?: string;
  text?: string;
  submit?: boolean;
  values?: string[];
  key?: string;
  direction?: string;
  script?: string;
  /** Snapshot only this ref's subtree. */
  scope?: string;
  /** Set to false to skip the snapshot. */
  snapshot?: boolean;
  maxChars?: number;
  wait?: { timeout?: number; text?: string };
}

export interface AgentResult {
  url: string;
  title: string;
  output?: string;
  settled: { settled: boolean; waited: number; found?: boolean; pending?: number };
  snapshot?: string;
  /** Set when the page reloaded while the call was in progress. */
  reloaded?: boolean;
}

export interface PageEvents {
  logs: { level: string; message: string }[];
  failedRequests: string[];
}

interface PendingCall {
  call: AgentCall;
  resolve: (result: AgentResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  reloaded?: boolean;
}

export interface AgentBrowserOptions {
  /** Origin of the frame on the preview domain, distinct from the user's preview. */
  origin: string;
  /** Read a file from the project's `dist` directory, e.g. `/index.html`. */
  readDistFile: (path: string) => Promise<Uint8Array>;
}

/**
 * A hidden copy of the project preview that the AI can inspect and drive,
 * independent of whatever the user has on screen.
 *
 * It runs on its own iframe.diy origin, so its storage and messages never mix
 * with the user's preview, and it gets no NIP-07 signer, so nothing the AI
 * does in it can sign as the user.
 */
export class AgentBrowser {
  private iframe: HTMLIFrameElement | undefined;
  private viewport: Viewport = 'desktop';
  private logs: PageEvents['logs'] = [];
  private failedRequests: string[] = [];
  private calls = new Map<string, PendingCall>();
  private onReady: (() => void) | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private lastFocused: HTMLElement | undefined;
  private injectedScripts = new Map([
    ['/__injected__/preview.js', getPreviewInjectedScript()],
    ['/__injected__/agent.js', getPreviewAgentScript()],
  ]);

  constructor(private options: AgentBrowserOptions) {
    window.addEventListener('message', this.handleMessage);
    document.addEventListener('focusin', this.handleFocusIn);
    document.addEventListener('focusout', this.handleFocusOut);
  }

  get isOpen(): boolean {
    return !!this.iframe;
  }

  get size(): string {
    const { width, height } = VIEWPORTS[this.viewport];
    return `${this.viewport} ${width}×${height}`;
  }

  /** Load the app fresh at `path`. */
  async open(path: string, viewport: Viewport | undefined, wait: AgentCall['wait']): Promise<AgentResult> {
    if (viewport) this.viewport = viewport;
    this.closeFrame();
    this.logs = [];
    this.failedRequests = [];

    const { width, height } = VIEWPORTS[this.viewport];
    const iframe = document.createElement('iframe');
    iframe.src = `${this.options.origin}/`;
    iframe.title = 'AI preview';
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    // On screen but invisible: browsers throttle frames that are off screen,
    // and IntersectionObserver-driven UI would never trigger.
    Object.assign(iframe.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: `${width}px`,
      height: `${height}px`,
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    });

    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.onReady = undefined;
        reject(new Error(`The preview did not load within ${LOAD_TIMEOUT_MS / 1000} seconds.`));
      }, LOAD_TIMEOUT_MS);
      this.onReady = () => {
        clearTimeout(timer);
        this.onReady = undefined;
        resolve();
      };
    });

    document.body.appendChild(iframe);
    this.iframe = iframe;

    try {
      await ready;
    } catch (error) {
      this.closeFrame();
      throw error;
    }

    // The agent script runs in <head>, before the app mounts, so the router
    // sees the new path when it starts.
    return this.call({ action: 'navigate', path, wait: { timeout: 10_000, ...wait } });
  }

  call(call: AgentCall): Promise<AgentResult> {
    const iframe = this.iframe;
    if (!iframe?.contentWindow) {
      return Promise.reject(new Error('The preview is not open. Use the "open" action first.'));
    }
    this.resetIdleTimer();

    const callId = crypto.randomUUID();
    const timeout = (call.wait?.timeout ?? 5000) + 15_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.calls.delete(callId);
        reject(new Error('The preview stopped responding. The page may be frozen in an infinite loop; open it again to reset it.'));
      }, timeout);
      this.calls.set(callId, { call, resolve, reject, timer });
      this.send(callId, call);
    });
  }

  /** Console messages and failed requests since the last call to this method. */
  drainEvents(): PageEvents {
    const events = { logs: this.logs, failedRequests: this.failedRequests };
    this.logs = [];
    this.failedRequests = [];
    return events;
  }

  dispose(): void {
    this.closeFrame();
    window.removeEventListener('message', this.handleMessage);
    document.removeEventListener('focusin', this.handleFocusIn);
    document.removeEventListener('focusout', this.handleFocusOut);
  }

  private closeFrame(): void {
    clearTimeout(this.idleTimer);
    for (const pending of this.calls.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('The preview was closed.'));
    }
    this.calls.clear();
    this.iframe?.remove();
    this.iframe = undefined;
  }

  private resetIdleTimer(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.closeFrame(), IDLE_MS);
  }

  private send(callId: string, call: AgentCall): void {
    // A notification: iframe.diy relays these to the inner frame without
    // waiting for a response.
    this.post({ jsonrpc: '2.0', method: 'agent.call', params: { ...call, callId } });
  }

  private post(message: unknown): void {
    this.iframe?.contentWindow?.postMessage(message, this.options.origin);
  }

  private handleMessage = (event: MessageEvent): void => {
    if (!this.iframe || event.source !== this.iframe.contentWindow || event.origin !== this.options.origin) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') return;

    switch (message.method) {
      case 'ready':
        this.post({ jsonrpc: '2.0', method: 'init', params: { version: 1 } });
        return;
      case 'fetch':
        this.handleFetch(message);
        return;
      case 'console':
        this.logs.push({ level: String(message.params?.level), message: String(message.params?.message) });
        if (this.logs.length > MAX_LOGS) this.logs.splice(0, this.logs.length - MAX_LOGS);
        break;
      case 'agent.ready':
        if (this.onReady) {
          this.onReady();
        } else {
          // The page reloaded (e.g. a plain link was clicked). Calls in flight
          // died with the old page, so finish them on the new one.
          for (const [callId, pending] of this.calls) {
            pending.reloaded = true;
            this.send(callId, { action: 'none', wait: pending.call.wait, snapshot: pending.call.snapshot, maxChars: pending.call.maxChars });
          }
        }
        break;
      case 'agent.result':
        this.handleResult(message.params);
        break;
    }

    if (message.id !== undefined) {
      // Answer every request, so the outer frame doesn't keep waiting on it
      const reply = typeof message.method === 'string' && message.method.startsWith('nostr.')
        ? { jsonrpc: '2.0', id: message.id, error: { code: -1, message: 'Signing is not available in the AI preview.' } }
        : { jsonrpc: '2.0', id: message.id, result: null };
      this.post(reply);
    }
  };

  private handleResult(params: { callId: string; result?: AgentResult; error?: string }): void {
    const pending = this.calls.get(params?.callId);
    if (!pending) return;
    this.calls.delete(params.callId);
    clearTimeout(pending.timer);
    if (params.error !== undefined) {
      pending.reject(new Error(params.error));
    } else if (params.result) {
      pending.resolve({ ...params.result, reloaded: pending.reloaded });
    }
  }

  private async handleFetch(message: { id: string | number; params: { request: { url: string } } }): Promise<void> {
    const { id } = message;
    try {
      const url = new URL(message.params.request.url);
      if (url.origin !== this.options.origin) {
        this.post({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Invalid URL - origin mismatch' } });
        return;
      }
      const result = await servePreviewFile(url.pathname, {
        readDistFile: this.options.readDistFile,
        injectedScripts: this.injectedScripts,
      });
      if (result.status === 404) this.failedRequests.push(`404 ${url.pathname}`);
      this.post({ jsonrpc: '2.0', id, result });
    } catch (error) {
      this.post({ jsonrpc: '2.0', id, error: { code: -32002, message: 'Request processing error', data: { error: String(error) } } });
    }
  }

  // Code in the frame can focus its elements, which pulls keyboard focus away
  // from Shakespeare (e.g. the chat input). Give it straight back.

  private handleFocusIn = (event: FocusEvent): void => {
    if (event.target instanceof HTMLElement && event.target !== this.iframe) {
      this.lastFocused = event.target;
    }
  };

  private handleFocusOut = (): void => {
    setTimeout(() => {
      if (!this.iframe || document.activeElement !== this.iframe) return;
      if (this.lastFocused?.isConnected) {
        this.lastFocused.focus({ preventScroll: true });
      } else {
        this.iframe.blur();
      }
    });
  };
}

let current: { key: string; browser: AgentBrowser } | undefined;

/**
 * Get the agent browser for `key`. Only one exists at a time; asking for a
 * different key (another project or preview domain) disposes the old one.
 */
export function getAgentBrowser(key: string, create: () => AgentBrowser): AgentBrowser {
  if (current?.key !== key) {
    current?.browser.dispose();
    current = { key, browser: create() };
  }
  return current.browser;
}
