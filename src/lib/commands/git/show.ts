import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitShowCommand implements GitSubcommand {
  name = 'show';
  description = 'Show various types of objects';
  usage = 'git show [<commit>]';

  private git: Git;
  private fs: JSRuntimeFS;
  private pwd: string;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
    this.pwd = options.pwd;
  }

  async execute(args: string[]): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await this.fs.stat(`${this.pwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { commit } = this.parseArgs(args);

      // Resolve the commit reference (handling relative refs like HEAD~1)
      const resolvedCommit = await this.resolveCommitRef(commit);
      if (!resolvedCommit) {
        return createErrorResult(`fatal: bad revision '${commit}'`);
      }

      return await this.showCommit(resolvedCommit);

    } catch (error) {
      return createErrorResult(`git show: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { commit: string } {
    let commit = 'HEAD'; // Default to HEAD

    for (const arg of args) {
      if (!arg.startsWith('-')) {
        commit = arg;
        break;
      }
    }

    return { commit };
  }

  /**
   * Resolve a commit reference, handling special syntax like HEAD~N and HEAD^N
   */
  private async resolveCommitRef(ref: string): Promise<string | null> {
    try {
      // Handle HEAD~N syntax (ancestor)
      const tildeMatch = ref.match(/^(.+)~(\d+)$/);
      if (tildeMatch) {
        const [, baseRef, steps] = tildeMatch;
        const numSteps = parseInt(steps, 10);
        
        if (numSteps === 0) {
          // ~0 is the commit itself
          return this.resolveCommitRef(baseRef);
        }
        
        // First resolve the base reference
        const baseCommit = await this.resolveCommitRef(baseRef);
        if (!baseCommit) {
          throw new Error(`Could not resolve base reference: ${baseRef}`);
        }
        
        // Walk back N steps in history
        return this.walkBackNCommits(baseCommit, numSteps);
      }
      
      // Handle HEAD^N syntax (Nth parent)
      const caretMatch = ref.match(/^(.+)\^(\d*)$/);
      if (caretMatch) {
        const [, baseRef, parentNum] = caretMatch;
        const parentIndex = parentNum ? parseInt(parentNum, 10) - 1 : 0; // Default to first parent
        
        // First resolve the base reference
        const baseCommit = await this.resolveCommitRef(baseRef);
        if (!baseCommit) {
          throw new Error(`Could not resolve base reference: ${baseRef}`);
        }
        
        // Get the specified parent
        return this.getNthParent(baseCommit, parentIndex);
      }
      
      // Handle simple reference (direct resolution)
      try {
        return await this.git.resolveRef({
          dir: this.pwd,
          ref,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('does not exist')) {
          return null;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error resolving commit reference:', error);
      return null;
    }
  }
  
  /**
   * Walk back N commits from the given commit
   */
  private async walkBackNCommits(startCommit: string, steps: number): Promise<string | null> {
    try {
      let currentCommit = startCommit;
      
      for (let i = 0; i < steps; i++) {
        // Get the commit object
        const commit = await this.git.readCommit({
          dir: this.pwd,
          oid: currentCommit,
        });
        
        // Check if the commit has parents
        if (!commit.commit.parent || commit.commit.parent.length === 0) {
          throw new Error(`Commit ${currentCommit.substring(0, 7)} has no parent, cannot go back further`);
        }
        
        // Move to the first parent
        currentCommit = commit.commit.parent[0];
      }
      
      return currentCommit;
    } catch (error) {
      console.error('Error walking back commits:', error);
      return null;
    }
  }
  
  /**
   * Get the Nth parent of the given commit
   */
  private async getNthParent(commit: string, parentIndex: number): Promise<string | null> {
    try {
      // Get the commit object
      const commitObj = await this.git.readCommit({
        dir: this.pwd,
        oid: commit,
      });
      
      // Check if the commit has parents
      if (!commitObj.commit.parent || commitObj.commit.parent.length === 0) {
        throw new Error(`Commit ${commit.substring(0, 7)} has no parents`);
      }
      
      // Check if the requested parent index is valid
      if (parentIndex < 0 || parentIndex >= commitObj.commit.parent.length) {
        throw new Error(`Commit ${commit.substring(0, 7)} does not have a parent at index ${parentIndex + 1}`);
      }
      
      // Return the specified parent
      return commitObj.commit.parent[parentIndex];
    } catch (error) {
      console.error('Error getting parent commit:', error);
      return null;
    }
  }

  private async showCommit(commitRef: string): Promise<ShellCommandResult> {
    try {
      // Get the commit
      const commits = await this.git.log({
        dir: this.pwd,
        depth: 1,
        ref: commitRef,
      });

      if (commits.length === 0) {
        return createErrorResult(`fatal: bad revision '${commitRef}'`);
      }

      const commit = commits[0];
      const lines: string[] = [];

      // Show commit information
      lines.push(`commit ${commit.oid}`);

      // Show parent commits if any
      if (commit.commit.parent && commit.commit.parent.length > 0) {
        for (const parent of commit.commit.parent) {
          lines.push(`parent ${parent}`);
        }
      }

      lines.push(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
      lines.push(`Date:   ${new Date(commit.commit.author.timestamp * 1000).toUTCString()}`);
      lines.push('');

      // Show commit message (indented)
      const messageLines = commit.commit.message.split('\n');
      for (const messageLine of messageLines) {
        lines.push(`    ${messageLine}`);
      }
      lines.push('');

      // Show the actual diff between this commit and its parent
      try {
        // If there's no parent, this is the first commit - show the entire tree
        if (!commit.commit.parent || commit.commit.parent.length === 0) {
          lines.push('(This is the initial commit)');
          
          // Get the tree for this commit
          const tree = await this.git.readTree({
            dir: this.pwd,
            oid: commit.oid,
          });

          if (tree.tree.length > 0) {
            lines.push('');
            lines.push('New files:');
            for (const entry of tree.tree) {
              lines.push(`new file: ${entry.path}`);
            }
          }
        } else {
          // Get the parent commit to compare with
          const parentCommit = commit.commit.parent[0];
          
          // Get the trees for both commits
          const parentTree = await this.git.readTree({
            dir: this.pwd,
            oid: parentCommit,
          });
          
          const commitTree = await this.git.readTree({
            dir: this.pwd,
            oid: commit.oid,
          });
          
          // Define types for tree entries
          interface TreeEntry {
            mode: string;
            path: string;
            oid: string;
            type?: string;
          }
          
          // Compare the trees manually
          const parentFiles = new Map<string, TreeEntry>();
          const commitFiles = new Map<string, TreeEntry>();
          
          // Populate the maps
          for (const entry of parentTree.tree) {
            parentFiles.set(entry.path, entry as TreeEntry);
          }
          
          for (const entry of commitTree.tree) {
            commitFiles.set(entry.path, entry as TreeEntry);
          }
          
          type ChangeType = 'add' | 'modify' | 'delete';
          interface Change {
            type: ChangeType;
            path: string;
          }
          
          const changes: Change[] = [];
          
          // Helper function to check if a path is a directory
          const isDirectory = (entry: TreeEntry): boolean => {
            return entry.mode === '040000';
          };
          
          // Helper function to recursively list files in a directory
          const listFilesInDirectory = async (oid: string, prefix: string = ''): Promise<Map<string, TreeEntry>> => {
            const result = new Map<string, TreeEntry>();
            try {
              const tree = await this.git.readTree({
                dir: this.pwd,
                oid,
              });
              
              for (const entry of tree.tree) {
                const entryWithType = entry as TreeEntry;
                const path = prefix ? `${prefix}/${entry.path}` : entry.path;
                
                if (isDirectory(entryWithType)) {
                  // Recursively list files in subdirectory
                  const subFiles = await listFilesInDirectory(entry.oid, path);
                  // Add all files from subdirectory to result
                  for (const [subPath, subEntry] of subFiles.entries()) {
                    result.set(subPath, subEntry);
                  }
                } else {
                  // Add file to result
                  result.set(path, entryWithType);
                }
              }
            } catch (error) {
              console.error(`Error listing files in directory ${oid}:`, error);
            }
            return result;
          };
          
          // Expand directory entries to include all files within them
          const expandDirectories = async (): Promise<void> => {
            // Process parent files
            for (const [path, entry] of [...parentFiles.entries()]) {
              if (isDirectory(entry)) {
                // Remove the directory entry
                parentFiles.delete(path);
                // Add all files within the directory
                const files = await listFilesInDirectory(entry.oid, path);
                for (const [filePath, fileEntry] of files.entries()) {
                  parentFiles.set(filePath, fileEntry);
                }
              }
            }
            
            // Process commit files
            for (const [path, entry] of [...commitFiles.entries()]) {
              if (isDirectory(entry)) {
                // Remove the directory entry
                commitFiles.delete(path);
                // Add all files within the directory
                const files = await listFilesInDirectory(entry.oid, path);
                for (const [filePath, fileEntry] of files.entries()) {
                  commitFiles.set(filePath, fileEntry);
                }
              }
            }
          };
          
          // Expand directories to get all files
          await expandDirectories();
          
          // Find added and modified files
          for (const [path, entry] of commitFiles.entries()) {
            const parentEntry = parentFiles.get(path);
            if (!parentEntry) {
              changes.push({ type: 'add', path });
            } else if (parentEntry.oid !== entry.oid) {
              changes.push({ type: 'modify', path });
            }
          }
          
          // Find deleted files
          for (const path of parentFiles.keys()) {
            if (!commitFiles.has(path)) {
              changes.push({ type: 'delete', path });
            }
          }
          
          // Sort changes by type and path
          const filteredChanges = changes.sort((a, b) => {
            if (a.type !== b.type) {
              // Order: add, modify, delete
              const typeOrder = { add: 0, modify: 1, delete: 2 };
              return typeOrder[a.type] - typeOrder[b.type];
            }
            return a.path.localeCompare(b.path);
          });
          
          if (filteredChanges.length > 0) {
            // Group changes by type
            const added = filteredChanges.filter(c => c.type === 'add');
            const modified = filteredChanges.filter(c => c.type === 'modify');
            const deleted = filteredChanges.filter(c => c.type === 'delete');
            
            lines.push('');
            
            // Show summary
            const changeDetails: string[] = [];
            if (added.length > 0) changeDetails.push(`${added.length} file${added.length !== 1 ? 's' : ''} added`);
            if (modified.length > 0) changeDetails.push(`${modified.length} file${modified.length !== 1 ? 's' : ''} modified`);
            if (deleted.length > 0) changeDetails.push(`${deleted.length} file${deleted.length !== 1 ? 's' : ''} deleted`);
            
            lines.push(`\x1b[1mChanges: ${changeDetails.join(', ')}\x1b[0m`); // Bold summary line
            lines.push('');
            
            // List changed files
             if (added.length > 0) {
               lines.push('\x1b[1mAdded files:\x1b[0m');
               for (const change of added) {
                 lines.push(`  \x1b[32mnew file: ${change.path}\x1b[0m`); // Green for new files
               }
               lines.push('');
             }
             
             if (modified.length > 0) {
               lines.push('\x1b[1mModified files:\x1b[0m');
               for (const change of modified) {
                 lines.push(`  \x1b[33mmodified: ${change.path}\x1b[0m`); // Yellow for modified files
               }
               lines.push('');
             }
             
             if (deleted.length > 0) {
               lines.push('\x1b[1mDeleted files:\x1b[0m');
               for (const change of deleted) {
                 lines.push(`  \x1b[31mdeleted: ${change.path}\x1b[0m`); // Red for deleted files
               }
               lines.push('');
             }
            
            // Show actual diffs for modified files (up to 3 files to avoid excessive output)
            if (modified.length > 0) {
              lines.push('Diffs:');
              lines.push('');
              
              // We've already expanded directories, so all entries are files now
              const filesToShow = modified.slice(0, 3); // Limit to 3 files
              
              if (filesToShow.length === 0) {
                lines.push('(Only directory structure changes, no file content to show)');
                lines.push('');
              }
              
              for (const change of filesToShow) {
              lines.push(`\x1b[1mdiff --git a/${change.path} b/${change.path}\x1b[0m`); // Bold
              lines.push(`\x1b[1;31m--- a/${change.path}\x1b[0m`); // Bold red
              lines.push(`\x1b[1;32m+++ b/${change.path}\x1b[0m`); // Bold green
                
                try {
                  // Get file content from parent commit
                  let parentContent = '';
                  try {
                    const parentBlob = await this.git.readBlob({
                      dir: this.pwd,
                      oid: parentCommit,
                      filepath: change.path,
                    });
                    parentContent = new TextDecoder().decode(parentBlob.blob);
                  } catch (e) {
                    console.error(`Error reading parent blob for ${change.path}:`, e);
                    // File might not exist in parent
                  }
                  
                  // Get file content from current commit
                  let currentContent = '';
                  try {
                    const currentBlob = await this.git.readBlob({
                      dir: this.pwd,
                      oid: commit.oid,
                      filepath: change.path,
                    });
                    currentContent = new TextDecoder().decode(currentBlob.blob);
                  } catch (e) {
                    console.error(`Error reading current blob for ${change.path}:`, e);
                    // File might not exist in current commit
                  }
                  
                  // Check if we have content to diff
                  if (parentContent === '' && currentContent === '') {
                    lines.push('(Unable to read file contents)');
                    lines.push('');
                    continue;
                  }
                  
                  // Generate a unified diff
                  const parentLines = parentContent.split('\n');
                  const currentLines = currentContent.split('\n');
                  
                  // Improved diff algorithm that generates unified diffs
                  const diffLines: string[] = [];
                  const contextSize = 3; // Number of context lines before and after changes
                  
                  // Find changed regions (hunks)
                  const hunks: Array<{
                    startOld: number;
                    endOld: number;
                    startNew: number;
                    endNew: number;
                  }> = [];
                  
                  let oldIndex = 0;
                  let newIndex = 0;
                  let hunkStart: { old: number; new: number } | null = null;
                  
                  // Use a simple LCS-based diff algorithm to find matching lines
                  const matches: boolean[] = [];
                  for (let i = 0; i < parentLines.length; i++) {
                    matches[i] = false;
                    for (let j = 0; j < currentLines.length; j++) {
                      if (parentLines[i] === currentLines[j] && !matches[j]) {
                        matches[i] = true;
                        break;
                      }
                    }
                  }
                  
                  // Process the diff and identify hunks
                  while (oldIndex < parentLines.length || newIndex < currentLines.length) {
                    if (oldIndex < parentLines.length && newIndex < currentLines.length && parentLines[oldIndex] === currentLines[newIndex]) {
                      // Matching line
                      if (hunkStart) {
                        // End of a hunk
                        hunks.push({
                          startOld: Math.max(0, hunkStart.old - contextSize),
                          endOld: Math.min(parentLines.length, oldIndex + contextSize),
                          startNew: Math.max(0, hunkStart.new - contextSize),
                          endNew: Math.min(currentLines.length, newIndex + contextSize)
                        });
                        hunkStart = null;
                      }
                      oldIndex++;
                      newIndex++;
                    } else {
                      // Difference found
                      if (!hunkStart) {
                        hunkStart = { old: oldIndex, new: newIndex };
                      }
                      
                      // Handle deletions and additions
                      if (oldIndex < parentLines.length && (!matches[oldIndex] || newIndex >= currentLines.length)) {
                        oldIndex++;
                      } else if (newIndex < currentLines.length) {
                        newIndex++;
                      }
                    }
                  }
                  
                  // Add the final hunk if there is one
                  if (hunkStart) {
                    hunks.push({
                      startOld: Math.max(0, hunkStart.old - contextSize),
                      endOld: Math.min(parentLines.length, oldIndex + contextSize),
                      startNew: Math.max(0, hunkStart.new - contextSize),
                      endNew: Math.min(currentLines.length, newIndex + contextSize)
                    });
                  }
                  
                  // Merge overlapping hunks
                  for (let i = 0; i < hunks.length - 1; i++) {
                    if (hunks[i].endOld >= hunks[i + 1].startOld - 2 * contextSize) {
                      hunks[i].endOld = hunks[i + 1].endOld;
                      hunks[i].endNew = hunks[i + 1].endNew;
                      hunks.splice(i + 1, 1);
                      i--;
                    }
                  }
                  
                  const foundDifference = hunks.length > 0;
                  
                  // Generate the diff output for each hunk
                  for (const hunk of hunks) {
                    const oldSize = hunk.endOld - hunk.startOld;
                    const newSize = hunk.endNew - hunk.startNew;
                    
                    // Add the hunk header with additional context
                    // Get a snippet of the surrounding code to provide context
                    const contextLine = hunk.startOld < parentLines.length ? parentLines[hunk.startOld] : hunk.startNew < currentLines.length ? currentLines[hunk.startNew] : '';
                    
                    // Trim the context line to a reasonable length and remove leading whitespace
                    const trimmedContext = contextLine.trim().substring(0, 40) + (contextLine.length > 40 ? '...' : '');
                    
                    // Add the hunk header with the context
                    diffLines.push(`\x1b[36m@@ -${hunk.startOld + 1},${oldSize} +${hunk.startNew + 1},${newSize} @@ \x1b[1;36m${trimmedContext}\x1b[0m`);
                    
                    // Process the hunk content with improved visual grouping
                    let oldLine = hunk.startOld;
                    let newLine = hunk.startNew;
                    
                    // Track consecutive additions/deletions for better visual grouping
                    let inAdditionBlock = false;
                    let inDeletionBlock = false;
                    
                    const addSeparator = () => {
                      if (inAdditionBlock || inDeletionBlock) {
                        diffLines.push(`\x1b[90m~\x1b[0m`); // Gray separator
                        inAdditionBlock = false;
                        inDeletionBlock = false;
                      }
                    };
                    
                    while (oldLine < hunk.endOld || newLine < hunk.endNew) {
                      if (oldLine < hunk.endOld && newLine < hunk.endNew && parentLines[oldLine] === currentLines[newLine]) {
                        // Context line (unchanged)
                        addSeparator();
                        diffLines.push(` ${parentLines[oldLine]}`);
                        oldLine++;
                        newLine++;
                      } else {
                        // Collect consecutive deletions
                        const deletions: string[] = [];
                        while (oldLine < hunk.endOld && (!matches[oldLine] || newLine >= hunk.endNew)) {
                          deletions.push(parentLines[oldLine]);
                          oldLine++;
                        }
                        
                        // Collect consecutive additions
                        const additions: string[] = [];
                        while (newLine < hunk.endNew && (oldLine >= hunk.endOld || parentLines[oldLine] !== currentLines[newLine])) {
                          additions.push(currentLines[newLine]);
                          newLine++;
                        }
                        
                        // If we have both deletions and additions, it might be a modification
                        if (deletions.length > 0 && additions.length > 0) {
                          addSeparator();
                          
                          // Output deletions
                          for (const line of deletions) {
                            diffLines.push(`\x1b[31m-${line}\x1b[0m`);
                          }
                          
                          // Output additions
                          for (const line of additions) {
                            diffLines.push(`\x1b[32m+${line}\x1b[0m`);
                          }
                        } else {
                          // Handle pure deletions
                          if (deletions.length > 0) {
                            if (!inDeletionBlock && inAdditionBlock) {
                              addSeparator();
                            }
                            inDeletionBlock = true;
                            
                            for (const line of deletions) {
                              diffLines.push(`\x1b[31m-${line}\x1b[0m`);
                            }
                          }
                          
                          // Handle pure additions
                          if (additions.length > 0) {
                            if (!inAdditionBlock && inDeletionBlock) {
                              addSeparator();
                            }
                            inAdditionBlock = true;
                            
                            for (const line of additions) {
                              diffLines.push(`\x1b[32m+${line}\x1b[0m`);
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  // Add the diff lines if we found changes
                  if (foundDifference && diffLines.length > 0) {
                    lines.push(...diffLines);
                    lines.push('');
                  } else if (!foundDifference) {
                    lines.push('(No textual changes detected)');
                    lines.push('');
                  } else {
                    lines.push('(Binary files differ)');
                    lines.push('');
                  }
                } catch (error) {
                  console.error(`Error generating diff for ${change.path}:`, error);
                  lines.push(`(Error generating diff: ${error instanceof Error ? error.message : 'Unknown error'})`);
                  lines.push('');
                }
              }
              
              const remainingFiles = modified.length - filesToShow.length;
              if (remainingFiles > 0) {
                lines.push(`... and ${remainingFiles} more modified files`);
                lines.push('');
              }
            }
          } else {
            lines.push('');
            lines.push('No changes (empty commit)');
          }
        }
      } catch (error) {
        // If we can't generate the diff, show an error
        lines.push(`(Error showing changes: ${error instanceof Error ? error.message : 'Unknown error'})`);
      }

      return createSuccessResult(lines.join('\n') + '\n');

    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        return createErrorResult(`fatal: bad revision '${commitRef}'`);
      }
      return createErrorResult(`Failed to show commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}