import { Activity, Camera, LayoutDashboard, MessageSquare, Monitor, Network, Server, Settings, ShieldAlert, ShieldCheck, Sparkles, TabletSmartphone, Users, Zap } from 'lucide-react';
import type { View } from '../types';

export interface SidebarNavigationItem { view: View; labelKey: string; icon: typeof Activity; requires?: 'family' | 'admin' | 'system' | 'admin-role'; }

export const primarySidebarNavigation: SidebarNavigationItem[] = [
  { view: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { view: 'spaces', labelKey: 'nav.spaces', icon: LayoutDashboard },
  { view: 'routines', labelKey: 'nav.routines', icon: Zap, requires: 'family' },
  { view: 'home-conversation', labelKey: 'nav.talk_to_home', icon: MessageSquare },
  { view: 'assistant', labelKey: 'nav.assistant', icon: Sparkles, requires: 'family' },
  { view: 'energy', labelKey: 'nav.energy', icon: Zap, requires: 'admin' },
  { view: 'resilience-showcase', labelKey: 'nav.resilience_showcase', icon: ShieldCheck },
];

export const systemSidebarNavigation: SidebarNavigationItem[] = [
  { view: 'system-devices', labelKey: 'nav.system_devices', icon: Network }, { view: 'system-inbox', labelKey: 'nav.system_inbox', icon: Server }, { view: 'system-diagnostics', labelKey: 'nav.system_diagnostics', icon: Activity }, { view: 'system-audit', labelKey: 'nav.system_audit', icon: ShieldAlert }, { view: 'system-executions', labelKey: 'nav.system_executions', icon: Activity }, { view: 'system-users', labelKey: 'nav.system_users', icon: Users, requires: 'admin-role' }, { view: 'system-ha', labelKey: 'nav.system_ha', icon: Settings }, { view: 'system-cameras', labelKey: 'nav.system_cameras', icon: Camera }, { view: 'system-displays', labelKey: 'nav.system_displays', icon: TabletSmartphone, requires: 'admin-role' }, { view: 'system-onboarding', labelKey: 'nav.system_onboarding', icon: Monitor },
];
