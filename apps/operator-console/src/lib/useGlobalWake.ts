import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GlobalWakeNoticeModel, GlobalWakeStatus } from '../components/GlobalWakeNotice';
import type { View } from '../types';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant, synthesizeAssistantSpeech } from './assistantApi';
import { AssistantTurnCoordinator, type AssistantTurn } from './assistantTurnCoordinator';
import { createSpeechAudioUrl } from './audioRecording';
import {
  HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT,
  HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT,
  HOME_CONVERSATION_STOP_SPEECH_EVENT,
  isSilenceVoiceCommand,
} from './homeConversationVoice';
import { recordHomeConversationTelemetry } from './homeConversationTelemetry';
import { requiresVoiceConfirmation } from './assistantVoiceConfirmation';

export const GLOBAL_WAKE_NOTICE_MS = 8000;

export interface PendingHomeConversationPrompt {
  id: string;
  text: string;
  interactionMode: 'voice';
}


const newPromptId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface Options {
  currentView: View;
  onExecutionSucceeded: () => void;
}

/**
 * Global wake-word flow: runs a spoken command outside the conversation view,
 * speaks the answer, and hands the prompt to the conversation view when open.
 */
export function useGlobalWake({ currentView, onExecutionSucceeded }: Options) {
  const { t } = useTranslation();
  const [coordinator] = useState(() => new AssistantTurnCoordinator());
  const [notice, setNotice] = useState<GlobalWakeNoticeModel | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<PendingHomeConversationPrompt | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const startedAtRef = useRef(0);

  const stopSpeech = useCallback(() => {
    setIsSpeaking(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string, turn?: AssistantTurn) => {
    if (!text.trim() || typeof Audio === 'undefined' || (turn && !coordinator.isCurrent(turn))) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    stopSpeech();

    const speech = await synthesizeAssistantSpeech(text, turn ? { signal: turn.signal } : undefined);
    if (!speech || requestId !== requestIdRef.current || (turn && !coordinator.isCurrent(turn))) return;

    try {
      const audioUrl = createSpeechAudioUrl(speech.audioBase64, speech.audioContentType);
      const audio = new Audio(audioUrl);
      audioUrlRef.current = audioUrl;
      audioRef.current = audio;
      const playbackFinished = new Promise<void>(resolve => {
        const finishPlayback = () => {
          stopSpeech();
          resolve();
        };
        audio.onended = finishPlayback;
        audio.onerror = finishPlayback;
      });
      setIsSpeaking(true);
      await audio.play();
      recordHomeConversationTelemetry('global_wake_spoken', {
        elapsedMs: Date.now() - startedAtRef.current,
        textLength: text.length,
      });
      await playbackFinished;
    } catch {
      stopSpeech();
    }
  }, [coordinator, stopSpeech]);

  useEffect(() => () => {
    coordinator.cancel();
    requestIdRef.current += 1;
    stopSpeech();
  }, [coordinator, stopSpeech]);

  useEffect(() => coordinator.onInvalidated(turn => {
    if (turn.origin !== 'wake_word') return;

    requestIdRef.current += 1;
    setIsProcessing(false);
    stopSpeech();
  }), [coordinator, stopSpeech]);

  useEffect(() => {
    const handleSpeechActivity = (event: Event) => {
      const detail = (event as CustomEvent<{ speaking?: boolean }>).detail;
      setIsSpeaking(Boolean(detail?.speaking));
    };

    window.addEventListener(HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, handleSpeechActivity);
    return () => {
      window.removeEventListener(HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, handleSpeechActivity);
    };
  }, []);

  useEffect(() => {
    if (!notice || isProcessing) return;

    const timeoutId = window.setTimeout(() => {
      setNotice(current => current?.id === notice.id ? null : current);
    }, GLOBAL_WAKE_NOTICE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [notice, isProcessing]);

  const onStatusChange = useCallback((wakeStatus: GlobalWakeStatus) => {
    if (wakeStatus !== 'unavailable') return;

    setNotice({
      id: `wake-${wakeStatus}`,
      message: t('assistant.conversation.voice_unavailable_error'),
      tone: 'warning',
      status: wakeStatus,
    });
  }, [t]);

  const onInterrupt = useCallback(() => {
    coordinator.cancel();
    requestIdRef.current += 1;
    setNotice(null);
    setIsProcessing(false);
    stopSpeech();
    window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
  }, [coordinator, stopSpeech]);

  const onCommand = (command: string) => {
    const text = command.trim();
    if (!text) return;

    if (isSilenceVoiceCommand(text)) {
      recordHomeConversationTelemetry('global_wake_processed', {
        sourceView: currentView,
        responseType: 'silence',
        elapsedMs: 0,
      });
      setNotice(null);
      setIsProcessing(false);
      stopSpeech();
      window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
      void speak(t('assistant.conversation.voice_silence_acknowledgement'));
      return;
    }

    if (currentView !== 'home-conversation') {
      const id = newPromptId();
      window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
      const turn = coordinator.begin('wake_word');
      startedAtRef.current = Date.now();
      recordHomeConversationTelemetry('global_wake_detected', {
        sourceView: currentView,
        promptLength: text.length,
      });
      setIsProcessing(true);
      setNotice(null);

      void converseWithAssistant({
        prompt: text,
        interactionMode: 'voice',
      }, {
        timeoutMs: ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS,
        signal: turn.signal,
      }).then(response => {
        if (!coordinator.isCurrent(turn)) return;
        recordHomeConversationTelemetry('global_wake_processed', {
          sourceView: currentView,
          responseType: response.type,
          elapsedMs: Date.now() - startedAtRef.current,
        });
        if (response.type === 'error') {
          setNotice({ id, message: t('assistant.conversation.voice_request_error'), tone: 'error', status: 'idle' });
        }
        if (response.type === 'execution' && response.execution?.status !== 'failed') {
          onExecutionSucceeded();
        }
        void speak(response.message, turn).finally(() => {
          if (requiresVoiceConfirmation(response)) {
            window.dispatchEvent(new Event(HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT));
          }
        });
      }).catch(() => {
        if (!coordinator.isCurrent(turn) || turn.signal.aborted) return;
        const message = t('assistant.conversation.voice_processing_error');
        recordHomeConversationTelemetry('global_wake_failed', {
          sourceView: currentView,
          elapsedMs: Date.now() - startedAtRef.current,
        });
        setNotice({ id, message, tone: 'error', status: 'idle' });
        void speak(message, turn);
      }).finally(() => {
        if (coordinator.isCurrent(turn)) setIsProcessing(false);
      });
      return;
    }

    window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
    coordinator.cancel();
    setPendingPrompt({ id: newPromptId(), text, interactionMode: 'voice' });
  };

  const consumePrompt = useCallback((id: string) => {
    setPendingPrompt(current => current?.id === id ? null : current);
  }, []);

  return {
    coordinator,
    notice,
    isProcessing,
    isSpeaking,
    pendingPrompt,
    consumePrompt,
    onCommand,
    onInterrupt,
    onStatusChange,
  };
}
