import { useState, useEffect } from 'react';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { RefreshCw } from 'lucide-react';

interface NsiteDeployFormProps {
  gateway: string;
  savedNsec?: string;
  onNsecChange: (nsec: string) => void;
}

export function NsiteDeployForm({
  gateway,
  savedNsec,
  onNsecChange,
}: NsiteDeployFormProps) {
  const [nsec, setNsec] = useState(savedNsec || '');
  const [npub, setNpub] = useState('');

  // Generate a new nsec if none exists
  useEffect(() => {
    if (!nsec) {
      const sk = generateSecretKey();
      const newNsec = nip19.nsecEncode(sk);
      setNsec(newNsec);
      onNsecChange(newNsec);
    }
  }, [nsec, onNsecChange]);

  // Update npub when nsec changes
  useEffect(() => {
    if (nsec) {
      try {
        const decoded = nip19.decode(nsec);
        if (decoded.type === 'nsec') {
          const pk = getPublicKey(decoded.data);
          const npubEncoded = nip19.npubEncode(pk);
          setNpub(npubEncoded);
        }
      } catch {
        setNpub('');
      }
    }
  }, [nsec]);

  const handleNsecChange = (value: string) => {
    setNsec(value);
    onNsecChange(value);
  };

  const handleGenerateNew = () => {
    const sk = generateSecretKey();
    const newNsec = nip19.nsecEncode(sk);
    setNsec(newNsec);
    onNsecChange(newNsec);
  };

  const fullDomain = npub ? `${npub}.${gateway}` : `npub1...${gateway}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Site URL</Label>
        <p className="text-sm font-mono bg-muted p-2 rounded-md break-all">
          {fullDomain}
        </p>
        <p className="text-xs text-muted-foreground">
          Each site has a unique Nostr keypair
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nsite-nsec">Site Private Key (nsec)</Label>
        <div className="flex gap-2">
          <PasswordInput
            id="nsite-nsec"
            value={nsec}
            onChange={(e) => handleNsecChange(e.target.value)}
            placeholder="nsec1..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleGenerateNew}
            title="Generate new key"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Keep this private key secure. It's used to sign site metadata.
        </p>
      </div>

      <div className="rounded-md bg-muted p-3 text-sm space-y-2">
        <p className="font-medium">How it works:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Files are uploaded to Blossom servers</li>
          <li>Kind 34128 events map URLs to file hashes</li>
          <li>Kind 10063 lists your Blossom servers</li>
          <li>Nsite hosts read events and serve files</li>
        </ul>
      </div>
    </div>
  );
}
