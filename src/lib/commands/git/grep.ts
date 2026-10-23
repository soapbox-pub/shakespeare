import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { isBinary } from "./diffing";
import { listTree, matchesPathspec, readIndex, resolveTree, RevisionError, unknownRevision } from "./revisions";

interface GrepFile {
  /** Name as printed: `path`, or `rev:path` when searching a revision. */
  name: string;
  read(): Promise<Uint8Array>;
}

interface GrepOptions {
  regex: RegExp;
  invert: boolean;
  lineNumber: boolean;
  column: boolean;
  showName: boolean;
  onlyMatching: boolean;
  before: number;
  after: number;
  maxCount: number;
  skipBinary: boolean;
  text: boolean;
  heading: boolean;
  breakFiles: boolean;
}

const decoder = new TextDecoder();

export class GitGrepCommand implements GitSubcommand {
  name = 'grep';
  description = 'Print lines matching a pattern';
  usage = 'git grep [-n] [-i] [-w] [-v] [-l | -L | -c] [-E | -G | -F | -P] [-h | -H] [-o] [-q] [-I] [-A <n>] [-B <n>] [-C <n>] [--cached | --untracked] [-e] <pattern> [<rev>...] [[--] <path>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git', 128);
      }

      const parsed = parseArgs(args, {
        flags: {
          n: 'lineNumber', 'line-number': 'lineNumber',
          i: 'ignoreCase', 'ignore-case': 'ignoreCase', y: 'ignoreCase',
          w: 'word', 'word-regexp': 'word',
          v: 'invert', 'invert-match': 'invert',
          l: 'filesWith', 'files-with-matches': 'filesWith', 'name-only': 'filesWith',
          L: 'filesWithout', 'files-without-match': 'filesWithout',
          c: 'count', count: 'count',
          E: 'extended', 'extended-regexp': 'extended',
          G: 'basic', 'basic-regexp': 'basic',
          F: 'fixed', 'fixed-strings': 'fixed',
          P: 'perl', 'perl-regexp': 'perl',
          h: 'noFilename', 'no-filename': 'noFilename',
          H: 'withFilename', 'with-filename': 'withFilename',
          I: 'skipBinary',
          a: 'text', text: 'text',
          q: 'quiet', quiet: 'quiet',
          o: 'only', 'only-matching': 'only',
          cached: 'cached', staged: 'cached',
          untracked: 'untracked',
          r: 'recursive', recursive: 'recursive',
          'full-name': 'fullName',
          column: 'column',
          heading: 'heading',
          break: 'break',
          'no-index': 'noIndex',
          'exclude-standard': 'excludeStandard',
        },
        values: {
          e: 'pattern', A: 'after', 'after-context': 'after', B: 'before', 'before-context': 'before',
          C: 'context', context: 'context', m: 'maxCount', 'max-count': 'maxCount',
        },
        optional: { color: 'color' },
        numeric: 'context',
      });

      if (parsed.unknown.length > 0) {
        const option = parsed.unknown[0];
        if (/^-[eABCm]$/.test(option)) return createErrorResult(`error: switch \`${option.slice(1)}' requires a value`, 129);
        return createErrorResult(unknownOption(option, this.usage), 129);
      }
      if (parsed.has('noIndex')) return createErrorResult('fatal: --no-index is not supported', 128);

      const positionals = [...parsed.positionals];
      const patterns = parsed.getAll('pattern');
      if (patterns.length === 0) {
        const first = positionals.shift();
        if (first === undefined) return createErrorResult('fatal: no pattern given', 128);
        patterns.push(first);
      }

      let regex: RegExp;
      try {
        regex = buildRegExp(patterns, {
          type: parsed.has('fixed') ? 'fixed' : parsed.has('perl') ? 'perl' : parsed.has('extended') ? 'extended' : 'basic',
          ignoreCase: parsed.has('ignoreCase'),
          word: parsed.has('word'),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.replace(/^Invalid regular expression: (\/.*\/[a-z]*: )?/, '') : 'invalid pattern';
        return createErrorResult(`fatal: command line, '${patterns[0]}': ${message}`, 128);
      }

      // Revisions come first; the remaining arguments are paths.
      const revs: Array<{ name: string; tree: string }> = [];
      const pathspecs: string[] = [];
      let i = 0;
      for (; i < positionals.length; i++) {
        try {
          revs.push({ name: positionals[i], tree: await resolveTree(this.git, cwd, positionals[i]) });
        } catch {
          break;
        }
      }
      for (; i < positionals.length; i++) {
        const path = positionals[i];
        if (!(await this.exists(`${cwd}/${path}`)) && !/[*?[]/.test(path)) {
          return createErrorResult(`${unknownRevision(path)}\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`, 128);
        }
        pathspecs.push(path);
      }
      pathspecs.push(...parsed.paths);

      if (revs.length > 0 && parsed.has('cached')) {
        return createErrorResult('fatal: both --cached and trees are given', 128);
      }

      const files = revs.length > 0
        ? await this.revisionFiles(cwd, revs, pathspecs)
        : await this.indexFiles(cwd, pathspecs, parsed.has('cached'), parsed.has('untracked'));

      const context = parsed.get('context');
      const number = (value: string | undefined, fallback: number) => {
        const n = value === undefined ? NaN : parseInt(value, 10);
        return Number.isNaN(n) ? fallback : n;
      };
      const options: GrepOptions = {
        regex,
        invert: parsed.has('invert'),
        lineNumber: parsed.has('lineNumber'),
        column: parsed.has('column'),
        showName: !parsed.has('noFilename') || parsed.has('withFilename'),
        onlyMatching: parsed.has('only'),
        before: number(parsed.get('before'), number(context, 0)),
        after: number(parsed.get('after'), number(context, 0)),
        maxCount: number(parsed.get('maxCount'), Infinity),
        skipBinary: parsed.has('skipBinary'),
        text: parsed.has('text'),
        heading: parsed.has('heading'),
        breakFiles: parsed.has('break'),
      };
      if (options.heading) options.showName = false;

      const out: string[] = [];
      let found = false;
      let printedLines = false;

      for (const file of files) {
        const bytes = await file.read();
        const binary = !options.text && isBinary(bytes);
        if (binary && options.skipBinary) {
          if (parsed.has('filesWithout')) out.push(file.name);
          continue;
        }
        const lines = splitLines(decoder.decode(bytes));
        const matched = matchLines(lines, options);
        const count = matched.filter(Boolean).length;

        if (parsed.has('quiet')) {
          if (count > 0) return createSuccessResult('');
          continue;
        }
        if (parsed.has('filesWithout')) {
          if (count === 0) out.push(file.name);
          continue;
        }
        if (count === 0) continue;
        found = true;

        if (parsed.has('filesWith')) {
          out.push(file.name);
        } else if (parsed.has('count')) {
          out.push(options.showName ? `${file.name}:${count}` : String(count));
        } else if (binary) {
          out.push(`Binary file ${file.name} matches`);
        } else {
          if (options.breakFiles && printedLines) out.push('');
          if (options.heading) out.push(file.name);
          printedLines = formatMatches(out, file.name, lines, matched, options, printedLines && !options.breakFiles);
        }
      }

      if (parsed.has('quiet')) return { exitCode: 1, stdout: '', stderr: '' };
      if (parsed.has('filesWithout')) found = out.length > 0;
      const stdout = out.length > 0 ? `${out.join('\n')}\n` : '';
      return { exitCode: found ? 0 : 1, stdout, stderr: '' };
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message, 128);
      return createErrorResult(`git grep: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async revisionFiles(dir: string, revs: Array<{ name: string; tree: string }>, pathspecs: string[]): Promise<GrepFile[]> {
    const files: GrepFile[] = [];
    for (const rev of revs) {
      const entries = await listTree(this.git, dir, rev.tree);
      for (const path of [...entries.keys()].sort(comparePaths)) {
        const entry = entries.get(path)!;
        if (entry.type !== 'blob' || !matchesPathspec(path, pathspecs)) continue;
        files.push({
          name: `${rev.name}:${path}`,
          read: async () => (await this.git.readBlob({ dir, oid: entry.oid })).blob,
        });
      }
    }
    return files;
  }

  private async indexFiles(dir: string, pathspecs: string[], cached: boolean, untracked: boolean): Promise<GrepFile[]> {
    const index = await readIndex(this.git, dir);
    const paths = new Set([...index.keys()].filter((path) => index.get(path)!.mode !== '160000'));

    if (untracked && !cached) {
      for (const [path, head, workdir, stage] of await this.git.statusMatrix({ dir })) {
        if (head === 0 && stage === 0 && workdir === 2) paths.add(path);
      }
    }

    const files: GrepFile[] = [];
    for (const path of [...paths].sort(comparePaths)) {
      if (!matchesPathspec(path, pathspecs)) continue;
      if (cached) {
        const oid = index.get(path)!.oid;
        files.push({ name: path, read: async () => (await this.git.readBlob({ dir, oid })).blob });
      } else {
        // Tracked files deleted from the working tree are skipped.
        try {
          const stat = await this.fs.stat(`${dir}/${path}`);
          if (stat.isDirectory()) continue;
        } catch {
          continue;
        }
        files.push({ name: path, read: () => this.fs.readFile(`${dir}/${path}`) });
      }
    }
    return files;
  }
}

function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function matchLines(lines: string[], options: GrepOptions): boolean[] {
  const matched: boolean[] = [];
  let count = 0;
  for (const line of lines) {
    options.regex.lastIndex = 0;
    const hit = count < options.maxCount && options.regex.test(line) !== options.invert;
    if (hit) count++;
    matched.push(hit);
  }
  return matched;
}

/** Append matching lines (with context) to `out`; returns whether anything was printed. */
function formatMatches(out: string[], name: string, lines: string[], matched: boolean[], options: GrepOptions, printedBefore: boolean): boolean {
  const prefix = (index: number, sep: string, column?: number) => {
    let p = options.showName ? `${name}${sep}` : '';
    if (options.lineNumber) p += `${index + 1}${sep}`;
    if (options.column && column !== undefined) p += `${column}${sep}`;
    return p;
  };

  if (options.onlyMatching) {
    if (options.invert) return printedBefore;
    let printed = printedBefore;
    lines.forEach((line, index) => {
      if (!matched[index]) return;
      const global = new RegExp(options.regex.source, `${options.regex.flags.replace('g', '')}g`);
      for (const m of line.matchAll(global)) {
        if (m[0] === '') continue;
        out.push(`${prefix(index, ':', (m.index ?? 0) + 1)}${m[0]}`);
        printed = true;
      }
    });
    return printed;
  }

  const show = new Map<number, boolean>();
  matched.forEach((hit, index) => {
    if (!hit) return;
    for (let j = Math.max(0, index - options.before); j <= Math.min(lines.length - 1, index + options.after); j++) {
      if (!show.has(j)) show.set(j, false);
    }
    show.set(index, true);
  });

  const hasContext = options.before > 0 || options.after > 0;
  let printed = printedBefore;
  let last = -2;
  for (const index of [...show.keys()].sort((a, b) => a - b)) {
    if (hasContext && printed && index !== last + 1) out.push('--');
    const isMatch = show.get(index)!;
    let column: number | undefined;
    if (isMatch && options.column) {
      options.regex.lastIndex = 0;
      column = options.invert ? 1 : (options.regex.exec(lines[index])?.index ?? 0) + 1;
    }
    out.push(`${prefix(index, isMatch ? ':' : '-', isMatch ? column : undefined)}${lines[index]}`);
    printed = true;
    last = index;
  }
  return printed;
}

const POSIX_CLASSES: Record<string, string> = {
  alpha: 'a-zA-Z', digit: '0-9', alnum: 'a-zA-Z0-9', upper: 'A-Z', lower: 'a-z',
  space: '\\s', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: '\\w', cntrl: '\\x00-\\x1f',
};

/** Copy a bracket expression starting at `start`, returning its JS form and the index of its `]`. */
function bracket(pattern: string, start: number): [string, number] {
  let i = start + 1;
  let out = '[';
  if (pattern[i] === '^') {
    out += '^';
    i++;
  }
  if (pattern[i] === ']') {
    out += '\\]';
    i++;
  }
  for (; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === ']') return [`${out}]`, i];
    const cls = pattern.slice(i).match(/^\[:([a-z]+):\]/);
    if (cls && POSIX_CLASSES[cls[1]]) {
      out += POSIX_CLASSES[cls[1]];
      i += cls[0].length - 1;
    } else if (c === '\\' || c === '[') {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return ['\\[', start];
}

/** Translate a POSIX basic or extended regex into a JavaScript one. */
function posixToJs(pattern: string, basic: boolean): string {
  const special = '(){}|+?';
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const n = pattern[++i];
      if (n === '<' || n === '>') out += '\\b';
      else if (basic && special.includes(n)) out += n;
      else out += `\\${n}`;
    } else if (c === '[') {
      const [cls, end] = bracket(pattern, i);
      out += cls;
      i = end;
    } else if (basic && special.includes(c)) {
      out += `\\${c}`;
    } else if (c === '*' && (out === '' || out.endsWith('(') || out === '^' || out.endsWith('|'))) {
      out += '\\*';
    } else {
      out += c;
    }
  }
  return out;
}

function buildRegExp(patterns: string[], options: { type: 'basic' | 'extended' | 'fixed' | 'perl'; ignoreCase: boolean; word: boolean }): RegExp {
  const sources = patterns.map((pattern) => {
    switch (options.type) {
      case 'fixed': return pattern.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      case 'perl': return pattern;
      default: return posixToJs(pattern, options.type === 'basic');
    }
  });
  let source = sources.map((s) => `(?:${s})`).join('|');
  if (options.word) source = `(?<![A-Za-z0-9_])(?:${source})(?![A-Za-z0-9_])`;
  return new RegExp(source, options.ignoreCase ? 'i' : '');
}
