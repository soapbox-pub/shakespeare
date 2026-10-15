import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { checkNameAvailable, type NameAvailability } from '@/lib/deploy/NpanelAdapter';
import { AdvancedSection } from './AdvancedSection';

/** How long typing has to stop before the gateway is asked about a name. */
const AVAILABILITY_DEBOUNCE_MS = 400;

interface NpanelDeployFormProps {
  /** The gateway's API origin, e.g. `npanel.shakespeare.to`. */
  dashboardHost: string;
  /** The domain sites are served under, e.g. `shakespeare.wtf`. */
  domain: string;
  /** Falls back to the project id when nothing has been deployed yet. */
  projectId: string;
  projectName: string;
  savedSubdomain?: string;
  savedSiteTitle?: string;
  savedSiteDescription?: string;
  onSubdomainChange: (subdomain: string) => void;
  onSiteTitleChange: (title: string) => void;
  onSiteDescriptionChange: (description: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  /**
   * Open the list of names this gateway is holding for whoever signs in.
   *
   * Passed in rather than opened here: recognising one name is usually not the
   * whole of what somebody has waiting, and the dialog that hands them all back
   * belongs above this field rather than inside it.
   */
  onTakeBackSites?: () => void;
}

/** What the field is currently saying about the name in it. */
type NameState =
  | { kind: 'empty' }
  | { kind: 'mine' }
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'free' }
  | { kind: 'unavailable'; message: string };

function describe(availability: NameAvailability, domain: string): NameState {
  // A name the gateway recognises as this user's own. It is spoken for, and
  // they are who it is spoken for by — deploying updates the site already
  // there rather than taking anything.
  if (availability.reason === 'mine') return { kind: 'mine' };

  // Theirs from before the gateway, and still held for them. Not somewhere
  // they can deploy until they take it back, which is a thing they can do
  // from here rather than a wall.
  if (availability.reason === 'waiting') return { kind: 'waiting' };

  if (availability.available) return { kind: 'free' };

  if (availability.reason === 'taken') {
    return { kind: 'unavailable', message: `That name is taken on ${domain}. Try another.` };
  }

  return { kind: 'unavailable', message: availability.error ?? 'That name cannot be used.' };
}

export function NpanelDeployForm({
  dashboardHost,
  domain,
  projectId,
  projectName,
  savedSubdomain,
  savedSiteTitle,
  savedSiteDescription,
  onSubdomainChange,
  onSiteTitleChange,
  onSiteDescriptionChange,
  onValidationChange,
  onTakeBackSites,
}: NpanelDeployFormProps) {
  const { user } = useCurrentUser();
  const [subdomain, setSubdomain] = useState(savedSubdomain || projectId);
  const [siteTitle, setSiteTitle] = useState(savedSiteTitle ?? projectName);
  const [siteDescription, setSiteDescription] = useState(savedSiteDescription ?? '');
  const [nameState, setNameState] = useState<NameState>({ kind: 'empty' });

  // Keyed by provider id in DeploySteps, so this runs once with fresh props.
  const initializedRef = useRef(false);
  const syncToParent = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    onSubdomainChange(savedSubdomain || projectId);
    onSiteTitleChange(savedSiteTitle ?? projectName);
    if (savedSiteDescription) onSiteDescriptionChange(savedSiteDescription);
  }, [
    savedSubdomain,
    savedSiteTitle,
    savedSiteDescription,
    projectId,
    projectName,
    onSubdomainChange,
    onSiteTitleChange,
    onSiteDescriptionChange,
  ]);

  useEffect(() => {
    syncToParent();
  }, [syncToParent]);

  // The name this project already deployed to is not "taken" — it is theirs,
  // and asking the gateway would truthfully say taken and alarm them about
  // their own site. Compared trimmed, since that is what gets deployed: a
  // trailing space is not a different name.
  const trimmed = subdomain.trim();
  const isOwnName = Boolean(savedSubdomain) && trimmed === savedSubdomain;

  useEffect(() => {
    if (!trimmed) {
      setNameState({ kind: 'empty' });
      return;
    }
    if (isOwnName) {
      setNameState({ kind: 'mine' });
      return;
    }

    setNameState({ kind: 'checking' });

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // Signed, where there is someone to sign: a name this user owns but this
      // project has never deployed to — one they took back through the
      // migration — is otherwise indistinguishable from a stranger's.
      const availability = await checkNameAvailable(
        dashboardHost,
        `${trimmed}.${domain}`,
        controller.signal,
        user?.signer,
      );
      if (!controller.signal.aborted) setNameState(describe(availability, domain));
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, isOwnName, dashboardHost, domain, user?.signer]);

  // A name still being checked stays deployable: the gateway decides for real
  // when the deploy runs, and blocking the button on an in-flight request would
  // make the form feel stuck on a slow connection.
  // A name still waiting is not one to deploy to: the gateway would refuse,
  // because taking it back is what turns it into somewhere this user can
  // publish. The field says so and offers the step rather than the refusal.
  const isValid =
    subdomain.trim() !== '' && nameState.kind !== 'unavailable' && nameState.kind !== 'waiting';

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const handleSubdomainChange = (value: string) => {
    setSubdomain(value);
    onSubdomainChange(value);
  };

  const handleSiteTitleChange = (value: string) => {
    setSiteTitle(value);
    onSiteTitleChange(value);
  };

  const handleSiteDescriptionChange = (value: string) => {
    setSiteDescription(value);
    onSiteDescriptionChange(value);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="npanel-subdomain">Address</Label>
        <div className="flex items-center gap-2">
          <Input
            id="npanel-subdomain"
            value={subdomain}
            onChange={(e) => handleSubdomainChange(e.target.value)}
            placeholder={projectId}
            className={nameState.kind === 'unavailable' ? 'border-destructive' : ''}
          />
          <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">
            .{domain}
          </span>
        </div>

        {nameState.kind === 'checking' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Checking availability…</span>
          </div>
        )}

        {nameState.kind === 'free' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3 w-3" />
            <span>
              <span className="font-mono">{subdomain.trim()}.{domain}</span> is available.
            </span>
          </div>
        )}

        {nameState.kind === 'waiting' && (
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <p className="text-sm">
              <span className="font-mono">{subdomain.trim()}.{domain}</span> is being held for you.
            </p>
            <p className="text-xs text-muted-foreground">
              You published it before {domain} moved to this gateway. It is being served from an
              archive until you take it back, which publishes your own copy and points the name at
              it.
            </p>
            {onTakeBackSites && (
              <Button type="button" variant="outline" size="sm" onClick={onTakeBackSites}>
                Take back your sites
              </Button>
            )}
          </div>
        )}

        {nameState.kind === 'unavailable' && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{nameState.message}</span>
          </div>
        )}
      </div>

      <AdvancedSection>
        <div className="space-y-2">
          <Label htmlFor="npanel-title">Site Title</Label>
          <Input
            id="npanel-title"
            value={siteTitle}
            onChange={(e) => handleSiteTitleChange(e.target.value)}
            placeholder="My Nostr Site"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="npanel-description">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="npanel-description"
            value={siteDescription}
            onChange={(e) => handleSiteDescriptionChange(e.target.value)}
            placeholder="A short description of this site…"
            rows={2}
          />
        </div>
      </AdvancedSection>
    </div>
  );
}
