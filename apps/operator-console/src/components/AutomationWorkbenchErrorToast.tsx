import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AutomationWorkbenchErrorToastProps {
  title: string;
  message: string;
  onRetry: () => void;
}

export const AutomationWorkbenchErrorToast: React.FC<AutomationWorkbenchErrorToastProps> = ({ title, message, onRetry }) => (
  <div className="fixed bottom-10 right-10 bg-destructive text-destructive-foreground p-5 rounded-panel shadow-depth-3 flex items-center gap-5 animate-in slide-in-from-right-4 z-[100] border border-destructive/20 backdrop-blur-md">
    <AlertCircle className="w-6 h-6" />
    <div className="flex flex-col">
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</span>
      <span className="text-xs font-bold">{message}</span>
    </div>
    <button onClick={onRetry} className="bg-white/20 p-2.5 rounded-2xl hover:bg-white/40 transition-colors shadow-inner">
      <RefreshCw className="w-4 h-4" />
    </button>
  </div>
);
