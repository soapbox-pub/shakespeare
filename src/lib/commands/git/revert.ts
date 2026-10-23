import type { ShellCommandResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import { Picker } from "./pick";

/** `git revert`: create commits that undo earlier commits. */
export class GitRevertCommand implements GitSubcommand {
  name = 'revert';
  description = 'Revert some existing commits';
  usage = 'git revert [--[no-]edit] [-n] [-m <parent-number>] [-s] <commit>... | (--continue | --skip | --abort | --quit)';

  private picker: Picker;

  constructor(options: GitSubcommandOptions) {
    this.picker = new Picker(options.git, options.fs, 'revert', this.usage);
  }

  execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    return this.picker.execute(args, cwd);
  }
}
