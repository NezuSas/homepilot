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
  onSelectTab,
  onDeleteTab,
  onStartAddingTab,
  onAddTab,
  onCancelAddingTab
}) => (
  <div className="flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-border/40 pb-0">
    {tabs.map((tab, index) => (
      <button
        key={tab.id}
        onClick={() => onSelectTab(index)}
        className={cn(
          "px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 relative",
          activeTabIdx === index ? "text-primary border-primary bg-primary/[0.02]" : "text-muted-foreground/40 border-transparent hover:text-muted-foreground hover:bg-muted/20"
        )}
      >
        {tab.title}
        {isEditing && tabs.length > 1 && (
          <div onClick={(event) => { event.stopPropagation(); onDeleteTab(index); }} className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform">
            <X className="w-2 h-2" />
          </div>
        )}
      </button>
    ))}
    <button onClick={onStartAddingTab} className="px-4 text-muted-foreground/30 hover:text-primary transition-colors"><Plus className="w-4 h-4" /></button>
    {isAddingTab && (
      <InlineTabCreator placeholder={placeholder} onConfirm={onAddTab} onCancel={onCancelAddingTab} />
    )}
  </div>
);
