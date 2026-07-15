import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface AutomationNotificationProps {
  message: string;
}

export const AutomationNotification: React.FC<AutomationNotificationProps> = ({ message }) => {
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-[110] flex w-[calc(100%-1.5rem)] max-w-toast-responsive items-center gap-3 rounded-panel border border-border/40 bg-card/95 px-4 py-3 shadow-2xl animate-in slide-in-from-right-8 fade-in text-primary premium-glow backdrop-blur-2xl sm:bottom-6 sm:right-6 sm:w-auto sm:min-w-80 sm:px-5 sm:py-4">
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      <span className="text-caption font-black uppercase tracking-widest">{message}</span>
    </div>
  );
};
