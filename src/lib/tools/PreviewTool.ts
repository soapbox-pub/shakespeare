import { z } from 'zod';
import { join } from 'path-browserify';

import type { Tool, ToolResult } from './Tool';
import type { JSRuntimeFS } from '../JSRuntime';
import { AgentBrowser, getAgentBrowser, type AgentCall, type AgentResult, type Viewport } from '../preview/AgentBrowser';
import { deriveIframeSubdomain } from '../iframeSubdomain';
import { decodeBase64 } from '@std/encoding/base64';
import { fileToUrl, resizeImageIfNeeded } from '../imageUtils';

const ACTIONS = ['open', 'snapshot', 'screenshot', 'click', 'type', 'select', 'hover', 'press', 'scroll', 'back', 'wait', 'eval'] as const;

export interface PreviewParams {
  action: typeof ACTIONS[number];
  path?: string;
  viewport?: Viewport;
  ref?: string;
  text?: string;
  submit?: boolean;
  values?: string[];
  key?: string;
  direction?: 'up' | 'down' | 'top' | 'bottom';
  script?: string;
  timeout?: number;
  full_page?: boolean;
}

/** Actions that act on an element. */
const NEEDS_REF: Partial<Record<PreviewParams['action'], true>> = { click: true, type: true, select: true, hover: true };

const MAX_LOG_LINES = 30;
const MAX_LOG_LINE = 500;

/** Source paths whose changes show up in the build. */
const SOURCE_PATHS = ['src', 'public', 'index.html'];

export class PreviewTool implements Tool<PreviewParams> {
  readonly description = `See and use the running app, to check that your changes work. This opens the project's latest build in a hidden browser frame, separate from the user's preview.

Every action returns the page as an accessibility snapshot, plus any console output, uncaught errors, and failed requests since the previous action. Interactive elements carry refs like [ref=e12]; pass one as \`ref\` to act on that element. Refs come from the latest snapshot. After each action the tool waits for the page to settle (no DOM changes, network requests, or pending Nostr queries) before snapshotting.

Actions:
- open: load the app fresh at \`path\` (default "/"), optionally with \`viewport\` "desktop" (1280×800, default) or "mobile" (390×844). Run build_project first; this shows the last build.
- snapshot: snapshot the page again, or only the element \`ref\`.
- screenshot: see how the page looks. Captures what is on screen, the whole page with \`full_page: true\`, or only the element \`ref\` (enlarged, to check details like images and icons). The screenshot is saved to /tmp, so you can zoom into part of it with \`read\` and \`region\`. It is rendered from the DOM, so images from other sites that block cross-origin requests may come out blank.
- click / hover: click or hover \`ref\`.
- type: replace the text of field \`ref\` with \`text\`; \`submit: true\` presses Enter afterwards.
- select: choose \`values\` (option values or labels) in the native <select> \`ref\`.
- press: press \`key\` on the focused element, e.g. "Enter", "Escape", "Tab", "ArrowDown", "Control+a".
- scroll: scroll \`ref\` into view, or the page in \`direction\` "down" (default), "up", "top", or "bottom".
- back: go back in history.
- wait: wait until \`text\` appears on the page (or the page settles), up to \`timeout\` seconds (default 10).
- eval: run JavaScript in the page and return its result. \`script\` may be an expression or a function body with \`return\`; promises are awaited.

Use this after building to confirm that pages render without errors and that the features you changed actually work. For visual changes (layout, colors, images, artwork), take a screenshot, including with the "mobile" viewport, before telling the user the change is done. The frame has no Nostr signer, so it can't log in as the user.`;

  readonly inputSchema = z.object({
    action: z.enum(ACTIONS).describe('What to do.'),
    path: z.string().optional().describe('For "open": the path to load, e.g. "/about".'),
    viewport: z.enum(['desktop', 'mobile']).optional().describe('For "open": the screen size to use.'),
    ref: z.string().optional().describe('Element ref from the latest snapshot, e.g. "e12".'),
    text: z.string().optional().describe('For "type": the text to enter. For "wait": the text to wait for.'),
    submit: z.boolean().optional().describe('For "type": press Enter after typing.'),
    values: z.array(z.string()).optional().describe('For "select": option values or labels to choose.'),
    key: z.string().optional().describe('For "press": the key, e.g. "Enter" or "Shift+Tab".'),
    direction: z.enum(['up', 'down', 'top', 'bottom']).optional().describe('For "scroll" without a ref.'),
    script: z.string().optional().describe('For "eval": JavaScript to run in the page.'),
    timeout: z.number().min(1).max(30).optional().describe('For "wait": seconds to wait (default 10).'),
    full_page: z.boolean().optional().describe('For "screenshot" without a ref: capture the whole page instead of the visible part.'),
  });

  constructor(
    private fs: JSRuntimeFS,
    private cwd: string,
    private projectId: string,
    private previewDomain: string,
    private tmpPath: string,
  ) {}

  async execute(params: PreviewParams): Promise<ToolResult> {
    const browser = this.getBrowser();
    const notes: string[] = [];
    let result: AgentResult;

    if (params.action === 'open') {
      if (!await this.exists('dist/index.html')) {
        throw new Error('The project has not been built yet. Run build_project first.');
      }
      if (await this.isBuildStale()) {
        notes.push('Note: source files changed after the last build, so the page may not show your latest changes. Run build_project and open the page again.');
      }
      result = await browser.open(params.path ?? '/', params.viewport, undefined);
    } else {
      if (NEEDS_REF[params.action] && !params.ref) {
        throw new Error(`The "${params.action}" action needs a ref from the snapshot.`);
      }
      result = await browser.call(this.toCall(params));
    }

    if (result.image) {
      return this.screenshotResult(params, result, browser, notes);
    }

    return { content: this.format(params, result, browser, notes) };
  }

  private async screenshotResult(params: PreviewParams, result: AgentResult, browser: AgentBrowser, notes: string[]): Promise<ToolResult> {
    const { dataUrl, width, height, scale, truncated } = result.image!;
    const bytes = decodeBase64(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const path = `${this.tmpPath}/screenshot-${Date.now()}.png`;
    try {
      await this.fs.stat(this.tmpPath);
    } catch {
      await this.fs.mkdir(this.tmpPath, { recursive: true });
    }
    await this.fs.writeFile(path, bytes);

    const what = params.ref ? `element ${params.ref}` : params.full_page ? 'the whole page' : 'the visible part of the page';
    notes.push(`Screenshot of ${what}, ${width}×${height} px (${scale}× the page's CSS pixels), saved to ${path}.${truncated ? ' The page is taller than that and was cut off.' : ''}`);

    const image = await resizeImageIfNeeded(new File([bytes], 'screenshot.png', { type: 'image/png' }), { maxFileSize: 3.75 * 1024 * 1024 });
    return {
      content: this.format(params, result, browser, notes),
      images: [await fileToUrl(image)],
    };
  }

  private getBrowser(): AgentBrowser {
    return getAgentBrowser(`${this.previewDomain}|${this.cwd}`, () => {
      const origin = `https://${deriveIframeSubdomain('agent', this.projectId)}.${this.previewDomain}`;
      return new AgentBrowser({
        origin,
        readDistFile: (path) => this.fs.readFile(join(this.cwd, 'dist', path)),
      });
    });
  }

  private toCall(params: PreviewParams): AgentCall {
    const { action, ref } = params;
    switch (action) {
      case 'snapshot':
        return { action, scope: ref, wait: { timeout: 2000 } };
      case 'wait':
        return { action, wait: { timeout: (params.timeout ?? 10) * 1000, text: params.text } };
      case 'eval':
        return { action, script: params.script, snapshot: false, wait: { timeout: 2000 } };
      case 'screenshot':
        return { action, ref, fullPage: params.full_page, snapshot: false, wait: { timeout: 2000 } };
      default:
        return {
          action,
          ref,
          text: params.text,
          submit: params.submit,
          values: params.values,
          key: params.key,
          direction: params.direction,
        };
    }
  }

  private format(params: PreviewParams, result: AgentResult, browser: AgentBrowser, notes: string[]): string {
    const sections: string[] = [];
    sections.push(`Page: ${result.url}${result.title ? ` — "${result.title}"` : ''} (${browser.size})`);
    sections.push(...notes);

    if (result.reloaded) {
      sections.push('The page reloaded during this action (a full page navigation).');
    }
    const { settled } = result;
    if (!settled.settled) {
      if (params.action === 'wait' && params.text && !settled.found) {
        sections.push(`"${params.text}" did not appear within ${Math.round(settled.waited / 1000)}s.`);
      } else {
        const pending = settled.pending ? ` (${settled.pending} network request${settled.pending === 1 ? '' : 's'} still pending)` : '';
        sections.push(`The page was still changing after ${Math.round(settled.waited / 1000)}s${pending}; it may still be loading.`);
      }
    }

    if (params.action === 'eval') {
      sections.push(`Result:\n${result.output ?? 'undefined'}`);
    }

    const { logs, failedRequests } = browser.drainEvents();
    const errors = logs.filter((log) => log.level === 'error');
    const others = logs.filter((log) => log.level !== 'error');
    const formatLogs = (entries: typeof logs) => entries
      .slice(-MAX_LOG_LINES)
      .map(({ level, message }) => {
        const line = message.length > MAX_LOG_LINE ? `${message.slice(0, MAX_LOG_LINE)}…` : message;
        return `[${level.toUpperCase()}] ${line}`;
      })
      .join('\n');
    const omitted = (entries: typeof logs) => entries.length > MAX_LOG_LINES ? ` (last ${MAX_LOG_LINES} of ${entries.length})` : '';

    if (errors.length) sections.push(`Errors${omitted(errors)}:\n${formatLogs(errors)}`);
    if (others.length) sections.push(`Console${omitted(others)}:\n${formatLogs(others)}`);
    if (failedRequests.length) sections.push(`Failed requests:\n${failedRequests.join('\n')}`);

    if (result.snapshot !== undefined) {
      sections.push(`Snapshot:\n${result.snapshot}`);
    }

    return sections.join('\n\n');
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.stat(join(this.cwd, path));
      return true;
    } catch {
      return false;
    }
  }

  private async isBuildStale(): Promise<boolean> {
    try {
      const built = (await this.fs.stat(join(this.cwd, 'dist/index.html'))).mtimeMs;
      if (built === undefined) return false;
      for (const path of SOURCE_PATHS) {
        if (await this.changedSince(join(this.cwd, path), built)) return true;
      }
    } catch {
      // Can't tell
    }
    return false;
  }

  private async changedSince(path: string, time: number): Promise<boolean> {
    let stat;
    try {
      stat = await this.fs.stat(path);
    } catch {
      return false;
    }
    if (!stat.isDirectory()) return (stat.mtimeMs ?? 0) > time;
    for (const name of await this.fs.readdir(path)) {
      if (await this.changedSince(join(path, name), time)) return true;
    }
    return false;
  }
}
