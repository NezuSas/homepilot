import { useState, useEffect, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  Monitor,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils';
import { useAutomaticTheme } from './lib/useAutomaticTheme';
import { API_ENDPOINTS, API_BASE_URL } from './config';
import { apiFetch } from './lib/apiClient';
import { consumeBrowserDirectoryHandoff, type BrowserDirectoryHandoff } from './lib/browserDirectoryHandoff';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant, synthesizeAssistantSpeech } from './lib/assistantApi';
import { createSpeechAudioUrl } from './lib/audioRecording';
import { AssistantTurnCoordinator, type AssistantTurn } from './lib/assistantTurnCoordinator';
import { HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT, HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, HOME_CONVERSATION_STOP_SPEECH_EVENT, isSilenceVoiceCommand } from './lib/homeConversationVoice';
import { recordHomeConversationTelemetry } from './lib/homeConversationTelemetry';
import { getAppAccessControl } from './lib/accessControl';
import { useSession } from './lib/useSession';
import { LoginView } from './views/LoginView';
import { FirstAdminSetupView } from './views/FirstAdminSetupView';
import { OnboardingView } from './views/OnboardingView';
import { Button } from './components/ui/Button';
import type { View } from './types';
import type { AssistantConversationResponse } from './types/assistantConversation';
import { DASHBOARDS_ONE_PATTERN, DASHBOARDS_TAB_PATTERN, dashboardTabPath, isSystemView, pathToView, resolveView, viewToPath } from './lib/viewNavigation';
import { useRealtimeEvents } from './lib/useRealtimeEvents';
import { useAppShellStore } from './stores/useAppShellStore';
import { useAssistantStore } from './stores/useAssistantStore';
import { useDeviceSnapshotStore } from './stores/useDeviceSnapshotStore';
import { useDemoGuideStore } from './stores/useDemoGuideStore';
import { APP_DEMO_STEPS } from './config/appDemoSteps';
import type { GlobalWakeNoticeModel, GlobalWakeStatus } from './components/GlobalWakeNotice';
import { AppSidebarFooter } from './components/AppSidebarFooter';
import { MobileSidebarToggle } from './components/MobileSidebarToggle';
import { AppOfflineBanner } from './components/AppOfflineBanner';
import { MobileSidebarBackdrop } from './components/MobileSidebarBackdrop';
import { AppViewRouter } from './components/AppViewRouter';
import { AppGlobalOverlays } from './components/AppGlobalOverlays';
import { AppSidebarShell } from './components/AppSidebarShell';
import { AppSidebarNavigation } from './components/AppSidebarNavigation';
import { AppSidebarPrimaryNavigation } from './components/AppSidebarPrimaryNavigation';
import { invalidateDashboardCatalog, loadDashboards } from './views/dashboards/dashboardOperations';
import { invalidateDiagnosticCatalog } from './lib/diagnosticResourceRequests';
import type { SetupStatus } from './appShellTypes';

const REALTIME_REFRESH_DEBOUNCE_MS = 300;
const HOME_IDLE_RETURN_MS = 120_000;

function requiresVoiceConfirmation(response: AssistantConversationResponse): boolean {
  if (response.type !== 'clarification') return false;

  const optionIds = new Set(response.clarification?.options.map(option => option.id));
  return optionIds.has('confirm') && optionIds.has('cancel');
}

/**
 * Union de vistas posibles para tipado estricto.
 *
 * Primary:         dashboard | spaces | routines | assistant
 * Personalization: dashboards (placeholder) | energy (placeholder)
 * System:          system-devices | system-inbox | system-diagnostics |
 *                  system-audit | system-users | system-ha
 *
 * Backward-compat aliases kept:
 *   topology      → spaces
 *   inbox         → system-inbox
 *   audit-logs    → system-audit
 *   ha-settings   → system-ha
 *   diagnostics   → system-diagnostics
 *   users         → system-users
 */

/** Shape returned by /api/v1/system/setup-status — mirrors OnboardingView.SetupStatus */
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
  const currentView = useMemo(() => pathToView(location.pathname), [location.pathname]);
  const dashboardsTabMatch = useMemo(() => matchPath(DASHBOARDS_TAB_PATTERN, location.pathname), [location.pathname]);
  const dashboardsOneMatch = useMemo(
    () => (dashboardsTabMatch ? null : matchPath(DASHBOARDS_ONE_PATTERN, location.pathname)),
    [dashboardsTabMatch, location.pathname],
  );
  const urlDashboardId = dashboardsTabMatch?.params.dashboardId ?? dashboardsOneMatch?.params.dashboardId ?? null;
  const urlTabId = dashboardsTabMatch?.params.tabId ?? null;
  // In-memory only (not sessionStorage/localStorage): survives switching
  // around the sidebar within this page load, but is gone after an actual
  // reload — exactly where the "default tab" flag should take over instead.
  const lastDashboardTabRef = useRef<{ dashboardId: string; tabId: string } | null>(null);
  useEffect(() => {
    if (dashboardsTabMatch?.params.dashboardId && dashboardsTabMatch?.params.tabId) {
      lastDashboardTabRef.current = {
        dashboardId: dashboardsTabMatch.params.dashboardId,
        tabId: dashboardsTabMatch.params.tabId,
      };
    }
  }, [dashboardsTabMatch]);
  const [pendingHomeConversationPrompt, setPendingHomeConversationPrompt] = useState<{ id: string; text: string; interactionMode: 'voice' } | null>(null);
  const [globalWakeNotice, setGlobalWakeNotice] = useState<GlobalWakeNoticeModel | null>(null);
  const [isGlobalWakeProcessing, setIsGlobalWakeProcessing] = useState(false);
  const [isGlobalWakeSpeaking, setIsGlobalWakeSpeaking] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState<boolean>(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loadingSetup, setLoadingSetup] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mobileSidebarPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => (
    !window.matchMedia('(pointer: coarse) and (max-width: 1366px)').matches
  ));
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);
  const [isCollapsedSystemSubmenuHidden, setIsCollapsedSystemSubmenuHidden] = useState(false);
  const [isDashboardsExpanded, setIsDashboardsExpanded] = useState(false);
  const [sidebarDashboards, setSidebarDashboards] = useState<Array<{ id: string; ownerId: string; title: string }>>([]);
  const selectedSidebarDashboardId = urlDashboardId;
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [localProfile, setLocalProfile] = useState<{ displayName: string | null; avatarDataUri: string | null }>(() => {
    try {
      const raw = localStorage.getItem('hp_user_ctx');
      if (raw) {
        const ctx = JSON.parse(raw);
        return { displayName: ctx.displayName ?? null, avatarDataUri: ctx.avatarDataUri ?? null };
      }
    } catch { /* ignore */ }
    return { displayName: null, avatarDataUri: null };
  });
  const globalWakeAudioRef = useRef<HTMLAudioElement | null>(null);
  const globalWakeAudioUrlRef = useRef<string | null>(null);
  const globalWakeRequestIdRef = useRef(0);
  const [assistantTurnCoordinator] = useState(() => new AssistantTurnCoordinator());
  const globalWakeStartedAtRef = useRef(0);
  const refreshBurstTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const resetAppShellState = useAppShellStore((state) => state.resetAppShellState);
  const resetAssistantState = useAssistantStore((state) => state.resetAssistantState);
  const resetSnapshotState = useDeviceSnapshotStore((state) => state.resetSnapshotState);

  const theme = useAppShellStore((state) => state.theme);
  useAutomaticTheme();
  const setTheme = useAppShellStore((state) => state.setTheme);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // ─── Session Management ───────────────────────────────────────────────
  const onSessionCleared = useCallback(() => {
    resetAppShellState();
    resetAssistantState();
    resetSnapshotState();
    invalidateDashboardCatalog();
    invalidateDiagnosticCatalog();
  }, [resetAppShellState, resetAssistantState, resetSnapshotState]);

  const { status, user, handleLoginSuccess, handleLogout, clearSession, validateSession } = useSession(onSessionCleared);

  useEffect(() => {
    if (status !== 'authenticated' || currentView === 'dashboard') return;
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Existing modal work remains in place; an interaction closing it starts a fresh period.
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
          schedule();
          return;
        }
        resetMainScroll();
        navigate('/', { replace: true });
      }, HOME_IDLE_RETURN_MS);
    };
    const onActivity = () => schedule();
    const onScroll = (event: Event) => { if (event.isTrusted) schedule(); };
    schedule();
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [status, currentView, navigate, resetMainScroll]);
  const [directorySsoToken, setDirectorySsoToken] = useState<string | null>(null);
  const [directorySsoError, setDirectorySsoError] = useState(false);
  const directoryHandoffRef = useRef<Promise<BrowserDirectoryHandoff | null> | null>(null);

  useEffect(() => {
    let active = true;
    directoryHandoffRef.current ??= consumeBrowserDirectoryHandoff(`${API_BASE_URL}/api/v1/auth/sso/directory/consume-browser`);
    void directoryHandoffRef.current
      .then((result) => {
        if (!result || !active) return;
        if (result.linked && result.token && result.user) {
          setDirectorySsoToken(null);
          handleLoginSuccess(result.token, result.user);
          navigate('/', { replace: true });
          return;
        }
        setDirectorySsoToken(result.token);
      })
      .catch(() => {
        if (active) setDirectorySsoError(true);
      });
    return () => { active = false; };
  }, [handleLoginSuccess, navigate]);

  // ─── Verification Orchestration ───────────────────────────────────────
  useEffect(() => {
    if (status === 'checking') {
      validateSession();
    }
  }, [status, validateSession]);

  // ─── Real-time Integration ───────────────────────────────────────────
  const { lastEvent: lastRealtimeEvent } = useRealtimeEvents(status === 'authenticated');
  const assistantSummary = useAppShellStore((state) => state.assistantSummary);
  const refreshAssistantSummary = useAppShellStore((state) => state.refreshAssistantSummary);
  const pulseSyncStatus = useAppShellStore((state) => state.pulseSyncStatus);
  const refreshAssistantFindings = useAssistantStore((state) => state.refreshFindings);
  const refreshDeviceSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const startDemo = useDemoGuideStore((state) => state.startDemo);

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  const {
    canAccessFamilyControl,
    canAccessAdminControl,
    canAccessDashboards,
    canAccessSystem,
  } = getAppAccessControl(user?.role);

  // Only fetches the list for the sidebar's nested menu — no navigation side
  // effects here. Kept deliberately stable (deps: just canAccessDashboards)
  // so it doesn't change identity on every navigation; it used to depend on
  // urlDashboardId, which made its identity change on every route change,
  // which in turn re-fired the "on auth" effect below on every single
  // navigation — including navigating AWAY from Tableros — and that effect
  // used to call this function expecting it to redirect, so leaving Tableros
  // for another section immediately bounced back.
  const refreshSidebarDashboards = useCallback(async () => {
    if (!canAccessDashboards) {
      setSidebarDashboards([]);
      return;
    }

    try {
      const data = await loadDashboards('No se pudieron cargar los tableros.');
      setSidebarDashboards(data.map(dashboard => ({
        id: dashboard.id,
        ownerId: dashboard.ownerId,
        title: dashboard.title
      })));
    } catch (error) {
      console.warn('[AppShell] Failed to refresh sidebar dashboards:', error);
      setSidebarDashboards([]);
    }
  }, [canAccessDashboards]);

  // Landing on bare /dashboards (no specific dashboard in the URL) needs a
  // fallback — but ONLY while actually viewing Tableros. Gating on
  // `currentView` is what keeps this from ever redirecting the user while
  // they're looking at a completely different section.
  useEffect(() => {
    if (currentView !== 'dashboards' || urlDashboardId) return;
    if (sidebarDashboards.length === 0) return;

    const remembered = lastDashboardTabRef.current;
    if (remembered && sidebarDashboards.some(dashboard => dashboard.id === remembered.dashboardId)) {
      navigate(`/dashboards/${remembered.dashboardId}/${remembered.tabId}`, { replace: true });
      return;
    }

    const ownedDashboard = sidebarDashboards.find(dashboard => dashboard.ownerId === user?.id);
    const fallbackId = ownedDashboard?.id ?? sidebarDashboards[0]?.id ?? null;
    if (fallbackId) navigate(`/dashboards/${fallbackId}`, { replace: true });
  }, [currentView, urlDashboardId, sidebarDashboards, user?.id, navigate]);

  // Check setup status before login only to detect factory state without users.
  useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }

    setLoadingSetup(true);
    fetch(API_ENDPOINTS.system.setupStatus)
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          setSetupStatus(null);
          setIsBackendOffline(false);
          return null;
        }
        const contentType = res.headers.get('content-type');
        if (!res.ok || !contentType || !contentType.includes('application/json')) {
          throw new Error('BACKEND_ERROR');
        }
        return res.json() as Promise<SetupStatus>;
      })
      .then(data => {
        if (data) {
          setSetupStatus(data);
          setIsBackendOffline(false);
        }
      })
      .catch(() => {
        setIsBackendOffline(true);
      })
      .finally(() => setLoadingSetup(false));
  }, [status]);

  // Check setup status once authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      setLoadingSetup(true);
      apiFetch(API_ENDPOINTS.system.setupStatus)
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (!res.ok || !contentType || !contentType.includes('application/json')) {
             throw new Error('BACKEND_ERROR');
          }
          return res.json() as Promise<SetupStatus>;
        })
        .then(data => {
          setSetupStatus(data);
          setIsBackendOffline(false);
        })
        .catch(() => {
          setIsBackendOffline(true);
        })
        .finally(() => setLoadingSetup(false));

      // Fetch assistant summary
      refreshAssistantSummary();
      void refreshSidebarDashboards();
    }
  }, [status, refreshAssistantSummary, refreshSidebarDashboards]);

  useEffect(() => {
    if (status !== 'authenticated' || !lastRealtimeEvent) {
      return;
    }

    pulseSyncStatus();
    const REFRESH_TRIGGER_EVENTS = [
      'DeviceDiscoveredEvent',
      'DeviceCommandDispatchedEvent',
      'DeviceStateUpdatedEvent',
      'HomeAssistantStateUpdatedEvent',
      'HomeCreatedEvent',
      'RoomCreatedEvent',
      'DeviceAssignedToRoomEvent'
    ];

    if (!REFRESH_TRIGGER_EVENTS.includes(lastRealtimeEvent.type)) {
      return;
    }

    // A single user action (e.g. toggling a light) emits a burst of distinct
    // realtime events (dispatch + state-updated) in quick succession. Debounce
    // so that burst collapses into one refresh cycle instead of one per event.
    // refreshAssistantFindings already refreshes the summary internally, so it
    // isn't triggered separately here.
    if (refreshBurstTimerRef.current !== null) {
      window.clearTimeout(refreshBurstTimerRef.current);
    }
    refreshBurstTimerRef.current = window.setTimeout(() => {
      refreshBurstTimerRef.current = null;
      void refreshDeviceSnapshot({ force: true });
      refreshAssistantFindings();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [status, lastRealtimeEvent, pulseSyncStatus, refreshAssistantFindings, refreshDeviceSnapshot]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const reconcileVisibleState = () => {
      if (document.visibilityState === 'visible') void refreshDeviceSnapshot();
    };
    document.addEventListener('visibilitychange', reconcileVisibleState);
    window.addEventListener('focus', reconcileVisibleState);

    return () => {
      document.removeEventListener('visibilitychange', reconcileVisibleState);
      window.removeEventListener('focus', reconcileVisibleState);
    };
  }, [status, refreshDeviceSnapshot]);

  const onLogout = useCallback(async () => {
    await handleLogout(async () => {
      await apiFetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST' });
    });
  }, [handleLogout]);

  // Sync localProfile with session user when it changes (e.g. after validation)
  useEffect(() => {
    if (user) {
      setLocalProfile({
        displayName: user.displayName ?? null,
        avatarDataUri: user.avatarDataUri ?? null
      });
    }
  }, [user]);

  const handlePasswordChanged = useCallback(() => {
    clearSession();
    setShowPwdModal(false);
  }, [clearSession]);

  const stopGlobalWakeSpeech = useCallback(() => {
    setIsGlobalWakeSpeaking(false);

    if (globalWakeAudioRef.current) {
      globalWakeAudioRef.current.pause();
      globalWakeAudioRef.current.src = '';
      globalWakeAudioRef.current = null;
    }

    if (globalWakeAudioUrlRef.current) {
      URL.revokeObjectURL(globalWakeAudioUrlRef.current);
      globalWakeAudioUrlRef.current = null;
    }
  }, []);

  const speakGlobalWakeResponse = useCallback(async (text: string, turn?: AssistantTurn) => {
    if (!text.trim() || typeof Audio === 'undefined' || (turn && !assistantTurnCoordinator.isCurrent(turn))) return;

    globalWakeRequestIdRef.current += 1;
    const requestId = globalWakeRequestIdRef.current;
    stopGlobalWakeSpeech();

    const speech = await synthesizeAssistantSpeech(text, turn ? { signal: turn.signal } : undefined);
    if (!speech || requestId !== globalWakeRequestIdRef.current || (turn && !assistantTurnCoordinator.isCurrent(turn))) return;

    try {
      const audioUrl = createSpeechAudioUrl(speech.audioBase64, speech.audioContentType);
      const audio = new Audio(audioUrl);
      globalWakeAudioUrlRef.current = audioUrl;
      globalWakeAudioRef.current = audio;
      const playbackFinished = new Promise<void>(resolve => {
        const finishPlayback = () => {
          stopGlobalWakeSpeech();
          resolve();
        };
        audio.onended = finishPlayback;
        audio.onerror = finishPlayback;
      });
      setIsGlobalWakeSpeaking(true);
      await audio.play();
      recordHomeConversationTelemetry('global_wake_spoken', {
        elapsedMs: Date.now() - globalWakeStartedAtRef.current,
        textLength: text.length
      });
      await playbackFinished;
    } catch {
      stopGlobalWakeSpeech();
    }
  }, [assistantTurnCoordinator, stopGlobalWakeSpeech]);

  useEffect(() => () => {
    assistantTurnCoordinator.cancel();
    globalWakeRequestIdRef.current += 1;
    stopGlobalWakeSpeech();
  }, [assistantTurnCoordinator, stopGlobalWakeSpeech]);

  useEffect(() => assistantTurnCoordinator.onInvalidated(turn => {
    if (turn.origin !== 'wake_word') return;

    globalWakeRequestIdRef.current += 1;
    setIsGlobalWakeProcessing(false);
    stopGlobalWakeSpeech();
  }), [assistantTurnCoordinator, stopGlobalWakeSpeech]);

  useEffect(() => {
    const handleHomeConversationSpeechActivity = (event: Event) => {
      const detail = (event as CustomEvent<{ speaking?: boolean }>).detail;
      setIsGlobalWakeSpeaking(Boolean(detail?.speaking));
    };

    window.addEventListener(HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, handleHomeConversationSpeechActivity);
    return () => {
      window.removeEventListener(HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, handleHomeConversationSpeechActivity);
    };
  }, []);


  useEffect(() => {
    return () => {
      if (refreshBurstTimerRef.current !== null) {
        window.clearTimeout(refreshBurstTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!globalWakeNotice || isGlobalWakeProcessing) return;

    const timeoutId = window.setTimeout(() => {
      setGlobalWakeNotice(current => current?.id === globalWakeNotice.id ? null : current);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [globalWakeNotice, isGlobalWakeProcessing]);

  const handleGlobalWakeStatusChange = useCallback((wakeStatus: GlobalWakeStatus) => {
    if (wakeStatus !== 'unavailable') {
      return;
    }

    setGlobalWakeNotice({
      id: `wake-${wakeStatus}`,
      message: t('assistant.conversation.voice_unavailable_error'),
      tone: 'warning',
      status: wakeStatus
    });
  }, [t]);

  const handleGlobalWakeInterrupt = useCallback(() => {
    assistantTurnCoordinator.cancel();
    globalWakeRequestIdRef.current += 1;
    setGlobalWakeNotice(null);
    setIsGlobalWakeProcessing(false);
    stopGlobalWakeSpeech();
    window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
  }, [assistantTurnCoordinator, stopGlobalWakeSpeech]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
        {/* Cinematic Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 animate-pulse duration-3000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-glow-orb h-glow-orb bg-primary/10 rounded-full blur-glow-xl opacity-20 animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping duration-2000" />
            <div className="relative w-16 h-16 bg-card border-2 border-primary/20 rounded-3xl flex items-center justify-center rotate-12 hover:rotate-0 transition-transform duration-500 shadow-2xl">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-panel-title font-black tracking-tighter uppercase">{t('shell.status.verifying_session')}</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary hp-typing-dot [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary hp-typing-dot [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary hp-typing-dot" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 text-micro uppercase font-black tracking-label-hero text-muted-foreground opacity-30">
          {t('shell.status.security_gate')}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    if (loadingSetup) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Monitor className="w-8 h-8 animate-pulse text-muted-foreground" />
        </div>
      );
    }

    if (setupStatus && !setupStatus.hasAdminUser) {
      return <FirstAdminSetupView onCompleted={handleLoginSuccess} />;
    }

    return <LoginView onLoginSuccess={handleLoginSuccess} ssoLinkToken={directorySsoToken} ssoError={directorySsoError} />;
  }

  if (loadingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Monitor className="w-8 h-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  // Si requiere onboarding (no inicializado), bloqueamos todo el sidebar y forzamos onboarding.
  if (setupStatus?.requiresOnboarding) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
        <header className="h-16 border-b flex items-center px-6 bg-card shrink-0">
          <Monitor className="w-6 h-6 mr-3 text-primary" />
          <h1 className="text-section-title font-bold tracking-tight">{t('shell.app_title')} {t('shell.app_edge')}</h1>
        </header>
        <main className="flex-1 flex overflow-hidden">
          <OnboardingView 
            statusProvider={setupStatus} 
            userContext={user} 
            onCompleted={() => setSetupStatus((prev) => prev ? { ...prev, requiresOnboarding: false } : null)} 
          />
        </main>
      </div>
    );
  }

  const handleMobileSidebarPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return;
    mobileSidebarPointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleMobileSidebarPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = mobileSidebarPointerStartRef.current;
    mobileSidebarPointerStartRef.current = null;
    if (!start || event.pointerType !== 'touch') return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (horizontalDistance <= -64 && Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
      setIsSidebarOpen(false);
    }
  };

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

  const handleGlobalWakeCommand = (command: string) => {
    const text = command.trim();
    if (!text) return;

    if (isSilenceVoiceCommand(text)) {
      recordHomeConversationTelemetry('global_wake_processed', {
        sourceView: currentView,
        responseType: 'silence',
        elapsedMs: 0
      });
      setGlobalWakeNotice(null);
      setIsGlobalWakeProcessing(false);
      stopGlobalWakeSpeech();
      window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
      void speakGlobalWakeResponse(t('assistant.conversation.voice_silence_acknowledgement'));
      return;
    }

    if (currentView !== 'home-conversation') {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
      const turn = assistantTurnCoordinator.begin('wake_word');
      globalWakeStartedAtRef.current = Date.now();
      recordHomeConversationTelemetry('global_wake_detected', {
        sourceView: currentView,
        promptLength: text.length
      });
      setIsGlobalWakeProcessing(true);
      setGlobalWakeNotice(null);

      void converseWithAssistant({
        prompt: text,
        interactionMode: 'voice',
      }, {
        timeoutMs: ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS,
        signal: turn.signal
      }).then(response => {
        if (!assistantTurnCoordinator.isCurrent(turn)) return;
        recordHomeConversationTelemetry('global_wake_processed', {
          sourceView: currentView,
          responseType: response.type,
          elapsedMs: Date.now() - globalWakeStartedAtRef.current
        });
        if (response.type === 'error') {
          setGlobalWakeNotice({
            id,
            message: t('assistant.conversation.voice_request_error'),
            tone: 'error',
            status: 'idle'
          });
        }
        if (response.type === 'execution' && response.execution?.status !== 'failed') {
          void refreshDeviceSnapshot();
        }
        void speakGlobalWakeResponse(response.message, turn).finally(() => {
          if (requiresVoiceConfirmation(response)) {
            window.dispatchEvent(new Event(HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT));
          }
        });
      }).catch(() => {
        if (!assistantTurnCoordinator.isCurrent(turn) || turn.signal.aborted) return;
        const message = t('assistant.conversation.voice_processing_error');
        recordHomeConversationTelemetry('global_wake_failed', {
          sourceView: currentView,
          elapsedMs: Date.now() - globalWakeStartedAtRef.current
        });
        setGlobalWakeNotice({ id, message, tone: 'error', status: 'idle' });
        void speakGlobalWakeResponse(message, turn);
      }).finally(() => {
        if (assistantTurnCoordinator.isCurrent(turn)) {
          setIsGlobalWakeProcessing(false);
        }
      });
      return;
    }

    window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
    assistantTurnCoordinator.cancel();
    setPendingHomeConversationPrompt({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      interactionMode: 'voice',
    });
  };

  const isDesktopSidebarCollapsed = !isDesktopSidebarOpen;
  const isSidebarContentCollapsed = isDesktopSidebarCollapsed && !isSidebarOpen;

  return (
    <div 
      className="flex min-h-screen-dvh w-full overflow-x-hidden bg-background text-foreground antialiased selection:bg-primary/10 transition-all duration-1000 xl:h-screen-dvh xl:overflow-hidden"
    >
      
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && <MobileSidebarBackdrop onDismiss={() => setIsSidebarOpen(false)} />}

      {/* Sidebar (Responsive Drawer on Mobile, Collapsible on Desktop) */}
      <AppSidebarShell isOpen={isSidebarOpen} isDesktopOpen={isDesktopSidebarOpen} onPointerDown={handleMobileSidebarPointerDown} onPointerUp={handleMobileSidebarPointerUp} onPointerCancel={() => { mobileSidebarPointerStartRef.current = null; }}>
        {/* Brand and desktop sidebar toggle. The redundant local-control label was removed to preserve navigation space. */}
        <div className={cn("border-b border-border/40 px-4 py-3 shrink-0 transition-all duration-300", isSidebarContentCollapsed && "xl:px-3")}>
          <div className={cn("flex items-center gap-2.5", isSidebarContentCollapsed && "xl:justify-center")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (window.matchMedia('(min-width: 1280px)').matches) {
                  setIsDesktopSidebarOpen((current) => !current);
                } else {
                  setIsSidebarOpen(false);
                }
              }}
              className="flex h-12 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-opacity hover:opacity-75"
              title={t('shell.toggle_sidebar')}
              aria-label={t('shell.toggle_sidebar')}
            >
              <img src="/logo.svg" alt="HomePilot" className={cn("h-7 w-auto object-contain transition-opacity", !isSidebarContentCollapsed && "xl:opacity-100")} />
            </Button>
            <h2 className={cn("font-black tracking-tighter text-body-lg leading-none whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200", isSidebarContentCollapsed && "xl:w-0 xl:opacity-0")}>
              {t('shell.app_title')}
            </h2>
          </div>
        </div>
        
        <AppSidebarNavigation collapsed={isSidebarContentCollapsed} dashboards={sidebarDashboards}>
          <AppSidebarPrimaryNavigation
            currentView={currentView}
            collapsed={isSidebarContentCollapsed}
            dashboards={sidebarDashboards}
            selectedDashboardId={selectedSidebarDashboardId}
            isDashboardsExpanded={isDashboardsExpanded}
            isSystemExpanded={isSystemExpanded}
            isCollapsedSystemSubmenuHidden={isCollapsedSystemSubmenuHidden}
            canAccessDashboards={canAccessDashboards}
            canAccessFamilyControl={canAccessFamilyControl}
            canAccessAdminControl={canAccessAdminControl}
            canAccessSystem={canAccessSystem}
            isAdmin={user?.role === 'admin'}
            assistantOpenCount={assistantSummary?.totalOpen ?? 0}
            translate={t}
            onNavigate={navigateFromSidebar}
            onNavigatePath={navigatePathFromSidebar}
            onRefreshDashboards={() => { void refreshSidebarDashboards(); }}
            onDashboardsExpandedChange={setIsDashboardsExpanded}
            onSystemExpandedChange={setIsSystemExpanded}
            onCollapsedSystemSubmenuHiddenChange={setIsCollapsedSystemSubmenuHidden}
            onCloseMobileSidebar={() => setIsSidebarOpen(false)}
            getDashboardPath={(dashboardId) => {
              const remembered = lastDashboardTabRef.current;
              return remembered && remembered.dashboardId === dashboardId
                ? `/dashboards/${remembered.dashboardId}/${remembered.tabId}`
                : `/dashboards/${dashboardId}`;
            }}
          />
        </AppSidebarNavigation>
        
        <AppSidebarFooter
          collapsed={isSidebarContentCollapsed}
          user={user}
          profile={localProfile}
          theme={theme}
          demoStepCount={APP_DEMO_STEPS.length}
          onStartDemo={() => startDemo(APP_DEMO_STEPS)}
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
          "flex-1 min-h-0 relative scroll-smooth",
          currentView === 'home-conversation'
            ? "overflow-hidden"
            : currentView === 'dashboards'
              ? "overflow-visible xl:overflow-y-auto"
              : "overflow-visible pt-14 xl:overflow-y-auto xl:pt-0"
        )}>
           {isBackendOffline && <AppOfflineBanner onRetry={() => window.location.reload()} />}
               <AppViewRouter
                 currentView={currentView}
                 currentPath={location.pathname}
                 user={user}
                 displayName={localProfile.displayName || user?.username || null}
                 canManageAutomations={canAccessAdminControl}
                 dashboardId={selectedSidebarDashboardId}
                 tabId={urlTabId}
                 setupStatus={setupStatus}
                 pendingPrompt={pendingHomeConversationPrompt}
                 assistantTurnCoordinator={assistantTurnCoordinator}
                 onNavigate={navigateTo}
                 onOpenOwnDashboardTab={(dashboardId, tabId) => navigate(dashboardTabPath(dashboardId, tabId))}
                 onRoutineSectionChange={(section) => navigate(`/routines/${section}`)}
                 onOpenMobileMenu={() => setIsSidebarOpen(true)}
                 onDashboardCatalogChange={(dashboards) => setSidebarDashboards(dashboards)}
                 onDeviceAction={() => { pulseSyncStatus(); void refreshDeviceSnapshot(); }}
                 onOnboardingCompleted={() => setSetupStatus((previous) => previous ? { ...previous, requiresOnboarding: false } : null)}
                 onPendingPromptConsumed={(id) => setPendingHomeConversationPrompt((current) => current?.id === id ? null : current)}
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
        globalWakeNotice={globalWakeNotice}
        isGlobalWakeProcessing={isGlobalWakeProcessing}
        isGlobalWakeSpeaking={isGlobalWakeSpeaking}
        onNavigate={navigateTo}
        onClosePasswordModal={() => setShowPwdModal(false)}
        onPasswordChanged={handlePasswordChanged}
        onCloseProfileModal={() => setShowProfileModal(false)}
        onProfileSaved={setLocalProfile}
        onWakeCommand={handleGlobalWakeCommand}
        onWakeInterrupt={handleGlobalWakeInterrupt}
        onWakeStatusChange={handleGlobalWakeStatusChange}
      />
    </div>
  );
}

export default App;
