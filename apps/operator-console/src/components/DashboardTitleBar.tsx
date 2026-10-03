import React, { useRef } from 'react';
import { Download, History, PenLine, Upload } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ActionMenu } from './ui/ActionMenu';

interface DashboardTitleBarProps {
  title: string;
  draftTitle: string;
  isEditingDashboard: boolean;
  onDraftTitleChange: (title: string) => void;
  onConfirmTitle: () => void;
  renameLabel: string;
  editLabel: string;
  doneLabel: string;
  moreLabel: string;
  onToggleEditing: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  exportLabel: string;
  importLabel: string;
  historyLabel: string;
  onOpenHistory: () => void;
  isTransferring?: boolean;
  editActions?: React.ReactNode;
}

export const DashboardTitleBar: React.FC<DashboardTitleBarProps> = ({
  title,
  draftTitle,
  isEditingDashboard,
  onDraftTitleChange,
  onConfirmTitle,
  renameLabel,
  editLabel,
  doneLabel,
  moreLabel,
  onToggleEditing,
  onExport,
  onImport,
  exportLabel,
  importLabel,
  historyLabel,
  onOpenHistory,
  isTransferring = false,
  editActions,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
  <div className="homepilot-dashboard-titlebar flex min-h-16 items-center justify-between gap-4 px-4 py-2 sm:px-6">
    {isEditingDashboard ? (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Input
          aria-label={renameLabel}
          containerClassName="min-w-0 flex-1"
          className="h-auto rounded-none border-0 border-b-2 border-primary bg-transparent px-0 py-1 text-panel-title font-semibold text-foreground shadow-none focus-visible:border-primary focus-visible:ring-0 focus-visible:shadow-none sm:text-view-title"
          value={draftTitle}
          onChange={event => onDraftTitleChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') onConfirmTitle();
          }}
        />
      </div>
    ) : (
      <div className="group flex min-w-0 flex-1 items-center gap-2">
        <h3 className="truncate text-section-title font-semibold tracking-tight text-foreground sm:text-panel-title">{title}</h3>
      </div>
    )}
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      {isEditingDashboard && editActions}
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
      {isEditingDashboard ? (
        <Button type="button" onClick={onToggleEditing} variant="primary" size="lg" className="rounded-full">{doneLabel}</Button>
      ) : null}
      <ActionMenu label={moreLabel} items={[
        ...(!isEditingDashboard ? [{ label: editLabel, icon: PenLine, onSelect: onToggleEditing }] : []),
        { label: exportLabel, icon: Download, onSelect: onExport, disabled: isTransferring },
        { label: importLabel, icon: Upload, onSelect: () => importInputRef.current?.click(), disabled: isTransferring },
        { label: historyLabel, icon: History, onSelect: onOpenHistory, disabled: isTransferring },
      ]} />
    </div>
  </div>
  );
};
