import React from 'react';
import { Plus, X } from 'lucide-react';
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
  onSelectTab: (index: number) => void;
  onDeleteTab: (index: number) => void;
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
  onSelectTab,
  onDeleteTab,
  onStartAddingTab,
  onAddTab,
  onCancelAddingTab
}) => (
  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-border/40 pb-2">
    {tabs.map((tab, index) => (
      <div key={tab.id} className="group relative shrink-0">
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
        {isEditing && tabs.length > 1 && (
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
