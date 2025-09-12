import { useState, useEffect, useCallback } from 'react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useGitStatus } from '@/hooks/useGitStatus';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createGitignoreFilter, normalizePathForGitignore } from '@/lib/gitignore';

interface FileTreeProps {
  projectId: string;
  onFileSelect: (filePath: string) => void;
  selectedFile: string | null;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isOpen?: boolean;
}

export function FileTree({ projectId, onFileSelect, selectedFile }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gitignoreFilter, setGitignoreFilter] = useState<{
    isIgnored: (path: string) => boolean;
    shouldShow: (path: string) => boolean;
  } | null>(null);
  const { fs } = useFS();
  const projectsManager = useProjectsManager();
  const { data: gitStatus } = useGitStatus(projectId);

  // Helper function to get git status for a file
  const getFileGitStatus = (filePath: string) => {
    if (!gitStatus?.changedFiles) return null;
    const fileChange = gitStatus.changedFiles.find(change => change.filepath === filePath);
    return fileChange?.status || null;
  };

  // Helper function to get git status for a directory
  const getDirectoryGitStatus = (dirPath: string, _children: FileNode[]): 'modified' | 'added' | null => {
    if (!gitStatus?.changedFiles) return null;

    // Check if any files in this directory or subdirectories have changes
    const hasChanges = gitStatus.changedFiles.some(change =>
      change.filepath.startsWith(dirPath + '/') ||
      (dirPath === '' && !change.filepath.includes('/'))
    );

    if (!hasChanges) return null;

    // Check if all changes are new files (added/untracked)
    const relevantChanges = gitStatus.changedFiles.filter(change =>
      change.filepath.startsWith(dirPath + '/') ||
      (dirPath === '' && !change.filepath.includes('/'))
    );

    const allAdded = relevantChanges.every(change =>
      change.status === 'added' || change.status === 'untracked'
    );

    return allAdded ? 'added' : 'modified';
  };

  // Helper function to get styling classes based on git status
  const getGitStatusClasses = (status: string | null) => {
    switch (status) {
      case 'added':
      case 'untracked':
        return 'text-green-600 dark:text-green-400';
      case 'modified':
      case 'staged':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return '';
    }
  };

  const buildFileTree = useCallback(async (projectId: string, dirPath: string): Promise<FileNode[]> => {
    const items = await projectsManager.listFiles(projectId, dirPath);
    const nodes: FileNode[] = [];

    for (const item of items) {
      const itemPath = dirPath ? `${dirPath}/${item}` : item;
      const fullPath = `${projectsManager['dir']}/${projectId}/${itemPath}`;

      try {
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          const children = await buildFileTree(projectId, itemPath);
          nodes.push({
            name: item,
            path: itemPath,
            type: 'directory',
            children,
            isOpen: false,
          });
        } else {
          nodes.push({
            name: item,
            path: itemPath,
            type: 'file',
          });
        }
      } catch {
        // Skip inaccessible items
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [projectsManager, fs]);

  const loadFileTree = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load gitignore filter
      const projectPath = `${projectsManager['dir']}/${projectId}`;
      const filter = await createGitignoreFilter(fs, projectPath);
      setGitignoreFilter(filter);

      const structure = await buildFileTree(projectId, '');
      setTree(structure);
    } catch (_error) {
      console.error('Failed to load file tree:', _error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, buildFileTree, fs, projectsManager]);

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  const toggleDirectory = (path: string) => {
    const toggleNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path && node.type === 'directory') {
          return { ...node, isOpen: !node.isOpen };
        }
        if (node.children) {
          return { ...node, children: toggleNode(node.children) };
        }
        return node;
      });
    };

    setTree(prev => toggleNode(prev));
  };

  const handleFileClick = (filePath: string, type: 'file' | 'directory') => {
    if (type === 'file') {
      onFileSelect(filePath);
    } else {
      toggleDirectory(filePath);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isSelected = selectedFile === node.path;

    // Get git status for this node
    const gitFileStatus = node.type === 'file' ? getFileGitStatus(node.path) : null;
    const gitDirStatus = node.type === 'directory' ? getDirectoryGitStatus(node.path, node.children || []) : null;
    const gitStatus = gitFileStatus || gitDirStatus;

    // Check if this file/directory is gitignored
    const normalizedPath = normalizePathForGitignore(node.path);
    const isGitignored = gitignoreFilter?.isIgnored(normalizedPath) ?? false;

    // Get styling classes for git status
    const gitStatusClasses = getGitStatusClasses(gitStatus);

    // Apply muted styling for gitignored files
    const gitignoreClasses = isGitignored ? 'text-muted-foreground' : '';

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted rounded',
            isSelected && 'bg-muted',
            depth > 0 && 'ml-4'
          )}
          onClick={() => handleFileClick(node.path, node.type)}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {node.type === 'directory' ? (
            <>
              {node.isOpen ? (
                <ChevronDown className={cn("h-4 w-4 flex-shrink-0", gitignoreClasses)} />
              ) : (
                <ChevronRight className={cn("h-4 w-4 flex-shrink-0", gitignoreClasses)} />
              )}
              <Folder className={cn("h-4 w-4 text-blue-500 flex-shrink-0", gitignoreClasses)} />
            </>
          ) : (
            <>
              <div className="w-4" /> {/* Spacer for alignment */}
              <File className={cn("h-4 w-4 text-gray-500 flex-shrink-0", gitignoreClasses)} />
            </>
          )}
          <span className={cn("text-sm whitespace-nowrap", gitStatusClasses, gitignoreClasses)}>{node.name}</span>
        </div>

        {node.type === 'directory' && node.isOpen && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-2">
      {tree.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          No files found
        </div>
      ) : (
        tree.map(node => renderNode(node))
      )}
    </div>
  );
}