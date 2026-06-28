import React, { useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Dashboard } from '../views/dashboards/types';
import { InlineTabCreator } from './InlineTabCreator';

interface DashboardTabsNavProps {
  tabs: Dashboard['tabs'];
  activeTabIdx: number;
  isEditing: boolean;
  isAddingTab: boolean;
  placeholder: string;
  addLabel: string;
  deleteLabel: string;
  renameLabel: string;
  onSelectTab: (index: number) => void;
  onDeleteTab: (index: number) => void;
  onRenameTab: (index: number, title: string) => void;
  onStartAddingTab: () => void;
  onAddTab: (title: string) => void;
  onCancelAddingTab: () => void;
}

export const DashboardTabsNav: React.FC<DashboardTabsNavProps> = ({
  tabs,
  activeTabIdx,
  isEditing,
  isAddingTab,
  placeholder,
  addLabel,
  deleteLabel,
  renameLabel,
  onSelectTab,
  onDeleteTab,
  onRenameTab,
  onStartAddingTab,
  onAddTab,
  onCancelAddingTab
}) => {
  const [editingTabIdx, setEditingTabIdx] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  const beginRename = (index: number, title: string) => {
    setEditingTabIdx(index);
    setTitleDraft(title);
    onSelectTab(index);
  };

  const submitRename = (event: React.FormEvent, index: number) => {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return;
    onRenameTab(index, nextTitle);
    setEditingTabIdx(null);
    setTitleDraft('');
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-border/40 pb-2">
      {tabs.map((tab, index) => (
        <div key={tab.id} className="group relative shrink-0">
          {editingTabIdx === index ? (
            <form className="flex items-center gap-1 rounded-t-xl border-b-2 border-primary bg-primary/5 px-2 py-2" onSubmit={(event) => submitRename(event, index)}>
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="w-36 rounded-lg border border-primary/30 bg-background px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground outline-none"
                aria-label={renameLabel}
              />
              <button type="submit" className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setEditingTabIdx(null)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab(index)}
              className={cn(
                "rounded-t-xl border-b-2 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] transition-all",
                activeTabIdx === index ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground/55 hover:bg-muted/30 hover:text-foreground"
              )}
            >
              {tab.title}
            </button>
          )}
          {isEditing && editingTabIdx !== index && (
            <button
              type="button"
              onClick={() => beginRename(index, tab.title)}
              className="absolute -right-1 top-6 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-100 shadow-sm transition-transform hover:scale-110 hover:text-primary"
              title={renameLabel}
              aria-label={`${renameLabel}: ${tab.title}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {isEditing && editingTabIdx !== index && (
            <button
              type="button"
              onClick={() => onDeleteTab(index)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-danger-foreground opacity-100 shadow-sm transition-transform hover:scale-110"
              title={deleteLabel}
              aria-label={`${deleteLabel}: ${tab.title}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {isAddingTab && (
        <InlineTabCreator placeholder={placeholder} onConfirm={onAddTab} onCancel={onCancelAddingTab} />
      )}
      {!isAddingTab && (
        <button
          type="button"
          onClick={onStartAddingTab}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          title={addLabel}
        >
          <Plus className="h-4 w-4" />
          <span>{addLabel}</span>
        </button>
      )}
    </div>
  );
};
