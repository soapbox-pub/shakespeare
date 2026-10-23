import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";

const USAGE = `git remote [-v | --verbose]
   or: git remote add [-t <branch>] [-m <master>] [-f] [--tags | --no-tags] <name> <url>
   or: git remote rename <old> <new>
   or: git remote remove <name>
   or: git remote set-head <name> (-a | --auto | -d | --delete | <branch>)
   or: git remote [-v | --verbose] show [-n] <name>
   or: git remote get-url [--push] [--all] <name>
   or: git remote set-url [--push] <name> <newurl> [<oldurl>]`;

export class GitRemoteCommand implements GitSubcommand {
  name = 'remote';
  description = 'Manage set of tracked repositories';
  usage = USAGE;

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

      // Options before the subcommand (`git remote -v show origin`).
      let i = 0;
      let verbose = false;
      while (i < args.length && args[i].startsWith('-')) {
        if (args[i] === '-v' || args[i] === '--verbose') verbose = true;
        else return createErrorResult(unknownOption(args[i], USAGE), 129);
        i++;
      }
      const sub = args[i];
      const rest = args.slice(i + 1);

      switch (sub) {
        case undefined:
          return await this.list(verbose, cwd);
        case 'add':
          return await this.add(rest, cwd);
        case 'remove':
        case 'rm':
          return await this.remove(rest, cwd);
        case 'rename':
          return await this.rename(rest, cwd);
        case 'set-url':
          return await this.setUrl(rest, cwd);
        case 'get-url':
          return await this.getUrl(rest, cwd);
        case 'show':
          return await this.show(rest, cwd);
        case 'set-head':
          return await this.setHead(rest, cwd);
        case 'prune':
        case 'update':
          return createErrorResult(`error: 'git remote ${sub}' is not supported here; use git fetch`, 1);
        default:
          return createErrorResult(`error: unknown subcommand: \`${sub}'\nusage: ${USAGE}`, 129);
      }
    } catch (error) {
      return createErrorResult(`git remote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async remotes(cwd: string) {
    return this.git.listRemotes({ dir: cwd });
  }

  private async list(verbose: boolean, cwd: string): Promise<ShellCommandResult> {
    const remotes = await this.remotes(cwd);
    let out = '';
    for (const { remote, url } of remotes) {
      if (verbose) {
        const pushUrl = (await this.git.getConfig({ dir: cwd, path: `remote.${remote}.pushurl` })) as string | undefined;
        out += `${remote}\t${url} (fetch)\n${remote}\t${pushUrl ?? url} (push)\n`;
      } else {
        out += `${remote}\n`;
      }
    }
    return createSuccessResult(out);
  }

  private async add(args: string[], cwd: string): Promise<ShellCommandResult> {
    const usage = 'git remote add [<options>] <name> <url>';
    const parsed = parseArgs(args, {
      flags: { f: 'fetch', fetch: 'fetch', tags: 'tags' },
      values: { t: 'track', track: 'track', m: 'master', master: 'master' },
      optional: { mirror: 'mirror' },
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], usage), 129);
    if (parsed.rest.length !== 2) return createErrorResult(`usage: ${usage}`, 129);
    const [name, url] = parsed.rest;
    if (!isValidRemoteName(name)) return createErrorResult(`fatal: '${name}' is not a valid remote name`, 128);
    if ((await this.remotes(cwd)).some((r) => r.remote === name)) {
      return createErrorResult(`error: remote ${name} already exists.`, 3);
    }
    await this.git.addRemote({ dir: cwd, remote: name, url });
    if (parsed.has('master')) {
      await this.writeSymref(cwd, `refs/remotes/${name}/HEAD`, `refs/remotes/${name}/${parsed.get('master')}`);
    }
    if (parsed.has('fetch')) {
      return { exitCode: 0, stdout: '', stderr: `warning: 'git remote add -f' does not fetch here; run 'git fetch ${name}'\n` };
    }
    return createSuccessResult('');
  }

  private async remove(args: string[], cwd: string): Promise<ShellCommandResult> {
    if (args.length !== 1) return createErrorResult('usage: git remote remove <name>', 129);
    const [name] = args;
    if (!(await this.remotes(cwd)).some((r) => r.remote === name)) {
      return createErrorResult(`error: No such remote: '${name}'`, 2);
    }
    await this.git.deleteRemote({ dir: cwd, remote: name });
    for (const ref of await this.remoteRefs(cwd, name)) {
      await this.git.deleteRef({ dir: cwd, ref: `refs/remotes/${name}/${ref}` });
    }
    await this.removeFile(`${cwd}/.git/refs/remotes/${name}/HEAD`);
    for (const branch of await this.git.listBranches({ dir: cwd })) {
      if ((await this.git.getConfig({ dir: cwd, path: `branch.${branch}.remote` })) === name) {
        await this.git.setConfig({ dir: cwd, path: `branch.${branch}.remote`, value: undefined });
        await this.git.setConfig({ dir: cwd, path: `branch.${branch}.merge`, value: undefined });
      }
    }
    return createSuccessResult('');
  }

  private async rename(args: string[], cwd: string): Promise<ShellCommandResult> {
    const positionals = args.filter((a) => !a.startsWith('-'));
    if (positionals.length !== 2) return createErrorResult('usage: git remote rename [--[no-]progress] <old> <new>', 129);
    const [from, to] = positionals;
    const remotes = await this.remotes(cwd);
    const old = remotes.find((r) => r.remote === from);
    if (!old) return createErrorResult(`error: No such remote: '${from}'`, 2);
    if (remotes.some((r) => r.remote === to)) return createErrorResult(`error: remote ${to} already exists.`, 3);
    if (!isValidRemoteName(to)) return createErrorResult(`fatal: '${to}' is not a valid remote name`, 128);

    const pushUrl = await this.git.getConfig({ dir: cwd, path: `remote.${from}.pushurl` }) as string | undefined;
    const symref = await this.readSymref(cwd, `refs/remotes/${from}/HEAD`);
    const refs = await this.remoteRefs(cwd, from);

    await this.git.deleteRemote({ dir: cwd, remote: from });
    await this.git.addRemote({ dir: cwd, remote: to, url: old.url });
    if (pushUrl) await this.git.setConfig({ dir: cwd, path: `remote.${to}.pushurl`, value: pushUrl });

    for (const ref of refs) {
      const oid = await this.git.resolveRef({ dir: cwd, ref: `refs/remotes/${from}/${ref}` });
      await this.git.writeRef({ dir: cwd, ref: `refs/remotes/${to}/${ref}`, value: oid, force: true });
      await this.git.deleteRef({ dir: cwd, ref: `refs/remotes/${from}/${ref}` });
    }
    if (symref) {
      await this.removeFile(`${cwd}/.git/refs/remotes/${from}/HEAD`);
      await this.writeSymref(cwd, `refs/remotes/${to}/HEAD`, symref.replace(`refs/remotes/${from}/`, `refs/remotes/${to}/`));
    }
    try {
      await this.fs.rmdir(`${cwd}/.git/refs/remotes/${from}`);
    } catch {
      // Not empty or not there.
    }
    for (const branch of await this.git.listBranches({ dir: cwd })) {
      if ((await this.git.getConfig({ dir: cwd, path: `branch.${branch}.remote` })) === from) {
        await this.git.setConfig({ dir: cwd, path: `branch.${branch}.remote`, value: to });
      }
    }
    return createSuccessResult('');
  }

  private async setUrl(args: string[], cwd: string): Promise<ShellCommandResult> {
    const usage = 'git remote set-url [--push] <name> <newurl> [<oldurl>]';
    const parsed = parseArgs(args, { flags: { push: 'push', add: 'add', delete: 'delete' } });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], usage), 129);
    if (parsed.rest.length < 2 || parsed.rest.length > 3) return createErrorResult(`usage: ${usage}`, 129);
    const [name, url] = parsed.rest;
    if (!(await this.remotes(cwd)).some((r) => r.remote === name)) {
      return createErrorResult(`error: No such remote '${name}'`, 2);
    }
    const key = `remote.${name}.${parsed.has('push') ? 'pushurl' : 'url'}`;
    if (parsed.has('delete')) {
      await this.git.setConfig({ dir: cwd, path: key, value: undefined });
    } else {
      await this.git.setConfig({ dir: cwd, path: key, value: url, append: parsed.has('add') });
    }
    return createSuccessResult('');
  }

  private async getUrl(args: string[], cwd: string): Promise<ShellCommandResult> {
    const usage = 'git remote get-url [--push] [--all] <name>';
    const parsed = parseArgs(args, { flags: { push: 'push', all: 'all' } });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], usage), 129);
    if (parsed.rest.length !== 1) return createErrorResult(`usage: ${usage}`, 129);
    const [name] = parsed.rest;
    if (!(await this.remotes(cwd)).some((r) => r.remote === name)) {
      return createErrorResult(`error: No such remote '${name}'`, 2);
    }
    let urls: string[] = [];
    if (parsed.has('push')) urls = (await this.git.getConfigAll({ dir: cwd, path: `remote.${name}.pushurl` })) as string[];
    if (urls.length === 0) urls = (await this.git.getConfigAll({ dir: cwd, path: `remote.${name}.url` })) as string[];
    if (!parsed.has('all')) urls = urls.slice(0, 1);
    return createSuccessResult(urls.map((u) => `${u}\n`).join(''));
  }

  private async show(args: string[], cwd: string): Promise<ShellCommandResult> {
    const names = args.filter((a) => !a.startsWith('-'));
    const remotes = await this.remotes(cwd);
    if (names.length === 0) return createSuccessResult(remotes.map((r) => `${r.remote}\n`).join(''));

    let out = '';
    for (const name of names) {
      const remote = remotes.find((r) => r.remote === name);
      if (!remote) {
        return createErrorResult(`fatal: '${name}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.`, 128);
      }
      const pushUrl = (await this.git.getConfig({ dir: cwd, path: `remote.${name}.pushurl` })) as string | undefined;
      const head = await this.readSymref(cwd, `refs/remotes/${name}/HEAD`);
      const branches = (await this.remoteRefs(cwd, name)).filter((b) => b !== 'HEAD').sort();
      out += `* remote ${name}\n`;
      out += `  Fetch URL: ${remote.url}\n`;
      out += `  Push  URL: ${pushUrl ?? remote.url}\n`;
      out += `  HEAD branch: ${head ? head.replace(`refs/remotes/${name}/`, '') : '(unknown)'}\n`;
      if (branches.length > 0) {
        const width = Math.max(...branches.map((b) => b.length));
        out += `  Remote branch${branches.length === 1 ? '' : 'es'}:\n`;
        for (const b of branches) out += `    ${b.padEnd(width)} tracked\n`;
      }
      const tracking: string[] = [];
      for (const branch of (await this.git.listBranches({ dir: cwd })).sort()) {
        if ((await this.git.getConfig({ dir: cwd, path: `branch.${branch}.remote` })) !== name) continue;
        const merge = (await this.git.getConfig({ dir: cwd, path: `branch.${branch}.merge` })) as string | undefined;
        if (merge) tracking.push(`    ${branch} merges with remote ${merge.replace(/^refs\/heads\//, '')}\n`);
      }
      if (tracking.length > 0) {
        out += `  Local branch${tracking.length === 1 ? '' : 'es'} configured for 'git pull':\n${tracking.join('')}`;
      }
    }
    return createSuccessResult(out);
  }

  private async setHead(args: string[], cwd: string): Promise<ShellCommandResult> {
    const [name, target] = args.filter((a) => !a.startsWith('-'));
    const del = args.includes('-d') || args.includes('--delete');
    const auto = args.includes('-a') || args.includes('--auto');
    if (!name) return createErrorResult('usage: git remote set-head <name> (-a | --auto | -d | --delete | <branch>)', 129);
    if (!(await this.remotes(cwd)).some((r) => r.remote === name)) {
      return createErrorResult(`error: No such remote '${name}'`, 2);
    }
    const headPath = `${cwd}/.git/refs/remotes/${name}/HEAD`;
    if (del) {
      await this.removeFile(headPath);
      return createSuccessResult('');
    }
    let branch: string | undefined = target;
    if (auto) {
      const refs = await this.remoteRefs(cwd, name);
      branch = ['main', 'master'].find((b) => refs.includes(b)) ?? refs.find((b) => b !== 'HEAD');
      if (!branch) return createErrorResult('error: Cannot determine remote HEAD', 1);
    }
    if (!branch) return createErrorResult('usage: git remote set-head <name> (-a | --auto | -d | --delete | <branch>)', 129);
    if (!(await this.remoteRefs(cwd, name)).includes(branch)) {
      return createErrorResult(`error: Not a valid ref: refs/remotes/${name}/${branch}`, 1);
    }
    await this.writeSymref(cwd, `refs/remotes/${name}/HEAD`, `refs/remotes/${name}/${branch}`);
    return createSuccessResult(`${name}/HEAD set to ${branch}\n`);
  }

  private async remoteRefs(cwd: string, name: string): Promise<string[]> {
    try {
      return await this.git.listRefs({ dir: cwd, filepath: `refs/remotes/${name}` });
    } catch {
      return [];
    }
  }

  private async readSymref(cwd: string, ref: string): Promise<string | undefined> {
    try {
      const content = (await this.fs.readFile(`${cwd}/.git/${ref}`, 'utf8')).trim();
      return content.startsWith('ref: ') ? content.slice(5) : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeSymref(cwd: string, ref: string, target: string): Promise<void> {
    await this.git.writeRef({ dir: cwd, ref, value: target, symbolic: true, force: true });
  }

  private async removeFile(path: string): Promise<void> {
    try {
      await this.fs.unlink(path);
    } catch {
      // Not there.
    }
  }
}

function isValidRemoteName(name: string): boolean {
  return name !== '' && !name.startsWith('-') && !/(\.\.|[\s~^:?*[\\]|@\{|\/\/|^\/|\/$|\.lock$|\.$)/.test(name);
}
