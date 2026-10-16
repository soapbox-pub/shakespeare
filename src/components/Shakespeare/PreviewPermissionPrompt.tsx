import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, KeyRound, Lock, Pen, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import type { PreviewPromptDecision, PreviewPromptState } from '@/hooks/usePreviewSignerRpc';

interface PreviewPermissionPromptProps {
  prompt: PreviewPromptState;
  onResolve: (decision: PreviewPromptDecision) => void;
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max) + '\u2026';
}

/**
 * Overlay shown on top of the preview iframe when the previewed app asks the
 * user's signer to do something.
 */
export function PreviewPermissionPrompt({ prompt, onResolve }: PreviewPermissionPromptProps) {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const nip = prompt.type.startsWith('nip04') ? 'NIP-04' : 'NIP-44';

  let icon: React.ReactNode;
  let title: string;
  let description: string;
  switch (prompt.type) {
    case 'signEvent':
      icon = <Pen className="size-5 text-amber-500" />;
      if (prompt.dTag !== null) {
        title = t('previewSignerWriteAppData', { dTag: prompt.dTag });
        description = t('previewSignerWriteAppDataDescription');
      } else {
        title = t('previewSignerSignKind', { kind: prompt.kind });
        description = t('previewSignerSignDescription');
      }
      break;
    case 'nip04.encrypt':
    case 'nip44.encrypt':
      icon = <Lock className="size-5 text-blue-500" />;
      title = t('previewSignerEncrypt', { nip });
      description = t('previewSignerEncryptDescription');
      break;
    case 'nip04.decrypt':
    case 'nip44.decrypt':
      icon = <KeyRound className="size-5 text-violet-500" />;
      title = t(prompt.self ? 'previewSignerDecryptSelf' : 'previewSignerDecrypt', { nip });
      description = t(prompt.self ? 'previewSignerDecryptSelfDescription' : 'previewSignerDecryptDescription');
      break;
  }

  const eventContent = typeof prompt.event?.content === 'string' ? prompt.event.content : undefined;
  const eventJson = prompt.event ? JSON.stringify(prompt.event, null, 2) : null;

  const resolve = (allowed: boolean) => onResolve({ allowed, remember });

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-labelledby="preview-signer-title"
        className="w-full max-w-sm rounded-xl border bg-card shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-5 pt-5 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t('previewSignerRequest')}</p>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="min-w-0">
              <p id="preview-signer-title" className="text-sm font-medium break-words">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>

          {eventContent && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t('previewSignerContent')}</p>
              <p className="text-sm break-words whitespace-pre-wrap">{truncate(eventContent, 280)}</p>
            </div>
          )}

          {eventJson && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDetails ? t('previewSignerHideDetails') : t('previewSignerShowDetails')}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs font-mono max-h-40 overflow-auto whitespace-pre-wrap break-all">
                  {eventJson}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="preview-signer-remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
            />
            <Label
              htmlFor="preview-signer-remember"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              {t('previewSignerRemember')}
            </Label>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => resolve(false)}>
            <X className="size-3.5" />
            {t('previewSignerDeny')}
          </Button>
          <Button className="flex-1 gap-1.5" onClick={() => resolve(true)}>
            <Check className="size-3.5" />
            {t('previewSignerAllow')}
          </Button>
        </div>
      </div>
    </div>
  );
}
