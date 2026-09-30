import { lazy } from 'react';

export const DashboardView = lazy(() => import('./views/DashboardView').then(module => ({ default: module.DashboardView })));
export const TopologyView = lazy(() => import('./views/TopologyView').then(module => ({ default: module.TopologyView })));
export const InboxView = lazy(() => import('./views/InboxView').then(module => ({ default: module.InboxView })));
export const AuditLogsView = lazy(() => import('./views/AuditLogsView').then(module => ({ default: module.AuditLogsView })));
export const HomeAssistantSettingsView = lazy(() => import('./views/HomeAssistantSettingsView').then(module => ({ default: module.HomeAssistantSettingsView })));
export const HomePersonalizationView = lazy(() => import('./views/HomePersonalizationView').then(module => ({ default: module.HomePersonalizationView })));
export const DiagnosticsView = lazy(() => import('./views/DiagnosticsView').then(module => ({ default: module.DiagnosticsView })));
export const UsersView = lazy(() => import('./views/UsersView').then(module => ({ default: module.UsersView })));
export const RoutinesView = lazy(() => import('./views/RoutinesView'));
export const AssistantView = lazy(() => import('./views/AssistantView').then(module => ({ default: module.AssistantView })));
export const DashboardsView = lazy(() => import('./views/DashboardsView').then(module => ({ default: module.DashboardsView })));
export const ResilienceShowcaseView = lazy(() => import('./views/ResilienceShowcaseView'));
export const EnergyView = lazy(() => import('./views/EnergyView').then(module => ({ default: module.EnergyView })));
export const ExecutionLogsView = lazy(() => import('./views/ExecutionLogsView').then(module => ({ default: module.ExecutionLogsView })));
export const HomeConversationView = lazy(() => import('./views/HomeConversationView').then(module => ({ default: module.HomeConversationView })));
export const NativeCamerasView = lazy(() => import('./views/NativeCamerasView').then(module => ({ default: module.NativeCamerasView })));
