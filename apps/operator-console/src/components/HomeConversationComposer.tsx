import React from 'react';
import { Send, Zap } from 'lucide-react';
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
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export const HomeConversationComposer: React.FC<HomeConversationComposerProps> = ({
  input,
  isLoading,
  placeholder,
  sendLabel,
  versionLabel,
  inputHint,
  onInputChange,
  onSend,
  onKeyDown
}) => (
  <footer className="shrink-0 border-t border-border/60 bg-background/85 px-4 py-4 backdrop-blur-xl md:px-6 md:pb-6">
    <div className="mx-auto max-w-5xl">
      <Card className="relative flex items-end rounded-panel border-border/70 bg-card/90 p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <textarea
          aria-label={placeholder}
          rows={1}
          value={input}
          onChange={event => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="custom-scrollbar min-h-[52px] max-h-48 flex-1 resize-none border-none bg-transparent px-3 py-3 pr-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/45 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
          disabled={isLoading}
        />
        <Button
          type="button"
          variant="primary"
          size="icon"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          aria-label={sendLabel}
          className="h-11 w-11 shrink-0 rounded-xl shadow-md shadow-primary/15"
        >
          <Send className="h-4 w-4" />
        </Button>
      </Card>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <StatusPill variant={isLoading ? 'warning' : 'success'} pulse={isLoading} dot className="h-3 w-3 shrink-0" />
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {versionLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground/55">
          <Zap className="h-3 w-3 text-primary" />
          <span className="hidden text-[10px] font-bold uppercase tracking-wider sm:inline">
            {inputHint}
          </span>
        </div>
      </div>
    </div>
  </footer>
);
