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
  <div className="flex min-h-conversation-sm items-center justify-center py-4 md:min-h-conversation-md">
    <div className="w-full max-w-3xl">
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion, index) => (
          <Button
            key={`${suggestion}-${index}`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            className="max-w-full rounded-full border-border/60 bg-card/70 px-3 text-left text-caption font-semibold"
          >
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-normal">{suggestion}</span>
          </Button>
        ))}
      </div>
    </div>
  </div>
);