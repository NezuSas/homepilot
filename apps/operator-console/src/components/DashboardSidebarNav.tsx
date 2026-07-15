import React from 'react';
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Dashboard } from '../views/dashboards/types';

interface DashboardSidebarNavProps {
  dashboards: Dashboard[];
  activeDashboardId?: string;
  title: string;
  onSelect: (dashboard: Dashboard) => void;
}

export const DashboardSidebarNav: React.FC<DashboardSidebarNavProps> = ({
  dashboards,
  activeDashboardId,
  title,
  onSelect
}) => (
  <nav className="flex flex-col gap-3 rounded-panel border border-border/60 bg-card/55 p-3 shadow-depth-1 lg:sticky lg:top-4">
    <div className="flex items-center justify-between gap-3 px-2 py-1">
      <p className="text-micro font-black uppercase tracking-label text-muted-foreground/60">{title}</p>
      <span className="rounded-full bg-primary/10 px-2 py-1 text-micro font-black text-primary">{dashboards.length}</span>
    </div>
    <div className="flex flex-col gap-2">
      {dashboards.map(dashboard => {
        const isActive = activeDashboardId === dashboard.id;
        return (
          <button
            key={dashboard.id}
            onClick={() => onSelect(dashboard)}
            className={cn(
              'group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-300',
              isActive
                ? 'bg-primary/5 border-primary/20 shadow-inner'
                : 'bg-card border-border/40 hover:bg-muted/40 hover:border-border'
            )}
          >
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
              isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground/30 group-hover:scale-110'
            )}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className={cn('flex-1 text-body font-bold truncate', isActive ? 'text-primary' : 'text-foreground')}>{dashboard.title}</span>
            {isActive && <ChevronRight className="w-4 h-4 text-primary/30" />}
          </button>
        );
      })}
    </div>
  </nav>
);
