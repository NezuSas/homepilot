import React from 'react';
import { Bot, MessageSquareText } from 'lucide-react';
import { StatusPill } from './ui/StatusPill';

interface HomeConversationHeaderProps {
  title: string;
  subtitle: string;
  statusLabel: string;
  isLoading: boolean;
  messageCount: number;
}

export const HomeConversationHeader: React.FC<HomeConversationHeaderProps> = ({
  title,
  subtitle,
  statusLabel,
  isLoading,
  messageCount
}) => (
  <header className="shrink-0 border-b border-border/60 bg-card/55 px-4 py-4 shadow-depth-1 backdrop-blur-xl md:px-6">
    <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/10 text-primary shadow-depth-1">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black tracking-tight text-foreground">{title}</h2>
          <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusPill variant={isLoading ? 'warning' : 'success'} pulse={isLoading}>
          {statusLabel}
        </StatusPill>
        {messageCount > 0 && (
          <StatusPill variant="neutral" className="hidden sm:inline-flex">
            <MessageSquareText className="h-3 w-3" />
            {messageCount}
          </StatusPill>
        )}
      </div>
    </div>
  </header>
);
