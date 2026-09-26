import { cn } from '../lib/utils';
import type { View } from '../types';

export function getAppSidebarShellClassName(isOpen: boolean, isDesktopOpen: boolean) {
  return cn(
    'fixed inset-y-0 left-0 z-[50] flex shrink-0 flex-col border-r border-border/60 bg-card transition-all duration-300 ease-in-out',
    isOpen ? 'w-72 translate-x-0 shadow-sidebar-open' : 'w-72 -translate-x-full',
    'xl:relative',
    isDesktopOpen ? 'xl:w-sidebar-expanded xl:translate-x-0' : 'xl:w-sidebar-collapsed xl:translate-x-0 xl:overflow-hidden',
  );
}

export function isGlobalWakeListenerEnabled(authenticated: boolean, loadingSetup: boolean, requiresOnboarding: boolean) {
  return authenticated && !loadingSetup && !requiresOnboarding;
}

export function getAppViewRouterLayout(view: View) {
  return {
    immersive: view === 'home-conversation' || view === 'dashboards',
    pageClassName: view === 'home-conversation' ? 'h-full' : undefined,
  };
}

export function getRoutineSection(currentPath: string, canManageAutomations: boolean) {
  return canManageAutomations && (currentPath === '/automations' || currentPath === '/routines/automations') ? 'automations' : 'scenes';
}
