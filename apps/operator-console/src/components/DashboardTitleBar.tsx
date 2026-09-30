import React, { useRef } from 'react';
import { Check, Download, History, MoreVertical, PenLine, Upload, X } from 'lucide-react';
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
  renameLabel: string;
  editLabel: string;
  doneLabel: string;
  moreLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  onToggleEditing: () => void;
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
  renameLabel,
  editLabel,
  doneLabel,
  moreLabel,
  confirmLabel,
  cancelLabel,
  onToggleEditing,
  onExport,
  onImport,
  exportLabel,
  importLabel,
  historyLabel,
  onOpenHistory,
  isTransferring = false,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const overflowDetailsRef = useRef<HTMLDetailsElement>(null);
  const closeOverflow = () => { if (overflowDetailsRef.current) overflowDetailsRef.current.open = false; };

  return (
  <div className="homepilot-dashboard-titlebar flex min-h-16 items-center justify-between gap-4 px-4 py-2 sm:px-6">
    {isEditingTitle ? (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Input
          autoFocus
          aria-label={renameLabel}
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
        <IconButton icon={PenLine} label={renameLabel} onClick={onStartEditingTitle} variant="ghost" size="lg" className="rounded-full" />
      </div>
    )}
    {!isEditingTitle && <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
      <IconButton icon={Download} label={exportLabel} onClick={onExport} variant="ghost" size="lg" className="hidden rounded-full xl:inline-flex" disabled={isTransferring} />
      <IconButton icon={Upload} label={importLabel} onClick={() => importInputRef.current?.click()} variant="ghost" size="lg" className="hidden rounded-full xl:inline-flex" disabled={isTransferring} />
      <IconButton icon={History} label={historyLabel} onClick={onOpenHistory} variant="ghost" size="lg" className="hidden rounded-full xl:inline-flex" disabled={isTransferring} />
      {isEditingDashboard ? (
        <Button type="button" onClick={onToggleEditing} variant="primary" size="lg" className="rounded-full">{doneLabel}</Button>
      ) : (
        <>
          <IconButton icon={PenLine} label={editLabel} onClick={onToggleEditing} variant="ghost" size="lg" className="rounded-full" />
        </>
      )}
      <details ref={overflowDetailsRef} className="relative xl:hidden">
        <summary aria-label={moreLabel} className="grid h-11 w-11 cursor-pointer touch-manipulation place-items-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden"><MoreVertical className="h-5 w-5" /></summary>
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 min-w-48 rounded-panel border border-border/70 bg-card p-1.5 shadow-depth-3">
          <Button role="menuitem" variant="ghost" size="md" onClick={() => { closeOverflow(); onExport(); }} className="min-h-11 w-full justify-start" disabled={isTransferring}><Download className="h-4 w-4" />{exportLabel}</Button>
          <Button role="menuitem" variant="ghost" size="md" onClick={() => { closeOverflow(); importInputRef.current?.click(); }} className="min-h-11 w-full justify-start" disabled={isTransferring}><Upload className="h-4 w-4" />{importLabel}</Button>
          <Button role="menuitem" variant="ghost" size="md" onClick={() => { closeOverflow(); onOpenHistory(); }} className="min-h-11 w-full justify-start" disabled={isTransferring}><History className="h-4 w-4" />{historyLabel}</Button>
        </div>
      </details>
    </div>}
  </div>
  );
};
