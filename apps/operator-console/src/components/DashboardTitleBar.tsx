import React from 'react';
import { Check, PenLine, Trash2, X } from 'lucide-react';

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
  onDelete
}) => (
  <div className="flex items-center justify-between gap-4">
    {isEditingTitle ? (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <input
          autoFocus
          className="text-2xl sm:text-3xl font-black bg-transparent border-b-2 border-primary outline-none flex-1 text-foreground py-1"
          value={draftTitle}
          onChange={event => onDraftTitleChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') onConfirmTitle();
            if (event.key === 'Escape') onCancelEditingTitle();
          }}
        />
        <button onClick={onConfirmTitle} className="p-2 text-primary"><Check className="w-5 h-5" /></button>
        <button onClick={onCancelEditingTitle} className="p-2 text-muted-foreground"><X className="w-5 h-5" /></button>
      </div>
    ) : (
      <div className="flex items-center gap-4 group flex-1">
        <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{title}</h3>
        <button onClick={onStartEditingTitle} className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-foreground transition-all"><PenLine className="w-4 h-4" /></button>
      </div>
    )}
    {!isEditingDashboard && (
      <button onClick={onDelete} className="p-3 bg-destructive/5 text-destructive rounded-2xl hover:bg-destructive hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
    )}
  </div>
);
