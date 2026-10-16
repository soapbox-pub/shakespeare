import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';
import { decodeAudio, transcribe } from '@/lib/speech';
import { cn } from '@/lib/utils';

type VoiceState =
  | { status: 'idle' }
  | { status: 'recording' }
  | { status: 'transcribing'; progress?: number };

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/** Records from the microphone and transcribes it locally with Whisper. */
export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [state, setState] = useState<VoiceState>({ status: 'idle' });
  const recorderRef = useRef<MediaRecorder>();

  // Release the microphone if the input goes away mid-recording.
  useEffect(() => () => {
    const recorder = recorderRef.current;
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const fail = useCallback((error: unknown) => {
    setState({ status: 'idle' });
    toast({
      title: t('voiceInputFailed'),
      description: error instanceof Error ? error.message : String(error),
      variant: 'destructive',
    });
  }, [t, toast]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail(new Error(t('voiceInputUnsupported')));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      fail(error);
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = undefined;
      setState({ status: 'transcribing' });
      try {
        const audio = await decodeAudio(new Blob(chunks, { type: recorder.mimeType }));
        const text = await transcribe(audio, i18n.resolvedLanguage ?? 'en', (progress) => setState({ status: 'transcribing', progress }));
        if (text) onTranscript(text);
        setState({ status: 'idle' });
      } catch (error) {
        fail(error);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setState({ status: 'recording' });
  }, [fail, i18n, onTranscript, t]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const downloading = state.status === 'transcribing' && state.progress !== undefined && state.progress < 100;
  const label =
    state.status === 'recording'
      ? t('voiceInputStop')
      : state.status === 'transcribing'
        ? downloading
          ? t('voiceInputDownloading', { percent: Math.round(state.progress ?? 0) })
          : t('voiceInputTranscribing')
        : t('voiceInputStart');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={state.status === 'idle' ? start : state.status === 'recording' ? stop : undefined}
            disabled={disabled}
            className={cn(
              'h-8 w-8 p-0 rounded-full hover:bg-muted/50',
              state.status === 'recording' && 'bg-destructive/10 text-destructive hover:bg-destructive/20 animate-pulse',
            )}
            aria-label={label}
            aria-pressed={state.status === 'recording'}
          >
            {state.status === 'recording' ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : state.status === 'transcribing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
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
