import React from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Zap } from 'lucide-react';
import { AudioInputPicker } from './AudioInputPicker';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { StatusPill } from './ui/StatusPill';

interface HomeConversationComposerProps {
  input: string;
  isLoading: boolean;
  placeholder: string;
  sendLabel: string;
  versionLabel: string;
  inputHint: string;
  isListening: boolean;
  isSpeechRecordingSupported: boolean;
  isSpeechSynthesisSupported: boolean;
  isSpeechEnabled: boolean;
  audioInputDevices: Array<{ id: string; label: string }>;
  selectedAudioInputId: string;
  audioInputLabel: string;
  voiceLabel: string;
  listeningLabel: string;
  speechOnLabel: string;
  speechOffLabel: string;
  onInputChange: (value: string) => void;
  onAudioInputChange: (deviceId: string) => void;
  onSend: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onToggleListening: () => void;
  onToggleSpeech: () => void;
}

export const HomeConversationComposer: React.FC<HomeConversationComposerProps> = ({
  input,
  isLoading,
  placeholder,
  sendLabel,
  versionLabel,
  inputHint,
  isListening,
  isSpeechRecordingSupported,
  isSpeechSynthesisSupported,
  isSpeechEnabled,
  audioInputDevices,
  selectedAudioInputId,
  audioInputLabel,
  voiceLabel,
  listeningLabel,
  speechOnLabel,
  speechOffLabel,
  onInputChange,
  onAudioInputChange,
  onSend,
  onKeyDown,
  onToggleListening,
  onToggleSpeech
}) => (
  <footer className="shrink-0 border-t border-border/60 bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-4 md:px-6">
    <div className="mx-auto w-full max-w-7xl">
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSend();
        }}
      >
        <Card className="relative flex flex-col gap-2 overflow-visible rounded-panel border-border/70 bg-card/95 p-2 shadow-depth-2 transition-all duration-300 focus-within:border-primary/45 focus-within:bg-card focus-within:shadow-primary/10 focus-within:ring-2 focus-within:ring-primary/10 md:flex-row md:items-end">
          <textarea
            aria-label={placeholder}
            rows={1}
            value={input}
            onChange={event => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="custom-scrollbar min-h-touch-target max-h-40 w-full flex-1 resize-none border-none bg-transparent px-3 py-3 text-body leading-relaxed text-foreground placeholder:text-muted-foreground/45 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 md:max-h-48 md:text-body-lg"
            disabled={isLoading}
          />
          <div className="flex w-full shrink-0 items-center justify-end gap-1 rounded-2xl border border-border/55 bg-muted/35 p-1 shadow-inner shadow-black/5 md:w-auto">
            {isSpeechRecordingSupported && (
              <>
              <AudioInputPicker
                devices={audioInputDevices}
                selectedDeviceId={selectedAudioInputId}
                label={audioInputLabel}
                disabled={isLoading || isListening}
                onChange={onAudioInputChange}
              />
              <Button
                type="button"
                variant={isListening ? 'danger' : 'secondary'}
                size="icon"
                disabled={isLoading}
                aria-label={isListening ? listeningLabel : voiceLabel}
                title={isListening ? listeningLabel : voiceLabel}
                onClick={onToggleListening}
                className={cn(
                  'h-10 w-10 shrink-0 rounded-xl',
                  isListening && 'shadow-lg shadow-primary/20 ring-2 ring-primary/35'
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              </>
            )}
            {isSpeechSynthesisSupported && (
              <Button
                type="button"
                variant={isSpeechEnabled ? 'primary' : 'secondary'}
                size="icon"
                aria-label={isSpeechEnabled ? speechOnLabel : speechOffLabel}
                title={isSpeechEnabled ? speechOnLabel : speechOffLabel}
                onClick={onToggleSpeech}
                className="h-10 w-10 shrink-0 rounded-xl"
              >
                {isSpeechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={!input.trim() || isLoading}
              aria-label={sendLabel}
              className="h-10 w-10 shrink-0 rounded-xl shadow-md shadow-primary/15"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <StatusPill variant={isLoading ? 'warning' : 'success'} pulse={isLoading} dot className="h-3 w-3 shrink-0" />
          <p className="truncate text-micro font-bold uppercase tracking-widest text-muted-foreground/60">
            {versionLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground/55">
          <Zap className="h-3 w-3 text-primary" />
          <span className="hidden text-micro font-bold uppercase tracking-wider sm:inline">
            {inputHint}
          </span>
        </div>
      </div>
    </div>
  </footer>
);
