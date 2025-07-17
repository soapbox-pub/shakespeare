import type LightningFS from '@isomorphic-git/lightning-fs';
import { join } from "@std/path/posix/join";
import { tool } from "ai";
import z from 'zod';

export class FsToolSet {
  constructor(readonly fs: LightningFS.PromisifiedFS, private cwd?: string) {}

  readonly readFile = tool({
    description: 'Read the contents of a file in the project',
    parameters: FsToolSet.readFileSchema,
    execute: (args) => {
      const filepath = join(this.cwd || '', args.filePath);
      return this.fs.readFile(filepath, 'utf8');
    },
  });

  readonly writeFile = tool({
    description: 'Write content to a file in the project',
    parameters: FsToolSet.writeFileSchema,
    execute: async (args) => {
      const filepath = join(this.cwd || '', args.filePath);
      await this.fs.writeFile(filepath, args.content, 'utf8');
      return `File ${args.filePath} written successfully`;
    },
  });

  static readFileSchema = z.object({
    filePath: z.string(),
    content: z.string().optional(),
  });

  static writeFileSchema = z.object({
    filePath: z.string(),
    content: z.string(),
  });
}