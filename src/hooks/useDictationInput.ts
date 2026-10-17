import { useCallback, useRef, useState, type RefObject } from 'react';

import { joinText } from '@/lib/speech/dictation';

interface DictationInputOptions {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  /** Height the textarea grows to before it scrolls. */
  maxHeight: number;
}

/**
 * Puts live dictation into a textarea at the cursor, replacing it as the
 * transcript is revised. Pass the handlers to a `VoiceInputButton`.
 */
export function useDictationInput({ textareaRef, value, onChange, maxHeight }: DictationInputOptions) {
  // The text around the cursor when dictation started; the transcript goes between.
  const surroundingRef = useRef<{ before: string; after: string }>();
  const [isDictating, setIsDictating] = useState(false);
  // The dictation captures these callbacks when it starts, so they read the latest props from refs.
  const latest = useRef({ onChange, maxHeight });
  latest.current = { onChange, maxHeight };

  const onStart = useCallback(() => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    surroundingRef.current = { before: value.slice(0, start), after: value.slice(end) };
    setIsDictating(true);
  }, [textareaRef, value]);

  const onText = useCallback((text: string) => {
    if (!surroundingRef.current) return;
    const { before, after } = surroundingRef.current;
    latest.current.onChange(joinText(before, text) + (text && after && !/^\s/.test(after) ? ' ' : '') + after);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, latest.current.maxHeight) + 'px';
      textarea.scrollTop = textarea.scrollHeight;
    });
  }, [textareaRef]);

  const onEnd = useCallback(() => {
    surroundingRef.current = undefined;
    setIsDictating(false);
  }, []);

  return { isDictating, onStart, onText, onEnd };
}
