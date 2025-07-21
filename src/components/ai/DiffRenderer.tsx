import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffRendererProps {
  path: string;
  oldStr: string;
  newStr: string;
  isError?: boolean;
  className?: string;
}

export function DiffRenderer({ path, oldStr, newStr, isError = false, className }: DiffRendererProps) {
  // Split strings into lines for diff rendering
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  // Simple diff algorithm - find common prefix and suffix
  const findCommonPrefix = (a: string[], b: string[]) => {
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) {
      i++;
    }
    return i;
  };

  const findCommonSuffix = (a: string[], b: string[], prefixLength: number) => {
    let i = 0;
    const maxLength = Math.min(a.length - prefixLength, b.length - prefixLength);
    while (i < maxLength && a[a.length - 1 - i] === b[b.length - 1 - i]) {
      i++;
    }
    return i;
  };

  const prefixLength = findCommonPrefix(oldLines, newLines);
  const suffixLength = findCommonSuffix(oldLines, newLines, prefixLength);

  const commonPrefix = oldLines.slice(0, prefixLength);
  const commonSuffix = oldLines.slice(oldLines.length - suffixLength);

  const removedLines = oldLines.slice(prefixLength, oldLines.length - suffixLength);
  const addedLines = newLines.slice(prefixLength, newLines.length - suffixLength);

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{path}</span>
          </div>
          <div className="flex items-center gap-2">
            {isError ? (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Success
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-muted/30 rounded-md overflow-x-auto overflow-y-hidden">
          <div className="font-mono text-xs min-w-max">
            {/* Context before changes */}
            {commonPrefix.length > 0 && (
              <div className="border-b border-muted/50">
                {commonPrefix.slice(-3).map((line, index) => (
                  <div key={`prefix-${index}`} className="px-3 py-1 text-muted-foreground">
                    <span className="inline-block w-8 text-right mr-3 select-none">
                      {prefixLength - 3 + index + 1}
                    </span>
                    <span className="whitespace-pre whitespace-nowrap">{line || ' '}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Removed lines */}
            {removedLines.map((line, index) => (
              <div key={`removed-${index}`} className="px-3 py-1 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                <span className="inline-block w-8 text-right mr-3 select-none text-red-600 dark:text-red-400">
                  -{prefixLength + index + 1}
                </span>
                <span className="whitespace-pre whitespace-nowrap">
                  <span className="bg-red-200 dark:bg-red-800/50">-</span>
                  {line || ' '}
                </span>
              </div>
            ))}

            {/* Added lines */}
            {addedLines.map((line, index) => (
              <div key={`added-${index}`} className="px-3 py-1 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                <span className="inline-block w-8 text-right mr-3 select-none text-green-600 dark:text-green-400">
                  +{prefixLength + index + 1}
                </span>
                <span className="whitespace-pre whitespace-nowrap">
                  <span className="bg-green-200 dark:bg-green-800/50">+</span>
                  {line || ' '}
                </span>
              </div>
            ))}

            {/* Context after changes */}
            {commonSuffix.length > 0 && (
              <div className="border-t border-muted/50">
                {commonSuffix.slice(0, 3).map((line, index) => (
                  <div key={`suffix-${index}`} className="px-3 py-1 text-muted-foreground">
                    <span className="inline-block w-8 text-right mr-3 select-none">
                      {prefixLength + Math.max(removedLines.length, addedLines.length) + index + 1}
                    </span>
                    <span className="whitespace-pre whitespace-nowrap">{line || ' '}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Handle case where there are no changes */}
            {removedLines.length === 0 && addedLines.length === 0 && (
              <div className="px-3 py-4 text-center text-muted-foreground">
                No changes detected
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {removedLines.length > 0 && (
            <span className="text-red-600 dark:text-red-400">
              -{removedLines.length} line{removedLines.length !== 1 ? 's' : ''}
            </span>
          )}
          {addedLines.length > 0 && (
            <span className="text-green-600 dark:text-green-400">
              +{addedLines.length} line{addedLines.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}