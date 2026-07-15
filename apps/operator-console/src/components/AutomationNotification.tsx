import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface AutomationNotificationProps {
  message: string;
}

export const AutomationNotification: React.FC<AutomationNotificationProps> = ({ message }) => {
  return (
    <div className="fixed bottom-12 right-12 z-[110] px-8 py-5 rounded-panel shadow-2xl animate-in slide-in-from-right-8 fade-in flex items-center gap-4 border border-border/40 bg-card/80 backdrop-blur-2xl text-primary premium-glow">
      <CheckCircle2 className="w-6 h-6" />
      <span className="font-black text-caption uppercase tracking-widest">{message}</span>
    </div>
  );
};
