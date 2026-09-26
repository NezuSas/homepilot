import type { ReactNode } from 'react';

export interface SidebarDashboardEntry { id: string; ownerId: string; title: string; }

export interface AppSidebarNavigationProps {
  collapsed: boolean;
  dashboards: SidebarDashboardEntry[];
  children: ReactNode;
}

/**
 * Navigation boundary for the application shell. Its explicit contract keeps
 * sidebar state independent from the responsive drawer that hosts it.
 */
export function AppSidebarNavigation({ collapsed, dashboards, children }: AppSidebarNavigationProps) {
  return <nav className="flex min-h-0 flex-1 flex-col" data-sidebar-collapsed={collapsed || undefined} data-dashboard-count={dashboards.length}>{children}</nav>;
}
