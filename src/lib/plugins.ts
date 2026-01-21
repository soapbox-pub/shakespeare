import { join } from 'path-browserify';
import type { JSRuntimeFS } from './JSRuntime';
import * as git from 'isomorphic-git';

export interface PluginGitInfo {
  commitHash: string;
  commitDate: Date;
  commitMessage: string;
}

/**
 * Get all plugins from the plugins directory
 */
export async function getPlugins(fs: JSRuntimeFS, pluginsPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(pluginsPath);
    const plugins: string[] = [];

    for (const entry of entries) {
      const stat = await fs.stat(join(pluginsPath, entry));
      if (stat.isDirectory()) {
        plugins.push(entry);
      }
    }

    return plugins;
  } catch {
    // Plugins directory doesn't exist yet
    return [];
  }
}

/**
 * Get git information for a plugin
 */
export async function getPluginGitInfo(fs: JSRuntimeFS, pluginsPath: string, pluginName: string): Promise<PluginGitInfo | null> {
  const pluginPath = join(pluginsPath, pluginName);

  try {
    // Get the latest commit
    const commits = await git.log({
      fs,
      dir: pluginPath,
      depth: 1,
    });

    if (commits.length === 0) {
      return null;
    }

    const commit = commits[0];

    return {
      commitHash: commit.oid,
      commitDate: new Date(commit.commit.committer.timestamp * 1000),
      commitMessage: commit.commit.message,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a plugin directory
 */
export async function deletePlugin(fs: JSRuntimeFS, pluginsPath: string, pluginName: string): Promise<void> {
  const pluginPath = join(pluginsPath, pluginName);

  // Recursively delete the plugin directory
  async function rmrf(path: string): Promise<void> {
    const stat = await fs.stat(path);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(path);
      for (const entry of entries) {
        await rmrf(join(path, entry));
      }
      await fs.rmdir(path);
    } else {
      await fs.unlink(path);
    }
  }

  await rmrf(pluginPath);
}
