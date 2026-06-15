import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { converseWithAssistant, synthesizeAssistantSpeech, transcribeAssistantSpeech } from '../lib/assistantApi';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import type { AssistantConversationResponse, AssistantConverseRequest, ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationEmptyState } from '../components/HomeConversationEmptyState';
import { HomeConversationHeader } from '../components/HomeConversationHeader';
import { HomeConversationMessageBubble } from '../components/HomeConversationMessageBubble';
import { HomeConversationTypingIndicator } from '../components/HomeConversationTypingIndicator';

const noopSessionCleared = () => {};

const MAX_RECORDING_MS = 12000;

function canUseLocalSpeechRecording(): boolean {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

function getPreferredAudioMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) || '';
}

function createSpeechAudioUrl(audioBase64: string, audioContentType: string): string {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: audioContentType }));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('AUDIO_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

export const HomeConversationView: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useSession(noopSessionCleared);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const [speechSupport, setSpeechSupport] = useState({
    recording: false,
    synthesis: false
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const speechEnabledRef = useRef(false);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
  const speechRequestIdRef = useRef(0);

  useEffect(() => {
    setSpeechSupport({
      recording: canUseLocalSpeechRecording(),
      synthesis: 'Audio' in window
    });
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
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    speechRequestIdRef.current += 1;
    stopProfessionalSpeech();
  }, []);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const stopProfessionalSpeech = () => {
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
    void speakAssistantResponse(response.message);
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
    setSpeechNotice('');
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
      const spokenText = transcription?.transcript.trim() ?? '';

      if (!spokenText) {
        setSpeechNotice(t('assistant.conversation.voice_no_speech'));
        return;
      }

      setInput(spokenText);
      await handleSend(spokenText);
    } catch {
      setSpeechNotice(t('assistant.conversation.voice_transcription_error'));
    }
  };

  const handleToggleListening = async () => {
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
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
      if (speechSupport.synthesis) {
        speechEnabledRef.current = true;
        setIsSpeechEnabled(true);
      }
      recorder.start();
      recordingTimeoutRef.current = window.setTimeout(() => stopLocalRecording(), MAX_RECORDING_MS);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : undefined;
      setSpeechNotice(resolveRecordingError(errorName));
      stopMediaStream();
      setIsListening(false);
    }
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

  return (
    <section className="flex h-full w-full animate-in fade-in duration-500 flex-col overflow-hidden bg-background">
      <HomeConversationHeader
        title={t('assistant.conversation.header_title')}
        subtitle={t('assistant.conversation.header_subtitle')}
        statusLabel={isLoading ? t('assistant.conversation.sending') : t('assistant.conversation.ready')}
        isLoading={isLoading}
        messageCount={messages.length}
      />

      <div
        ref={scrollRef}
        className="custom-scrollbar flex-1 overflow-y-auto scroll-smooth bg-muted/10 px-4 py-5 md:px-6 lg:px-10 lg:py-8"
      >
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="mx-auto flex w-full max-w-5xl flex-col gap-5"
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
        voiceLabel={t('assistant.conversation.voice_start')}
        listeningLabel={t('assistant.conversation.voice_listening')}
        speechOnLabel={t('assistant.conversation.speech_on')}
        speechOffLabel={t('assistant.conversation.speech_off')}
        onInputChange={setInput}
        onSend={() => handleSend()}
        onKeyDown={handleKeyDown}
        onToggleListening={() => void handleToggleListening()}
        onToggleSpeech={handleToggleSpeech}
      />
    </section>
  );
};
