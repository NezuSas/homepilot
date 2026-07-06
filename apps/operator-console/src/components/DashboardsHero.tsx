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
  <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/2" />
    </div>
    <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-2xl shadow-primary/30 sm:h-14 sm:w-14">
          <LayoutDashboard className="h-6 w-6 text-primary-foreground sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 mb-2">{category}</p>
          <h2 className="truncate text-2xl font-black tracking-tight text-foreground sm:text-3xl">{title}</h2>
          <p className="text-xs text-muted-foreground/60 max-w-md">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3">
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
