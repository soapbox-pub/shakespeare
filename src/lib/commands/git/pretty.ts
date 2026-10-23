import type { ReadCommitResult } from 'isomorphic-git';
import type { Git } from '../../git';
import { abbrev } from './revisions';

type Person = ReadCommitResult['commit']['author'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `+0200` from isomorphic-git's offset (minutes, sign inverted like `Date#getTimezoneOffset`). */
export function formatTimezone(offset: number): string {
  const minutes = -offset;
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
}

/** The person's wall-clock time, as a Date whose UTC fields hold it. */
function localTime(person: Person): Date {
  return new Date((person.timestamp - person.timezoneOffset * 60) * 1000);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** git's default date format: `Fri Oct 23 17:08:10 2026 -0700`. */
export function formatDate(person: Person): string {
  const d = localTime(person);
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${d.getUTCFullYear()} ${formatTimezone(person.timezoneOffset)}`;
}

function isoDate(person: Person, strict: boolean): string {
  const d = localTime(person);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const tz = formatTimezone(person.timezoneOffset);
  return strict ? `${date}T${time}${tz.slice(0, 3)}:${tz.slice(3)}` : `${date} ${time} ${tz}`;
}

function shortDate(person: Person): string {
  return isoDate(person, false).slice(0, 10);
}

export function relativeDate(timestamp: number, now = Date.now() / 1000): string {
  const diff = Math.max(0, Math.round(now - timestamp));
  const units: Array<[number, string]> = [
    [60, 'second'], [60 * 60, 'minute'], [60 * 60 * 24, 'hour'], [60 * 60 * 24 * 14, 'day'],
    [60 * 60 * 24 * 70, 'week'], [60 * 60 * 24 * 365, 'month'],
  ];
  const sizes = [1, 60, 60 * 60, 60 * 60 * 24, 60 * 60 * 24 * 7, 60 * 60 * 24 * 30];
  for (let i = 0; i < units.length; i++) {
    if (diff < units[i][0]) {
      const n = Math.round(diff / sizes[i]);
      return `${n} ${units[i][1]}${n === 1 ? '' : 's'} ago`;
    }
  }
  const years = Math.round(diff / (60 * 60 * 24 * 365));
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** A date in one of git's `--date` styles. */
export function formatDateStyle(person: Person, style: string | undefined): string {
  switch (style) {
    case 'iso':
    case 'iso8601':
      return isoDate(person, false);
    case 'iso-strict':
    case 'iso8601-strict':
      return isoDate(person, true);
    case 'short':
      return shortDate(person);
    case 'relative':
      return relativeDate(person.timestamp);
    case 'unix':
      return String(person.timestamp);
    case 'raw':
      return `${person.timestamp} ${formatTimezone(person.timezoneOffset)}`;
    case 'rfc':
    case 'rfc2822': {
      const d = localTime(person);
      return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${formatTimezone(person.timezoneOffset)}`;
    }
    default:
      return formatDate(person);
  }
}

/** Refs pointing at each commit, for `--decorate` and `%d`. */
export type Decorations = Map<string, string[]>;

export async function loadDecorations(git: Git, dir: string): Promise<Decorations> {
  const decorations: Decorations = new Map();
  const add = (oid: string, name: string) => decorations.set(oid, [...(decorations.get(oid) ?? []), name]);

  let head: string | undefined;
  let branch: string | undefined;
  try {
    head = await git.resolveRef({ dir, ref: 'HEAD' });
    branch = (await git.currentBranch({ dir })) ?? undefined;
  } catch {
    return decorations;
  }

  if (!branch) add(head, 'HEAD');
  for (const name of await git.listBranches({ dir })) {
    try {
      const oid = await git.resolveRef({ dir, ref: `refs/heads/${name}` });
      add(oid, name === branch ? `HEAD -> ${name}` : name);
    } catch {
      // Dangling ref.
    }
  }
  for (const remote of await git.listRemotes({ dir })) {
    for (const name of await git.listBranches({ dir, remote: remote.remote })) {
      try {
        const oid = await git.resolveRef({ dir, ref: `refs/remotes/${remote.remote}/${name}` });
        add(oid, `${remote.remote}/${name}`);
      } catch {
        // Dangling ref.
      }
    }
  }
  for (const name of await git.listTags({ dir })) {
    try {
      const oid = await git.resolveRef({ dir, ref: `refs/tags/${name}` });
      const obj = await git.readObject({ dir, oid, format: 'parsed' });
      add(obj.type === 'tag' ? (obj.object as { object: string }).object : oid, `tag: ${name}`);
    } catch {
      // Dangling ref.
    }
  }

  // HEAD first, then in the order git prints: branch, remotes, tags.
  for (const [oid, names] of decorations) {
    decorations.set(oid, names.sort((a, b) => rank(a) - rank(b)));
  }
  return decorations;
}

function rank(name: string): number {
  if (name.startsWith('HEAD')) return 0;
  if (name.startsWith('tag: ')) return 3;
  return name.includes('/') ? 2 : 1;
}

function subject(message: string): string {
  // git joins the first paragraph's lines into the subject.
  return message.trim().split(/\n\s*\n/)[0]?.replace(/\n/g, ' ') ?? '';
}

function body(message: string): string {
  const trimmed = message.trim();
  const blank = trimmed.search(/\n\s*\n/);
  return blank === -1 ? '' : trimmed.slice(blank).replace(/^\s*\n/, '') + '\n';
}

function indent(message: string): string[] {
  return message.replace(/\n+$/, '').split('\n').map((line) => `    ${line}`);
}

export interface PrettyOptions {
  /** `oneline`, `short`, `medium`, `full`, `fuller`, `raw`, `format:...`, `tformat:...`, or a bare format string. */
  format: string;
  abbrevCommit?: boolean;
  dateStyle?: string;
  decorations?: Decorations;
}

/**
 * Render a commit in one of git's pretty formats. The result has no trailing
 * newline; built-in formats other than `oneline` end with the message.
 */
export function formatCommit(entry: ReadCommitResult, options: PrettyOptions): string {
  const { oid, commit } = entry;
  const fmt = options.format;
  const hash = options.abbrevCommit ? abbrev(oid) : oid;
  const refs = options.decorations?.get(oid);
  const decoration = refs?.length ? ` (${refs.join(', ')})` : '';
  const date = (p: Person) => formatDateStyle(p, options.dateStyle);

  if (fmt.startsWith('format:') || fmt.startsWith('tformat:') || fmt.includes('%')) {
    return expandFormat(entry, fmt.replace(/^t?format:/, ''), options);
  }

  const merge = commit.parent.length > 1 ? [`Merge: ${commit.parent.map((p) => abbrev(p)).join(' ')}`] : [];

  switch (fmt) {
    case 'oneline':
      return `${options.abbrevCommit ? abbrev(oid) : oid}${decoration} ${subject(commit.message)}`;
    case 'short':
      return [`commit ${hash}${decoration}`, ...merge, `Author: ${commit.author.name} <${commit.author.email}>`, '', `    ${subject(commit.message)}`].join('\n');
    case 'full':
      return [
        `commit ${hash}${decoration}`, ...merge,
        `Author: ${commit.author.name} <${commit.author.email}>`,
        `Commit: ${commit.committer.name} <${commit.committer.email}>`,
        '', ...indent(commit.message),
      ].join('\n');
    case 'fuller':
      return [
        `commit ${hash}${decoration}`, ...merge,
        `Author:     ${commit.author.name} <${commit.author.email}>`,
        `AuthorDate: ${date(commit.author)}`,
        `Commit:     ${commit.committer.name} <${commit.committer.email}>`,
        `CommitDate: ${date(commit.committer)}`,
        '', ...indent(commit.message),
      ].join('\n');
    case 'raw':
      return [
        `commit ${oid}`,
        `tree ${commit.tree}`,
        ...commit.parent.map((p) => `parent ${p}`),
        `author ${commit.author.name} <${commit.author.email}> ${commit.author.timestamp} ${formatTimezone(commit.author.timezoneOffset)}`,
        `committer ${commit.committer.name} <${commit.committer.email}> ${commit.committer.timestamp} ${formatTimezone(commit.committer.timezoneOffset)}`,
        '', ...indent(commit.message),
      ].join('\n');
    default:
      return [
        `commit ${hash}${decoration}`, ...merge,
        `Author: ${commit.author.name} <${commit.author.email}>`,
        `Date:   ${date(commit.author)}`,
        '', ...indent(commit.message),
      ].join('\n');
  }
}

/** Expand `%` placeholders in a `--format` string. */
export function expandFormat(entry: ReadCommitResult, format: string, options: Omit<PrettyOptions, 'format'> = {}): string {
  const { oid, commit } = entry;
  const refs = options.decorations?.get(oid) ?? [];
  const person = (p: Person, key: string): string | undefined => {
    switch (key) {
      case 'n': return p.name;
      case 'N': return p.name;
      case 'e': return p.email;
      case 'E': return p.email;
      case 'l': return p.email.split('@')[0];
      case 'd': return formatDateStyle(p, options.dateStyle);
      case 'D': return formatDateStyle(p, 'rfc');
      case 'r': return relativeDate(p.timestamp);
      case 't': return String(p.timestamp);
      case 'i': return isoDate(p, false);
      case 'I': return isoDate(p, true);
      case 's': return shortDate(p);
      default: return undefined;
    }
  };

  return format.replace(/%(?:C\([^)]*\)|C(?:red|green|blue|reset)|x[0-9a-fA-F]{2}|[ac][a-zA-Z]|[<>]\(\d+(?:,[a-z]+)?\)|.)/g, (token) => {
    const spec = token.slice(1);
    if (spec.startsWith('C') || spec.startsWith('<') || spec.startsWith('>')) return '';
    if (spec.startsWith('x')) return String.fromCharCode(parseInt(spec.slice(1), 16));
    if (spec.length === 2 && (spec[0] === 'a' || spec[0] === 'c')) {
      const value = person(spec[0] === 'a' ? commit.author : commit.committer, spec[1]);
      if (value !== undefined) return value;
    }
    switch (spec) {
      case 'H': return oid;
      case 'h': return abbrev(oid);
      case 'T': return commit.tree;
      case 't': return abbrev(commit.tree);
      case 'P': return commit.parent.join(' ');
      case 'p': return commit.parent.map((p) => abbrev(p)).join(' ');
      case 's': return subject(commit.message);
      case 'f': return subject(commit.message).replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-|-$/g, '');
      case 'b': return body(commit.message);
      case 'B': return commit.message.replace(/\n*$/, '\n');
      case 'd': return refs.length ? ` (${refs.join(', ')})` : '';
      case 'D': return refs.join(', ');
      case 'n': return '\n';
      case '%': return '%';
      case 'm': return '';
      default: return token;
    }
  });
}

/**
 * Whether a format separates entries (`format:`) rather than terminating
 * them (`tformat:`, and bare format strings).
 */
export function isSeparatorFormat(format: string): boolean {
  return format.startsWith('format:');
}

/** Normalize `--pretty`/`--format` values: `--format=%h` is `tformat:%h`. */
export function normalizePrettyFormat(value: string): string {
  if (['oneline', 'short', 'medium', 'full', 'fuller', 'raw', 'reference', 'email'].includes(value)) return value;
  if (value.startsWith('format:') || value.startsWith('tformat:')) return value;
  return `tformat:${value}`;
}
