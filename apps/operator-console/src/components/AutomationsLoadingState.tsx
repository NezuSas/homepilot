import React from 'react';
import { Loader2 } from 'lucide-react';

interface AutomationsLoadingStateProps {
  label: string;
}

export const AutomationsLoadingState: React.FC<AutomationsLoadingStateProps> = ({ label }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
      <div className="premium-shimmer w-32 h-32 rounded-full absolute opacity-20" />
      <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-30">{label}</p>
    </div>
  );
};
