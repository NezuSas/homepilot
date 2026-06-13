import React from 'react';
import { Send, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { StatusPill } from './ui/StatusPill';

interface HomeConversationComposerProps {
  input: string;
  isLoading: boolean;
  placeholder: string;
  versionLabel: string;
  inputHint: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export const HomeConversationComposer: React.FC<HomeConversationComposerProps> = ({
  input,
  isLoading,
  placeholder,
  versionLabel,
  inputHint,
  onInputChange,
  onSend,
  onKeyDown
}) => (
  <div className="px-4 py-4 md:px-6 md:pb-8 bg-background/80 backdrop-blur-xl border-t border-border shrink-0">
    <div className="max-w-5xl mx-auto px-4">
      <div className="relative flex items-center bg-card border border-border rounded-2xl focus-within:border-primary/40 focus-within:shadow-lg transition-all duration-300 group ring-offset-background focus-within:ring-2 focus-within:ring-primary/10">
        <textarea
          rows={1}
          value={input}
          onChange={event => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none focus:ring-0 text-foreground p-4 py-4 pr-16 resize-none custom-scrollbar min-h-[56px] max-h-48 placeholder:text-muted-foreground/50 text-base"
          disabled={isLoading}
        />
        <div className="absolute right-2 bottom-2 flex items-center space-x-1">
          <Button
            variant="primary"
            size="sm"
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 p-0 rounded-xl shadow-md hover:shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="flex justify-between items-center px-1 mt-3">
        <div className="flex items-center space-x-2">
          <StatusPill variant={isLoading ? "warning" : "success"} className="scale-[0.7] origin-left" />
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
            {versionLabel}
          </p>
        </div>
        <div className="flex items-center space-x-4 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <span className="text-[10px] text-muted-foreground flex items-center font-bold uppercase tracking-tighter">
            <Zap className="w-3 h-3 mr-1 text-primary animate-pulse" /> {inputHint}
          </span>
        </div>
      </div>
    </div>
  </div>
);
