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
  <div className="flex min-h-[56vh] items-center justify-center py-8">
    <Card variant="glass" className="w-full max-w-4xl p-5 md:p-7">
      <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1">
              <Home className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/75">
                HomePilot Edge
              </p>
              <h3 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
                {title}
              </h3>
            </div>
          </div>

          <p className="max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>

          <div className="mt-5 grid gap-2">
            {capabilities.map((capability, index) => {
              const Icon = promptIcons[index % promptIcons.length];

              return (
                <div key={capability} className="flex items-center gap-3 rounded-panel border border-border/55 bg-background/35 px-3 py-2 text-sm font-bold text-foreground/80">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 truncate">{capability}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-[1.75rem] border border-border/55 bg-background/35 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
            {suggestionLabel}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => {
              const Icon = promptIcons[index % promptIcons.length];

              return (
                <Button
                  key={`${suggestion}-${index}`}
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="h-auto justify-between rounded-panel border-border/60 bg-card/70 px-3 py-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-[0.82rem] font-bold text-foreground/85">
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
