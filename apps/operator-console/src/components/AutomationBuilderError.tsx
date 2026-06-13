import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AutomationBuilderErrorProps {
  message: string;
}

export const AutomationBuilderError: React.FC<AutomationBuilderErrorProps> = ({ message }) => (
  <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive animate-shake">
    <AlertCircle className="w-4 h-4 shrink-0" />
    <p className="text-[10px] font-black uppercase tracking-wider leading-none">{message}</p>
  </div>
);
