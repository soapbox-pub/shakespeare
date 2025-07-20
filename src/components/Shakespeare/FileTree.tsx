import { useState, useEffect, useCallback } from 'react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { fs } = useFS();
  const projectsManager = useProjectsManager();

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
      const structure = await buildFileTree(projectId, '');
      setTree(structure);
    } catch (_error) {
      console.error('Failed to load file tree:', _error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, buildFileTree]);

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
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
            </>
          ) : (
            <>
              <div className="w-4" /> {/* Spacer for alignment */}
              <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
            </>
          )}
          <span className="text-sm truncate">{node.name}</span>
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