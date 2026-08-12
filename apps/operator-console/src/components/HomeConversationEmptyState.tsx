import React from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from './ui/Button';

interface HomeConversationEmptyStateProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

export const HomeConversationEmptyState: React.FC<HomeConversationEmptyStateProps> = ({
  suggestions,
  onSuggestionClick
}) => (
  <div className="flex min-h-full items-end justify-center px-1 pb-2 pt-8 sm:px-2">
    <div className="w-full max-w-3xl">
      <div className="flex flex-wrap justify-center gap-2 rounded-panel border border-border/45 bg-background/45 p-2 shadow-depth-1">
        {suggestions.map((suggestion, index) => (
          <Button
            key={`${suggestion}-${index}`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            className="max-w-full rounded-full border-border/70 bg-card px-3 text-left text-caption font-semibold shadow-sm"
          >
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-normal">{suggestion}</span>
          </Button>
        ))}
      </div>
    </div>
  </div>
);