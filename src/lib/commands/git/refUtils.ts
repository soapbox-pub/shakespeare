import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';
import { readGitSettings } from '../../configUtils';
import { abbrev } from './revisions';

/** Whether `ancestor` is reachable from `descendant` (or is it). */
export async function isAncestor(git: Git, dir: string, ancestor: string, descendant: string): Promise<boolean> {
  if (ancestor === descendant) return true;
  try {
    return await git.isDescendent({ dir, oid: descendant, ancestor, depth: -1 });
  } catch {
    return false;
  }
}

/** Every commit reachable from `oid`. */
export async function ancestors(git: Git, dir: string, oid: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const queue = [oid];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    try {
      const { commit } = await git.readCommit({ dir, oid: next });
      queue.push(...commit.parent);
    } catch {
      // Shallow or missing.
    }
  }
  return seen;
}

/** Commits only in `a` and only in `b`, as `git rev-list --left-right --count a...b` counts them. */
export async function aheadBehind(git: Git, dir: string, a: string, b: string): Promise<{ ahead: number; behind: number }> {
  if (a === b) return { ahead: 0, behind: 0 };
  const left = await ancestors(git, dir, a);
  const right = await ancestors(git, dir, b);
  let ahead = 0;
  let behind = 0;
  for (const oid of left) if (!right.has(oid)) ahead++;
  for (const oid of right) if (!left.has(oid)) behind++;
  return { ahead, behind };
}

/** The identity used for commits and tags: Shakespeare's Git settings, then the repository config. */
export async function identity(git: Git, fs: JSRuntimeFS, dir: string): Promise<{ name: string; email: string }> {
  const settings = await readGitSettings(fs);
  if (settings.name && settings.email) return { name: settings.name, email: settings.email };
  const name = await git.getConfig({ dir, path: 'user.name' }).catch(() => undefined);
  const email = await git.getConfig({ dir, path: 'user.email' }).catch(() => undefined);
  return {
    name: typeof name === 'string' && name ? name : 'shakespeare.diy',
    email: typeof email === 'string' && email ? email : 'assistant@shakespeare.diy',
  };
}

/** A person line for a new object, timestamped now. */
export async function signature(git: Git, fs: JSRuntimeFS, dir: string) {
  const { name, email } = await identity(git, fs, dir);
  return { name, email, timestamp: Math.floor(Date.now() / 1000), timezoneOffset: new Date().getTimezoneOffset() };
}

/** Roughly `git check-ref-format --branch`. */
export function isValidRefName(name: string): boolean {
  return name !== '' && name !== 'HEAD' && name !== '@' && !name.startsWith('-') &&
    !/(\.\.|[\s~^:?*[\\\x00-\x1f\x7f]|@\{|\/\/|^\/|\/$|\.lock$|\.$|^\.|\/\.)/.test(name);
}

/** Glob match for `--list <pattern>` (`*`, `?`, `[...]`). */
export function matchesGlob(name: string, pattern: string): boolean {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end === -1) re += '\\[';
      else {
        re += pattern.slice(i, end + 1).replace(/^\[!/, '[^');
        i = end;
      }
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(name);
}

/** Version-aware comparison for `--sort=version:refname`. */
export function compareVersions(a: string, b: string): number {
  const split = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const pa = split(a);
  const pb = split(b);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) return parseInt(x, 10) - parseInt(y, 10);
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

export interface RefFormatFields {
  refname: string;
  short: string;
  oid: string;
  subject: string;
  body?: string;
  head?: boolean;
  upstream?: string;
  objecttype?: string;
}

/** Expand the common `--format` atoms of `git branch` / `git tag` (`%(refname:short)` etc). */
export function expandRefFormat(format: string, f: RefFormatFields): string {
  return format
    .replace(/%\((-?[a-z]+)(?::([a-z]+))?\)/g, (match, atom: string, mod?: string) => {
      switch (atom) {
        case 'refname': return mod === 'short' || mod === 'strip' ? f.short : f.refname;
        case 'objectname': return mod === 'short' ? abbrev(f.oid) : f.oid;
        case 'subject': return f.subject;
        case 'contents': return mod === 'subject' ? f.subject : mod === 'body' ? (f.body ?? '') : `${f.subject}\n${f.body ? `\n${f.body}` : ''}`;
        case 'body': return f.body ?? '';
        case 'HEAD': return f.head ? '*' : ' ';
        case 'upstream': return mod === 'short' ? (f.upstream ?? '').replace(/^refs\/remotes\//, '') : (f.upstream ?? '');
        case 'objecttype': return f.objecttype ?? 'commit';
        default: return match;
      }
    })
    .replace(/%([0-9a-f]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/%%/g, '%');
}

/**
 * Give options like `--contains [<commit>]` an explicit value: the next
 * argument when there is one, else `HEAD`, as git does for options whose
 * value is optional only as the last argument.
 */
export function attachDefaultValues(args: string[], names: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') {
      out.push(...args.slice(i));
      break;
    }
    if (arg.startsWith('--') && names.includes(arg.slice(2))) {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        out.push(`${arg}=${next}`);
        i++;
      } else {
        out.push(`${arg}=HEAD`);
      }
    } else {
      out.push(arg);
    }
  }
  return out;
}
