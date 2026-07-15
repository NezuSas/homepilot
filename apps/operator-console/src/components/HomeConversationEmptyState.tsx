import React from 'react';
import { ChevronRight, Home, Lightbulb, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

const promptIcons = [Lightbulb, ShieldCheck, Home, MessageSquareText, Sparkles];

interface HomeConversationEmptyStateProps {
  title: string;
  description: string;
  capabilities: string[];
  suggestionLabel: string;
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

export const HomeConversationEmptyState: React.FC<HomeConversationEmptyStateProps> = ({
  title,
  description,
  capabilities,
  suggestionLabel,
  suggestions,
  onSuggestionClick
}) => (
  <div className="flex min-h-conversation-sm items-center justify-center py-4 md:min-h-conversation-md xl:min-h-conversation-lg">
    <Card
      variant="glass"
      className="w-full max-w-6xl overflow-hidden rounded-panel border-border/60 bg-assistant-ready p-4 shadow-depth-2 md:p-6 xl:p-8"
    >
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-center">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1 md:h-14 md:w-14">
              <Home className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-micro font-black uppercase tracking-label-wide text-primary/75">
                HomePilot Edge
              </p>
              <h3 className="mt-2 max-w-2xl text-display-title font-black leading-display-tight tracking-tight text-foreground md:text-hero-title-lg xl:text-hero-title-lg">
                {title}
              </h3>
              <p className="mt-4 max-w-3xl text-body font-semibold leading-relaxed text-muted-foreground md:text-body-lg">
                {description}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {capabilities.map((capability, index) => {
              const Icon = promptIcons[index % promptIcons.length];

              return (
                <div key={capability} className="flex min-h-12 items-center gap-2 rounded-panel border border-border/55 bg-background/45 px-3 py-2 shadow-inner shadow-black/5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 text-caption font-black uppercase leading-snug tracking-wide text-foreground/75">
                    {capability}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-section border border-border/45 bg-background/30 p-3 shadow-inner shadow-black/5 md:p-4">
          <p className="mb-3 text-micro font-black uppercase tracking-label text-muted-foreground/65">
            {suggestionLabel}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {suggestions.map((suggestion, index) => {
              const Icon = promptIcons[index % promptIcons.length];

              return (
                <Button
                  key={`${suggestion}-${index}`}
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="min-h-suggested-command justify-between rounded-panel border-border/60 bg-card/70 px-3 py-3 text-left transition hover:border-primary/45 hover:bg-primary/5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 whitespace-normal text-body-compact font-bold leading-snug text-foreground/85">
                      {suggestion}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  </div>
);
