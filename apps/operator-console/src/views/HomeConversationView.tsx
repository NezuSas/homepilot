import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant, synthesizeAssistantSpeech, transcribeAssistantSpeech } from '../lib/assistantApi';
import { blobToBase64, canUseLocalSpeechRecording, createSpeechAudioUrl, getPreferredAudioMimeType } from '../lib/audioRecording';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import { AssistantTurnCoordinator, type AssistantTurn } from '../lib/assistantTurnCoordinator';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { AssistantConversationResponse, ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationMessageBubble } from '../components/HomeConversationMessageBubble';
import { HomeConversationTypingIndicator } from '../components/HomeConversationTypingIndicator';
import { HomeConversationEmptyState } from '../components/HomeConversationEmptyState';
import { Button } from '../components/ui/Button';
import { MessageSquarePlus } from 'lucide-react';
import {
  HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT,
  HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT,
  HOME_CONVERSATION_STOP_SPEECH_EVENT,
  isUsableVoiceTranscript,
  normalizeVoiceTranscript
} from '../lib/homeConversationVoice';

const noopSessionCleared = () => {};

const MAX_RECORDING_MS = 8000;
const MIN_RECORDING_MS = 700;
const STOP_AFTER_SILENCE_MS = 900;
const SPEECH_LEVEL_THRESHOLD = 0.018;
const HOME_CONVERSATION_STORAGE_PREFIX = 'hp_home_conversation_v1';
const HOME_CONVERSATION_SPEECH_ENABLED_STORAGE_KEY = 'hp_home_conversation_speech_enabled';
const MAX_PERSISTED_MESSAGES = 80;

type ConversationActivity = 'ready' | 'listening' | 'transcribing' | 'consulting' | 'notice';

function requiresVoiceConfirmation(response: AssistantConversationResponse): boolean {
  if (response.type !== 'clarification') return false;

  const optionIds = new Set(response.clarification?.options.map(option => option.id));
  return optionIds.has('confirm') && optionIds.has('cancel');
}

function readStoredMessages(storageKey: string | null): ChatMessage[] {
  if (!storageKey) return [];
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is ChatMessage => typeof value === 'object' && value !== null
        && typeof value.id === 'string'
        && (value.role === 'user' || value.role === 'assistant')
        && typeof value.content === 'string'
        && typeof value.timestamp === 'string')
      .map(({ options: _options, ...message }) => message)
      .slice(-MAX_PERSISTED_MESSAGES);
  } catch {
    return [];
  }
}

function readSpeechEnabledPreference(): boolean {
  try {
    return localStorage.getItem(HOME_CONVERSATION_SPEECH_ENABLED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function storeSpeechEnabledPreference(enabled: boolean): void {
  try {
    localStorage.setItem(HOME_CONVERSATION_SPEECH_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // The conversation remains usable when browser storage is unavailable.
  }
}

interface HomeConversationViewProps {
  pendingPrompt?: { id: string; text: string; interactionMode: 'voice' } | null;
  onPendingPromptConsumed?: (id: string) => void;
  assistantTurnCoordinator: AssistantTurnCoordinator;
}

export const HomeConversationView: React.FC<HomeConversationViewProps> = ({ pendingPrompt, onPendingPromptConsumed, assistantTurnCoordinator }) => {
  const { t } = useTranslation();
  const { user } = useSession(noopSessionCleared);
  const conversationStorageKey = user ? HOME_CONVERSATION_STORAGE_PREFIX + ':' + user.id : null;
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredMessages(conversationStorageKey));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationActivity, setConversationActivity] = useState<ConversationActivity>('ready');
  const [isListening, setIsListening] = useState(false);
  const initialSpeechEnabledRef = useRef(readSpeechEnabledPreference());
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(initialSpeechEnabledRef.current);
  const [speechNotice, setSpeechNotice] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [speechSupport, setSpeechSupport] = useState({
    recording: false,
    synthesis: false
  });
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const silenceAnimationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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

  useEffect(() => {
    setSpeechSupport({
      recording: canUseLocalSpeechRecording(),
      synthesis: 'Audio' in window
    });
  }, []);

  useEffect(() => {
    if (!canUseLocalSpeechRecording()) return;

    let isMounted = true;
    const loadAudioInputs = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!isMounted) return;
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputDevices(audioInputs);
      setSelectedAudioInputId(current => audioInputs.some(device => device.deviceId === current) ? current : audioInputs[0]?.deviceId || '');
    };

    void loadAudioInputs();
    navigator.mediaDevices.addEventListener?.('devicechange', loadAudioInputs);

    return () => {
      isMounted = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', loadAudioInputs);
    };
  }, []);

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
    const safeMessages = messages.slice(-MAX_PERSISTED_MESSAGES).map(({ options: _options, ...message }) => message);
    sessionStorage.setItem(conversationStorageKey, JSON.stringify(safeMessages));
  }, [conversationStorageKey, messages]);

  useEffect(() => () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    stopSilenceDetection();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
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

  function stopSilenceDetection() {
    if (silenceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceAnimationFrameRef.current);
      silenceAnimationFrameRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    silenceStartedAtRef.current = null;
    speechDetectedRef.current = false;
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const stopLocalRecording = () => {
    clearRecordingTimeout();
    stopSilenceDetection();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    stopMediaStream();
    setIsListening(false);
  };

  const resolveRecordingError = (error?: string): string => {
    if (error === 'NotAllowedError' || error === 'SecurityError') {
      return t('assistant.conversation.voice_permission_error');
    }

    if (error === 'NotFoundError' || error === 'NotReadableError') {
      return t('assistant.conversation.voice_capture_error');
    }

    return t('assistant.conversation.voice_start_error');
  };

  const startSilenceDetection = (stream: MediaStream) => {
    stopSilenceDetection();

    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const samples = new Uint8Array(analyser.fftSize);
    const detectSilence = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const value = (sample - 128) / 128;
        sum += value * value;
      }

      const volume = Math.sqrt(sum / samples.length);
      const now = Date.now();
      const elapsed = now - recordingStartedAtRef.current;

      if (volume >= SPEECH_LEVEL_THRESHOLD) {
        speechDetectedRef.current = true;
        silenceStartedAtRef.current = null;
      } else if (speechDetectedRef.current && elapsed >= MIN_RECORDING_MS) {
        silenceStartedAtRef.current ??= now;
        if (now - silenceStartedAtRef.current >= STOP_AFTER_SILENCE_MS) {
          stopLocalRecording();
          return;
        }
      }

      silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
    };

    silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    stopMediaStream();
    setIsListening(false);

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

  const startLocalRecording = async () => {
    if (isLoading) return;

    if (!speechSupport.recording) {
      setSpeechNotice(t('assistant.conversation.voice_unavailable_error'));
      return;
    }

    if (isListening) {
      stopLocalRecording();
      return;
    }

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
      if (selectedAudioInputId) {
        audioConstraints.deviceId = { exact: selectedAudioInputId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputDevices(audioInputs);
      setSelectedAudioInputId(current => audioInputs.some(device => device.deviceId === current) ? current : audioInputs[0]?.deviceId || '');
      const mimeType = getPreferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setSpeechNotice(t('assistant.conversation.voice_start_error'));
        stopLocalRecording();
      };
      recorder.onstop = () => {
        clearRecordingTimeout();
        const audioBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        mediaChunksRef.current = [];
        void handleRecordingComplete(audioBlob);
      };

      setSpeechNotice('');
      setConversationActivity('listening');
      setIsListening(true);
      recordingStartedAtRef.current = Date.now();
      silenceStartedAtRef.current = null;
      speechDetectedRef.current = false;
      if (speechSupport.synthesis) {
        speechEnabledRef.current = true;
        setIsSpeechEnabled(true);
      }
      recorder.start();
      startSilenceDetection(stream);
      recordingTimeoutRef.current = window.setTimeout(() => stopLocalRecording(), MAX_RECORDING_MS);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : undefined;
      setSpeechNotice(resolveRecordingError(errorName));
      setConversationActivity('notice');
      stopMediaStream();
      setIsListening(false);
    }
  };

  const handleToggleListening = async () => {
    await startLocalRecording();
  };

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

      <div
        ref={scrollRef}
        className="home-conversation-feed custom-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-4 md:px-6 lg:px-8 xl:px-10 xl:py-8"
      >
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="home-conversation-thread mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-5"
        >

          {messages.length === 0 && !isLoading && (
            <HomeConversationEmptyState
              title={t('assistant.conversation.empty_title')}
              description={t('assistant.conversation.empty_description')}
              suggestionsLabel={t('assistant.conversation.suggestions_label')}
              suggestions={suggestions}
              confirmationRequiredLabel={t('assistant.conversation.confirmation_required')}
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

          {messages.length > 0 && !isLoading && (
            <div className="home-conversation-thread-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearConversation}
                className="home-conversation-new-thread"
              >
                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                <span>{t('assistant.conversation.new_conversation')}</span>
              </Button>
            </div>
          )}

          {isLoading && <HomeConversationTypingIndicator />}
        </div>
      </div>

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
        onToggleListening={() => void handleToggleListening()}
        onToggleSpeech={handleToggleSpeech}
        onCancelRequest={handleCancelRequest}
      />
    </section>
  );
};
