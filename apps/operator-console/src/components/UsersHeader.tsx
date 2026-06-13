import React from 'react';
import { Plus } from 'lucide-react';

interface UsersHeaderProps {
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
}

export const UsersHeader: React.FC<UsersHeaderProps> = ({ title, subtitle, addLabel, onAdd }) => (
  <div className="flex justify-between items-end">
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm active:scale-95"
    >
      <Plus className="w-4 h-4" />
      {addLabel}
    </button>
  </div>
);
