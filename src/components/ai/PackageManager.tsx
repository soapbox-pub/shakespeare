import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Minus, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PackageManagerProps {
  action: 'add' | 'remove';
  registry: 'npm' | 'jsr';
  packageName: string;
  version?: string;
  dev?: boolean;
  result?: string;
  isError?: boolean;
  className?: string;
}

export function PackageManager({ 
  action, 
  registry, 
  packageName, 
  version, 
  dev, 
  result, 
  isError = false, 
  className 
}: PackageManagerProps) {
  // Get package info
  const getPackageInfo = (name: string) => {
    // Common package icons
    if (name.includes('react')) return '⚛️';
    if (name.includes('vue')) return '💚';
    if (name.includes('angular')) return '🅰️';
    if (name.includes('typescript') || name.includes('@types/')) return '🔷';
    if (name.includes('eslint')) return '🔍';
    if (name.includes('prettier')) return '✨';
    if (name.includes('vite')) return '⚡';
    if (name.includes('webpack')) return '📦';
    if (name.includes('babel')) return '🐠';
    if (name.includes('jest') || name.includes('vitest')) return '🧪';
    if (name.includes('tailwind')) return '🎨';
    if (name.includes('sass') || name.includes('scss')) return '🎨';
    if (name.includes('lodash')) return '🔧';
    if (name.includes('axios')) return '🌐';
    if (name.includes('express')) return '🚀';
    if (name.includes('next')) return '▲';
    if (name.includes('nuxt')) return '💚';
    if (name.includes('svelte')) return '🧡';
    if (name.includes('prisma')) return '🔺';
    if (name.includes('graphql')) return '🔗';
    if (name.includes('socket')) return '🔌';
    if (name.includes('redis')) return '🔴';
    if (name.includes('mongo')) return '🍃';
    if (name.includes('postgres')) return '🐘';
    if (name.includes('mysql')) return '🐬';
    if (name.includes('docker')) return '🐳';
    if (name.includes('kubernetes')) return '☸️';
    if (name.includes('aws')) return '☁️';
    if (name.includes('firebase')) return '🔥';
    if (name.includes('stripe')) return '💳';
    if (name.includes('auth')) return '🔐';
    if (name.includes('crypto')) return '🔒';
    if (name.includes('date') || name.includes('moment')) return '📅';
    if (name.includes('uuid')) return '🆔';
    if (name.includes('validator')) return '✅';
    if (name.includes('helmet')) return '⛑️';
    if (name.includes('cors')) return '🌐';
    if (name.includes('dotenv')) return '🔧';
    if (name.includes('nodemon')) return '👀';
    if (name.includes('concurrently')) return '🔄';
    if (name.includes('husky')) return '🐶';
    if (name.includes('lint-staged')) return '🎭';
    if (name.includes('commitizen')) return '📝';
    if (name.includes('semantic-release')) return '🚀';
    if (name.includes('storybook')) return '📚';
    if (name.includes('cypress')) return '🌲';
    if (name.includes('playwright')) return '🎭';
    if (name.includes('puppeteer')) return '🎪';
    return '📦';
  };

  const packageIcon = getPackageInfo(packageName);
  const registryIcon = registry === 'jsr' ? '🦕' : '📦';

  // Parse output for useful information
  const parseOutput = (output: string) => {
    if (!output) return { summary: '', details: output };

    if (action === 'add') {
      if (output.includes('added') || output.includes('installed')) {
        return {
          summary: `Successfully added ${packageName}${version ? `@${version}` : ''}`,
          details: output
        };
      }
      if (output.includes('already exists') || output.includes('up to date')) {
        return {
          summary: `${packageName} is already installed`,
          details: output
        };
      }
    }

    if (action === 'remove') {
      if (output.includes('removed') || output.includes('uninstalled')) {
        return {
          summary: `Successfully removed ${packageName}`,
          details: output
        };
      }
      if (output.includes('not found') || output.includes('not installed')) {
        return {
          summary: `${packageName} was not installed`,
          details: output
        };
      }
    }

    return {
      summary: `Package ${action} completed`,
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
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">{packageIcon}</span>
              <span className="text-sm">{registryIcon}</span>
            </div>
            <div>
              <div className="font-mono text-sm font-medium">
                {action === 'add' ? (
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3 text-green-600" />
                    {packageName}{version && `@${version}`}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Minus className="h-3 w-3 text-red-600" />
                    {packageName}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {action === 'add' ? 'Install' : 'Remove'} {registry.toUpperCase()} package
                {dev && ' (dev dependency)'}
              </div>
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
                <Package className="h-3 w-3 mr-1" />
                {action === 'add' ? 'Installing' : 'Removing'}
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
                View package manager output
              </summary>
              <div className="bg-muted/30 rounded-md overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground border-b border-muted/50">
                  Package Manager Output
                </div>
                <div className="p-3 max-h-80 overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre text-muted-foreground">
                    {details}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {/* Package info */}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {registryIcon} {registry.toUpperCase()} registry
            </span>
            {version && (
              <span>
                Version: {version}
              </span>
            )}
            {dev && (
              <span className="text-orange-600 dark:text-orange-400">
                Development dependency
              </span>
            )}
            {action === 'add' && (
              <span className="text-green-600 dark:text-green-400">
                Added to project
              </span>
            )}
            {action === 'remove' && (
              <span className="text-red-600 dark:text-red-400">
                Removed from project
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}