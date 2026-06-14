import React from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { cn } from '../lib/utils';
import type { AssistantConverseRequest, ChatMessage } from '../types/assistantConversation';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { StatusPill } from './ui/StatusPill';

interface ConversationUser {
  username?: string;
  displayName?: string | null;
  avatarDataUri?: string | null;
}

interface HomeConversationMessageBubbleProps {
  message: ChatMessage;
  user?: ConversationUser | null;
  onOptionClick: (optionId: string, label: string, pendingAction?: AssistantConverseRequest['pendingAction']) => void;
}

export const HomeConversationMessageBubble: React.FC<HomeConversationMessageBubbleProps> = ({
  message,
  user,
  onOptionClick
}) => {
  const { t, i18n } = useTranslation();
  const isUserMessage = message.role === 'user';
  const isError = message.responseType === 'error';
  const userLabel = user?.displayName || user?.username || 'Usuario';

  return (
    <div
      className={cn(
        "flex w-full animate-in slide-in-from-bottom-2 duration-300",
        isUserMessage ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex gap-3",
        isUserMessage ? "max-w-[92%] flex-row-reverse lg:max-w-[64%]" : "max-w-[92%] flex-row lg:max-w-[74%]"
      )}>
        <div className={cn(
          "mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-depth-1",
          isUserMessage
            ? "bg-primary text-primary-foreground"
            : isError
              ? "border border-danger/25 bg-danger/10 text-danger"
              : "border border-border bg-muted text-muted-foreground"
        )}>
          {isUserMessage ? (
            user?.avatarDataUri ? (
              <img
                src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri}
                alt={userLabel}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-black uppercase">{userLabel.substring(0, 2)}</span>
            )
          ) : (
            <Bot className="h-5 w-5 text-current" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Card className={cn(
            "rounded-2xl p-4 shadow-depth-1",
            isUserMessage
              ? "rounded-tr-md border-primary bg-primary text-primary-foreground"
              : isError
                ? "rounded-tl-md border-danger/25 bg-danger/5 text-foreground"
                : "rounded-tl-md bg-card/90 text-foreground"
          )}>
            <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed md:text-[0.95rem]">
              {message.content}
            </p>

            {message.options && message.options.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                  {t('assistant.conversation.options_question')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {message.options.map(option => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onOptionClick(option.id, option.label, message.pendingAction)}
                      className="rounded-xl bg-background/60"
                    >
                      <span>{option.label}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {message.execution && (
              <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
                {message.execution.status === 'success' ? (
                  <StatusPill variant="success">{t('assistant.conversation.execution_success')}</StatusPill>
                ) : message.execution.status === 'partial' ? (
                  <StatusPill variant="warning">{t('assistant.conversation.execution_partial')}</StatusPill>
                ) : (
                  <StatusPill variant="danger">{t('assistant.conversation.execution_failed')}</StatusPill>
                )}
              </div>
            )}
          </Card>

          <span className={cn(
            "px-1 text-[10px] text-muted-foreground/50",
            isUserMessage ? "text-right" : "text-left"
          )}>
            {new Date(message.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};
