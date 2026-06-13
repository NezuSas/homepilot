import React from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { cn } from '../lib/utils';
import type { AssistantConverseRequest, ChatMessage } from '../types/assistantConversation';
import { StatusPill } from './ui/StatusPill';

interface ConversationUser {
  username?: string;
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

  return (
    <div
      className={cn(
        "flex w-full animate-in slide-in-from-bottom-2 duration-300",
        isUserMessage ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex space-x-3",
        isUserMessage ? "flex-row-reverse space-x-reverse max-w-[88%] lg:max-w-[64%]" : "flex-row max-w-[88%] lg:max-w-[72%]"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg mt-1 overflow-hidden",
          isUserMessage ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-muted-foreground"
        )}>
          {isUserMessage ? (
            user?.avatarDataUri ? (
              <img
                src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-black text-xs uppercase">{(user?.username || 'U').substring(0, 2)}</span>
            )
          ) : (
            <Bot className="w-5 h-5 text-primary" />
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <div className={cn(
            "p-4 rounded-2xl shadow-xl border",
            isUserMessage
              ? "bg-primary text-primary-foreground rounded-tr-none border-primary"
              : "bg-muted/80 border-border text-foreground rounded-tl-none"
          )}>
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

            {message.options && message.options.length > 0 && (
              <div className="mt-4 space-y-2 pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground mb-3">{t('assistant.conversation.options_question')}</p>
                <div className="flex flex-wrap gap-2">
                  {message.options.map(option => (
                    <button
                      key={option.id}
                      onClick={() => onOptionClick(option.id, option.label, message.pendingAction)}
                      className="px-4 py-2 bg-background/50 hover:bg-primary/10 border border-border hover:border-primary/50 rounded-xl text-sm font-medium transition-all duration-200 flex items-center group text-foreground"
                    >
                      <span>{option.label}</span>
                      <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {message.execution && (
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center space-x-2">
                {message.execution.status === 'success' ? (
                  <StatusPill variant="success">{t('assistant.conversation.execution_success')}</StatusPill>
                ) : message.execution.status === 'partial' ? (
                  <StatusPill variant="warning">{t('assistant.conversation.execution_partial')}</StatusPill>
                ) : (
                  <StatusPill variant="danger">{t('assistant.conversation.execution_failed')}</StatusPill>
                )}
              </div>
            )}
          </div>

          <span className={cn(
            "text-[10px] text-muted-foreground px-1 opacity-40",
            isUserMessage ? "text-right" : "text-left"
          )}>
            {new Date(message.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};
