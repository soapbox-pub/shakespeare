import { useEffect, useRef, useCallback } from 'react';

interface UseKeepAliveOptions {
  /** Whether to enable keep-alive functionality */
  enabled: boolean;
  /** Title to show in media session */
  title: string;
  /** Artist to show in media session */
  artist: string;
  /** Artwork to show in media session */
  artwork?: MediaImage[];
}

/**
 * Hook to keep the tab alive using a silent sine wave and Media Session API.
 * This prevents the browser from throttling the tab when the user locks their phone
 * or navigates away, allowing AI processing to continue in the background.
 */
export function useKeepAlive({
  enabled,
  title,
  artist,
  artwork = []
}: UseKeepAliveOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isActiveRef = useRef(false);

  const startKeepAlive = useCallback(async () => {
    if (isActiveRef.current || !enabled) return;

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }
      audioContextRef.current = new AudioContextClass();
      const audioContext = audioContextRef.current;

      // Resume audio context if suspended (required for user interaction)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create oscillator for silent sine wave
      oscillatorRef.current = audioContext.createOscillator();
      gainNodeRef.current = audioContext.createGain();

      const oscillator = oscillatorRef.current;
      const gainNode = gainNodeRef.current;

      // Configure oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(20000, audioContext.currentTime); // 20kHz - above human hearing range

      // Set volume to nearly silent but not completely muted
      gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Start oscillator
      oscillator.start();

      // Set up Media Session API
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          artwork
        });

        // Set playback state
        navigator.mediaSession.playbackState = 'playing';

        // Handle media session actions
        navigator.mediaSession.setActionHandler('play', () => {
          // Already playing, do nothing
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          stopKeepAlive();
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          stopKeepAlive();
        });
      }

      isActiveRef.current = true;
      console.log('Keep-alive started with silent audio and media session');
    } catch (error) {
      console.error('Failed to start keep-alive:', error);
    }
  }, [enabled, title, artist, artwork]);

  const stopKeepAlive = useCallback(() => {
    if (!isActiveRef.current) return;

    try {
      // Stop oscillator
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }

      // Disconnect gain node
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Clear media session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';

        // Clear action handlers
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
      }

      isActiveRef.current = false;
      console.log('Keep-alive stopped');
    } catch (error) {
      console.error('Failed to stop keep-alive:', error);
    }
  }, []);

  const updateMetadata = useCallback((newTitle: string, newArtist?: string) => {
    if (!isActiveRef.current || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: newTitle,
        artist: newArtist || artist,
        artwork
      });
    } catch (error) {
      console.error('Failed to update media session metadata:', error);
    }
  }, [artist, artwork]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopKeepAlive();
    };
  }, [stopKeepAlive]);

  // Handle enabled state changes
  useEffect(() => {
    if (enabled && !isActiveRef.current) {
      // Small delay to ensure user interaction has occurred
      const timer = setTimeout(() => {
        startKeepAlive();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!enabled && isActiveRef.current) {
      stopKeepAlive();
    }
  }, [enabled, startKeepAlive, stopKeepAlive]);

  return {
    isActive: isActiveRef.current,
    startKeepAlive,
    stopKeepAlive,
    updateMetadata
  };
}