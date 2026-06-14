import React from 'react';
import { ChevronRight, Home, Lightbulb, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

const promptIcons = [Lightbulb, ShieldCheck, Home, MessageSquareText];

interface HomeConversationEmptyStateProps {
  title: string;
  description: string;
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

export const HomeConversationEmptyState: React.FC<HomeConversationEmptyStateProps> = ({
  title,
  description,
  suggestions,
  onSuggestionClick
}) => (
  <div className="flex min-h-[58vh] items-center justify-center py-8">
    <Card variant="glass" className="w-full max-w-3xl p-6 md:p-8">
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1">
          <Home className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="max-w-xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary/75">
              HomePilot Edge
            </p>
            <h3 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
              {title}
            </h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
              {description}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => {
              const Icon = promptIcons[index % promptIcons.length];

              return (
                <Button
                  key={`${suggestion}-${index}`}
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="h-auto justify-between rounded-panel border-border/60 bg-background/50 px-4 py-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-bold text-foreground/85">
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
