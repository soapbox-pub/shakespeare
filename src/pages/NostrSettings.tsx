import { ArrowLeft, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RelaySelector } from '@/components/RelaySelector';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';

export function NostrSettings() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {isMobile && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-8 w-auto px-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Wifi className="h-6 w-6 text-primary" />
              Nostr Settings
            </h1>
            <p className="text-muted-foreground">
              Configure your Nostr connection settings and relay preferences.
            </p>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wifi className="h-6 w-6 text-primary" />
            Nostr Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your Nostr connection settings and relay preferences.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Relay Configuration */}
        <div className="grid gap-2">
          <Label htmlFor="relay-selector">Selected Relay</Label>
          <RelaySelector className="w-full max-w-md" />
        </div>
      </div>
    </div>
  );
}

export default NostrSettings;