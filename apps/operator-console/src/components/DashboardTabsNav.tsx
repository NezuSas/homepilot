import React from 'react';
import { BriefcaseBusiness, Home, LayoutGrid, Pencil, Plus } from 'lucide-react';
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
  configureLabel: string;
  onSelectTab: (index: number) => void;
  onConfigureTab: (index: number) => void;
  onStartAddingTab: () => void;
  onAddTab: (title: string) => void;
  onCancelAddingTab: () => void;
  onToggleEditing?: () => void;
  editLabel?: string;
}

export const DashboardTabsNav: React.FC<DashboardTabsNavProps> = ({
  tabs,
  activeTabIdx,
  isEditing,
  isAddingTab,
  placeholder,
  addLabel,
  configureLabel,
  onSelectTab,
  onConfigureTab,
  onStartAddingTab,
  onAddTab,
  onCancelAddingTab,
  onToggleEditing,
  editLabel
}) => {
  const iconForIndex = (index: number) => {
    if (index === 0) return Home;
    if (index === 1) return LayoutGrid;
    return BriefcaseBusiness;
  };

  return (
    <div className="border-b border-border/60">
      <div className="flex min-h-12 items-center gap-0 overflow-x-auto no-scrollbar px-3">
        {tabs.map((tab, index) => {
          const Icon = iconForIndex(index);
          const isActive = activeTabIdx === index;
          return (
            <div key={tab.id} className="group flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onSelectTab(index)}
                  className={cn(
                    "flex h-14 min-w-20 items-center justify-center gap-2 border-b-2 px-3 text-xs font-black transition-all sm:min-w-28",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.title}</span>
                </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(index);
                    onConfigureTab(index);
                  }}
                  className={cn(
                    "mr-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-primary",
                    isActive && "bg-primary/15 text-primary"
                  )}
                  aria-label={`${configureLabel}: ${tab.title}`}
                  title={configureLabel}
                >
                  <Pencil className="h-4 w-4" />
                </button>
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
              "ml-1 flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-[10px] font-black uppercase tracking-widest transition-colors",
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
        
        {/* Fill available space to push the edit button to the right */}
        <div className="flex-1" />

        {/* Edit Button (HA Style) when not editing */}
        {!isEditing && onToggleEditing && (
          <button
            type="button"
            onClick={onToggleEditing}
            className="ml-auto mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-primary"
            title={editLabel}
            aria-label={editLabel}
          >
            <Pencil className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};
