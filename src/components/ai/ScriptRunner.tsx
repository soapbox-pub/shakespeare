import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptRunnerProps {
  script: string;
  result?: string;
  isError?: boolean;
  className?: string;
}

export function ScriptRunner({ script, result, isError = false, className }: ScriptRunnerProps) {
  // Get script info
  const getScriptInfo = (scriptName: string) => {
    switch (scriptName) {
      case 'build': return { icon: '🔨', description: 'Build the project for production' };
      case 'test': return { icon: '🧪', description: 'Run tests and linting' };
      case 'dev': return { icon: '🚀', description: 'Start development server' };
      case 'start': return { icon: '▶️', description: 'Start the application' };
      case 'lint': return { icon: '🔍', description: 'Check code quality' };
      case 'format': return { icon: '✨', description: 'Format code' };
      case 'preview': return { icon: '👀', description: 'Preview production build' };
      case 'deploy': return { icon: '🚀', description: 'Deploy to production' };
      default: return { icon: '⚡', description: 'Run script' };
    }
  };

  const scriptInfo = getScriptInfo(script);

  // Parse output for useful information
  const parseOutput = (output: string) => {
    if (!output) return { summary: '', details: output };

    const lines = output.split('\n').filter(line => line.trim());

    // Look for common patterns
    if (script === 'build') {
      if (output.includes('built in') || output.includes('Build completed')) {
        return {
          summary: 'Build completed successfully',
          details: output
        };
      }
      if (output.includes('error') || output.includes('Error')) {
        return {
          summary: 'Build failed with errors',
          details: output
        };
      }
    }

    if (script === 'test') {
      const passMatch = output.match(/(\d+) passing/);
      const failMatch = output.match(/(\d+) failing/);
      if (passMatch || failMatch) {
        const passing = passMatch ? passMatch[1] : '0';
        const failing = failMatch ? failMatch[1] : '0';
        return {
          summary: `Tests completed: ${passing} passing, ${failing} failing`,
          details: output
        };
      }
      if (output.includes('All tests passed') || output.includes('✓')) {
        return {
          summary: 'All tests passed',
          details: output
        };
      }
    }

    if (script === 'lint') {
      if (output.includes('No linting errors found') || output.includes('✓')) {
        return {
          summary: 'No linting errors found',
          details: output
        };
      }
      const errorMatch = output.match(/(\d+) error/);
      const warningMatch = output.match(/(\d+) warning/);
      if (errorMatch || warningMatch) {
        const errors = errorMatch ? errorMatch[1] : '0';
        const warnings = warningMatch ? warningMatch[1] : '0';
        return {
          summary: `Linting completed: ${errors} errors, ${warnings} warnings`,
          details: output
        };
      }
    }

    // Default: use last meaningful line
    const meaningfulLines = lines.filter(line =>
      !line.startsWith('#') &&
      !line.startsWith('//') &&
      line.length > 0
    );

    return {
      summary: meaningfulLines[meaningfulLines.length - 1] || 'Script executed',
      details: output
    };
  };

  const { summary, details } = parseOutput(result || '');

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">{scriptInfo.icon}</span>
            </div>
            <div>
              <div className="font-mono text-sm font-medium">npm run {script}</div>
              <div className="text-xs text-muted-foreground">{scriptInfo.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result !== undefined ? (
              isError ? (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Success
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                <Play className="h-3 w-3 mr-1" />
                Running
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {result && (
        <CardContent className="pt-0">
          {/* Summary */}
          {summary && (
            <div className={cn(
              "mb-3 p-3 rounded-md text-sm font-medium",
              isError
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30"
            )}>
              {summary}
            </div>
          )}

          {/* Full output */}
          {details && details.trim() && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                View script output
              </summary>
              <div className="bg-muted/30 rounded-md overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground border-b border-muted/50">
                  Script Output
                </div>
                <div className="p-3 max-h-80 overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre text-muted-foreground">
                    {details}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {/* Script stats */}
          {!isError && details && (
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {details.split('\n').length} line{details.split('\n').length !== 1 ? 's' : ''} output
              </span>
              {script === 'build' && details.includes('built in') && (
                <span>
                  Build time: {details.match(/built in (\d+\.?\d*[a-z]+)/)?.[1] || 'unknown'}
                </span>
              )}
              {script === 'test' && (
                <>
                  {details.match(/(\d+) passing/) && (
                    <span className="text-green-600 dark:text-green-400">
                      {details.match(/(\d+) passing/)?.[1]} passing
                    </span>
                  )}
                  {details.match(/(\d+) failing/) && (
                    <span className="text-red-600 dark:text-red-400">
                      {details.match(/(\d+) failing/)?.[1]} failing
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}