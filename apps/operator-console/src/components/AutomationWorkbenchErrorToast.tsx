import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AutomationWorkbenchErrorToastProps {
  title: string;
  message: string;
  onRetry: () => void;
}

export const AutomationWorkbenchErrorToast: React.FC<AutomationWorkbenchErrorToastProps> = ({ title, message, onRetry }) => (
  <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-[100] flex w-[calc(100%-1.5rem)] max-w-toast-responsive items-center gap-3 rounded-panel border border-destructive/20 bg-destructive p-4 text-destructive-foreground shadow-depth-3 animate-in slide-in-from-right-4 backdrop-blur-md sm:bottom-6 sm:right-6 sm:w-auto sm:min-w-80 sm:gap-4 sm:p-5">
    <AlertCircle className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
    <div className="min-w-0 flex-1">
      <span className="text-micro font-black uppercase tracking-widest opacity-60">{title}</span>
      <span className="text-caption font-bold">{message}</span>
    </div>
    <button onClick={onRetry} className="shrink-0 rounded-2xl bg-white/20 p-2.5 shadow-inner transition-colors hover:bg-white/40">
      <RefreshCw className="w-4 h-4" />
    </button>
  </div>
);
