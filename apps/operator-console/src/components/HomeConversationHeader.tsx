import React from 'react';
import { Bot, Cpu, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
}) => {
  const { t } = useTranslation();

  return (
    <header className="shrink-0 border-b border-border/60 bg-card/75 px-4 py-3 shadow-depth-1 backdrop-blur-xl md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-panel border border-primary/25 bg-primary/10 text-primary shadow-depth-1">
            <Bot className="h-room-icon w-room-icon" />
          </div>
          <div className="min-w-0">
            <h2 className="break-words text-body-lg font-black tracking-tight text-foreground md:text-section-title">{title}</h2>
            <p className="text-micro font-black uppercase leading-snug tracking-status text-muted-foreground/55">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
          <StatusPill variant={isLoading ? 'warning' : 'success'} pulse={isLoading}>
            {statusLabel}
          </StatusPill>
          <StatusPill variant="primary" className="hidden md:inline-flex">
            <Cpu className="h-3 w-3" />
            {t('assistant.conversation.edge_label')}
          </StatusPill>
          <StatusPill variant="neutral" className="hidden md:inline-flex">
            <ShieldCheck className="h-3 w-3" />
            {t('assistant.conversation.local_label')}
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
};
