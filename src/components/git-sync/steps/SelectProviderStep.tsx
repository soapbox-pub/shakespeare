import { Zap, GitBranch } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { useGitSettings } from '@/hooks/useGitSettings';
import { cn } from '@/lib/utils';
import type { SelectProviderStepProps, ProviderOption } from '../types';

export function SelectProviderStep({
  onSelectProvider,
}: SelectProviderStepProps) {
  const { settings } = useGitSettings();

  const providerOptions: ProviderOption[] = [
    {
      id: 'nostr',
      name: 'Nostr',
      icon: <Zap className="h-4 w-4" />,
    },
    ...settings.credentials.map(credential => ({
      id: credential.id,
      name: credential.name,
      origin: credential.origin,
      icon: (
        <ExternalFavicon
          url={credential.origin}
          size={16}
          fallback={<GitBranch className="h-4 w-4" />}
        />
      ),
      credential,
    })),
    {
      id: 'other',
      name: 'Other',
      icon: <GitBranch className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Sync your code to git</h3>
        <p className="text-sm text-muted-foreground">
          Choose a provider to sync your project
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Select Provider</Label>
        <div className="flex flex-wrap gap-2">
          {providerOptions.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectProvider(provider)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                "border-2 hover:scale-105 active:scale-95",
                "bg-background text-foreground border-border hover:border-primary/50"
              )}
            >
              {provider.icon}
              <span>{provider.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
