import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Wrench } from 'lucide-react';
import type { CoreToolMessage } from 'ai';

interface ToolResultContentProps {
  content: CoreToolMessage['content'];
}

export const ToolResultContent = memo(({ content }: ToolResultContentProps) => {
  if (typeof content === 'string') {
    return (
      <Card className="mt-2 bg-muted/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 flex-shrink-0" />
            <span className="font-mono text-sm">Tool Result</span>
          </div>
          <div className="text-xs rounded p-2 border bg-background">
            <pre className="whitespace-pre-wrap break-words overflow-x-auto">{content}</pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {content.map((item, index) => {
        if (item.type === 'tool-result') {
          const isError = item.isError || false;
          const result = typeof item.result === 'string' ? item.result : JSON.stringify(item.result);

          return (
            <Card key={index} className="mt-2 bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 flex-shrink-0" />
                    <span className="font-mono text-sm">{item.toolName}</span>
                  </div>
                  <Badge variant={isError ? "destructive" : "secondary"} className="text-xs">
                    {isError ? (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Error
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success
                      </>
                    )}
                  </Badge>
                </div>
                <div className={`text-xs rounded p-2 border max-h-40 overflow-scroll ${
                  isError ? 'bg-destructive/10 border-destructive/20' : 'bg-background'
                }`}>
                  <pre className="whitespace-pre-wrap break-words overflow-x-auto">{result}</pre>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })}
    </>
  );
});

ToolResultContent.displayName = 'ToolResultContent';