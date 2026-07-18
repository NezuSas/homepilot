import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant, synthesizeAssistantSpeech, transcribeAssistantSpeech } from '../lib/assistantApi';
import { blobToBase64, canUseLocalSpeechRecording, createSpeechAudioUrl, getPreferredAudioMimeType } from '../lib/audioRecording';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { AssistantConversationResponse, AssistantConverseRequest, ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationEmptyState } from '../components/HomeConversationEmptyState';
import { HomeConversationHeader } from '../components/HomeConversationHeader';
import { HomeConversationMessageBubble } from '../components/HomeConversationMessageBubble';
import { HomeConversationTypingIndicator } from '../components/HomeConversationTypingIndicator';
import {
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

interface HomeConversationViewProps {
  pendingPrompt?: { id: string; text: string; interactionMode: 'voice' } | null;
  onPendingPromptConsumed?: (id: string) => void;
}

export const HomeConversationView: React.FC<HomeConversationViewProps> = ({ pendingPrompt, onPendingPromptConsumed }) => {
  const { t } = useTranslation();
  const { user } = useSession(noopSessionCleared);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
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
  const speechEnabledRef = useRef(false);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
  const speechRequestIdRef = useRef(0);
  const conversationAbortRef = useRef<AbortController | null>(null);
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

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
    conversationAbortRef.current?.abort();
    conversationAbortRef.current = null;
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

  const stopProfessionalSpeech = () => {
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

  useEffect(() => {
    const handleStopSpeech = () => {
      speechRequestIdRef.current += 1;
      conversationRequestIdRef.current += 1;
      conversationAbortRef.current?.abort();
      conversationAbortRef.current = null;
      setIsLoading(false);
      stopProfessionalSpeech();
    };

    window.addEventListener(HOME_CONVERSATION_STOP_SPEECH_EVENT, handleStopSpeech);
    return () => {
      window.removeEventListener(HOME_CONVERSATION_STOP_SPEECH_EVENT, handleStopSpeech);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- The global stop event binds once for this conversation.

  const speakAssistantResponse = async (text: string) => {
    if (!speechEnabledRef.current || !text.trim()) return;

    speechRequestIdRef.current += 1;
    const requestId = speechRequestIdRef.current;
    stopProfessionalSpeech();

    const professionalSpeech = await synthesizeAssistantSpeech(text);
    if (requestId !== speechRequestIdRef.current || !speechEnabledRef.current) return;

    if (!professionalSpeech) return;

    try {
      const audioUrl = createSpeechAudioUrl(professionalSpeech.audioBase64, professionalSpeech.audioContentType);
      const audio = new Audio(audioUrl);
      speechAudioUrlRef.current = audioUrl;
      speechAudioRef.current = audio;
      audio.onended = stopProfessionalSpeech;
      audio.onerror = stopProfessionalSpeech;
      notifySpeechActivity(true);
      await audio.play();
    } catch {
      stopProfessionalSpeech();
    }
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
    if (response.type === 'execution' && response.execution?.status !== 'failed') {
      void refreshDeviceSnapshot();
    }
    void speakAssistantResponse(response.message);
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

  const handleSend = async (text: string = input, responseTimeoutMs?: number, replaceActive = false, interactionMode: 'chat' | 'voice' = 'chat') => {
    if (!text.trim() || (isLoading && !replaceActive)) return;

    const userText = text.trim();
    if (replaceActive) conversationAbortRef.current?.abort();
    const conversationController = new AbortController();
    conversationAbortRef.current = conversationController;
    conversationRequestIdRef.current += 1;
    const requestId = conversationRequestIdRef.current;
    setSpeechNotice('');
    setInput('');
    addMessage({ role: 'user', content: userText });
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: userText,
        userName: user?.displayName || user?.username,
        interactionMode,
      }, { timeoutMs: responseTimeoutMs, signal: conversationController.signal });
      if (requestId !== conversationRequestIdRef.current) return;
      handleResponse(response);
    } catch (error: unknown) {
      if (requestId !== conversationRequestIdRef.current || conversationController.signal.aborted) return;
      const errorMessage = addErrorMessage(error);
      if (responseTimeoutMs) void speakAssistantResponse(errorMessage);
    } finally {
      if (requestId === conversationRequestIdRef.current) {
        conversationAbortRef.current = null;
        setIsLoading(false);
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

  const stopSilenceDetection = () => {
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

    setSpeechNotice(t('assistant.conversation.voice_transcribing'));

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const transcription = await transcribeAssistantSpeech(audioBase64, audioBlob.type || 'audio/webm');
      const spokenText = normalizeVoiceTranscript(transcription?.transcript ?? '');

      if (!spokenText) {
        setSpeechNotice(t('assistant.conversation.voice_no_speech'));
        return;
      }

      if (!isUsableVoiceTranscript(spokenText)) {
        setSpeechNotice(t('assistant.conversation.voice_not_understood'));
        return;
      }

      setInput(spokenText);
      await handleSend(spokenText, ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, false, 'voice');
    } catch {
      setSpeechNotice(t('assistant.conversation.voice_transcription_error'));
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
    setIsSpeechEnabled(nextSpeechEnabled);
  };

  const handleOptionClick = async (optionId: string, label: string, pendingAction?: AssistantConverseRequest['pendingAction']) => {
    if (isLoading) return;

    addMessage({
      role: 'user',
      content: t('assistant.conversation.selected_option', { label })
    });
    const conversationController = new AbortController();
    conversationAbortRef.current = conversationController;
    conversationRequestIdRef.current += 1;
    const requestId = conversationRequestIdRef.current;
    setIsLoading(true);

    try {
      const response = await converseWithAssistant({
        prompt: `Selected: ${label}`,
        userName: user?.displayName || user?.username,
        selectedOptionId: optionId,
        pendingAction,
        confirmed: optionId === 'confirm'
      }, { signal: conversationController.signal });
      if (requestId !== conversationRequestIdRef.current) return;
      handleResponse(response);
    } catch (error: unknown) {
      if (requestId !== conversationRequestIdRef.current || conversationController.signal.aborted) return;
      addErrorMessage(error);
    } finally {
      if (requestId === conversationRequestIdRef.current) {
        conversationAbortRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const suggestions = useMemo(() => [
    t('assistant.conversation.suggestion_status'),
    t('assistant.conversation.suggestion_1'),
    t('assistant.conversation.suggestion_2'),
    t('assistant.conversation.suggestion_4')
  ], [t]);

  const capabilityLabels = useMemo(() => [
    t('assistant.conversation.capability_status'),
    t('assistant.conversation.capability_actions'),
    t('assistant.conversation.capability_safety')
  ], [t]);

  const audioInputOptions = useMemo(() => audioInputDevices.map((device, index) => ({
    id: device.deviceId,
    label: device.label || t('assistant.conversation.audio_input_fallback', { count: index + 1 })
  })), [audioInputDevices, t]);

  return (
    <section
      className="flex h-full w-full animate-in fade-in duration-500 flex-col overflow-hidden bg-background"
      style={{ height: keyboardInset > 0 ? `calc(100% - ${keyboardInset}px)` : '100%' }}
    >
      <HomeConversationHeader
        title={t('assistant.conversation.header_title')}
        subtitle={t('assistant.conversation.header_subtitle')}
        statusLabel={isLoading ? t('assistant.conversation.sending') : t('assistant.conversation.ready')}
        isLoading={isLoading}
        messageCount={messages.length}
      />

      <div
        ref={scrollRef}
        className="custom-scrollbar flex-1 overflow-y-auto scroll-smooth bg-muted/10 px-3 py-4 sm:px-4 md:px-6 lg:px-8 xl:px-10 xl:py-8"
      >
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5"
        >
          {messages.length === 0 && (
            <HomeConversationEmptyState
              title={t('assistant.conversation.empty_chat_title')}
              description={t('assistant.conversation.empty_chat_description')}
              capabilities={capabilityLabels}
              suggestionLabel={t('assistant.conversation.suggestions_label')}
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
        onInputChange={setInput}
        onAudioInputChange={setSelectedAudioInputId}
        onSend={() => handleSend()}
        onKeyDown={handleKeyDown}
        onToggleListening={() => void handleToggleListening()}
        onToggleSpeech={handleToggleSpeech}
      />
    </section>
  );
};
