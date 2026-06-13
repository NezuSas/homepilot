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
  <nav className="flex flex-col gap-3">
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 px-2 mb-2">{title}</p>
    <div className="flex flex-col gap-2">
      {dashboards.map(dashboard => {
        const isActive = activeDashboardId === dashboard.id;
        return (
          <button
            key={dashboard.id}
            onClick={() => onSelect(dashboard)}
            className={cn(
              'group flex items-center gap-4 p-4 rounded-3xl text-left transition-all duration-300 border',
              isActive
                ? 'bg-primary/5 border-primary/20 shadow-inner'
                : 'bg-card border-border/40 hover:bg-muted/40 hover:border-border'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300',
              isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground/30 group-hover:scale-110'
            )}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className={cn('flex-1 text-sm font-bold truncate', isActive ? 'text-primary' : 'text-foreground')}>{dashboard.title}</span>
            {isActive && <ChevronRight className="w-4 h-4 text-primary/30" />}
          </button>
        );
      })}
    </div>
  </nav>
);
