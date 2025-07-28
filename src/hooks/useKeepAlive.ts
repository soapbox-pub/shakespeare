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
 * Hook to keep the tab alive using a silent audio element and Media Session API.
 * This prevents the browser from throttling the tab when the user locks their phone
 * or navigates away, allowing AI processing to continue in the background.
 */
export function useKeepAlive({
  enabled,
  title,
  artist,
  artwork = []
}: UseKeepAliveOptions) {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isActiveRef = useRef(false);

  const startKeepAlive = useCallback(async () => {
    if (isActiveRef.current || !enabled) return;

    try {
      // Create audio element and add it to the DOM
      audioElementRef.current = document.createElement('audio');
      const audio = audioElementRef.current;

      // Configure audio element to use the provided audio file
      audio.src = '/sine.mp3';
      audio.loop = true;
      audio.volume = 0.01; // Very low volume but not completely muted
      audio.preload = 'auto';
      audio.style.display = 'none'; // Hide the audio element
      audio.setAttribute('aria-hidden', 'true'); // Hide from screen readers

      // Add to DOM (required for proper media session support)
      document.body.appendChild(audio);

      // Set up Media Session API before playing
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          artwork
        });

        // Handle media session actions
        navigator.mediaSession.setActionHandler('play', () => {
          if (audioElementRef.current) {
            audioElementRef.current.play().catch(console.error);
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            audioElementRef.current.src = '';
            audioElementRef.current.load();

            // Remove from DOM
            if (audioElementRef.current.parentNode) {
              audioElementRef.current.parentNode.removeChild(audioElementRef.current);
            }

            audioElementRef.current = null;
          }
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('stop', null);
          }
          isActiveRef.current = false;
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            audioElementRef.current.src = '';
            audioElementRef.current.load();

            // Remove from DOM
            if (audioElementRef.current.parentNode) {
              audioElementRef.current.parentNode.removeChild(audioElementRef.current);
            }

            audioElementRef.current = null;
          }
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('stop', null);
          }
          isActiveRef.current = false;
        });
      }

      // Start playing
      await audio.play();

      // Set playback state after successful play
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }

      isActiveRef.current = true;
      console.log('Keep-alive started with silent audio element and media session');
    } catch (error) {
      console.error('Failed to start keep-alive:', error);
    }
  }, [enabled, title, artist, artwork]);

  const stopKeepAlive = useCallback(() => {
    if (!isActiveRef.current) return;

    try {
      // Stop and cleanup audio element
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.src = '';
        audioElementRef.current.load(); // Reset the audio element

        // Remove from DOM
        if (audioElementRef.current.parentNode) {
          audioElementRef.current.parentNode.removeChild(audioElementRef.current);
        }

        audioElementRef.current = null;
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