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
  <div className="flex min-h-[54vh] items-center justify-center py-6">
    <Card variant="glass" className="w-full max-w-3xl p-5 md:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/75">
              HomePilot Edge
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-foreground md:text-3xl">
              {title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground md:text-[0.95rem]">
              {description}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {capabilities.map((capability, index) => {
            const Icon = promptIcons[index % promptIcons.length];

            return (
              <div key={capability} className="flex min-h-12 items-center gap-2 rounded-panel border border-border/55 bg-background/35 px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 text-xs font-black uppercase leading-snug tracking-wide text-foreground/75">
                  {capability}
                </span>
              </div>
            );
          })}
        </div>

        <div className="min-w-0">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
            {suggestionLabel}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => {
              const Icon = promptIcons[index % promptIcons.length];

              return (
                <Button
                  key={`${suggestion}-${index}`}
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="min-h-12 justify-between rounded-panel border-border/60 bg-card/70 px-3 py-2.5 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 whitespace-normal text-[0.82rem] font-bold leading-snug text-foreground/85">
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
