import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { readGitSettings } from "../../configUtils";
import { parseArgs, unknownOption } from "./args";

interface ConfigEntry {
  /** Canonical name: section and key lowercased, subsection kept as is. */
  name: string;
  value: string;
  /** Line index in the file. */
  line: number;
}

interface ParsedConfig {
  lines: string[];
  entries: ConfigEntry[];
  /** Section header line indexes by canonical section name (`remote.origin`). */
  sections: Array<{ name: string; line: number }>;
}

type Action = 'get' | 'get-all' | 'get-regexp' | 'set' | 'add' | 'replace-all' | 'unset' | 'unset-all' | 'list' | 'remove-section' | 'rename-section';

const SUBCOMMANDS = new Set(['get', 'set', 'unset', 'list', 'remove-section', 'rename-section', 'edit']);

/**
 * `git config`, over the repository's `.git/config`. There is no global
 * config file here: `--global` and `--system` use the repository's config,
 * and outside a repository `user.name`/`user.email` come from Shakespeare's
 * Git settings.
 */
export class GitConfigCommand implements GitSubcommand {
  name = 'config';
  description = 'Get and set repository or global options';
  usage = 'git config [<file-option>] [--type=<type>] [--show-origin] [-z|--null] [--name-only] (--get | --get-all | --get-regexp | --add | --unset | --unset-all | --replace-all | -l | --list | --remove-section | --rename-section) [<name> [<value>]]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      const parsed = parseArgs(args, {
        flags: {
          global: 'global', system: 'global', local: 'local', worktree: 'local',
          l: 'list', list: 'list', get: 'get', 'get-all': 'getAll', 'get-regexp': 'getRegexp',
          add: 'add', unset: 'unset', 'unset-all': 'unsetAll', 'replace-all': 'replaceAll',
          'remove-section': 'removeSection', 'rename-section': 'renameSection',
          'show-origin': 'showOrigin', 'show-scope': 'showScope', 'name-only': 'nameOnly',
          z: 'null', null: 'null', bool: 'bool', int: 'int', path: 'pathType', 'bool-or-int': 'boolOrInt',
          all: 'all', regexp: 'regexp', append: 'append', includes: 'includes', e: 'edit', edit: 'edit',
        },
        values: { type: 'type', default: 'default', f: 'file', file: 'file', blob: 'blob', comment: 'comment', value: 'valuePattern' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('file') || parsed.has('blob')) {
        return createErrorResult('error: --file and --blob are not supported here', 129);
      }

      const positionals = [...parsed.positionals];
      let action: Action | undefined;
      if (positionals.length > 0 && SUBCOMMANDS.has(positionals[0])) {
        const sub = positionals.shift()!;
        if (sub === 'edit') return createErrorResult('error: editing the config file is not supported here; use git config set', 1);
        if (sub === 'get') action = parsed.has('regexp') ? 'get-regexp' : parsed.has('all') ? 'get-all' : 'get';
        else if (sub === 'set') action = parsed.has('append') ? 'add' : parsed.has('all') ? 'replace-all' : 'set';
        else if (sub === 'unset') action = parsed.has('all') ? 'unset-all' : 'unset';
        else action = sub as Action;
      } else if (parsed.has('edit')) {
        return createErrorResult('error: editing the config file is not supported here; use git config <name> <value>', 1);
      } else if (parsed.has('list')) action = 'list';
      else if (parsed.has('getAll')) action = 'get-all';
      else if (parsed.has('getRegexp')) action = 'get-regexp';
      else if (parsed.has('get')) action = 'get';
      else if (parsed.has('add')) action = 'add';
      else if (parsed.has('unsetAll')) action = 'unset-all';
      else if (parsed.has('unset')) action = 'unset';
      else if (parsed.has('replaceAll')) action = 'replace-all';
      else if (parsed.has('removeSection')) action = 'remove-section';
      else if (parsed.has('renameSection')) action = 'rename-section';
      else if (positionals.length === 1) action = 'get';
      else if (positionals.length === 2) action = 'set';

      if (!action) {
        return createErrorResult(`usage: ${this.usage}`, 129);
      }
      const inRepo = await this.exists(`${cwd}/.git`);
      const configPath = `${cwd}/.git/config`;
      const type = parsed.get('type') ?? (parsed.has('bool') ? 'bool' : parsed.has('int') ? 'int' : undefined);
      const nul = parsed.has('null');
      const term = nul ? '\0' : '\n';

      const readAll = async (): Promise<ConfigEntry[]> => {
        if (inRepo) {
          const config = parseConfig(await this.readText(configPath));
          return config.entries;
        }
        return this.settingsEntries();
      };

      const writeAction = !['get', 'get-all', 'get-regexp', 'list'].includes(action);
      if (!inRepo && writeAction) {
        return createErrorResult('fatal: not in a git directory', 128);
      }

      switch (action) {
        case 'list': {
          const entries = await readAll();
          const origin = parsed.has('showOrigin') ? (inRepo ? 'file:.git/config\t' : 'command line:\t') : '';
          const scope = parsed.has('showScope') ? (inRepo ? 'local\t' : 'global\t') : '';
          return createSuccessResult(entries.map((e) => {
            const value = parsed.has('nameOnly') ? '' : nul ? `\n${e.value}` : `=${e.value}`;
            return `${scope}${origin}${e.name}${value}${term}`;
          }).join(''));
        }

        case 'get':
        case 'get-all': {
          const name = positionals[0];
          if (!name) return createErrorResult(`error: wrong number of arguments, should be 1\nusage: ${this.usage}`, 129);
          const key = canonicalName(name);
          if (!key) return createErrorResult(`error: key does not contain a section: ${name}`, 1);
          let values = (await readAll()).filter((e) => e.name === key).map((e) => e.value);
          if (values.length === 0 && inRepo && (key === 'user.name' || key === 'user.email')) {
            values = (await this.settingsEntries()).filter((e) => e.name === key).map((e) => e.value);
          }
          if (values.length === 0) {
            const fallback = parsed.get('default');
            if (fallback !== undefined) return createSuccessResult(`${formatValue(fallback, type)}${term}`);
            return createErrorResult('', 1);
          }
          if (action === 'get') values = values.slice(-1);
          return createSuccessResult(values.map((v) => `${formatValue(v, type)}${term}`).join(''));
        }

        case 'get-regexp': {
          const pattern = positionals[0] ?? '.';
          let re: RegExp;
          try {
            re = new RegExp(pattern, 'i');
          } catch {
            return createErrorResult(`error: invalid key pattern: ${pattern}`, 6);
          }
          const matches = (await readAll()).filter((e) => re.test(e.name));
          if (matches.length === 0) return createErrorResult('', 1);
          return createSuccessResult(matches.map((e) => (parsed.has('nameOnly') ? `${e.name}${term}` : `${e.name} ${formatValue(e.value, type)}${term}`)).join(''));
        }

        case 'set':
        case 'add':
        case 'replace-all': {
          const [name, value] = positionals;
          if (name === undefined || value === undefined) {
            return createErrorResult(`error: wrong number of arguments, should be 2\nusage: ${this.usage}`, 129);
          }
          const key = canonicalName(name);
          if (!key) return createErrorResult(`error: key does not contain a section: ${name}`, 2);
          if (!/^[a-z][a-z0-9-]*$/i.test(key.slice(key.lastIndexOf('.') + 1))) {
            return createErrorResult(`error: invalid key: ${name}`, 1);
          }
          const config = parseConfig(await this.readText(configPath));
          const existing = config.entries.filter((e) => e.name === key);
          if (action === 'set' && existing.length > 1) {
            return createErrorResult(`warning: ${name} has multiple values\nerror: cannot overwrite multiple values with a single value\n       Use a regexp, --add or --replace-all to change ${name}.`, 5);
          }
          if (action === 'replace-all' && existing.length > 0) {
            await this.writeText(configPath, removeLines(config.lines, existing.map((e) => e.line)));
          }
          await this.git.setConfig({ dir: cwd, path: name, value, append: action === 'add' });
          return createSuccessResult('');
        }

        case 'unset':
        case 'unset-all': {
          const name = positionals[0];
          if (!name) return createErrorResult(`error: wrong number of arguments, should be 1\nusage: ${this.usage}`, 129);
          const key = canonicalName(name);
          if (!key) return createErrorResult(`error: key does not contain a section: ${name}`, 2);
          const config = parseConfig(await this.readText(configPath));
          const existing = config.entries.filter((e) => e.name === key);
          if (existing.length === 0) return createErrorResult('', 5);
          if (action === 'unset' && existing.length > 1) {
            return createErrorResult(`warning: ${name} has multiple values`, 5);
          }
          await this.writeText(configPath, removeLines(config.lines, existing.map((e) => e.line)));
          return createSuccessResult('');
        }

        case 'remove-section': {
          const name = positionals[0];
          if (!name) return createErrorResult(`error: wrong number of arguments, should be 1\nusage: ${this.usage}`, 129);
          const config = parseConfig(await this.readText(configPath));
          const section = canonicalSection(name);
          const ranges = sectionRanges(config).filter((r) => r.name === section);
          if (ranges.length === 0) return createErrorResult('fatal: no such section: ' + name, 128);
          const drop: number[] = [];
          for (const r of ranges) for (let i = r.start; i < r.end; i++) drop.push(i);
          await this.writeText(configPath, removeLines(config.lines, drop));
          return createSuccessResult('');
        }

        case 'rename-section': {
          const [from, to] = positionals;
          if (!from || !to) return createErrorResult(`error: wrong number of arguments, should be 2\nusage: ${this.usage}`, 129);
          const config = parseConfig(await this.readText(configPath));
          const section = canonicalSection(from);
          const matches = config.sections.filter((s) => s.name === section);
          if (matches.length === 0) return createErrorResult('fatal: no such section: ' + from, 128);
          const lines = [...config.lines];
          for (const s of matches) lines[s.line] = sectionHeader(to);
          await this.writeText(configPath, lines.join('\n'));
          return createSuccessResult('');
        }
      }
    } catch (error) {
      return createErrorResult(`git config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async settingsEntries(): Promise<ConfigEntry[]> {
    const settings = await readGitSettings(this.fs);
    const entries: ConfigEntry[] = [];
    if (settings.name) entries.push({ name: 'user.name', value: settings.name, line: -1 });
    if (settings.email) entries.push({ name: 'user.email', value: settings.email, line: -1 });
    return entries;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async readText(path: string): Promise<string> {
    try {
      return await this.fs.readFile(path, 'utf8');
    } catch {
      return '';
    }
  }

  private async writeText(path: string, text: string): Promise<void> {
    await this.fs.writeFile(path, text.endsWith('\n') || text === '' ? text : `${text}\n`);
  }
}

/** `Section.Sub.Key` → `section.Sub.key`; null without a section. */
function canonicalName(name: string): string | null {
  const first = name.indexOf('.');
  const last = name.lastIndexOf('.');
  if (first <= 0 || last === name.length - 1) return null;
  const section = name.slice(0, first).toLowerCase();
  const key = name.slice(last + 1).toLowerCase();
  const sub = first === last ? '' : `.${name.slice(first + 1, last)}`;
  return `${section}${sub}.${key}`;
}

function canonicalSection(name: string): string {
  const dot = name.indexOf('.');
  return dot === -1 ? name.toLowerCase() : `${name.slice(0, dot).toLowerCase()}${name.slice(dot)}`;
}

function sectionHeader(name: string): string {
  const dot = name.indexOf('.');
  if (dot === -1) return `[${name}]`;
  return `[${name.slice(0, dot)} "${name.slice(dot + 1).replace(/["\\]/g, '\\$&')}"]`;
}

function parseConfig(text: string): ParsedConfig {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const entries: ConfigEntry[] = [];
  const sections: ParsedConfig['sections'] = [];
  let section = '';

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) return;
    const header = line.match(/^\[\s*([^\s\]"]+)(?:\s+"((?:[^"\\]|\\.)*)")?\s*\]/);
    if (header) {
      const [, name, sub] = header;
      // The legacy `[section.sub]` syntax lowercases the subsection too.
      section = sub !== undefined ? `${name.toLowerCase()}.${sub.replace(/\\(.)/g, '$1')}` : name.toLowerCase();
      sections.push({ name: section, line: i });
      return;
    }
    if (!section) return;
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9-]*)\s*(?:=\s*(.*))?$/);
    if (!kv) return;
    const value = kv[2] === undefined ? 'true' : unquote(kv[2]);
    entries.push({ name: `${section}.${kv[1].toLowerCase()}`, value, line: i });
  });

  return { lines, entries, sections };
}

function unquote(raw: string): string {
  let out = '';
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      quoted = !quoted;
    } else if (c === '\\' && i + 1 < raw.length) {
      const n = raw[++i];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'b' ? '\b' : n;
    } else if ((c === '#' || c === ';') && !quoted) {
      break;
    } else {
      out += c;
    }
  }
  return quoted ? out : out.trimEnd();
}

function sectionRanges(config: ParsedConfig): Array<{ name: string; start: number; end: number }> {
  return config.sections.map((s, i) => ({
    name: s.name,
    start: s.line,
    end: i + 1 < config.sections.length ? config.sections[i + 1].line : config.lines.length,
  }));
}

function removeLines(lines: string[], drop: number[]): string {
  const set = new Set(drop);
  return lines.filter((_, i) => !set.has(i)).join('\n');
}

function formatValue(value: string, type: string | undefined): string {
  if (type === 'bool') {
    const v = value.toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(v)) return 'true';
    if (['false', 'no', 'off', '0', ''].includes(v)) return 'false';
  }
  if (type === 'int') {
    const m = value.match(/^(-?\d+)([kmg])?$/i);
    if (m) {
      const mult = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[(m[2] ?? '').toLowerCase() as 'k' | 'm' | 'g'] ?? 1;
      return String(parseInt(m[1], 10) * mult);
    }
  }
  return value;
}
