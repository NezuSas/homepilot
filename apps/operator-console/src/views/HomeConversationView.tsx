import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { converseWithAssistant } from '../lib/assistantApi';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import type { AssistantConversationResponse, AssistantConverseRequest, ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationEmptyState } from '../components/HomeConversationEmptyState';
import { HomeConversationHeader } from '../components/HomeConversationHeader';
import { HomeConversationMessageBubble } from '../components/HomeConversationMessageBubble';
import { HomeConversationTypingIndicator } from '../components/HomeConversationTypingIndicator';

export const HomeConversationView: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useSession(() => {});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleResponse = (response: AssistantConversationResponse) => {
    addMessage({
      role: 'assistant',
      content: response.message,
      responseType: response.type,
      options: response.clarification?.options,
      execution: response.execution,
      pendingAction: response.clarification?.pendingAction
    });
  };

  const addErrorMessage = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addMessage({
      role: 'assistant',
      content: errorMessage || t('assistant.conversation.unknown_error'),
      responseType: 'error'
    });
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userText = text.trim();
    setInput('');
    addMessage({ role: 'user', content: userText });
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: userText,
        userName: user?.displayName || user?.username
      });
      handleResponse(response);
    } catch (error: unknown) {
      addErrorMessage(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = async (optionId: string, label: string, pendingAction?: AssistantConverseRequest['pendingAction']) => {
    if (isLoading) return;

    addMessage({
      role: 'user',
      content: t('assistant.conversation.selected_option', { label })
    });
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: `Selected: ${label}`,
        userName: user?.displayName || user?.username,
        selectedOptionId: optionId,
        pendingAction,
        confirmed: optionId === 'confirm'
      });
      handleResponse(response);
    } catch (error: unknown) {
      addErrorMessage(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const suggestions = useMemo(() => [
    t('assistant.conversation.placeholder').split('ej: ')[1]?.split(',')[0] || t('assistant.conversation.suggestion_1'),
    t('assistant.conversation.suggestion_1'),
    t('assistant.conversation.suggestion_2'),
    t('assistant.conversation.suggestion_3')
  ], [t]);

  return (
    <section className="flex h-full w-full animate-in fade-in duration-500 flex-col overflow-hidden bg-background">
      <HomeConversationHeader
        title={t('assistant.conversation.title', 'Asistente de Hogar')}
        subtitle={t('assistant.conversation.subtitle', 'Control Inteligente')}
        statusLabel={isLoading ? t('assistant.conversation.sending') : t('assistant.conversation.ready')}
        isLoading={isLoading}
        messageCount={messages.length}
      />

      <div
        ref={scrollRef}
        className="custom-scrollbar flex-1 overflow-y-auto scroll-smooth px-4 py-5 md:px-6 lg:px-10 lg:py-8"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          {messages.length === 0 && (
          <HomeConversationEmptyState
            title={t('assistant.conversation.empty_chat_title')}
            description={t('assistant.conversation.empty_chat_description')}
            suggestions={suggestions}
            onSuggestionClick={handleSend}
          />
          )}

          {messages.map(message => (
            <HomeConversationMessageBubble
              key={message.id}
              message={message}
              user={user}
              onOptionClick={handleOptionClick}
            />
          ))}

          {isLoading && <HomeConversationTypingIndicator />}
        </div>
      </div>

      <HomeConversationComposer
        input={input}
        isLoading={isLoading}
        placeholder={t('assistant.conversation.placeholder')}
        sendLabel={t('assistant.conversation.send')}
        versionLabel={t('assistant.conversation.version_label')}
        inputHint={t('assistant.conversation.input_hint')}
        onInputChange={setInput}
        onSend={() => handleSend()}
        onKeyDown={handleKeyDown}
      />
    </section>
  );
};
