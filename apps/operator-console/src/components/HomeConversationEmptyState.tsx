import React from 'react';
import { Lightbulb, MessageCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';

interface HomeConversationSuggestion {
  id: string;
  label: string;
  requiresConfirmation?: boolean;
}

interface HomeConversationEmptyStateProps {
  title: string;
  description: string;
  suggestionsLabel: string;
  confirmationRequiredLabel: string;
  suggestions: HomeConversationSuggestion[];
  onSuggestionClick: (suggestion: string) => void;
}

export const HomeConversationEmptyState: React.FC<HomeConversationEmptyStateProps> = ({
  title, description, suggestionsLabel, confirmationRequiredLabel, suggestions, onSuggestionClick
}) => (
  <section className="home-conversation-empty-state" aria-labelledby="home-conversation-empty-title">
    <div className="home-conversation-empty-panel">
      <div className="home-conversation-empty-intro">
        <div className="home-conversation-empty-icon" aria-hidden="true">
          <MessageCircle className="h-5 w-5" />
        </div>
        <h2 id="home-conversation-empty-title" className="home-conversation-empty-title">{title}</h2>
        <p className="home-conversation-empty-description">{description}</p>
      </div>

      <div className="home-conversation-suggestions" aria-label={suggestionsLabel}>
        {suggestions.map(suggestion => (
          <Button
            key={suggestion.id}
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onSuggestionClick(suggestion.label)}
            className={[
              'home-conversation-suggestion',
              suggestion.requiresConfirmation ? 'home-conversation-suggestion--protected' : ''
            ].join(' ')}
          >
            {suggestion.requiresConfirmation
              ? <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              : <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            <span>{suggestion.label}</span>
            {suggestion.requiresConfirmation && <span className="sr-only">{confirmationRequiredLabel}</span>}
          </Button>
        ))}
      </div>
    </div>
  </section>
);
