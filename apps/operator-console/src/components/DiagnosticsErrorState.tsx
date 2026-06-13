import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface DiagnosticsErrorStateProps {
  title: string;
  message: string;
}

export const DiagnosticsErrorState: React.FC<DiagnosticsErrorStateProps> = ({ title, message }) => {
  return (
    <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-start gap-4">
      <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
      <div>
        <h3 className="font-bold text-sm">{title}</h3>
        <p className="text-xs opacity-80 mt-1">{message}</p>
      </div>
    </div>
  );
};
