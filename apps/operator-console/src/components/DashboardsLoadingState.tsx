import React from 'react';
import { LayoutDashboard } from 'lucide-react';

interface DashboardsLoadingStateProps {
  label: string;
}

export const DashboardsLoadingState: React.FC<DashboardsLoadingStateProps> = ({ label }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3 animate-pulse">
      <LayoutDashboard className="w-8 h-8 text-primary/40" />
      <p className="text-micro text-muted-foreground font-black uppercase tracking-widest">{label}</p>
    </div>
  </div>
);
