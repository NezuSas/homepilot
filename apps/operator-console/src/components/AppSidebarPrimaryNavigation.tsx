import { BarChart2, ChevronDown, ChevronRight, Home, LayoutDashboard, Settings } from 'lucide-react';
import { Button } from './ui/Button';
import { SidebarItem } from './ui/SidebarItem';
import { cn } from '../lib/utils';
import type { View } from '../types';
import type { SidebarDashboardEntry } from './AppSidebarNavigation';
import { primarySidebarNavigation, systemSidebarNavigation } from './appSidebarNavigationConfig';

interface AppSidebarPrimaryNavigationProps {
  currentView: View;
  collapsed: boolean;
  dashboards: SidebarDashboardEntry[];
  selectedDashboardId: string | null;
  isDashboardsExpanded: boolean;
  isSystemExpanded: boolean;
  isCollapsedSystemSubmenuHidden: boolean;
  canAccessDashboards: boolean;
  canAccessFamilyControl: boolean;
  canAccessAdminControl: boolean;
  canAccessSystem: boolean;
  isAdmin: boolean;
  assistantOpenCount: number;
  translate: (key: string) => string;
  onNavigate: (view: View) => void;
  onNavigatePath: (path: string) => void;
  onRefreshDashboards: () => void;
  onDashboardsExpandedChange: (expanded: boolean | ((current: boolean) => boolean)) => void;
  onSystemExpandedChange: (expanded: boolean | ((current: boolean) => boolean)) => void;
  onCollapsedSystemSubmenuHiddenChange: (hidden: boolean | ((current: boolean) => boolean)) => void;
  onCloseMobileSidebar: () => void;
  getDashboardPath: (dashboardId: string) => string;
}

function canShowPrimaryItem(item: typeof primarySidebarNavigation[number], props: AppSidebarPrimaryNavigationProps) {
  if (item.requires === 'family') return props.canAccessFamilyControl;
  if (item.requires === 'admin') return props.canAccessAdminControl;
  return true;
}

/**
 * The interactive part of the sidebar stays isolated from App's session and
 * shell orchestration. Every navigation affordance keeps the same role gate
 * and collapsed-rail behavior regardless of the shell that hosts it.
 */
export function AppSidebarPrimaryNavigation(props: AppSidebarPrimaryNavigationProps) {
  const activeDashboardsSection = props.currentView === 'dashboards';
  const activeSystemSection = props.currentView.startsWith('system-');
  const showSystemChildren = props.collapsed ? !props.isCollapsedSystemSubmenuHidden : props.isSystemExpanded;

  return <div className={cn('flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-3 custom-scrollbar transition-all duration-300', props.collapsed && 'sidebar-collapsed-rail xl:gap-1 xl:px-2 xl:py-2')}>
    <div className="flex flex-col gap-0.5">
      {primarySidebarNavigation.filter((item) => item.view === 'dashboard').map((item) => <SidebarItem key={item.view} icon={Home} label={props.translate(item.labelKey)} active={props.currentView === item.view} onClick={() => props.onNavigate(item.view)} id="demo-nav-dashboard" data-demo="nav-dashboard" collapsedOnDesktop={props.collapsed} />)}

      {props.canAccessDashboards && <>
        <Button type="button" onClick={() => {
          if (props.collapsed) {
            props.onRefreshDashboards();
            props.onNavigate('dashboards');
            return;
          }
          props.onDashboardsExpandedChange((current) => {
            const next = !current;
            if (next) props.onRefreshDashboards();
            return next;
          });
        }} aria-expanded={props.isDashboardsExpanded} variant="ghost" size="sm" className={cn('group relative h-auto w-full justify-start gap-2.5 rounded-xl px-3 py-2 text-left text-body-compact', activeDashboardsSection && !props.collapsed ? 'sidebar-item-active text-primary' : 'interactive-lift text-muted-foreground hover:bg-muted/50 hover:text-foreground', props.collapsed && 'xl:h-11 xl:flex-none xl:justify-center xl:px-2 xl:py-2')} title={props.collapsed ? props.translate('nav.dashboards') : undefined}>
          <div className={cn('surface-transition flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', activeDashboardsSection && !props.collapsed ? 'bg-primary/15 text-primary' : 'text-muted-foreground/70 group-hover:text-foreground')}><BarChart2 className="h-4 w-4 shrink-0" /></div>
          <span className={cn('sidebar-nav-label flex-1 min-w-0 overflow-hidden text-left tracking-tight transition-[opacity,width] duration-200', activeDashboardsSection && !props.collapsed && 'text-primary', props.collapsed && 'xl:hidden')}>{props.translate('nav.dashboards')}</span>
          {!props.collapsed && (props.isDashboardsExpanded ? <ChevronDown className="h-4 w-4 opacity-60" /> : <ChevronRight className="h-4 w-4 opacity-60" />)}
        </Button>
        {(props.isDashboardsExpanded || props.collapsed) && <div className={cn('mt-1 ml-5 flex flex-col gap-1 border-l-2 border-border/40 pl-2', props.collapsed && 'xl:mt-0 xl:ml-1 xl:gap-0.5 xl:border-l xl:pl-1')}>
          {props.dashboards.length === 0 ? (!props.collapsed && <span className="px-3 py-2 text-caption font-semibold text-muted-foreground/60">{props.translate('dashboards.sidebar_empty')}</span>) : props.dashboards.map((dashboard) => <SidebarItem key={dashboard.id} icon={LayoutDashboard} label={dashboard.title} active={props.currentView === 'dashboards' && props.selectedDashboardId === dashboard.id} onClick={() => { props.onNavigatePath(props.getDashboardPath(dashboard.id)); props.onCloseMobileSidebar(); props.onDashboardsExpandedChange(true); }} nested collapsedOnDesktop={props.collapsed} />)}
        </div>}
      </>}

      {primarySidebarNavigation.filter((item) => item.view !== 'dashboard').filter((item) => canShowPrimaryItem(item, props)).map((item) => <SidebarItem key={item.view} icon={item.icon} label={props.translate(item.labelKey)} active={props.currentView === item.view} onClick={() => props.onNavigate(item.view)} badge={item.view === 'assistant' && props.assistantOpenCount > 0 ? <span className="rounded bg-primary px-1.5 py-0.5 text-micro font-black text-primary-foreground">{props.assistantOpenCount}</span> : undefined} data-demo={item.view === 'routines' ? 'nav-routines' : item.view === 'home-conversation' ? 'nav-home-conversation' : item.view === 'resilience-showcase' ? 'nav-resilience' : undefined} collapsedOnDesktop={props.collapsed} />)}
    </div>

    {props.canAccessSystem && <div className="flex flex-col gap-0.5">
      <Button type="button" onClick={() => { if (props.collapsed) { props.onCollapsedSystemSubmenuHiddenChange((hidden) => !hidden); return; } props.onSystemExpandedChange((current) => !current); }} aria-expanded={props.collapsed ? !props.isCollapsedSystemSubmenuHidden : props.isSystemExpanded} variant="ghost" size="sm" className={cn('group relative h-auto w-full justify-start gap-2.5 rounded-xl px-3 py-2 text-left text-body-compact', activeSystemSection && !props.collapsed ? 'sidebar-item-active text-primary' : 'interactive-lift text-muted-foreground hover:bg-muted/50 hover:text-foreground', props.collapsed && 'xl:h-11 xl:flex-none xl:justify-center xl:px-2 xl:py-2')} title={props.collapsed ? props.translate('nav.system') : undefined}>
        <div className={cn('surface-transition flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', activeSystemSection && !props.collapsed ? 'bg-primary/15 text-primary' : 'text-muted-foreground/70 group-hover:text-foreground')}><Settings className="h-4 w-4 shrink-0" /></div>
        <span className={cn('sidebar-nav-label flex-1 min-w-0 overflow-hidden text-left tracking-tight transition-[opacity,width] duration-200', activeSystemSection && !props.collapsed && 'text-primary', props.collapsed && 'xl:hidden')}>{props.translate('nav.system')}</span>
        {!props.collapsed && (props.isSystemExpanded ? <ChevronDown className="h-4 w-4 opacity-60" /> : <ChevronRight className="h-4 w-4 opacity-60" />)}
      </Button>
      {showSystemChildren && <div className={cn('mt-1 ml-5 flex flex-col gap-1 border-l-2 border-border/40 pl-2', props.collapsed && 'xl:mt-0 xl:ml-1 xl:gap-0.5 xl:border-l xl:pl-1')}>
        {systemSidebarNavigation.filter((item) => item.requires !== 'admin-role' || props.isAdmin).map((item) => <SidebarItem key={item.view} icon={item.icon} label={props.translate(item.labelKey)} active={props.currentView === item.view} onClick={() => props.onNavigate(item.view)} nested collapsedOnDesktop={props.collapsed} />)}
      </div>}
    </div>}
  </div>;
}
