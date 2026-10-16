import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';
import { Dictation } from '@/lib/speech/dictation';
import { cn } from '@/lib/utils';

type VoiceState = 'idle' | 'starting' | 'listening' | 'finishing';

interface VoiceInputButtonProps {
  /** Dictation is starting; its text goes where the cursor is now. */
  onStart: () => void;
  /** The transcript so far, which replaces the previous one. */
  onText: (text: string) => void;
  /** Dictation is over, the last `onText` was final. */
  onEnd: () => void;
  disabled?: boolean;
}

/** Live dictation, transcribed locally with Whisper. Stops by itself when the speaker does. */
export function VoiceInputButton({ onStart, onText, onEnd, disabled }: VoiceInputButtonProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [state, setState] = useState<VoiceState>('idle');
  const [progress, setProgress] = useState<number>();
  const dictationRef = useRef<Dictation>();

  // Release the microphone if the input goes away mid-dictation.
  useEffect(() => () => dictationRef.current?.cancel(), []);

  const fail = useCallback((error: unknown) => {
    dictationRef.current = undefined;
    setState('idle');
    onEnd();
    toast({
      title: t('voiceInputFailed'),
      description: error instanceof Error ? error.message : String(error),
      variant: 'destructive',
    });
  }, [onEnd, t, toast]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
      fail(new Error(t('voiceInputUnsupported')));
      return;
    }
    setState('starting');
    onStart();
    try {
      dictationRef.current = await Dictation.start({
        language: i18n.resolvedLanguage ?? 'en',
        onText,
        onProgress: setProgress,
        onFinishing: () => setState('finishing'),
        onEnd: (text) => {
          dictationRef.current = undefined;
          setState('idle');
          onText(text);
          onEnd();
        },
        onError: fail,
      });
      setState('listening');
    } catch (error) {
      fail(error);
    }
  }, [fail, i18n, onEnd, onStart, onText, t]);

  const stop = useCallback(() => dictationRef.current?.stop(), []);

  const downloading = state !== 'idle' && progress !== undefined && progress < 100;
  const label = downloading
    ? t('voiceInputDownloading', { percent: Math.round(progress) })
    : state === 'listening'
      ? t('voiceInputStop')
      : state === 'finishing'
        ? t('voiceInputTranscribing')
        : t('voiceInputStart');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={state === 'idle' ? start : state === 'listening' ? stop : undefined}
            disabled={disabled}
            className={cn(
              'h-8 w-8 p-0 rounded-full hover:bg-muted/50',
              state === 'listening' && 'bg-destructive/10 text-destructive hover:bg-destructive/20 animate-pulse',
            )}
            aria-label={label}
            aria-pressed={state === 'listening'}
          >
            {state === 'listening' ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : state === 'idle' ? (
              <Mic className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
      {downloading && (
        <span className="text-xs text-muted-foreground whitespace-nowrap" aria-live="polite">{label}</span>
      )}
    </TooltipProvider>
  );
}
