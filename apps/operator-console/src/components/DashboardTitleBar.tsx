import React from 'react';
import { Check, HelpCircle, MoreVertical, PenLine, Plus, Trash2, X } from 'lucide-react';

interface DashboardTitleBarProps {
  title: string;
  draftTitle: string;
  isEditingTitle: boolean;
  isEditingDashboard: boolean;
  onDraftTitleChange: (title: string) => void;
  onStartEditingTitle: () => void;
  onCancelEditingTitle: () => void;
  onConfirmTitle: () => void;
  onDelete: () => void;
  deleteLabel: string;
  editLabel: string;
  doneLabel: string;
  newLabel: string;
  helpLabel: string;
  moreLabel: string;
  onToggleEditing: () => void;
  onCreate: () => void;
}

export const DashboardTitleBar: React.FC<DashboardTitleBarProps> = ({
  title,
  draftTitle,
  isEditingTitle,
  isEditingDashboard,
  onDraftTitleChange,
  onStartEditingTitle,
  onCancelEditingTitle,
  onConfirmTitle,
  onDelete,
  deleteLabel,
  editLabel,
  doneLabel,
  newLabel,
  helpLabel,
  moreLabel,
  onToggleEditing,
  onCreate,
}) => (
  <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border/60 bg-card/95 px-4 py-2 shadow-depth-1 sm:px-6">
    {isEditingTitle ? (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          autoFocus
          className="flex-1 border-b-2 border-primary bg-transparent py-1 text-xl font-semibold text-foreground outline-none sm:text-2xl"
          value={draftTitle}
          onChange={event => onDraftTitleChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') onConfirmTitle();
            if (event.key === 'Escape') onCancelEditingTitle();
          }}
        />
        <button type="button" onClick={onConfirmTitle} className="p-2 text-primary"><Check className="w-5 h-5" /></button>
        <button type="button" onClick={onCancelEditingTitle} className="p-2 text-muted-foreground"><X className="w-5 h-5" /></button>
      </div>
    ) : (
      <div className="group flex min-w-0 flex-1 items-center gap-2">
        <h3 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h3>
        <button type="button" onClick={onStartEditingTitle} className="rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-primary" aria-label={editLabel}><PenLine className="h-4 w-4" /></button>
      </div>
    )}
    <div className="flex shrink-0 items-center gap-2">
      {isEditingDashboard ? (
        <>
          <button type="button" onClick={onCreate} title={newLabel} aria-label={newLabel} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Plus className="h-5 w-5" /></button>
          <button type="button" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={helpLabel}><HelpCircle className="h-5 w-5" /></button>
          <button type="button" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={moreLabel}><MoreVertical className="h-5 w-5" /></button>
          <button type="button" onClick={onToggleEditing} className="rounded-full bg-primary/15 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{doneLabel}</button>
        </>
      ) : (
        <>
          <button type="button" onClick={onToggleEditing} title={editLabel} aria-label={editLabel} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><PenLine className="h-5 w-5" /></button>
          <button type="button" onClick={onCreate} title={newLabel} aria-label={newLabel} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Plus className="h-5 w-5" /></button>
          <button type="button" onClick={onDelete} title={deleteLabel} aria-label={deleteLabel} className="rounded-full p-2 text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-5 w-5" /></button>
        </>
      )}
    </div>
  </div>
);
