import type { ShellCommandResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import { Picker } from "./pick";

/** `git cherry-pick`: apply the changes introduced by existing commits. */
export class GitCherryPickCommand implements GitSubcommand {
  name = 'cherry-pick';
  description = 'Apply the changes introduced by some existing commits';
  usage = 'git cherry-pick [--edit] [-n] [-m <parent-number>] [-s] [-x] <commit>... | (--continue | --skip | --abort | --quit)';

  private picker: Picker;

  constructor(options: GitSubcommandOptions) {
    this.picker = new Picker(options.git, options.fs, 'cherry-pick', this.usage);
  }

  execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    return this.picker.execute(args, cwd);
  }
}
