import React from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { AudioInputPicker } from './AudioInputPicker';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { StatusPill } from './ui/StatusPill';

interface HomeConversationComposerProps {
  input: string; isLoading: boolean; placeholder: string; sendLabel: string;
  activityLabel: string; activityTone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral'; inputHint: string;
  isListening: boolean; isSpeechRecordingSupported: boolean; isSpeechSynthesisSupported: boolean; isSpeechEnabled: boolean;
  audioInputDevices: Array<{ id: string; label: string }>; selectedAudioInputId: string; audioInputLabel: string;
  voiceLabel: string; listeningLabel: string; speechOnLabel: string; speechOffLabel: string; cancelLabel: string;
  onInputChange: (value: string) => void; onAudioInputChange: (deviceId: string) => void; onSend: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void; onToggleListening: () => void; onToggleSpeech: () => void; onCancelRequest: () => void;
}

export const HomeConversationComposer: React.FC<HomeConversationComposerProps> = ({
  input, isLoading, placeholder, sendLabel, activityLabel, activityTone, inputHint, isListening, isSpeechRecordingSupported,
  isSpeechSynthesisSupported, isSpeechEnabled, audioInputDevices, selectedAudioInputId, audioInputLabel, voiceLabel,
  listeningLabel, speechOnLabel, speechOffLabel, cancelLabel, onInputChange, onAudioInputChange, onSend, onKeyDown,
  onToggleListening, onToggleSpeech, onCancelRequest
}) => (
  <footer data-testid="home-conversation-composer" className="home-conversation-composer-region sticky bottom-0 z-30 shrink-0 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 md:px-6">
    <div className="mx-auto min-w-0 w-full max-w-6xl">
      <form aria-busy={isLoading} onSubmit={(event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSend(); }}>
        <Card className="home-conversation-composer-card relative flex min-w-0 flex-col gap-2 overflow-visible rounded-panel border-border/75 bg-card/95 p-2 shadow-depth-3 transition-all duration-300 focus-within:border-primary/45 focus-within:bg-card focus-within:shadow-primary/10 focus-within:ring-2 focus-within:ring-primary/10 md:flex-row md:items-end">
          <textarea aria-label={placeholder} aria-describedby="home-conversation-input-hint" rows={1} value={input} onChange={event => onInputChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className="custom-scrollbar min-h-touch-target max-h-40 w-full flex-1 resize-none border-none bg-transparent px-3 py-3 text-body leading-relaxed text-foreground placeholder:text-muted-foreground/45 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 md:max-h-48 md:text-body-lg" disabled={isLoading} />
          <div className="home-conversation-composer-controls flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 rounded-2xl border border-border/55 bg-muted/35 p-1 shadow-inner shadow-black/5 md:w-auto md:justify-end md:flex-nowrap">
            {isSpeechRecordingSupported && <><AudioInputPicker devices={audioInputDevices} selectedDeviceId={selectedAudioInputId} label={audioInputLabel} disabled={isLoading || isListening} onChange={onAudioInputChange} /><Button type="button" variant={isListening ? 'danger' : 'secondary'} size="icon" disabled={isLoading} aria-label={isListening ? listeningLabel : voiceLabel} title={isListening ? listeningLabel : voiceLabel} onClick={onToggleListening} className={cn('h-10 w-10 shrink-0 rounded-xl', isListening && 'shadow-lg shadow-primary/20 ring-2 ring-primary/35')}>{isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button></>}
            {isSpeechSynthesisSupported && <Button type="button" variant={isSpeechEnabled ? 'primary' : 'secondary'} size="icon" aria-label={isSpeechEnabled ? speechOnLabel : speechOffLabel} title={isSpeechEnabled ? speechOnLabel : speechOffLabel} onClick={onToggleSpeech} className="h-10 w-10 shrink-0 rounded-xl">{isSpeechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>}
            {isLoading && <Button type="button" variant="outline" size="sm" onClick={onCancelRequest} className="home-conversation-cancel-request shrink-0"><X className="h-3.5 w-3.5" /><span>{cancelLabel}</span></Button>}
            <Button type="submit" variant="primary" size="icon" disabled={!input.trim() || isLoading} aria-label={sendLabel} className="h-10 w-10 shrink-0 rounded-xl shadow-md shadow-primary/15"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </form>
      <div className="home-conversation-composer-meta mt-2 flex min-w-0 flex-wrap items-start justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2" role="status" aria-live="polite"><StatusPill variant={activityTone} pulse={isLoading || isListening} className="home-conversation-activity-status">{activityLabel}</StatusPill></div>
        <div id="home-conversation-input-hint" className="flex min-w-0 items-center gap-1.5 text-muted-foreground/55"><span className="text-micro font-bold uppercase tracking-wider">{inputHint}</span></div>
      </div>
    </div>
  </footer>
);
