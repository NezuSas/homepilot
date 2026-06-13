import React from 'react';
import { Check, LayoutDashboard, PenLine, Plus } from 'lucide-react';
import { Button } from './ui/Button';

interface DashboardsHeroProps {
  category: string;
  title: string;
  subtitle: string;
  canEdit: boolean;
  isEditing: boolean;
  isCreating: boolean;
  editLabel: string;
  doneLabel: string;
  newLabel: string;
  onToggleEditing: () => void;
  onCreate: () => void;
}

export const DashboardsHero: React.FC<DashboardsHeroProps> = ({
  category,
  title,
  subtitle,
  canEdit,
  isEditing,
  isCreating,
  editLabel,
  doneLabel,
  newLabel,
  onToggleEditing,
  onCreate
}) => (
  <div className="relative rounded-[2.5rem] overflow-hidden mb-8 border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-8 sm:p-10">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/2" />
    </div>
    <div className="relative z-10 flex items-center justify-between gap-6">
      <div className="flex items-center gap-6 min-w-0">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 shrink-0">
          <LayoutDashboard className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 mb-2">{category}</p>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight truncate mb-1">{title}</h2>
          <p className="text-xs text-muted-foreground/60 max-w-md">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {canEdit && (
          <Button
            variant={isEditing ? "primary" : "secondary"}
            size="sm"
            onClick={onToggleEditing}
            className="flex items-center gap-2 px-6 rounded-2xl"
          >
            {isEditing ? <Check className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
            <span className="hidden xs:inline uppercase font-black text-[10px] tracking-widest">{isEditing ? doneLabel : editLabel}</span>
          </Button>
        )}
        {!isCreating && !isEditing && (
          <Button variant="primary" size="sm" onClick={onCreate} className="flex items-center gap-2 px-6 rounded-2xl">
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline uppercase font-black text-[10px] tracking-widest">{newLabel}</span>
          </Button>
        )}
      </div>
    </div>
  </div>
);
