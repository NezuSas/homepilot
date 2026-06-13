import React from 'react';
import { Loader2 } from 'lucide-react';

export const DashboardLoadingState: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
    </div>
  );
};
