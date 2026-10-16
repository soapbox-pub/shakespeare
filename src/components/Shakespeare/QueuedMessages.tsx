import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { userMessageAttachments, userMessageText } from '@/lib/messageText';
import type { QueuedMessage } from '@/lib/SessionManager';

interface QueuedMessagesProps {
  messages: QueuedMessage[];
  onRemove: (id: string) => void;
}

/** User messages waiting for the AI to finish its turn. */
export const QueuedMessages = memo(function QueuedMessages({ messages, onRemove }: QueuedMessagesProps) {
  const { t } = useTranslation();

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-b px-2 py-2">
      {messages.map(({ id, content }) => {
        const text = userMessageText(content);
        const attachments = userMessageAttachments(content);
        return (
          <div key={id} className="flex items-start gap-2 rounded-lg bg-muted/50 py-1.5 pl-3 pr-1 text-sm">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label={t('queuedMessage')} />
            <div className="min-w-0 flex-1">
              {text && <p className="line-clamp-2 whitespace-pre-wrap break-words">{text}</p>}
              {attachments > 0 && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3" />
                  {t('queuedAttachments', { count: attachments })}
                </p>
              )}
            </div>
            {text.trim() && <CopyButton text={text} />}
            <Button
              variant="ghost"
              size="sm"
              className="size-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onRemove(id)}
              aria-label={t('removeQueuedMessage')}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
});
