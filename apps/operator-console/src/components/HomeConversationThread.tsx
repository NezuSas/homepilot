import { useLayoutEffect, useRef } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import type { ChatMessage } from '../types/assistantConversation';
import { Button } from './ui/Button';
import { HomeConversationEmptyState } from './HomeConversationEmptyState';
import { HomeConversationMessageBubble } from './HomeConversationMessageBubble';
import { HomeConversationTypingIndicator } from './HomeConversationTypingIndicator';

interface HomeConversationThreadProps {
  onScrollContainerReady: (element: HTMLDivElement | null) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  user: { username?: string; displayName?: string | null; avatarDataUri?: string | null } | null;
  conversationActiveLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  suggestionsLabel: string;
  confirmationRequiredLabel: string;
  suggestions: Array<{ id: string; label: string; requiresConfirmation?: boolean }>;
  newConversationLabel: string;
  onSuggestionClick: (text: string) => void;
  onOptionClick: (optionId: string, label: string) => void;
  onClearConversation: () => void;
}

/** Read-only timeline boundary; it owns transcript layout but never assistant state. */
export function HomeConversationThread(props: HomeConversationThreadProps) {
  const feedElementRef = useRef<HTMLDivElement>(null);
  const { onScrollContainerReady } = props;

  useLayoutEffect(() => {
    onScrollContainerReady(feedElementRef.current);
    return () => onScrollContainerReady(null);
  }, [onScrollContainerReady]);

  return <div ref={feedElementRef} className="home-conversation-feed custom-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-4 md:px-6 lg:px-8 xl:px-10 xl:py-8">
    <div role="log" aria-live="polite" aria-relevant="additions text" className="home-conversation-thread mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-5">
      {props.messages.length > 0 && (
        <p className="home-conversation-thread-status text-xs font-medium text-muted-foreground">
          {props.conversationActiveLabel}
        </p>
      )}
      {props.messages.length === 0 && !props.isLoading && (
        <HomeConversationEmptyState
          title={props.emptyTitle}
          description={props.emptyDescription}
          suggestionsLabel={props.suggestionsLabel}
          suggestions={props.suggestions}
          confirmationRequiredLabel={props.confirmationRequiredLabel}
          onSuggestionClick={props.onSuggestionClick}
        />
      )}
      {props.messages.map((message) => (
        <HomeConversationMessageBubble key={message.id} message={message} user={props.user} onOptionClick={props.onOptionClick} />
      ))}
      {props.messages.length > 0 && !props.isLoading && (
        <div className="home-conversation-thread-actions">
          <Button type="button" variant="outline" size="sm" onClick={props.onClearConversation} className="home-conversation-new-thread">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            <span>{props.newConversationLabel}</span>
          </Button>
        </div>
      )}
      {props.isLoading && <HomeConversationTypingIndicator />}
    </div>
  </div>;
}
