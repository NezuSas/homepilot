import React, { useRef } from 'react';
import { Check, Download, HelpCircle, History, MoreVertical, PenLine, Plus, Trash2, Upload, X } from 'lucide-react';
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
  onExport: () => void;
  onImport: (file: File) => void;
  exportLabel: string;
  importLabel: string;
  historyLabel: string;
  onOpenHistory: () => void;
  isTransferring?: boolean;
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
  onExport,
  onImport,
  exportLabel,
  importLabel,
  historyLabel,
  onOpenHistory,
  isTransferring = false,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
  <div className="homepilot-dashboard-titlebar flex min-h-16 items-center justify-between gap-4 px-4 py-2 sm:px-6">
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
        <IconButton icon={PenLine} label={editLabel} onClick={onStartEditingTitle} variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex" />
      </div>
    )}
    <div className="flex shrink-0 items-center gap-2">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = '';
        }}
      />
    <div className="flex shrink-0 items-center gap-2 sm:hidden">
      <IconButton icon={History} label={historyLabel} onClick={onOpenHistory} variant="ghost" size="md" className="rounded-full" disabled={isTransferring} />
      <details className="relative">
        <summary aria-label={moreLabel} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground [&::-webkit-details-marker]:hidden"><MoreVertical className="h-5 w-5" /></summary>
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 min-w-44 rounded-panel border border-border/70 bg-card p-1.5 shadow-depth-3">
          <Button role="menuitem" variant="ghost" size="sm" onClick={onExport} className="w-full justify-start" disabled={isTransferring}><Download className="h-4 w-4" />{exportLabel}</Button>
          <Button role="menuitem" variant="ghost" size="sm" onClick={() => importInputRef.current?.click()} className="w-full justify-start" disabled={isTransferring}><Upload className="h-4 w-4" />{importLabel}</Button>
          <Button role="menuitem" variant="ghost" size="sm" onClick={onCreate} className="w-full justify-start"><Plus className="h-4 w-4" />{newLabel}</Button>
          <Button role="menuitem" variant="ghost" size="sm" onClick={onToggleEditing} className="w-full justify-start"><PenLine className="h-4 w-4" />{editLabel}</Button>
          <Button role="menuitem" variant="ghost" size="sm" onClick={onDelete} className="w-full justify-start text-danger hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" />{deleteLabel}</Button>
        </div>
      </details>
      {isEditingDashboard ? <Button type="button" onClick={onToggleEditing} variant="primary" size="sm" className="hidden rounded-full sm:inline-flex">{doneLabel}</Button> : null}
    </div>      <IconButton icon={Download} label={exportLabel} onClick={onExport} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" disabled={isTransferring} />
      <IconButton icon={Upload} label={importLabel} onClick={() => importInputRef.current?.click()} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" disabled={isTransferring} />
      <IconButton icon={History} label={historyLabel} onClick={onOpenHistory} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" disabled={isTransferring} />
      {isEditingDashboard ? (
        <>
          <IconButton icon={Plus} label={newLabel} onClick={onCreate} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" />
          <IconButton icon={HelpCircle} label={helpLabel} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" />
          <IconButton icon={MoreVertical} label={moreLabel} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" />
          <Button type="button" onClick={onToggleEditing} variant="primary" size="sm" className="hidden rounded-full sm:inline-flex">{doneLabel}</Button>
        </>
      ) : (
        <>
          <IconButton icon={PenLine} label={editLabel} onClick={onToggleEditing} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" />
          <IconButton icon={Plus} label={newLabel} onClick={onCreate} variant="ghost" size="md" className="hidden rounded-full sm:inline-flex" />
          <IconButton icon={Trash2} label={deleteLabel} onClick={onDelete} variant="danger" size="md" className="hidden rounded-full sm:inline-flex" />
        </>
      )}
    </div>
  </div>
  );
};
