export interface ArgSpec {
  /** Options without a value, by spelling (`a`, `all`) → canonical name. */
  flags?: Record<string, string>;
  /** Options that take a value (`-m msg`, `-mmsg`, `--message=msg`, `--message msg`). */
  values?: Record<string, string>;
  /** Long options whose value is optional and only given as `--name=value`. */
  optional?: Record<string, string>;
  /** Canonical name that `-<number>` sets, as in `git log -3`. */
  numeric?: string;
}

/**
 * Parsed command-line arguments, in git's getopt style: short options can be
 * bundled (`-qam msg`), a value can be attached (`-mmsg`, `--message=msg`),
 * `--no-<flag>` negates a flag, and everything after `--` is a path.
 */
export class ParsedArgs {
  readonly flags = new Map<string, boolean>();
  readonly values = new Map<string, string[]>();
  readonly positionals: string[] = [];
  readonly paths: string[] = [];
  readonly unknown: string[] = [];
  /** Whether `--` was given. */
  dashDash = false;

  /** Whether a flag was given (and not later negated). */
  has(name: string): boolean {
    return this.flags.get(name) === true || this.values.has(name);
  }

  /** Whether a flag was explicitly negated with `--no-<name>`. */
  negated(name: string): boolean {
    return this.flags.get(name) === false;
  }

  /** The last value given for an option. */
  get(name: string): string | undefined {
    const all = this.values.get(name);
    return all?.[all.length - 1];
  }

  /** Every value given for an option, in order. */
  getAll(name: string): string[] {
    return this.values.get(name) ?? [];
  }

  /** Positionals followed by paths after `--`. */
  get rest(): string[] {
    return [...this.positionals, ...this.paths];
  }
}

export function parseArgs(args: string[], spec: ArgSpec): ParsedArgs {
  const flags = spec.flags ?? {};
  const values = spec.values ?? {};
  const optional = spec.optional ?? {};
  const out = new ParsedArgs();

  const addValue = (name: string, value: string) => {
    out.values.set(name, [...(out.values.get(name) ?? []), value]);
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (out.dashDash) {
      out.paths.push(arg);
    } else if (arg === '--') {
      out.dashDash = true;
    } else if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      const attached = eq === -1 ? undefined : arg.slice(eq + 1);

      if (key in values) {
        if (attached !== undefined) addValue(values[key], attached);
        else if (i + 1 < args.length) addValue(values[key], args[++i]);
        else out.unknown.push(arg);
      } else if (key in optional) {
        if (attached !== undefined) addValue(optional[key], attached);
        else out.flags.set(optional[key], true);
      } else if (key in flags && attached === undefined) {
        out.flags.set(flags[key], true);
      } else if (key.startsWith('no-') && key.slice(3) in flags) {
        out.flags.set(flags[key.slice(3)], false);
      } else if (key.startsWith('no-') && key.slice(3) in values) {
        out.values.delete(values[key.slice(3)]);
        out.flags.set(values[key.slice(3)], false);
      } else {
        out.unknown.push(arg);
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      if (spec.numeric && /^-\d+$/.test(arg)) {
        addValue(spec.numeric, arg.slice(1));
        continue;
      }
      for (let j = 1; j < arg.length; j++) {
        const c = arg[j];
        if (c in values) {
          const attached = arg.slice(j + 1).replace(/^=/, '');
          if (attached) addValue(values[c], attached);
          else if (i + 1 < args.length) addValue(values[c], args[++i]);
          else out.unknown.push(`-${c}`);
          break;
        } else if (c in flags) {
          out.flags.set(flags[c], true);
        } else if (spec.numeric && /\d/.test(c) && j === 1) {
          addValue(spec.numeric, arg.slice(1));
          break;
        } else {
          out.unknown.push(`-${c}`);
        }
      }
    } else {
      out.positionals.push(arg);
    }
  }

  return out;
}

/** git's message for an option it doesn't know. */
export function unknownOption(option: string, usage: string): string {
  const name = option.replace(/^-+/, '').split('=')[0];
  const label = option.startsWith('--') ? `option \`${name}'` : `switch \`${name}'`;
  return `error: unknown ${label}\nusage: ${usage}`;
}
