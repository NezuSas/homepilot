import { Suspense } from 'react';
import type { UserContext } from '../lib/useSession';
import type { View } from '../types';
import type { AssistantTurnCoordinator } from '../lib/assistantTurnCoordinator';
import { AssistantView, AuditLogsView, DashboardView, DashboardsView, DiagnosticsView, EnergyView, ExecutionLogsView, HomeAssistantSettingsView, HomePersonalizationView, HomeConversationView, InboxView, NativeCamerasView, ResilienceShowcaseView, RoutinesView, TopologyView, UsersView } from '../appRouteViews';
import type { SetupStatus } from '../appShellTypes';
import { OnboardingView } from '../views/OnboardingView';
import { LoadingState } from './ui/LoadingState';
import { PageFrame } from './ui/PageFrame';
import { useTranslation } from 'react-i18next';
import { getAppViewRouterLayout, getRoutineSection } from './appShellBoundaryHelpers';

export { getAppViewRouterLayout, getRoutineSection } from './appShellBoundaryHelpers';

interface AppViewRouterProps {
  currentView: View;
  currentPath: string;
  user: UserContext | null;
  displayName: string | null;
  canManageAutomations: boolean;
  dashboardId: string | null;
  tabId: string | null;
  setupStatus: SetupStatus | null;
  pendingPrompt: { id: string; text: string; interactionMode: 'voice' } | null;
  assistantTurnCoordinator: AssistantTurnCoordinator;
  onNavigate: (view: View) => void;
  onOpenOwnDashboardTab: (dashboardId: string, tabId: string) => void;
  onRoutineSectionChange: (section: 'scenes' | 'automations') => void;
  onOpenMobileMenu: () => void;
  onDashboardCatalogChange: (dashboards: Array<{ id: string; ownerId: string; title: string }>) => void;
  onDeviceAction: () => void;
  onOnboardingCompleted: () => void;
  onPendingPromptConsumed: (id: string) => void;
}

export function AppViewRouter(props: AppViewRouterProps) {
  const { t } = useTranslation();
  const layout = getAppViewRouterLayout(props.currentView);
  const fallback = <LoadingState label={t('common.loading')} className="min-h-screen-half" size="md" />;
  return <PageFrame immersive={layout.immersive} className={layout.pageClassName}><Suspense fallback={fallback}>
    {props.currentView === 'dashboard' && <DashboardView onActionExecute={props.onDeviceAction} onNavigate={props.onNavigate} displayName={props.displayName} currentUserId={props.user?.id ?? null} onOpenOwnDashboardTab={props.onOpenOwnDashboardTab} canManageAutomations={props.canManageAutomations} />}
    {props.currentView === 'spaces' && <TopologyView currentUser={props.user} />}
    {props.currentView === 'routines' && <RoutinesView section={getRoutineSection(props.currentPath, props.canManageAutomations)} canManageAutomations={props.canManageAutomations} onSectionChange={props.onRoutineSectionChange} onSceneActionExecute={props.onDeviceAction} currentUserId={props.user?.id ?? null} />}
    {props.currentView === 'assistant' && <AssistantView onNavigate={props.onNavigate} />}
    {props.currentView === 'resilience-showcase' && <ResilienceShowcaseView />}
    {props.currentView === 'dashboards' && <DashboardsView initialDashboardId={props.dashboardId} initialTabId={props.tabId} onOpenMobileMenu={props.onOpenMobileMenu} onDashboardCatalogChange={props.onDashboardCatalogChange} />}
    {props.currentView === 'energy' && <EnergyView onNavigate={props.onNavigate} />}
    {props.currentView === 'system-devices' && <InboxView mode="manager" />}{props.currentView === 'system-inbox' && <InboxView mode="discovery" />}{props.currentView === 'system-diagnostics' && <DiagnosticsView />}{props.currentView === 'system-audit' && <AuditLogsView />}{props.currentView === 'system-executions' && <ExecutionLogsView />}{props.currentView === 'system-ha' && <HomeAssistantSettingsView />}{props.currentView === 'system-cameras' && <NativeCamerasView />}
    {props.currentView === 'system-onboarding' && props.setupStatus && <OnboardingView statusProvider={props.setupStatus} userContext={props.user} onCompleted={props.onOnboardingCompleted} />}
    {props.currentView === 'system-users' && <UsersView currentUserId={props.user?.id ?? null} />}
    {props.currentView === 'system-home-personalization' && props.user?.role === 'admin' && <HomePersonalizationView />}
    {props.currentView === 'home-conversation' && <HomeConversationView pendingPrompt={props.pendingPrompt} assistantTurnCoordinator={props.assistantTurnCoordinator} onPendingPromptConsumed={props.onPendingPromptConsumed} />}
  </Suspense></PageFrame>;
}
