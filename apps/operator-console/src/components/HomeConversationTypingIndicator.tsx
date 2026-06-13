import React from 'react';
import { Bot } from 'lucide-react';

export const HomeConversationTypingIndicator: React.FC = () => (
  <div className="flex justify-start w-full max-w-[85%] animate-in fade-in duration-300">
    <div className="flex space-x-3">
      <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0 shadow-lg">
        <Bot className="w-5 h-5 text-primary animate-pulse" />
      </div>
      <div className="bg-muted/30 border border-border p-4 rounded-2xl rounded-tl-none flex space-x-1.5 items-center shadow-lg">
        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
      </div>
    </div>
  </div>
);
