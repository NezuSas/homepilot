import { useRef, useState } from 'react';
import { synthesizeAssistantSpeech } from '../lib/assistantApi';
import type { AssistantTurn, AssistantTurnCoordinator } from '../lib/assistantTurnCoordinator';
import { createSpeechAudioUrl } from '../lib/audioRecording';
import { HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT } from '../lib/homeConversationVoice';
import { readSpeechEnabledPreference, storeSpeechEnabledPreference } from './homeConversationPersistence';

const notifySpeechActivity = (speaking: boolean) => {
  window.dispatchEvent(new CustomEvent(HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, {
    detail: { speaking }
  }));
};

/** Owns synthesized assistant speech playback and the persisted speech toggle. */
export function useHomeConversationSpeech(assistantTurnCoordinator: AssistantTurnCoordinator, voiceEnabled = true) {
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(readSpeechEnabledPreference);
  const speechEnabledRef = useRef(isSpeechEnabled);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
  const speechRequestIdRef = useRef(0);

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
  }

  const invalidateSpeechRequests = () => {
    speechRequestIdRef.current += 1;
  };

  const enableSpeech = () => {
    speechEnabledRef.current = true;
    setIsSpeechEnabled(true);
  };

  const speakAssistantResponse = async (text: string, turn?: AssistantTurn) => {
    if (!voiceEnabled || !speechEnabledRef.current || !text.trim() || (turn && !assistantTurnCoordinator.isCurrent(turn))) return;

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

  const handleToggleSpeech = () => {
    const nextSpeechEnabled = !speechEnabledRef.current;
    if (!nextSpeechEnabled) {
      invalidateSpeechRequests();
      stopProfessionalSpeech();
    }
    speechEnabledRef.current = nextSpeechEnabled;
    storeSpeechEnabledPreference(nextSpeechEnabled);
    setIsSpeechEnabled(nextSpeechEnabled);
  };

  return {
    isSpeechEnabled,
    enableSpeech,
    invalidateSpeechRequests,
    stopProfessionalSpeech,
    speakAssistantResponse,
    handleToggleSpeech
  };
}
