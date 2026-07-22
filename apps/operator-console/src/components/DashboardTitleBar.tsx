import React from 'react';
import { Check, HelpCircle, MoreVertical, PenLine, Plus, Trash2, X } from 'lucide-react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';

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
  confirmLabel: string;
  cancelLabel: string;
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
  confirmLabel,
  cancelLabel,
  onToggleEditing,
  onCreate,
}) => (
  <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border/60 bg-card/95 px-4 py-2 shadow-depth-1 sm:px-6">
    {isEditingTitle ? (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Input
          autoFocus
          aria-label={editLabel}
          containerClassName="min-w-0 flex-1"
          className="h-auto rounded-none border-0 border-b-2 border-primary bg-transparent px-0 py-1 text-panel-title font-semibold text-foreground shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:shadow-none sm:text-view-title"
          value={draftTitle}
          onChange={event => onDraftTitleChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') onConfirmTitle();
            if (event.key === 'Escape') onCancelEditingTitle();
          }}
        />
        <IconButton icon={Check} label={confirmLabel} onClick={onConfirmTitle} variant="ghost" size="md" className="text-primary hover:text-primary" />
        <IconButton icon={X} label={cancelLabel} onClick={onCancelEditingTitle} variant="ghost" size="md" />
      </div>
    ) : (
      <div className="group flex min-w-0 flex-1 items-center gap-2">
        <h3 className="truncate text-section-title font-semibold tracking-tight text-foreground sm:text-panel-title">{title}</h3>
        <IconButton icon={PenLine} label={editLabel} onClick={onStartEditingTitle} variant="ghost" size="sm" className="rounded-full" />
      </div>
    )}
    <div className="flex shrink-0 items-center gap-2">
      {isEditingDashboard ? (
        <>
          <IconButton icon={Plus} label={newLabel} onClick={onCreate} variant="ghost" size="md" className="rounded-full" />
          <IconButton icon={HelpCircle} label={helpLabel} variant="ghost" size="md" className="rounded-full" />
          <IconButton icon={MoreVertical} label={moreLabel} variant="ghost" size="md" className="rounded-full" />
          <Button type="button" onClick={onToggleEditing} variant="primary" size="sm" className="rounded-full">{doneLabel}</Button>
        </>
      ) : (
        <>
          <IconButton icon={PenLine} label={editLabel} onClick={onToggleEditing} variant="ghost" size="md" className="rounded-full" />
          <IconButton icon={Plus} label={newLabel} onClick={onCreate} variant="ghost" size="md" className="rounded-full" />
          <IconButton icon={Trash2} label={deleteLabel} onClick={onDelete} variant="danger" size="md" className="rounded-full" />
        </>
      )}
    </div>
  </div>
);
