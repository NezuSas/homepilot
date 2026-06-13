import React from 'react';
import { Activity } from 'lucide-react';

interface UsersLoadingStateProps {
  label: string;
}

export const UsersLoadingState: React.FC<UsersLoadingStateProps> = ({ label }) => (
  <div className="flex items-center justify-center p-12">
    <Activity className="w-8 h-8 animate-pulse text-muted-foreground mr-3" />
    <span className="text-muted-foreground font-medium">{label}</span>
  </div>
);
