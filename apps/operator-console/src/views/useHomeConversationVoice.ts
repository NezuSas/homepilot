import { useTranslation } from 'react-i18next';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, transcribeAssistantSpeech } from '../lib/assistantApi';
import type { AssistantTurnCoordinator } from '../lib/assistantTurnCoordinator';
import { blobToBase64 } from '../lib/audioRecording';
import { isUsableVoiceTranscript, normalizeVoiceTranscript } from '../lib/homeConversationVoice';
import type { useHomeConversationSpeech } from './useHomeConversationSpeech';
import { useHomeConversationVoiceCapture } from './useHomeConversationVoiceCapture';
import type { useHomeConversationTurns } from './useHomeConversationTurns';

interface UseHomeConversationVoiceOptions {
  assistantTurnCoordinator: AssistantTurnCoordinator;
  turns: ReturnType<typeof useHomeConversationTurns>;
  speech: ReturnType<typeof useHomeConversationSpeech>;
}

/** Connects microphone capture to transcription and the shared conversation turn flow. */
export function useHomeConversationVoice({ assistantTurnCoordinator, turns, speech }: UseHomeConversationVoiceOptions) {
  const { t } = useTranslation();
  const {
    isLoading,
    setInput,
    setSpeechNotice,
    setConversationActivity,
    activeConversationTurnRef,
    handleSend
  } = turns;

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

  return useHomeConversationVoiceCapture({
    disabled: isLoading,
    onRecordingComplete: audioBlob => { void handleRecordingComplete(audioBlob); },
    onActivityChange: setConversationActivity,
    onNotice: setSpeechNotice,
    onRecordingStarted: synthesisSupported => {
      if (!synthesisSupported) return;
      speech.enableSpeech();
    },
    getErrorMessage: kind => {
      if (kind === 'permission') return t('assistant.conversation.voice_permission_error');
      if (kind === 'capture') return t('assistant.conversation.voice_capture_error');
      return t('assistant.conversation.voice_start_error');
    },
    getUnavailableMessage: () => t('assistant.conversation.voice_unavailable_error')
  });
}
