import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant } from '../lib/assistantApi';
import type { AssistantTurn, AssistantTurnCoordinator } from '../lib/assistantTurnCoordinator';
import {
  HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT,
  HOME_CONVERSATION_STOP_SPEECH_EVENT
} from '../lib/homeConversationVoice';
import type { PendingHomeConversationPrompt } from '../lib/useGlobalWake';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { AssistantConversationResponse, ChatMessage } from '../types/assistantConversation';
import { requiresVoiceConfirmation, type ConversationActivity } from './homeConversationPresentation';
import type { useHomeConversationSpeech } from './useHomeConversationSpeech';

export type NewChatMessage = Omit<ChatMessage, 'id' | 'timestamp'>;

interface UseHomeConversationTurnsOptions {
  assistantTurnCoordinator: AssistantTurnCoordinator;
  speech: ReturnType<typeof useHomeConversationSpeech>;
  addMessage: (message: NewChatMessage) => void;
  pendingPrompt?: PendingHomeConversationPrompt | null;
  onPendingPromptConsumed?: (id: string) => void;
}

/** Owns assistant request turns: sending, cancelling, option picks and routed prompts. */
export function useHomeConversationTurns({
  assistantTurnCoordinator,
  speech,
  addMessage,
  pendingPrompt,
  onPendingPromptConsumed
}: UseHomeConversationTurnsOptions) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationActivity, setConversationActivity] = useState<ConversationActivity>('ready');
  const [speechNotice, setSpeechNotice] = useState('');
  const activeConversationTurnRef = useRef<AssistantTurn | null>(null);
  const conversationRequestIdRef = useRef(0);
  const consumedPendingPromptIdRef = useRef<string | null>(null);
  const { stopProfessionalSpeech, speakAssistantResponse, invalidateSpeechRequests, enableSpeech } = speech;
  const refreshDeviceSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

  useEffect(() => () => {
    invalidateSpeechRequests();
    conversationRequestIdRef.current += 1;
    assistantTurnCoordinator.cancel(activeConversationTurnRef.current ?? undefined);
    activeConversationTurnRef.current = null;
    stopProfessionalSpeech();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Cleanup uses the current audio refs on unmount.

  useEffect(() => assistantTurnCoordinator.onInvalidated(turn => {
    if (turn.origin === 'wake_word') return;

    invalidateSpeechRequests();
    conversationRequestIdRef.current += 1;
    activeConversationTurnRef.current = null;
    setIsLoading(false);
    stopProfessionalSpeech();
  }), [assistantTurnCoordinator]); // eslint-disable-line react-hooks/exhaustive-deps -- Speech cleanup intentionally uses current audio refs.

  useEffect(() => {
    const handleStopSpeech = () => {
      invalidateSpeechRequests();
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
    if (typeof Audio !== 'undefined') enableSpeech();
    setInput(pendingPrompt.text);
    void handleSend(pendingPrompt.text, ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, true, pendingPrompt.interactionMode).then(() => {
      onPendingPromptConsumed?.(pendingPrompt.id);
    });
  }, [pendingPrompt, onPendingPromptConsumed]); // eslint-disable-line react-hooks/exhaustive-deps -- Consume each routed prompt exactly once.

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

  return {
    input,
    setInput,
    isLoading,
    conversationActivity,
    setConversationActivity,
    speechNotice,
    setSpeechNotice,
    activeConversationTurnRef,
    handleSend,
    handleCancelRequest,
    handleOptionClick
  };
}
