import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils';
import { useAutomaticTheme } from './lib/useAutomaticTheme';
import { API_BASE_URL } from './config';
import { apiFetch } from './lib/apiClient';
import { getAppAccessControl } from './lib/accessControl';
import { useSession } from './lib/useSession';
import { useHomeIdleReturn } from './lib/useHomeIdleReturn';
import { useDirectorySsoHandoff } from './lib/useDirectorySsoHandoff';
import { useDashboardRoute, getDashboardPath } from './lib/useDashboardRoute';
import { useSidebarDashboards } from './lib/useSidebarDashboards';
import { useSetupStatus } from './lib/useSetupStatus';
import { useRealtimeRefresh } from './lib/useRealtimeRefresh';
import { useGlobalWake } from './lib/useGlobalWake';
import { useMobileSidebarSwipe } from './lib/mobileSidebarSwipe';
import { readStoredProfile } from './lib/storedProfile';
import { dashboardTabPath, isSystemView, pathToView, resolveView, viewToPath } from './lib/viewNavigation';
import { LoginView } from './views/LoginView';
import { FirstAdminSetupView } from './views/FirstAdminSetupView';
import type { View } from './types';
import { useAppShellStore } from './stores/useAppShellStore';
import { useAssistantStore } from './stores/useAssistantStore';
import { useDeviceSnapshotStore } from './stores/useDeviceSnapshotStore';
import { useDemoGuideStore } from './stores/useDemoGuideStore';
import { getAppDemoSteps } from './config/appDemoSteps';
import { useInstalledFeatures } from './lib/useInstalledFeatures';
import { resolveVisibleView } from './lib/installedFeatures';
import { AppSidebarFooter } from './components/AppSidebarFooter';
import { AppSidebarBrand } from './components/AppSidebarBrand';
import { MobileSidebarToggle } from './components/MobileSidebarToggle';
import { AppOfflineBanner } from './components/AppOfflineBanner';
import { MobileSidebarBackdrop } from './components/MobileSidebarBackdrop';
import { AppViewRouter } from './components/AppViewRouter';
import { AppGlobalOverlays } from './components/AppGlobalOverlays';
import { AppSidebarShell } from './components/AppSidebarShell';
import { AppSidebarNavigation } from './components/AppSidebarNavigation';
import { AppSidebarPrimaryNavigation } from './components/AppSidebarPrimaryNavigation';
import { OnboardingScreen, SessionCheckScreen, SetupLoadingScreen } from './components/AppBootScreens';
import { invalidateDashboardCatalog } from './views/dashboards/dashboardOperations';
import { invalidateDiagnosticCatalog } from './lib/diagnosticResourceRequests';

/**
 * App shell: session gate, sidebar and the routed view. Each concern lives in
 * its own hook or component (`lib/use*`, `components/App*`); this file only
 * composes them.
 *
 * Views: dashboard | spaces | routines | assistant (primary), dashboards | energy
 * (personalization), system-* (system). Old aliases resolve through `resolveView`.
 */
function App() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const mainScrollRef = useRef<HTMLElement>(null);
  const resetMainScroll = useCallback(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  // The URL is the source of truth for navigation (reload/back/forward/share
  // all just work), instead of plain component state that resets on reload.
  const requestedView = useMemo(() => pathToView(location.pathname), [location.pathname]);
  const { dashboardId: urlDashboardId, tabId: urlTabId, lastTabRef } = useDashboardRoute(location.pathname);
  const [showPwdModal, setShowPwdModal] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => (
    !window.matchMedia('(pointer: coarse) and (max-width: 1366px)').matches
  ));
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);
  const [isCollapsedSystemSubmenuHidden, setIsCollapsedSystemSubmenuHidden] = useState(false);
  const [isDashboardsExpanded, setIsDashboardsExpanded] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [localProfile, setLocalProfile] = useState(() => readStoredProfile());
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const sidebarSwipe = useMobileSidebarSwipe(closeSidebar);

  const resetAppShellState = useAppShellStore((state) => state.resetAppShellState);
  const resetAssistantState = useAssistantStore((state) => state.resetAssistantState);
  const resetSnapshotState = useDeviceSnapshotStore((state) => state.resetSnapshotState);

  const theme = useAppShellStore((state) => state.theme);
  const keepDashboard = useAppShellStore((state) => state.keepDashboard);
  useAutomaticTheme();
  const setTheme = useAppShellStore((state) => state.setTheme);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // ─── Session ──────────────────────────────────────────────────────────
  const onSessionCleared = useCallback(() => {
    resetAppShellState();
    resetAssistantState();
    resetSnapshotState();
    invalidateDashboardCatalog();
    invalidateDiagnosticCatalog();
  }, [resetAppShellState, resetAssistantState, resetSnapshotState]);

  const { status, user, handleLoginSuccess, handleLogout, clearSession, validateSession } = useSession(onSessionCleared);
  const installedFeatures = useInstalledFeatures(status === 'authenticated');
  const currentView = resolveVisibleView(requestedView, installedFeatures);
  const demoSteps = useMemo(() => getAppDemoSteps(installedFeatures.homeChat), [installedFeatures.homeChat]);
  // A bookmarked or shared link to a view this installation does not have lands on the home dashboard.
  useEffect(() => {
    if (requestedView !== currentView) navigate('/', { replace: true });
  }, [requestedView, currentView, navigate]);

  useEffect(() => {
    if (status === 'checking') {
      validateSession();
    }
  }, [status, validateSession]);

  const returnHome = useCallback(() => {
    resetMainScroll();
    navigate('/', { replace: true });
  }, [navigate, resetMainScroll]);
  const keepsDashboardOpen = keepDashboard && currentView === 'dashboards' && Boolean(urlDashboardId);
  useHomeIdleReturn(status === 'authenticated' && currentView !== 'dashboard' && !keepsDashboardOpen, returnHome);

  const leaveLogin = useCallback(() => navigate('/', { replace: true }), [navigate]);
  const { linkToken: directorySsoToken, hasError: directorySsoError } = useDirectorySsoHandoff({
    onLinkedSession: handleLoginSuccess,
    onDone: leaveLogin,
  });

  const { setupStatus, loadingSetup, isBackendOffline, markOnboardingCompleted } = useSetupStatus(status);

  // ─── Data kept fresh while signed in ──────────────────────────────────
  useRealtimeRefresh(status);
  const assistantSummary = useAppShellStore((state) => state.assistantSummary);
  const refreshAssistantSummary = useAppShellStore((state) => state.refreshAssistantSummary);
  const pulseSyncStatus = useAppShellStore((state) => state.pulseSyncStatus);
  const refreshDeviceSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const startDemo = useDemoGuideStore((state) => state.startDemo);

  const {
    canAccessFamilyControl,
    canAccessAdminControl,
    canAccessDashboards,
    canAccessSystem,
  } = getAppAccessControl(user?.role);

  const {
    dashboards: sidebarDashboards,
    setDashboards: setSidebarDashboards,
    refresh: refreshSidebarDashboards,
  } = useSidebarDashboards({
    canAccessDashboards,
    currentView,
    urlDashboardId,
    userId: user?.id,
    lastTabRef,
  });

  useEffect(() => {
    if (status === 'authenticated') {
      refreshAssistantSummary();
      void refreshSidebarDashboards();
    }
  }, [status, refreshAssistantSummary, refreshSidebarDashboards]);

  // Sync localProfile with session user when it changes (e.g. after validation)
  useEffect(() => {
    if (user) {
      setLocalProfile({
        displayName: user.displayName ?? null,
        avatarDataUri: user.avatarDataUri ?? null,
      });
    }
  }, [user]);

  const wake = useGlobalWake({
    currentView,
    onExecutionSucceeded: () => { void refreshDeviceSnapshot(); },
  });

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
  };

  const onLogout = useCallback(async () => {
    await handleLogout(async () => {
      await apiFetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST' });
    });
  }, [handleLogout]);

  const handlePasswordChanged = useCallback(() => {
    clearSession();
    setShowPwdModal(false);
  }, [clearSession]);

  if (status === 'checking') return <SessionCheckScreen />;

  if (status === 'unauthenticated') {
    if (loadingSetup) return <SetupLoadingScreen />;

    if (setupStatus && !setupStatus.hasAdminUser) {
      return <FirstAdminSetupView onCompleted={handleLoginSuccess} />;
    }

    return <LoginView onLoginSuccess={handleLoginSuccess} ssoLinkToken={directorySsoToken} ssoError={directorySsoError} />;
  }

  if (loadingSetup) return <SetupLoadingScreen />;

  // Si requiere onboarding (no inicializado), bloqueamos todo el sidebar y forzamos onboarding.
  if (setupStatus?.requiresOnboarding) {
    return <OnboardingScreen setupStatus={setupStatus} user={user} onCompleted={markOnboardingCompleted} />;
  }

  const navigateTo = (view: View) => {
    const resolved = resolveView(view);
    navigate(viewToPath(view === 'scenes' || view === 'automations' ? view : resolved));
    setIsSidebarOpen(false);
    // Auto-expand system section when a system view is activated
    if (isSystemView(resolved)) {
      setIsSystemExpanded(true);
    }
    if (resolved === 'dashboards') setIsDashboardsExpanded(true);
  };

  const navigateFromSidebar = (view: View) => {
    resetMainScroll();
    navigateTo(view);
  };

  const navigatePathFromSidebar = (path: string) => {
    resetMainScroll();
    navigate(path);
  };

  const isDesktopSidebarCollapsed = !isDesktopSidebarOpen;
  const isSidebarContentCollapsed = isDesktopSidebarCollapsed && !isSidebarOpen;

  return (
    <div
      className="flex min-h-screen-dvh w-full overflow-x-hidden bg-background text-foreground antialiased selection:bg-primary/10 transition-all duration-1000 xl:h-screen-dvh xl:overflow-hidden"
    >

      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && <MobileSidebarBackdrop onDismiss={closeSidebar} />}

      {/* Sidebar (Responsive Drawer on Mobile, Collapsible on Desktop) */}
      <AppSidebarShell
        isOpen={isSidebarOpen}
        isDesktopOpen={isDesktopSidebarOpen}
        onPointerDown={sidebarSwipe.onPointerDown}
        onPointerUp={sidebarSwipe.onPointerUp}
        onPointerCancel={sidebarSwipe.onPointerCancel}
      >
        <AppSidebarBrand
          collapsed={isSidebarContentCollapsed}
          title={t('shell.app_title')}
          toggleLabel={t('shell.toggle_sidebar')}
          onToggle={() => {
            if (window.matchMedia('(min-width: 1280px)').matches) {
              setIsDesktopSidebarOpen((current) => !current);
            } else {
              closeSidebar();
            }
          }}
        />

        <AppSidebarNavigation collapsed={isSidebarContentCollapsed} dashboards={sidebarDashboards}>
          <AppSidebarPrimaryNavigation
            currentView={currentView}
            collapsed={isSidebarContentCollapsed}
            dashboards={sidebarDashboards}
            selectedDashboardId={urlDashboardId}
            isDashboardsExpanded={isDashboardsExpanded}
            isSystemExpanded={isSystemExpanded}
            isCollapsedSystemSubmenuHidden={isCollapsedSystemSubmenuHidden}
            canAccessDashboards={canAccessDashboards}
            canAccessFamilyControl={canAccessFamilyControl}
            canAccessAdminControl={canAccessAdminControl}
            canAccessSystem={canAccessSystem}
            isAdmin={user?.role === 'admin'}
            homeChatEnabled={installedFeatures.homeChat}
            assistantOpenCount={assistantSummary?.totalOpen ?? 0}
            translate={t}
            onNavigate={navigateFromSidebar}
            onNavigatePath={navigatePathFromSidebar}
            onRefreshDashboards={() => { void refreshSidebarDashboards(); }}
            onDashboardsExpandedChange={setIsDashboardsExpanded}
            onSystemExpandedChange={setIsSystemExpanded}
            onCollapsedSystemSubmenuHiddenChange={setIsCollapsedSystemSubmenuHidden}
            onCloseMobileSidebar={closeSidebar}
            getDashboardPath={(dashboardId) => getDashboardPath(dashboardId, lastTabRef.current)}
          />
        </AppSidebarNavigation>

        <AppSidebarFooter
          collapsed={isSidebarContentCollapsed}
          user={user}
          profile={localProfile}
          theme={theme}
          demoStepCount={demoSteps.length}
          onStartDemo={() => startDemo(demoSteps)}
          onToggleTheme={() => {
            useAppShellStore.getState().setAutomaticTheme(false);
            setTheme(theme === 'dark' ? 'light' : 'dark');
          }}
          onToggleLanguage={toggleLanguage}
          onChangePassword={() => setShowPwdModal(true)}
          onLogout={onLogout}
          onOpenProfile={() => setShowProfileModal(true)}
        />
      </AppSidebarShell>

      {/* Main Content Area */}
      <main className={cn(
        'flex min-w-0 flex-1 flex-col bg-background',
        currentView === 'home-conversation'
          ? 'h-screen-dvh overflow-hidden'
          : 'min-h-screen-dvh overflow-visible xl:h-full xl:overflow-hidden'
      )}>

        {currentView !== 'dashboards' && (
          <MobileSidebarToggle onOpen={() => setIsSidebarOpen(true)} />
        )}

        <section ref={mainScrollRef} className={cn(
          'flex-1 min-h-0 relative scroll-smooth',
          currentView === 'home-conversation'
            ? 'overflow-hidden'
            : currentView === 'dashboards'
              ? 'overflow-visible xl:overflow-y-auto'
              : 'overflow-visible pt-14 xl:overflow-y-auto xl:pt-0'
        )}>
          {isBackendOffline && <AppOfflineBanner onRetry={() => window.location.reload()} />}
          <AppViewRouter
            currentView={currentView}
            currentPath={location.pathname}
            user={user}
            displayName={localProfile.displayName || user?.username || null}
            canManageAutomations={canAccessAdminControl}
            dashboardId={urlDashboardId}
            tabId={urlTabId}
            setupStatus={setupStatus}
            pendingPrompt={wake.pendingPrompt}
            assistantTurnCoordinator={wake.coordinator}
            onNavigate={navigateTo}
            onOpenOwnDashboardTab={(dashboardId, tabId) => navigate(dashboardTabPath(dashboardId, tabId))}
            onRoutineSectionChange={(section) => navigate(`/routines/${section}`)}
            onOpenMobileMenu={() => setIsSidebarOpen(true)}
            onDashboardCatalogChange={(dashboards) => setSidebarDashboards(dashboards)}
            onDeviceAction={() => { pulseSyncStatus(); void refreshDeviceSnapshot(); }}
            onOnboardingCompleted={markOnboardingCompleted}
            onPendingPromptConsumed={wake.consumePrompt}
          />
        </section>

      </main>

      <AppGlobalOverlays
        authenticated={status === 'authenticated'}
        loadingSetup={loadingSetup}
        requiresOnboarding={Boolean(setupStatus?.requiresOnboarding)}
        showPasswordModal={showPwdModal}
        showProfileModal={showProfileModal}
        user={user}
        globalWakeNotice={wake.notice}
        isGlobalWakeProcessing={wake.isProcessing}
        onNavigate={navigateTo}
        onClosePasswordModal={() => setShowPwdModal(false)}
        onPasswordChanged={handlePasswordChanged}
        onCloseProfileModal={() => setShowProfileModal(false)}
        onProfileSaved={setLocalProfile}
        homeChatEnabled={installedFeatures.homeChat}
        onWakeCommand={wake.onCommand}
        onWakeInterrupt={wake.onInterrupt}
        onWakeStatusChange={wake.onStatusChange}
      />
    </div>
  );
}

export default App;
