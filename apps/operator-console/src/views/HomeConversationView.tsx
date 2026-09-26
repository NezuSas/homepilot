import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant, synthesizeAssistantSpeech, transcribeAssistantSpeech } from '../lib/assistantApi';
import { blobToBase64, createSpeechAudioUrl } from '../lib/audioRecording';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import { AssistantTurnCoordinator, type AssistantTurn } from '../lib/assistantTurnCoordinator';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { AssistantConversationResponse, ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationThread } from '../components/HomeConversationThread';
import {
  HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT,
  HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT,
  HOME_CONVERSATION_STOP_SPEECH_EVENT,
  isUsableVoiceTranscript,
  normalizeVoiceTranscript
} from '../lib/homeConversationVoice';
import { getConversationStorageKey, readSpeechEnabledPreference, readStoredConversationMessages, storeConversationMessages, storeSpeechEnabledPreference } from './homeConversationPersistence';
import { requiresVoiceConfirmation, type ConversationActivity } from './homeConversationPresentation';
import { useHomeConversationVoiceCapture } from './useHomeConversationVoiceCapture';

const noopSessionCleared = () => {};

interface HomeConversationViewProps {
  pendingPrompt?: { id: string; text: string; interactionMode: 'voice' } | null;
  onPendingPromptConsumed?: (id: string) => void;
  assistantTurnCoordinator: AssistantTurnCoordinator;
}

export const HomeConversationView: React.FC<HomeConversationViewProps> = ({ pendingPrompt, onPendingPromptConsumed, assistantTurnCoordinator }) => {
  const { t } = useTranslation();
  const { user } = useSession(noopSessionCleared);
  const conversationStorageKey = getConversationStorageKey(user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredConversationMessages(conversationStorageKey));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationActivity, setConversationActivity] = useState<ConversationActivity>('ready');
  const initialSpeechEnabledRef = useRef(readSpeechEnabledPreference());
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(initialSpeechEnabledRef.current);
  const [speechNotice, setSpeechNotice] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleScrollContainerReady = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element;
  }, []);
  const speechEnabledRef = useRef(initialSpeechEnabledRef.current);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
  const speechRequestIdRef = useRef(0);
  const activeConversationTurnRef = useRef<AssistantTurn | null>(null);
  const conversationRequestIdRef = useRef(0);
  const consumedPendingPromptIdRef = useRef<string | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardInset = () => {
      const nextInset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      setKeyboardInset(nextInset);
      if (nextInset > 0 && document.activeElement instanceof HTMLTextAreaElement) {
        window.requestAnimationFrame(() => document.activeElement?.scrollIntoView({ block: 'nearest' }));
      }
    };

    updateKeyboardInset();
    viewport.addEventListener('resize', updateKeyboardInset);
    viewport.addEventListener('scroll', updateKeyboardInset);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset);
      viewport.removeEventListener('scroll', updateKeyboardInset);
    };
  }, []);
  const refreshDeviceSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

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

  useEffect(() => () => {
    speechRequestIdRef.current += 1;
    conversationRequestIdRef.current += 1;
    assistantTurnCoordinator.cancel(activeConversationTurnRef.current ?? undefined);
    activeConversationTurnRef.current = null;
    stopProfessionalSpeech();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Cleanup uses the current audio refs on unmount.

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const notifySpeechActivity = (speaking: boolean) => {
    window.dispatchEvent(new CustomEvent(HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, {
      detail: { speaking }
    }));
  };

  function stopProfessionalSpeech() {
    notifySpeechActivity(false);

    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.src = '';
      speechAudioRef.current = null;
    }

    if (speechAudioUrlRef.current) {
      URL.revokeObjectURL(speechAudioUrlRef.current);
      speechAudioUrlRef.current = null;
    }
  };

  useEffect(() => assistantTurnCoordinator.onInvalidated(turn => {
    if (turn.origin === 'wake_word') return;

    speechRequestIdRef.current += 1;
    conversationRequestIdRef.current += 1;
    activeConversationTurnRef.current = null;
    setIsLoading(false);
    stopProfessionalSpeech();
  }), [assistantTurnCoordinator]); // eslint-disable-line react-hooks/exhaustive-deps -- Speech cleanup intentionally uses current audio refs.
  useEffect(() => {
    const handleStopSpeech = () => {
      speechRequestIdRef.current += 1;
      conversationRequestIdRef.current += 1;
      assistantTurnCoordinator.cancel(activeConversationTurnRef.current ?? undefined);
      activeConversationTurnRef.current = null;
      setIsLoading(false);
      stopProfessionalSpeech();
    };

    window.addEventListener(HOME_CONVERSATION_STOP_SPEECH_EVENT, handleStopSpeech);
    return () => {
      window.removeEventListener(HOME_CONVERSATION_STOP_SPEECH_EVENT, handleStopSpeech);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- The global stop event binds once for this conversation.

  const speakAssistantResponse = async (text: string, turn?: AssistantTurn) => {
    if (!speechEnabledRef.current || !text.trim() || (turn && !assistantTurnCoordinator.isCurrent(turn))) return;

    speechRequestIdRef.current += 1;
    const requestId = speechRequestIdRef.current;
    stopProfessionalSpeech();

    const professionalSpeech = await synthesizeAssistantSpeech(text, turn ? { signal: turn.signal } : undefined);
    if (requestId !== speechRequestIdRef.current || !speechEnabledRef.current || (turn && !assistantTurnCoordinator.isCurrent(turn))) return;

    if (!professionalSpeech) return;

    try {
      const audioUrl = createSpeechAudioUrl(professionalSpeech.audioBase64, professionalSpeech.audioContentType);
      const audio = new Audio(audioUrl);
      speechAudioUrlRef.current = audioUrl;
      speechAudioRef.current = audio;
      const playbackFinished = new Promise<void>(resolve => {
        const finishPlayback = () => {
          stopProfessionalSpeech();
          resolve();
        };
        audio.onended = finishPlayback;
        audio.onerror = finishPlayback;
      });
      notifySpeechActivity(true);
      await audio.play();
      await playbackFinished;
    } catch {
      stopProfessionalSpeech();
    }
  };

  const handleResponse = (response: AssistantConversationResponse, turn: AssistantTurn) => {
    addMessage({
      role: 'assistant',
      content: response.message,
      responseType: response.type,
      options: response.clarification?.options,
      execution: response.execution
    });
    if (response.type === 'execution' && response.execution?.status !== 'failed') {
      void refreshDeviceSnapshot({ force: true });
    }
    void speakAssistantResponse(response.message, turn).finally(() => {
      if (turn.origin === 'manual_voice' && requiresVoiceConfirmation(response)) {
        window.dispatchEvent(new Event(HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT));
      }
    });
  };

  const addErrorMessage = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const resolvedMessage = errorMessage || t('assistant.conversation.unknown_error');
    addMessage({
      role: 'assistant',
      content: resolvedMessage,
      responseType: 'error'
    });
    return resolvedMessage;
  };

  const handleCancelRequest = () => {
    const activeTurn = activeConversationTurnRef.current;
    if (!activeTurn) return;

    conversationRequestIdRef.current += 1;
    assistantTurnCoordinator.cancel(activeTurn);
    activeConversationTurnRef.current = null;
    setIsLoading(false);
    setConversationActivity('notice');
    addMessage({
      role: 'assistant',
      content: t('assistant.conversation.request_cancelled'),
      responseType: 'answer'
    });
  };

  const handleSend = async (text: string = input, responseTimeoutMs?: number, replaceActive = false, interactionMode: 'chat' | 'voice' = 'chat', existingTurn?: AssistantTurn) => {
    if (!text.trim() || (isLoading && !replaceActive)) return;

    const userText = text.trim();
    const turn = existingTurn && assistantTurnCoordinator.isCurrent(existingTurn)
      ? existingTurn
      : assistantTurnCoordinator.begin(interactionMode === 'voice' ? 'manual_voice' : 'chat');
    activeConversationTurnRef.current = turn;
    conversationRequestIdRef.current += 1;
    const requestId = conversationRequestIdRef.current;
    setSpeechNotice('');
    setInput('');
    addMessage({ role: 'user', content: userText });
    setConversationActivity('consulting');
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: userText,
        interactionMode,
      }, { timeoutMs: responseTimeoutMs, signal: turn.signal });
      if (requestId !== conversationRequestIdRef.current || !assistantTurnCoordinator.isCurrent(turn)) return;
      handleResponse(response, turn);
    } catch (error: unknown) {
      if (requestId !== conversationRequestIdRef.current || turn.signal.aborted || !assistantTurnCoordinator.isCurrent(turn)) return;
      const errorMessage = addErrorMessage(error);
      if (responseTimeoutMs) void speakAssistantResponse(errorMessage, turn);
    } finally {
      if (requestId === conversationRequestIdRef.current) {
        if (activeConversationTurnRef.current?.id === turn.id) {
          activeConversationTurnRef.current = null;
        }
        setIsLoading(false);
        setConversationActivity('ready');
      }
    }
  };

  useEffect(() => {
    if (!pendingPrompt || consumedPendingPromptIdRef.current === pendingPrompt.id) return;

    consumedPendingPromptIdRef.current = pendingPrompt.id;
    if (typeof Audio !== 'undefined') {
      speechEnabledRef.current = true;
      setIsSpeechEnabled(true);
    }
    setInput(pendingPrompt.text);
    void handleSend(pendingPrompt.text, ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, true, pendingPrompt.interactionMode).then(() => {
      onPendingPromptConsumed?.(pendingPrompt.id);
    });
  }, [pendingPrompt, onPendingPromptConsumed]); // eslint-disable-line react-hooks/exhaustive-deps -- Consume each routed prompt exactly once.

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) {
      setSpeechNotice(t('assistant.conversation.voice_no_speech'));
      return;
    }

    const turn = assistantTurnCoordinator.begin('manual_voice');
    activeConversationTurnRef.current = turn;
    setSpeechNotice(t('assistant.conversation.voice_transcribing'));
    setConversationActivity('transcribing');

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const transcription = await transcribeAssistantSpeech(audioBase64, audioBlob.type || 'audio/webm', {
        signal: turn.signal
      });
      if (!assistantTurnCoordinator.isCurrent(turn)) return;

      const spokenText = normalizeVoiceTranscript(transcription?.transcript ?? '');
      if (!spokenText) {
        setSpeechNotice(t('assistant.conversation.voice_no_speech'));
        setConversationActivity('notice');
        return;
      }

      if (!isUsableVoiceTranscript(spokenText)) {
        setSpeechNotice(t('assistant.conversation.voice_not_understood'));
        setConversationActivity('notice');
        return;
      }

      setInput(spokenText);
      await handleSend(spokenText, ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, false, 'voice', turn);
    } catch {
      if (assistantTurnCoordinator.isCurrent(turn)) {
        setSpeechNotice(t('assistant.conversation.voice_transcription_error'));
        setConversationActivity('notice');
      }
    }
  };

  const {
    isListening,
    speechSupport,
    audioInputDevices,
    selectedAudioInputId,
    setSelectedAudioInputId,
    toggleRecording
  } = useHomeConversationVoiceCapture({
    disabled: isLoading,
    onRecordingComplete: audioBlob => { void handleRecordingComplete(audioBlob); },
    onActivityChange: setConversationActivity,
    onNotice: setSpeechNotice,
    onRecordingStarted: synthesisSupported => {
      if (!synthesisSupported) return;
      speechEnabledRef.current = true;
      setIsSpeechEnabled(true);
    },
    getErrorMessage: kind => {
      if (kind === 'permission') return t('assistant.conversation.voice_permission_error');
      if (kind === 'capture') return t('assistant.conversation.voice_capture_error');
      return t('assistant.conversation.voice_start_error');
    },
    getUnavailableMessage: () => t('assistant.conversation.voice_unavailable_error')
  });

  const handleToggleSpeech = () => {
    const nextSpeechEnabled = !speechEnabledRef.current;
    if (!nextSpeechEnabled) {
      speechRequestIdRef.current += 1;
      stopProfessionalSpeech();
    }
    speechEnabledRef.current = nextSpeechEnabled;
    storeSpeechEnabledPreference(nextSpeechEnabled);
    setIsSpeechEnabled(nextSpeechEnabled);
  };

  const handleOptionClick = async (optionId: string, label: string) => {
    if (isLoading) return;

    addMessage({
      role: 'user',
      content: t('assistant.conversation.selected_option', { label })
    });
    const turn = assistantTurnCoordinator.begin('chat');
    activeConversationTurnRef.current = turn;
    conversationRequestIdRef.current += 1;
    const requestId = conversationRequestIdRef.current;
    setConversationActivity('consulting');
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: `Selected: ${label}`,
        selectedOptionId: optionId
      }, { signal: turn.signal });
      if (requestId !== conversationRequestIdRef.current || !assistantTurnCoordinator.isCurrent(turn)) return;
      handleResponse(response, turn);
    } catch (error: unknown) {
      if (requestId !== conversationRequestIdRef.current || turn.signal.aborted || !assistantTurnCoordinator.isCurrent(turn)) return;
      addErrorMessage(error);
    } finally {
      if (requestId === conversationRequestIdRef.current) {
        if (activeConversationTurnRef.current?.id === turn.id) {
          activeConversationTurnRef.current = null;
        }
        setIsLoading(false);
        setConversationActivity('ready');
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    if (conversationStorageKey) sessionStorage.removeItem(conversationStorageKey);
    setMessages([]);
    setSpeechNotice('');
    setConversationActivity('ready');
  };

  const suggestions = useMemo(() => [
    { id: 'lights-on', label: t('assistant.conversation.suggestion_status') },
    { id: 'home-status', label: t('assistant.conversation.suggestion_home_status') },
    { id: 'all-off', label: t('assistant.conversation.suggestion_1'), requiresConfirmation: true }
  ], [t]);

  const activityStatus = useMemo(() => {
    if (conversationActivity === 'listening') return { label: t('assistant.conversation.voice_listening_status'), tone: 'danger' as const };
    if (conversationActivity === 'transcribing') return { label: t('assistant.conversation.voice_transcribing_status'), tone: 'warning' as const };
    if (conversationActivity === 'consulting') return { label: t('assistant.conversation.consulting'), tone: 'primary' as const };
    if (conversationActivity === 'notice' && speechNotice) return { label: speechNotice, tone: 'warning' as const };
    return { label: t('assistant.conversation.ready'), tone: 'success' as const };
  }, [conversationActivity, speechNotice, t]);


  const audioInputOptions = useMemo(() => audioInputDevices.map((device, index) => ({
    id: device.deviceId,
    label: device.label || t('assistant.conversation.audio_input_fallback', { count: index + 1 })
  })), [audioInputDevices, t]);

  return (
    <section
      className="home-conversation-shell flex h-full w-full animate-in fade-in duration-500 flex-col overflow-hidden"
      style={{ height: keyboardInset > 0 ? `calc(100% - ${keyboardInset}px)` : '100%' }}
    >

      <HomeConversationThread onScrollContainerReady={handleScrollContainerReady} messages={messages} isLoading={isLoading} user={user} conversationActiveLabel={t('assistant.conversation.conversation_active')} emptyTitle={t('assistant.conversation.empty_title')} emptyDescription={t('assistant.conversation.empty_description')} suggestionsLabel={t('assistant.conversation.suggestions_label')} confirmationRequiredLabel={t('assistant.conversation.confirmation_required')} suggestions={suggestions} newConversationLabel={t('assistant.conversation.new_conversation')} onSuggestionClick={handleSend} onOptionClick={handleOptionClick} onClearConversation={clearConversation} />

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
        isSpeechEnabled={isSpeechEnabled}
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
        onToggleSpeech={handleToggleSpeech}
        onCancelRequest={handleCancelRequest}
      />
    </section>
  );
};
