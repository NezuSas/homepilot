import React from 'react';
import { Loader2 } from 'lucide-react';

interface AutomationWorkbenchLoadingStateProps {
  label: string;
}

export const AutomationWorkbenchLoadingState: React.FC<AutomationWorkbenchLoadingStateProps> = ({ label }) => (
  <div className="p-20 text-center flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
    <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
    <span className="text-sm font-black uppercase tracking-widest">{label}</span>
  </div>
);
