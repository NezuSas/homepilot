import React from 'react';
import { Bot, CheckCircle2, ChevronRight, HelpCircle, XCircle } from 'lucide-react';
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
  const isClarification = message.responseType === 'clarification';
  const userLabel = user?.displayName || user?.username || t('assistant.conversation.user_fallback');
  const hasConfirmationOptions = message.options?.some(option => option.id === 'confirm' || option.id === 'cancel') ?? false;

  return (
    <div
      className={cn(
        "flex w-full animate-in slide-in-from-bottom-2 duration-300",
        isUserMessage ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex gap-3",
        isUserMessage ? "max-w-conversation-mobile flex-row-reverse lg:max-w-percent-64" : "max-w-conversation-mobile flex-row lg:max-w-conversation-assistant"
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
              <span className="text-caption font-black uppercase">{userLabel.substring(0, 2)}</span>
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
            <p className="whitespace-pre-wrap break-words text-body font-medium leading-relaxed">
              {message.content}
            </p>

            {message.options && message.options.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-muted-foreground/70">
                  {hasConfirmationOptions ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>
                    {hasConfirmationOptions ? t('assistant.conversation.confirmation_question') : t('assistant.conversation.options_question')}
                  </span>
                </div>
                <div className={cn("grid gap-2", hasConfirmationOptions ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
                  {message.options.map(option => {
                    const isConfirm = option.id === 'confirm';
                    const isCancel = option.id === 'cancel';

                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant={isConfirm ? 'primary' : isCancel ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => onOptionClick(option.id, option.label, message.pendingAction)}
                        className={cn(
                          "min-h-10 rounded-xl bg-background/60",
                          isConfirm && "bg-success text-success-foreground hover:bg-success/90 shadow-success/15",
                          isCancel && "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {isConfirm && <CheckCircle2 className="h-4 w-4" />}
                        {isCancel && <XCircle className="h-4 w-4" />}
                        <span className="min-w-0 whitespace-normal break-words text-left">{option.label}</span>
                        {!isConfirm && !isCancel && <ChevronRight className="h-4 w-4" />}
                      </Button>
                    );
                  })}
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

            {isClarification && !message.options?.length && (
              <div className="mt-4 border-t border-border/50 pt-4">
                <StatusPill variant="primary">
                  <HelpCircle className="h-3 w-3" />
                  {t('assistant.conversation.needs_clarification')}
                </StatusPill>
              </div>
            )}
          </Card>

          <span className={cn(
            "px-1 text-micro text-muted-foreground/50",
            isUserMessage ? "text-right" : "text-left"
          )}>
            {new Date(message.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};
