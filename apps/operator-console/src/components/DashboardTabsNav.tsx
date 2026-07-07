import React, { useState } from 'react';
import { BriefcaseBusiness, Check, Home, LayoutGrid, Pencil, Plus, X } from 'lucide-react';
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

  const iconForIndex = (index: number) => {
    if (index === 0) return Home;
    if (index === 1) return LayoutGrid;
    return BriefcaseBusiness;
  };

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
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-depth-1">
      <div className="flex min-h-14 items-center gap-1 overflow-x-auto no-scrollbar px-2 py-1.5">
        {tabs.map((tab, index) => {
          const Icon = iconForIndex(index);
          const isActive = activeTabIdx === index;
          return (
            <div key={tab.id} className="group relative shrink-0">
              {editingTabIdx === index ? (
                <form className="flex items-center gap-1 rounded-xl border border-primary/30 bg-background px-2 py-1.5" onSubmit={(event) => submitRename(event, index)}>
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    className="w-36 rounded-lg border border-primary/30 bg-background px-2 py-1 text-xs font-black text-foreground outline-none"
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
                    "flex min-w-24 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-all sm:min-w-28",
                    isActive
                      ? "border-primary/35 bg-primary/15 text-primary shadow-inner shadow-primary/10"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.title}</span>
                </button>
              )}
              {isEditing && editingTabIdx !== index && (
                <div className="absolute -right-1 -top-1 flex items-center gap-1 opacity-100">
                  <button
                    type="button"
                    onClick={() => beginRename(index, tab.title)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-transform hover:scale-110 hover:text-primary"
                    title={renameLabel}
                    aria-label={`${renameLabel}: ${tab.title}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTab(index)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-danger-foreground shadow-sm transition-transform hover:scale-110"
                    title={deleteLabel}
                    aria-label={`${deleteLabel}: ${tab.title}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {isAddingTab && (
          <InlineTabCreator placeholder={placeholder} onConfirm={onAddTab} onCancel={onCancelAddingTab} />
        )}
        {!isAddingTab && (
          <button
            type="button"
            onClick={onStartAddingTab}
            className={cn(
              "ml-1 flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-colors",
              isEditing
                ? "border-primary/30 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={addLabel}
            aria-label={addLabel}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{addLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
