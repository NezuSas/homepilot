import React from 'react';
import { Plus, Users } from 'lucide-react';
import { Button } from './ui/Button';
import { SectionHeader } from './ui/SectionHeader';

interface UsersHeaderProps {
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
}

export const UsersHeader: React.FC<UsersHeaderProps> = ({ title, subtitle, addLabel, onAdd }) => (
  <SectionHeader
    level="view"
    icon={Users}
    title={title}
    subtitle={subtitle}
    action={
      <Button onClick={onAdd} size="sm" className="gap-2">
        <Plus className="w-4 h-4" />
        {addLabel}
      </Button>
    }
  />
);
