import React from 'react';
import { RefreshCw } from 'lucide-react';

interface DiagnosticsLoadingStateProps {
  label: string;
}

export const DiagnosticsLoadingState: React.FC<DiagnosticsLoadingStateProps> = ({ label }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <RefreshCw className="w-8 h-8 animate-spin mb-4" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
};
