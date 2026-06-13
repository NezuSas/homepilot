import React from 'react';
import { Sparkles } from 'lucide-react';

export const AssistantLoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 animate-pulse">
      <Sparkles className="w-12 h-12 text-primary/20" />
      <div className="h-4 w-48 bg-muted rounded-full" />
    </div>
  );
};
