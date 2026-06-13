import React from 'react';
import { Ghost } from 'lucide-react';

interface AutomationWorkbenchEmptyStateProps {
  title: string;
  description: string;
}

export const AutomationWorkbenchEmptyState: React.FC<AutomationWorkbenchEmptyStateProps> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-[3rem] text-center p-12 bg-card/20 animate-in fade-in duration-1000">
    <Ghost className="w-16 h-16 text-muted-foreground opacity-10 mb-8" />
    <h3 className="text-2xl font-black tracking-tight">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-xs mt-3 mb-10 leading-relaxed font-medium">{description}</p>
  </div>
);
