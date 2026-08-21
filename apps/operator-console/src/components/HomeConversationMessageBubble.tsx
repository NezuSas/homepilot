import React, { useState } from 'react';
import { Bot, CheckCircle2, ChevronRight, HelpCircle, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { cn } from '../lib/utils';
import type { ChatMessage } from '../types/assistantConversation';
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
  onOptionClick: (optionId: string, label: string) => void;
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
  const requiresConfirmation = isClarification && /\b(confirm|confirma|confirmas|confirmacion)\b/i.test(message.content);
  const isSuccessfulExecution = message.execution?.status === 'success';
  const messageLines = message.content.split(/\r?\n/);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const actionableOptions = hasConfirmationOptions ? undefined : message.options;
  const visibleOptions = showAllOptions ? actionableOptions : actionableOptions?.slice(0, 4);
  const hiddenOptionCount = Math.max(0, (actionableOptions?.length ?? 0) - (visibleOptions?.length ?? 0));

  return (
    <div
      className={cn(
        'home-conversation-message flex w-full animate-in slide-in-from-bottom-2 duration-300',
        isUserMessage ? 'home-conversation-message--user justify-end' : 'home-conversation-message--assistant justify-start'
      )}
    >
      <div className={cn(
        'home-conversation-message-stack flex gap-3',
        isUserMessage ? 'max-w-conversation-mobile flex-row-reverse lg:max-w-percent-64' : 'max-w-conversation-mobile flex-row lg:max-w-conversation-assistant'
      )}>
        <div className={cn(
          'home-conversation-message-avatar mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden',
          isUserMessage
            ? 'bg-primary text-primary-foreground'
            : isError
              ? 'home-conversation-message-avatar--error'
              : 'text-primary'
        )}>
          {isUserMessage ? (
            user?.avatarDataUri ? (
              <img
                src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri}
                alt={userLabel}
                className="h-full w-full object-cover"
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
            'home-conversation-message-card rounded-2xl p-4',
            isUserMessage
              ? 'home-conversation-message-card--user rounded-tr-md border-primary bg-primary text-primary-foreground'
              : isError
                ? 'home-conversation-message-card--error rounded-tl-md border-danger/25 bg-danger/5 text-foreground'
                : requiresConfirmation
                  ? 'home-conversation-message-card--confirmation rounded-tl-md text-foreground'
                  : isSuccessfulExecution
                    ? 'home-conversation-message-card--success rounded-tl-md text-foreground'
                    : 'home-conversation-message-card--assistant rounded-tl-md text-foreground'
          )}>
            {!isUserMessage && (requiresConfirmation || (isClarification && !message.options?.length) || message.execution) && (
              <div className={cn(
                'home-conversation-message-status mb-4 flex items-start gap-2.5 pb-3',
                requiresConfirmation ? 'text-primary' : isSuccessfulExecution ? 'text-success' : 'text-muted-foreground'
              )}>
                {requiresConfirmation ? (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                ) : isSuccessfulExecution ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-caption font-bold leading-tight">
                    {requiresConfirmation
                      ? t('assistant.conversation.confirmation_required')
                      : isSuccessfulExecution
                        ? t('assistant.conversation.execution_completed')
                        : t('assistant.conversation.clarification_required')}
                  </p>
                  {requiresConfirmation && (
                    <p className="mt-0.5 text-micro leading-snug text-muted-foreground">
                      {t('assistant.conversation.confirmation_reply_hint')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="home-conversation-message-content space-y-2 break-words text-body font-medium leading-relaxed">
              {messageLines.map((line, index) => (
                <p key={`${message.id}-${index}`} className={line.length === 0 ? 'h-1' : undefined}>
                  {line}
                </p>
              ))}
            </div>

            {actionableOptions && actionableOptions.length > 0 && (
              <div className="home-conversation-message-actions mt-4 space-y-3 pt-4">
                <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-muted-foreground/70">
                  {hasConfirmationOptions ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>
                    {hasConfirmationOptions ? t('assistant.conversation.confirmation_question') : t('assistant.conversation.options_question')}
                  </span>
                </div>
                <div className={cn('grid gap-2', hasConfirmationOptions ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
                  {visibleOptions?.map(option => {
                    const isConfirm = option.id === 'confirm';
                    const isCancel = option.id === 'cancel';

                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant={isConfirm ? 'primary' : isCancel ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => onOptionClick(option.id, option.label)}
                        className={cn(
                          'min-h-10 rounded-xl bg-background/60',
                          isConfirm && 'shadow-primary/15',
                          isCancel && 'text-muted-foreground hover:text-foreground'
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
                {hiddenOptionCount > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllOptions(true)} className="self-start text-primary">
                    {t('assistant.conversation.show_more_options', { count: hiddenOptionCount })}
                  </Button>
                )}
              </div>
            )}

            {message.execution && !isSuccessfulExecution && (
              <div className="home-conversation-message-actions mt-4 flex items-center gap-2 pt-4">
                {message.execution.status === 'partial' ? (
                  <StatusPill variant="warning">{t('assistant.conversation.execution_partial')}</StatusPill>
                ) : (
                  <StatusPill variant="danger">{t('assistant.conversation.execution_failed')}</StatusPill>
                )}
              </div>
            )}
          </Card>

          <span className={cn(
            'home-conversation-message-timestamp px-1 text-micro text-muted-foreground/50',
            isUserMessage ? 'text-right' : 'text-left'
          )}>
            {new Date(message.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};