import React from 'react';
import { Bot } from 'lucide-react';

interface HomeConversationHeaderProps {
  title: string;
  subtitle: string;
}

export const HomeConversationHeader: React.FC<HomeConversationHeaderProps> = ({ title, subtitle }) => (
  <div className="px-6 py-4 border-b border-border bg-card/30 flex items-center">
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-primary/10 rounded-lg text-primary">
        <Bot className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">{subtitle}</p>
      </div>
    </div>
  </div>
);
