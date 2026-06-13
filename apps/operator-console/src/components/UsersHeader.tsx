import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

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
    <Button onClick={onAdd} size="sm">
      <Plus className="w-4 h-4" />
      {addLabel}
    </Button>
  </div>
);
