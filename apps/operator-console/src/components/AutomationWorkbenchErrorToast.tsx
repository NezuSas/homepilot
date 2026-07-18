import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './ui/IconButton';

interface AutomationWorkbenchErrorToastProps {
  title: string;
  message: string;
  onRetry: () => void;
}

export const AutomationWorkbenchErrorToast: React.FC<AutomationWorkbenchErrorToastProps> = ({ title, message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-[100] flex w-[calc(100%-1.5rem)] max-w-toast-responsive items-center gap-3 rounded-panel border border-destructive/20 bg-destructive p-4 text-destructive-foreground shadow-depth-3 animate-in slide-in-from-right-4 backdrop-blur-md sm:bottom-6 sm:right-6 sm:w-auto sm:min-w-80 sm:gap-4 sm:p-5">
      <AlertCircle className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
      <div className="min-w-0 flex-1">
        <span className="text-micro font-black uppercase tracking-widest opacity-60">{title}</span>
        <span className="text-caption font-bold">{message}</span>
      </div>
      <IconButton icon={RefreshCw} label={t('common.retry')} onClick={onRetry} variant="ghost" size="md" className="shrink-0 bg-white/20 text-destructive-foreground hover:bg-white/40" />
    </div>
  );
};
