import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AutomationBuilderErrorProps {
  message: string;
}

export const AutomationBuilderError: React.FC<AutomationBuilderErrorProps> = ({ message }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-danger animate-shake">
    <AlertCircle className="w-4 h-4 shrink-0" />
    <p className="hp-type-control">{message}</p>
  </div>
);
