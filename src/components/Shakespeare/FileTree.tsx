import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useGitStatus } from '@/hooks/useGitStatus';
import { ChevronRight, ChevronDown, File, Folder, Search, Code, FileText, Image, FileJson, Palette, Settings, FileCode } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createGitignoreFilter, normalizePathForGitignore } from '@/lib/gitignore';
import { Input } from '@/components/ui/input';

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

// Helper function to get file icon based on extension
function getFileIcon(fileName: string): { icon: LucideIcon; color: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Image files - subtle blue hint
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff'].includes(ext)) {
    return { icon: Image, color: 'text-blue-400/60' };
  }
  
  // Code files - subtle amber hint
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'dart'].includes(ext)) {
    return { icon: Code, color: 'text-amber-400/60' };
  }
  
  // Web files - subtle orange hint
  if (['html', 'htm', 'xhtml'].includes(ext)) {
    return { icon: FileCode, color: 'text-orange-400/60' };
  }
  
  // CSS files - subtle purple hint
  if (['css', 'scss', 'sass', 'less', 'styl'].includes(ext)) {
    return { icon: Palette, color: 'text-purple-400/60' };
  }
  
  // Data/Config files - subtle green hint
  if (['json', 'jsonc'].includes(ext)) {
    return { icon: FileJson, color: 'text-green-400/60' };
  }
  
  // Config files - subtle amber hint
  if (['xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config'].includes(ext)) {
    return { icon: Settings, color: 'text-amber-400/60' };
  }
  
  // Text/Markdown files - subtle amber hint
  if (['txt', 'md', 'markdown', 'rst', 'log'].includes(ext)) {
    return { icon: FileText, color: 'text-amber-400/60' };
  }
  
  // Default file icon - subtle amber hint
  return { icon: File, color: 'text-amber-400/60' };
}

export function FileTree({ projectId, onFileSelect, selectedFile }: FileTreeProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [filteredTree, setFilteredTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gitignoreFilter, setGitignoreFilter] = useState<{
    isIgnored: (path: string) => boolean;
    shouldShow: (path: string) => boolean;
      } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
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
      setFilteredTree(structure);
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

    // Update both the original tree and filtered tree
    setTree(prev => toggleNode(prev));
    setFilteredTree(prev => toggleNode(prev));
  };

  const handleFileClick = (filePath: string, type: 'file' | 'directory') => {
    if (type === 'file') {
      onFileSelect(filePath);
    } else {
      toggleDirectory(filePath);
    }
  };

  // Search functions
  const searchInFiles = useCallback(async (nodes: FileNode[], term: string): Promise<FileNode[]> => {
    if (!term.trim()) return nodes;

    const results: FileNode[] = [];
    const searchTermLower = term.toLowerCase();

    for (const node of nodes) {
      if (node.type === 'file') {
        const fileNameMatch = node.name.toLowerCase().includes(searchTermLower);

        if (fileNameMatch) {
          results.push(node);
        }
      } else if (node.type === 'directory' && node.children) {
        const childResults = await searchInFiles(node.children, term);
        if (childResults.length > 0) {
          // Create a filtered directory node with matching children
          results.push({
            ...node,
            children: childResults,
            isOpen: true, // Auto-expand directories with matches
          });
        }
      }
    }

    return results  }, []);

  // Perform search when search term changes
  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setFilteredTree(tree);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchInFiles(tree, searchTerm);
        setFilteredTree(results);
      } catch (error) {
        console.error('Search failed:', error);
        setFilteredTree([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [searchTerm, tree, searchInFiles]);

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
              {(() => {
                const { icon: Icon, color } = getFileIcon(node.name);
                return <Icon className={cn("h-4 w-4 flex-shrink-0", color, gitignoreClasses)} />;
              })()}
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
      {/* Search Section */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchFiles')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* File Tree */}
      {isSearching ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          {searchTerm ? t('noFilesFoundSearch') : t('noFilesFound')}
        </div>
      ) : (
        filteredTree.map(node => renderNode(node))
      )}
    </div>
  );
}