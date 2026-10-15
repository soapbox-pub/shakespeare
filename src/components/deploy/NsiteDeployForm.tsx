import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdvancedSection } from './AdvancedSection';

interface NsiteDeployFormProps {
  /** Human-readable project name — used to default the title */
  projectName: string;
  /** Persisted values from a previous deployment */
  savedSiteTitle?: string;
  savedSiteDescription?: string;
  /** Present only when the project was previously deployed with a dedicated keypair (v1) */
  savedNsec?: string;
  /**
   * Whether the site has been set up before. A first deploy shows the title,
   * since it picks the site's address; after that it lives under Advanced.
   */
  configured?: boolean;
  /** Extra detail shown at the end of the Advanced section */
  advancedFooter?: ReactNode;
  onSiteTitleChange: (title: string) => void;
  onSiteDescriptionChange: (description: string) => void;
}

export function NsiteDeployForm({
  projectName,
  savedSiteTitle,
  savedSiteDescription,
  savedNsec,
  configured,
  advancedFooter,
  onSiteTitleChange,
  onSiteDescriptionChange,
}: NsiteDeployFormProps) {
  const [siteTitle, setSiteTitle] = useState(savedSiteTitle ?? projectName);
  const [siteDescription, setSiteDescription] = useState(savedSiteDescription ?? '');

  // On mount: sync all saved values to parent and set defaults.
  // The component is keyed by selectedProviderId in DeploySteps, so this always
  // runs with fresh props — no initialized guard needed.
  const initializedRef = useRef(false);
  const stableSyncToParent = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (savedSiteDescription) onSiteDescriptionChange(savedSiteDescription);

    const initialTitle = savedSiteTitle ?? projectName;
    if (initialTitle !== siteTitle) setSiteTitle(initialTitle);
    onSiteTitleChange(initialTitle);
  }, [savedSiteDescription, savedSiteTitle, siteTitle, projectName, onSiteDescriptionChange, onSiteTitleChange]);

  useEffect(() => {
    stableSyncToParent();
  }, [stableSyncToParent]);

  const handleSiteTitleChange = (value: string) => {
    setSiteTitle(value);
    onSiteTitleChange(value);
  };

  const handleSiteDescriptionChange = (value: string) => {
    setSiteDescription(value);
    onSiteDescriptionChange(value);
  };

  const titleField = (
    <div className="space-y-2">
      <Label htmlFor="nsite-title">Site Title</Label>
      <Input
        id="nsite-title"
        value={siteTitle}
        onChange={(e) => handleSiteTitleChange(e.target.value)}
        placeholder="My Nostr Site"
      />
    </div>
  );

  return (
    <div className="space-y-3">

      {/* Migration notice */}
      {savedNsec && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Site identity is changing.</strong> This project was previously deployed with a
            dedicated private key. Going forward, it will deploy under your Nostr identity. The old
            site will remain at its original address until overwritten.
          </AlertDescription>
        </Alert>
      )}

      {!configured && titleField}

      <AdvancedSection>
        {configured && titleField}

        <div className="space-y-2">
          <Label htmlFor="nsite-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            id="nsite-description"
            value={siteDescription}
            onChange={(e) => handleSiteDescriptionChange(e.target.value)}
            placeholder="A short description of this site…"
            rows={2}
          />
        </div>

        {advancedFooter}
      </AdvancedSection>
    </div>
  );
}
