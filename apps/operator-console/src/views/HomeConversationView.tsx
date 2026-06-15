import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { converseWithAssistant, synthesizeAssistantSpeech } from '../lib/assistantApi';
import { useSession } from '../lib/useSession';
import { generateId } from '../utils/generateId';
import type { AssistantConversationResponse, AssistantConverseRequest, ChatMessage } from '../types/assistantConversation';
import { HomeConversationComposer } from '../components/HomeConversationComposer';
import { HomeConversationEmptyState } from '../components/HomeConversationEmptyState';
import { HomeConversationHeader } from '../components/HomeConversationHeader';
import { HomeConversationMessageBubble } from '../components/HomeConversationMessageBubble';
import { HomeConversationTypingIndicator } from '../components/HomeConversationTypingIndicator';

const noopSessionCleared = () => {};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function scoreSpeechVoice(voice: SpeechSynthesisVoice, language: string): number {
  const normalizedName = voice.name.toLowerCase();
  const normalizedLang = voice.lang.toLowerCase();
  const targetLanguage = language.startsWith('en') ? 'en' : 'es';
  let score = 0;

  if (normalizedLang.startsWith(targetLanguage)) score += 100;
  if (targetLanguage === 'es' && normalizedLang.includes('419')) score += 16;
  if (targetLanguage === 'es' && normalizedLang.includes('us')) score += 10;
  if (targetLanguage === 'en' && normalizedLang.includes('us')) score += 14;
  if (normalizedName.includes('natural')) score += 36;
  if (normalizedName.includes('online')) score += 30;
  if (normalizedName.includes('google')) score += 28;
  if (normalizedName.includes('microsoft')) score += 24;
  if (normalizedName.includes('neural')) score += 20;
  if (normalizedName.includes('premium')) score += 18;
  if (normalizedName.includes('female')) score += 6;
  if (normalizedName.includes('helena') || normalizedName.includes('elvira') || normalizedName.includes('dalia')) score += 8;
  if (normalizedName.includes('compact')) score -= 12;
  if (voice.default) score += 4;

  return score;
}

function resolvePreferredSpeechVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | null {
  const targetLanguage = language.startsWith('en') ? 'en' : 'es';
  const candidates = voices.filter(voice => voice.lang.toLowerCase().startsWith(targetLanguage));
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => scoreSpeechVoice(b, language) - scoreSpeechVoice(a, language))[0] ?? null;
}

function createSpeechAudioUrl(audioBase64: string, audioContentType: string): string {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: audioContentType }));
}

export const HomeConversationView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSession(noopSessionCleared);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupport, setSpeechSupport] = useState({
    recognition: false,
    synthesis: false
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechEnabledRef = useRef(false);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
  const speechRequestIdRef = useRef(0);

  useEffect(() => {
    setSpeechSupport({
      recognition: getSpeechRecognitionConstructor() !== null,
      synthesis: 'Audio' in window || 'speechSynthesis' in window
    });
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const syncVoices = () => {
      setSpeechVoices(window.speechSynthesis.getVoices());
    };

    syncVoices();
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', syncVoices);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    speechRequestIdRef.current += 1;
    stopProfessionalSpeech();
    window.speechSynthesis?.cancel();
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

  const speakWithBrowserFallback = (text: string) => {
    if (!speechEnabledRef.current || !text.trim()) return;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = i18n.language.startsWith('en') ? 'en-US' : 'es-ES';
    utterance.voice = resolvePreferredSpeechVoice(speechVoices, i18n.language);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  const speakAssistantResponse = async (text: string) => {
    if (!speechEnabledRef.current || !text.trim()) return;

    speechRequestIdRef.current += 1;
    const requestId = speechRequestIdRef.current;
    stopProfessionalSpeech();
    window.speechSynthesis?.cancel();

    const professionalSpeech = await synthesizeAssistantSpeech(text);
    if (requestId !== speechRequestIdRef.current || !speechEnabledRef.current) return;

    if (!professionalSpeech) {
      speakWithBrowserFallback(text);
      return;
    }

    try {
      const audioUrl = createSpeechAudioUrl(professionalSpeech.audioBase64, professionalSpeech.audioContentType);
      const audio = new Audio(audioUrl);
      speechAudioUrlRef.current = audioUrl;
      speechAudioRef.current = audio;
      audio.onended = stopProfessionalSpeech;
      audio.onerror = () => {
        stopProfessionalSpeech();
        speakWithBrowserFallback(text);
      };
      await audio.play();
    } catch {
      stopProfessionalSpeech();
      speakWithBrowserFallback(text);
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

  const handleToggleListening = () => {
    if (!speechSupport.recognition || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = i18n.language.startsWith('en') ? 'en-US' : 'es-ES';
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? '';
        if (!transcript) continue;

        if (result.isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += `${transcript} `;
        }
      }

      const spokenText = finalTranscript.trim();
      if (spokenText) {
        setInput(spokenText);
        void handleSend(spokenText);
        return;
      }

      const partialText = interimTranscript.trim();
      if (partialText) setInput(partialText);
    };

    recognitionRef.current = recognition;
    if (speechSupport.synthesis) {
      speechEnabledRef.current = true;
      setIsSpeechEnabled(true);
    }
    setIsListening(true);
    recognition.start();
  };

  const handleToggleSpeech = () => {
    const nextSpeechEnabled = !speechEnabledRef.current;
    if (!nextSpeechEnabled) {
      speechRequestIdRef.current += 1;
      stopProfessionalSpeech();
      window.speechSynthesis?.cancel();
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
        inputHint={t('assistant.conversation.input_hint')}
        isListening={isListening}
        isSpeechRecognitionSupported={speechSupport.recognition}
        isSpeechSynthesisSupported={speechSupport.synthesis}
        isSpeechEnabled={isSpeechEnabled}
        voiceLabel={t('assistant.conversation.voice_start')}
        listeningLabel={t('assistant.conversation.voice_listening')}
        speechOnLabel={t('assistant.conversation.speech_on')}
        speechOffLabel={t('assistant.conversation.speech_off')}
        onInputChange={setInput}
        onSend={() => handleSend()}
        onKeyDown={handleKeyDown}
        onToggleListening={handleToggleListening}
        onToggleSpeech={handleToggleSpeech}
      />
    </section>
  );
};
