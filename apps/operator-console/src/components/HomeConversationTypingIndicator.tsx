import React from 'react';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/Card';

export const HomeConversationTypingIndicator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('assistant.conversation.typing')}
      className="flex w-full max-w-composer-bubble justify-start animate-in fade-in duration-300"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted shadow-depth-1">
          <Bot className="h-5 w-5 animate-pulse text-primary" aria-hidden="true" />
        </div>
        <Card className="flex items-center gap-1.5 rounded-2xl rounded-tl-md p-4 shadow-depth-1">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" />
        </Card>
      </div>
    </div>
  );
};
