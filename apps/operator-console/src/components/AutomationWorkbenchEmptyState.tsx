import React from 'react';
import { Sparkles } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';

interface AutomationWorkbenchEmptyStateProps {
  title: string;
  description: string;
}

export const AutomationWorkbenchEmptyState: React.FC<AutomationWorkbenchEmptyStateProps> = ({ title, description }) => (
  <EmptyState
    icon={Sparkles}
    title={title}
    description={description}
    className="min-h-empty-sm animate-in fade-in duration-1000"
  />
);
