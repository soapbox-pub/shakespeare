import { Git } from './git';
import type { JSRuntimeFS } from './JSRuntime';

/**
 * Example usage of the Git class
 */
export async function exampleGitUsage(fs: JSRuntimeFS) {
  // Create a Git instance with fs and optional CORS proxy
  const git = new Git(fs, 'https://cors.isomorphic-git.org');

  // Initialize a new repository
  await git.init({
    dir: '/my-project',
    defaultBranch: 'main',
  });

  // Set up configuration
  await git.setConfig({
    dir: '/my-project',
    path: 'user.name',
    value: 'John Doe',
  });

  await git.setConfig({
    dir: '/my-project',
    path: 'user.email',
    value: 'john@example.com',
  });

  // Add files to the index
  await git.add({
    dir: '/my-project',
    filepath: 'README.md',
  });

  // Make a commit
  await git.commit({
    dir: '/my-project',
    message: 'Initial commit',
    author: {
      name: 'John Doe',
      email: 'john@example.com',
    },
  });

  // Get repository status
  const statusMatrix = await git.statusMatrix({
    dir: '/my-project',
  });

  // List branches
  const branches = await git.listBranches({
    dir: '/my-project',
  });

  // Get commit log
  const commits = await git.log({
    dir: '/my-project',
    depth: 10,
  });

  // Clone a repository
  await git.clone({
    dir: '/cloned-project',
    url: 'https://github.com/user/repo.git',
    singleBranch: true,
    depth: 1,
  });

  // Add a remote
  await git.addRemote({
    dir: '/my-project',
    remote: 'origin',
    url: 'https://github.com/user/my-project.git',
  });

  // Push to remote (requires authentication)
  try {
    await git.push({
      dir: '/my-project',
      remote: 'origin',
      ref: 'main',
      // onAuth would be needed for authentication
    });
  } catch (error) {
    console.log('Push failed (likely due to authentication):', error);
  }

  return {
    statusMatrix,
    branches,
    commits,
  };
}

/**
 * Example for GitHub/GitLab repositories with CORS proxy
 */
export function createGitForGitHub(fs: JSRuntimeFS) {
  return new Git(fs, 'https://cors.isomorphic-git.org');
}

/**
 * Example for self-hosted Git servers without CORS proxy
 */
export function createGitForSelfHosted(fs: JSRuntimeFS) {
  return new Git(fs); // No CORS proxy needed
}