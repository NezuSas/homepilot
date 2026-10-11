import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import type { AssistantTurnCoordinator } from '../lib/assistantTurnCoordinator';
import type { PendingHomeConversationPrompt } from '../lib/useGlobalWake';
import type { ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationThread } from '../components/HomeConversationThread';
import { getConversationStorageKey, readStoredConversationMessages, storeConversationMessages } from './homeConversationPersistence';
import { buildAudioInputOptions, resolveActivityStatus } from './homeConversationViewModel';
import { useHomeConversationSpeech } from './useHomeConversationSpeech';
import { useHomeConversationTurns, type NewChatMessage } from './useHomeConversationTurns';
import { useHomeConversationVoice } from './useHomeConversationVoice';
import { useKeyboardInset } from './useKeyboardInset';

const noopSessionCleared = () => {};

interface HomeConversationViewProps {
  pendingPrompt?: PendingHomeConversationPrompt | null;
  onPendingPromptConsumed?: (id: string) => void;
  assistantTurnCoordinator: AssistantTurnCoordinator;
}

export const HomeConversationView: React.FC<HomeConversationViewProps> = ({ pendingPrompt, onPendingPromptConsumed, assistantTurnCoordinator }) => {
  const { t } = useTranslation();
  const { user } = useSession(noopSessionCleared);
  const conversationStorageKey = getConversationStorageKey(user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredConversationMessages(conversationStorageKey));
  const keyboardInset = useKeyboardInset();
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleScrollContainerReady = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element;
  }, []);
  const speech = useHomeConversationSpeech(assistantTurnCoordinator);

  const addMessage = (message: NewChatMessage) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const turns = useHomeConversationTurns({
    assistantTurnCoordinator,
    speech,
    addMessage,
    pendingPrompt,
    onPendingPromptConsumed
  });
  const { input, setInput, isLoading, conversationActivity, speechNotice, handleSend } = turns;

  useLayoutEffect(() => {
    const feed = scrollRef.current;
    if (!feed) return;

    const previousScrollBehavior = feed.style.scrollBehavior;
    feed.style.scrollBehavior = 'auto';
    feed.scrollTop = feed.scrollHeight;
    feed.style.scrollBehavior = previousScrollBehavior;
  }, [conversationStorageKey, messages.length, isLoading]);

  useEffect(() => {
    if (!conversationStorageKey) return;
    storeConversationMessages(conversationStorageKey, messages);
  }, [conversationStorageKey, messages]);

  const {
    isListening,
    speechSupport,
    audioInputDevices,
    selectedAudioInputId,
    setSelectedAudioInputId,
    toggleRecording
  } = useHomeConversationVoice({ assistantTurnCoordinator, turns, speech });

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    if (conversationStorageKey) sessionStorage.removeItem(conversationStorageKey);
    setMessages([]);
    turns.setSpeechNotice('');
    turns.setConversationActivity('ready');
  };

  const suggestions = useMemo(() => [
    { id: 'lights-on', label: t('assistant.conversation.suggestion_status') },
    { id: 'home-status', label: t('assistant.conversation.suggestion_home_status') },
    { id: 'all-off', label: t('assistant.conversation.suggestion_1'), requiresConfirmation: true }
  ], [t]);

  const activityStatus = useMemo(() => resolveActivityStatus(conversationActivity, speechNotice, {
    listening: t('assistant.conversation.voice_listening_status'),
    transcribing: t('assistant.conversation.voice_transcribing_status'),
    consulting: t('assistant.conversation.consulting'),
    ready: t('assistant.conversation.ready')
  }), [conversationActivity, speechNotice, t]);

  const audioInputOptions = useMemo(
    () => buildAudioInputOptions(audioInputDevices, count => t('assistant.conversation.audio_input_fallback', { count })),
    [audioInputDevices, t]
  );

  return (
    <section
      className="home-conversation-shell flex h-full w-full animate-in fade-in duration-500 flex-col overflow-hidden"
      style={{ height: keyboardInset > 0 ? `calc(100% - ${keyboardInset}px)` : '100%' }}
    >

      <HomeConversationThread onScrollContainerReady={handleScrollContainerReady} messages={messages} isLoading={isLoading} user={user} conversationActiveLabel={t('assistant.conversation.conversation_active')} emptyTitle={t('assistant.conversation.empty_title')} emptyDescription={t('assistant.conversation.empty_description')} suggestionsLabel={t('assistant.conversation.suggestions_label')} confirmationRequiredLabel={t('assistant.conversation.confirmation_required')} suggestions={suggestions} newConversationLabel={t('assistant.conversation.new_conversation')} onSuggestionClick={handleSend} onOptionClick={turns.handleOptionClick} onClearConversation={clearConversation} />

      <HomeConversationComposer
        input={input}
        isLoading={isLoading}
        placeholder={t('assistant.conversation.placeholder')}
        sendLabel={t('assistant.conversation.send')}
        activityLabel={activityStatus.label}
        activityTone={activityStatus.tone}
        inputHint={speechNotice || t('assistant.conversation.input_hint')}
        isListening={isListening}
        isSpeechRecordingSupported={speechSupport.recording}
        isSpeechSynthesisSupported={speechSupport.synthesis}
        isSpeechEnabled={speech.isSpeechEnabled}
        audioInputDevices={audioInputOptions}
        selectedAudioInputId={selectedAudioInputId}
        audioInputLabel={t('assistant.conversation.audio_input_label')}
        voiceLabel={t('assistant.conversation.voice_start')}
        listeningLabel={t('assistant.conversation.voice_listening')}
        speechOnLabel={t('assistant.conversation.speech_on')}
        speechOffLabel={t('assistant.conversation.speech_off')}
        cancelLabel={t('assistant.conversation.cancel_request')}
        onInputChange={setInput}
        onAudioInputChange={setSelectedAudioInputId}
        onSend={() => handleSend()}
        onKeyDown={handleKeyDown}
        onToggleListening={() => void toggleRecording()}
        onToggleSpeech={speech.handleToggleSpeech}
        onCancelRequest={turns.handleCancelRequest}
      />
    </section>
  );
};
