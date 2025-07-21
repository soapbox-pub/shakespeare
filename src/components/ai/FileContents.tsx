import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface FileContentsProps {
  content: string;
  filePath: string;
  className?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  showHeader?: boolean;
  headerContent?: React.ReactNode;
}

export function FileContents({
  content,
  filePath,
  className,
  showLineNumbers,
  maxHeight = 'max-h-80',
  showHeader = true,
  headerContent
}: FileContentsProps) {
  const { theme } = useTheme();

  // Get file extension for syntax highlighting hints
  const getFileExtension = (path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  // Map file extensions to syntax highlighter languages
  const getLanguageFromExtension = (ext: string): string => {
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'html': 'html',
      'xml': 'xml',
      'svg': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'toml': 'toml',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'sql': 'sql',
      'dockerfile': 'dockerfile',
      'gitignore': 'gitignore',
      'env': 'bash',
      'ini': 'ini',
      'conf': 'nginx',
      'nginx': 'nginx',
      'apache': 'apache',
      'htaccess': 'apache',
      'vim': 'vim',
      'lua': 'lua',
      'r': 'r',
      'matlab': 'matlab',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'dart': 'dart',
      'elm': 'elm',
      'haskell': 'haskell',
      'clojure': 'clojure',
      'scala': 'scala',
      'perl': 'perl',
      'powershell': 'powershell',
      'makefile': 'makefile',
      'cmake': 'cmake',
      'gradle': 'gradle',
      'properties': 'properties',
      'diff': 'diff',
      'patch': 'diff',
      'log': 'log'
    };

    return languageMap[ext] || 'text';
  };

  // Check if content should be syntax highlighted
  const shouldHighlight = (ext: string, text: string): boolean => {
    // Don't highlight very large files (over 50KB) for performance
    if (text.length > 50000) return false;

    // Don't highlight binary-looking content (check for null bytes and other binary indicators)
    if (text.includes('\0') || text.includes('\uFFFD')) return false;

    // Always highlight known code file extensions
    const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'xml', 'py', 'rb', 'php', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'sh', 'bash', 'sql', 'yml', 'yaml', 'toml', 'md'];
    return codeExtensions.includes(ext);
  };

  const fileExtension = getFileExtension(filePath);
  const shouldUseHighlighting = shouldHighlight(fileExtension, content);

  // Determine if we should show line numbers
  const shouldShowLineNumbers = showLineNumbers ?? (content.split('\n').length > 10);

  return (
    <div className={cn("bg-muted/30 rounded-md overflow-hidden", className)}>
      {showHeader && (
        <div className="bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground border-b border-muted/50 flex items-center justify-between">
          <span>File Contents</span>
          {headerContent || (fileExtension && (
            <span className="text-xs bg-muted px-2 py-1 rounded">
              {fileExtension.toUpperCase()}
            </span>
          ))}
        </div>
      )}
      <div className={cn("p-0 overflow-auto", maxHeight)}>
        {shouldUseHighlighting ? (
          <SyntaxHighlighter
            language={getLanguageFromExtension(fileExtension)}
            style={theme === 'dark' ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              padding: '12px',
              fontSize: '12px',
              lineHeight: '1.4',
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
            }}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }
            }}
            showLineNumbers={shouldShowLineNumbers}
            lineNumberStyle={{
              minWidth: '2.5em',
              paddingRight: '1em',
              color: theme === 'dark' ? '#6b7280' : '#9ca3af',
              fontSize: '11px',
            }}
            wrapLines={false}
            wrapLongLines={false}
          >
            {content}
          </SyntaxHighlighter>
        ) : (
          <div className="p-3">
            <pre className="text-xs font-mono whitespace-pre text-foreground">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}