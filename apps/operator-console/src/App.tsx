import { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  BarChart2,
  Zap,
  Sparkles,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Activity,
  KeyRound,
  Monitor,
  Users,
  Menu,
  Globe,
  Network,
  Server,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  MessageSquare,
  Camera
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils';
import { API_ENDPOINTS, API_BASE_URL } from './config';
import { apiFetch } from './lib/apiClient';
import { ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS, converseWithAssistant, synthesizeAssistantSpeech } from './lib/assistantApi';
import { createSpeechAudioUrl } from './lib/audioRecording';
import { HOME_CONVERSATION_SPEECH_ACTIVITY_EVENT, HOME_CONVERSATION_STOP_SPEECH_EVENT, isSilenceVoiceCommand } from './lib/homeConversationVoice';
import { recordHomeConversationTelemetry } from './lib/homeConversationTelemetry';
import { useSession } from './lib/useSession';
import { LoginView } from './views/LoginView';
import { FirstAdminSetupView } from './views/FirstAdminSetupView';
import { ChangePasswordModal } from './views/ChangePasswordModal';
import { OnboardingView } from './views/OnboardingView';
import { AlertBanner } from './components/ui/AlertBanner';
import { Button } from './components/ui/Button';
import { PageFrame } from './components/ui/PageFrame';
import { SidebarItem } from './components/ui/SidebarItem';
import type { View } from './types';
import { useRealtimeEvents } from './lib/useRealtimeEvents';
import { useAppShellStore } from './stores/useAppShellStore';
import { useAssistantStore } from './stores/useAssistantStore';
import { useDeviceSnapshotStore } from './stores/useDeviceSnapshotStore';
import { useDemoGuideStore, type DemoStep } from './stores/useDemoGuideStore';
import { DemoGuideOverlay } from './components/DemoGuideOverlay';
import { UserProfileModal } from './components/UserProfileModal';
import { GlobalWakeListener } from './components/GlobalWakeListener';
import { GlobalWakeNotice, type GlobalWakeNoticeModel, type GlobalWakeStatus } from './components/GlobalWakeNotice';

const DashboardView = lazy(() => import('./views/DashboardView').then(module => ({ default: module.DashboardView })));
const TopologyView = lazy(() => import('./views/TopologyView').then(module => ({ default: module.TopologyView })));
const InboxView = lazy(() => import('./views/InboxView').then(module => ({ default: module.InboxView })));
const AuditLogsView = lazy(() => import('./views/AuditLogsView').then(module => ({ default: module.AuditLogsView })));
const HomeAssistantSettingsView = lazy(() => import('./views/HomeAssistantSettingsView').then(module => ({ default: module.HomeAssistantSettingsView })));
const DiagnosticsView = lazy(() => import('./views/DiagnosticsView').then(module => ({ default: module.DiagnosticsView })));
const UsersView = lazy(() => import('./views/UsersView').then(module => ({ default: module.UsersView })));
const RoutinesView = lazy(() => import('./views/RoutinesView'));
const AssistantView = lazy(() => import('./views/AssistantView').then(module => ({ default: module.AssistantView })));
const DashboardsView = lazy(() => import('./views/DashboardsView').then(module => ({ default: module.DashboardsView })));
const ResilienceShowcaseView = lazy(() => import('./views/ResilienceShowcaseView'));
const EnergyView = lazy(() => import('./views/EnergyView').then(module => ({ default: module.EnergyView })));
const ExecutionLogsView = lazy(() => import('./views/ExecutionLogsView').then(module => ({ default: module.ExecutionLogsView })));
const HomeConversationView = lazy(() => import('./views/HomeConversationView').then(module => ({ default: module.HomeConversationView })));
const NativeCamerasView = lazy(() => import('./views/NativeCamerasView').then(module => ({ default: module.NativeCamerasView })));
const GLOBAL_WAKE_SILENCE_ACKNOWLEDGEMENT = 'De acuerdo, Oscar.';
const BASIC_HOME_ROLES = new Set(['admin', 'operator', 'parent', 'child', 'guest']);
const FAMILY_CONTROL_ROLES = new Set(['admin', 'operator', 'parent', 'child']);
const ADMIN_CONTROL_ROLES = new Set(['admin', 'operator', 'parent']);
const SYSTEM_ROLES = new Set(['admin', 'operator']);

function ViewLoadingState() {
  return (
    <div className="flex min-h-screen-half items-center justify-center text-muted-foreground">
      <Monitor className="h-7 w-7 animate-pulse" />
    </div>
  );
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

/** Resolve legacy view names to canonical ones. */
function resolveView(view: View): View {
  switch (view) {
    case 'scenes':      return 'routines';
    case 'automations': return 'routines';
    case 'topology':    return 'spaces';
    case 'inbox':       return 'system-inbox';
    case 'audit-logs':  return 'system-audit';
    case 'ha-settings': return 'system-ha';
    case 'diagnostics': return 'system-diagnostics';
    case 'users':       return 'system-users';
    default:            return view;
  }
}

/** Returns true if the given canonical view belongs to the System section. */
function isSystemView(view: View): boolean {
  return view === 'system-devices'
    || view === 'system-inbox'
    || view === 'system-diagnostics'
    || view === 'system-audit'
    || view === 'system-executions'
    || view === 'system-users'
    || view === 'system-ha'
    || view === 'system-cameras'
    || view === 'system-onboarding';
}

/**
 * URL <-> View mapping. This is the whole reload-persistence story: the
 * browser URL is the source of truth for navigation instead of plain React
 * state, so a reload (or a shared link) lands back on the same section —
 * and, for Tableros, the exact dashboard + tab — instead of resetting to
 * Home. nginx already serves index.html for any unknown path (SPA
 * fallback), so no deployment changes are needed for these routes to work.
 */
const DASHBOARDS_TAB_PATTERN = '/dashboards/:dashboardId/:tabId';
const DASHBOARDS_ONE_PATTERN = '/dashboards/:dashboardId';

function viewToPath(view: View): string {
  switch (view) {
    case 'dashboard': return '/';
    case 'spaces': return '/spaces';
    case 'routines': return '/routines/scenes';
    case 'scenes': return '/routines/scenes';
    case 'automations': return '/routines/automations';
    case 'assistant': return '/assistant';
    case 'energy': return '/energy';
    case 'resilience-showcase': return '/resilience-showcase';
    case 'home-conversation': return '/home-conversation';
    case 'dashboards': return '/dashboards';
    case 'system-devices': return '/system/devices';
    case 'system-inbox': return '/system/inbox';
    case 'system-diagnostics': return '/system/diagnostics';
    case 'system-audit': return '/system/audit';
    case 'system-executions': return '/system/executions';
    case 'system-users': return '/system/users';
    case 'system-ha': return '/system/ha';
    case 'system-cameras': return '/system/cameras';
    case 'system-onboarding': return '/system/onboarding';
    default: return '/';
  }
}

function pathToView(pathname: string): View {
  if (pathname.startsWith('/dashboards')) return 'dashboards';
  switch (pathname) {
    case '/spaces': return 'spaces';
    case '/routines':
    case '/routines/scenes':
    case '/routines/automations':
    case '/scenes':
    case '/automations': return 'routines';
    case '/assistant': return 'assistant';
    case '/energy': return 'energy';
    case '/resilience-showcase': return 'resilience-showcase';
    case '/home-conversation': return 'home-conversation';
    case '/system/devices': return 'system-devices';
    case '/system/inbox': return 'system-inbox';
    case '/system/diagnostics': return 'system-diagnostics';
    case '/system/audit': return 'system-audit';
    case '/system/executions': return 'system-executions';
    case '/system/users': return 'system-users';
    case '/system/ha': return 'system-ha';
    case '/system/cameras': return 'system-cameras';
    case '/system/onboarding': return 'system-onboarding';
    default: return 'dashboard';
  }
}

/**
 * App Component
 * Aplicación principal de la Operator Console V1.
 * Gestiona el enrutamiento básico y el layout global.
 */
/** Shape returned by /api/v1/system/setup-status — mirrors OnboardingView.SetupStatus */
interface SetupStatus {
  isInitialized: boolean;
  requiresOnboarding: boolean;
  hasAdminUser: boolean;
  hasHAConfig: boolean;
  haConnectionValid: boolean;
}

function App() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => (
    !window.matchMedia('(pointer: coarse) and (max-width: 1366px)').matches
  ));
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);
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
  const globalWakeConversationAbortRef = useRef<AbortController | null>(null);
  const globalWakeConversationIdRef = useRef(0);
  const globalWakeStartedAtRef = useRef(0);

  const resetAppShellState = useAppShellStore((state) => state.resetAppShellState);
  const resetAssistantState = useAssistantStore((state) => state.resetAssistantState);
  const resetSnapshotState = useDeviceSnapshotStore((state) => state.resetSnapshotState);

  const theme = useAppShellStore((state) => state.theme);
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
  }, [resetAppShellState, resetAssistantState, resetSnapshotState]);

  const { status, user, handleLoginSuccess, handleLogout, clearSession, validateSession } = useSession(onSessionCleared);

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

  const DEMO_STEPS: DemoStep[] = [
    {
      id: 'dashboard-nav',
      target: '[data-demo="nav-dashboard"]',
      titleKey: 'demo.steps.dashboard.title',
      descriptionKey: 'demo.steps.dashboard.description',
      view: 'dashboard'
    },
    {
      id: 'routines',
      target: '[data-demo="dashboard-routines"]',
      titleKey: 'demo.steps.routines.title',
      descriptionKey: 'demo.steps.routines.description',
      view: 'dashboard'
    },
    {
      id: 'conversation',
      target: '[data-demo="nav-home-conversation"]',
      titleKey: 'demo.steps.conversation.title',
      descriptionKey: 'demo.steps.conversation.description',
      view: 'home-conversation'
    },
    {
      id: 'automations',
      target: '[data-demo="nav-routines"]',
      titleKey: 'demo.steps.automations.title',
      descriptionKey: 'demo.steps.automations.description',
      view: 'automations'
    },
    {
      id: 'resilience',
      target: '[data-demo="nav-resilience"]',
      titleKey: 'demo.steps.resilience.title',
      descriptionKey: 'demo.steps.resilience.description',
      view: 'resilience-showcase'
    }
  ];

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  const canAccessBasicHomeViews = user?.role ? BASIC_HOME_ROLES.has(user.role) : false;
  const canAccessFamilyControl = user?.role ? FAMILY_CONTROL_ROLES.has(user.role) : false;
  const canAccessAdminControl = user?.role ? ADMIN_CONTROL_ROLES.has(user.role) : false;
  const canAccessDashboards = canAccessBasicHomeViews;
  const canAccessSystem = user?.role ? SYSTEM_ROLES.has(user.role) : false;

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
      const response = await apiFetch(`${API_BASE_URL}/api/v1/dashboards`);
      if (!response.ok) return;
      const data = await response.json() as Array<{ id: string; ownerId: string; title: string }>;
      if (!Array.isArray(data)) return;
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
      'HomeCreatedEvent',
      'RoomCreatedEvent',
      'DeviceAssignedToRoomEvent'
    ];

    if (REFRESH_TRIGGER_EVENTS.includes(lastRealtimeEvent.type)) {
      refreshDeviceSnapshot();
      refreshAssistantFindings();
      refreshAssistantSummary();
    }
  }, [status, lastRealtimeEvent, pulseSyncStatus, refreshAssistantFindings, refreshAssistantSummary, refreshDeviceSnapshot]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const reconcileVisibleState = () => {
      if (document.visibilityState === 'visible') void refreshDeviceSnapshot();
    };
    const intervalId = window.setInterval(reconcileVisibleState, 10000);
    document.addEventListener('visibilitychange', reconcileVisibleState);
    window.addEventListener('focus', reconcileVisibleState);

    return () => {
      window.clearInterval(intervalId);
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

  const speakGlobalWakeResponse = useCallback(async (text: string) => {
    if (!text.trim() || typeof Audio === 'undefined') return;

    globalWakeRequestIdRef.current += 1;
    const requestId = globalWakeRequestIdRef.current;
    stopGlobalWakeSpeech();

    const speech = await synthesizeAssistantSpeech(text);
    if (!speech || requestId !== globalWakeRequestIdRef.current) return;

    try {
      const audioUrl = createSpeechAudioUrl(speech.audioBase64, speech.audioContentType);
      const audio = new Audio(audioUrl);
      globalWakeAudioUrlRef.current = audioUrl;
      globalWakeAudioRef.current = audio;
      audio.onended = stopGlobalWakeSpeech;
      audio.onerror = stopGlobalWakeSpeech;
      setIsGlobalWakeSpeaking(true);
      await audio.play();
      recordHomeConversationTelemetry('global_wake_spoken', {
        elapsedMs: Date.now() - globalWakeStartedAtRef.current,
        textLength: text.length
      });
    } catch {
      stopGlobalWakeSpeech();
    }
  }, [stopGlobalWakeSpeech]);

  useEffect(() => () => {
    globalWakeConversationIdRef.current += 1;
    globalWakeConversationAbortRef.current?.abort();
    globalWakeConversationAbortRef.current = null;
    globalWakeRequestIdRef.current += 1;
    stopGlobalWakeSpeech();
  }, [stopGlobalWakeSpeech]);

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
    globalWakeConversationIdRef.current += 1;
    globalWakeConversationAbortRef.current?.abort();
    globalWakeConversationAbortRef.current = null;
    globalWakeRequestIdRef.current += 1;
    setGlobalWakeNotice(null);
    setIsGlobalWakeProcessing(false);
    stopGlobalWakeSpeech();
    window.dispatchEvent(new Event(HOME_CONVERSATION_STOP_SPEECH_EVENT));
  }, [stopGlobalWakeSpeech]);

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
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 text-micro uppercase font-black tracking-label-hero text-muted-foreground opacity-30">
          HomePilot Edge Security Gate
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

    return <LoginView onLoginSuccess={handleLoginSuccess} />;
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

  const navigateTo = (view: View) => {
    const resolved = resolveView(view);
    navigate(viewToPath(view === 'scenes' || view === 'automations' ? view : resolved));
    setIsSidebarOpen(false);
    // Auto-expand system section when a system view is activated
    if (isSystemView(resolved)) {
      setIsSystemExpanded(true);
    }
    if (resolved === 'dashboards') {
      setIsDashboardsExpanded(true);
      void refreshSidebarDashboards();
    }
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
      void speakGlobalWakeResponse(GLOBAL_WAKE_SILENCE_ACKNOWLEDGEMENT);
      return;
    }

    if (currentView !== 'home-conversation') {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      globalWakeConversationAbortRef.current?.abort();
      const conversationController = new AbortController();
      globalWakeConversationAbortRef.current = conversationController;
      globalWakeConversationIdRef.current += 1;
      const conversationId = globalWakeConversationIdRef.current;
      globalWakeStartedAtRef.current = Date.now();
      recordHomeConversationTelemetry('global_wake_detected', {
        sourceView: currentView,
        promptLength: text.length
      });
      setIsGlobalWakeProcessing(true);
      setGlobalWakeNotice(null);

      void converseWithAssistant({
        prompt: text,
        userName: user?.displayName || user?.username,
        interactionMode: 'voice',
      }, {
        timeoutMs: ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS,
        signal: conversationController.signal
      }).then(response => {
        if (conversationId !== globalWakeConversationIdRef.current) return;
        recordHomeConversationTelemetry('global_wake_processed', {
          sourceView: currentView,
          responseType: response.type,
          elapsedMs: Date.now() - globalWakeStartedAtRef.current
        });
        if (response.type === 'error') {
          setGlobalWakeNotice({
            id,
            message: 'No pude completar la solicitud por voz.',
            tone: 'error',
            status: 'idle'
          });
        }
        if (response.type === 'execution' && response.execution?.status !== 'failed') {
          void refreshDeviceSnapshot();
        }
        void speakGlobalWakeResponse(response.message);
      }).catch((error: unknown) => {
        if (conversationId !== globalWakeConversationIdRef.current || conversationController.signal.aborted) return;
        const message = error instanceof Error && error.message
          ? error.message
          : 'No pude procesar el comando de voz.';
        recordHomeConversationTelemetry('global_wake_failed', {
          sourceView: currentView,
          elapsedMs: Date.now() - globalWakeStartedAtRef.current
        });
        setGlobalWakeNotice({ id, message, tone: 'error', status: 'idle' });
        void speakGlobalWakeResponse(message);
      }).finally(() => {
        if (conversationId === globalWakeConversationIdRef.current) {
          globalWakeConversationAbortRef.current = null;
          setIsGlobalWakeProcessing(false);
        }
      });
      return;
    }

    setPendingHomeConversationPrompt({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      interactionMode: 'voice',
    });
  };

  const activeSystemSection = isSystemView(currentView);
  const activeDashboardsSection = currentView === 'dashboards';
  const isDesktopSidebarCollapsed = !isDesktopSidebarOpen;
  const isSidebarContentCollapsed = isDesktopSidebarCollapsed && !isSidebarOpen;

  return (
    <div 
      className="flex min-h-screen-dvh w-full overflow-x-hidden bg-background text-foreground antialiased selection:bg-primary/10 transition-all duration-1000 xl:h-screen-dvh xl:overflow-hidden"
    >
      
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[40] xl:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Responsive Drawer on Mobile, Collapsible on Desktop) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[50] border-r border-border/60 bg-card flex flex-col transition-all duration-300 ease-in-out shrink-0",
        isSidebarOpen ? "w-72 translate-x-0 shadow-sidebar-open" : "w-72 -translate-x-full",
        // Desktop override:
        "xl:relative",
        isDesktopSidebarOpen ? "xl:w-sidebar-expanded xl:translate-x-0" : "xl:w-sidebar-collapsed xl:translate-x-0 xl:overflow-hidden"
      )}>
        {/* Logo area */}
          <div className={cn("px-4 py-4 border-b border-border/40 flex flex-col gap-0.5 shrink-0 transition-all duration-300", isSidebarContentCollapsed && "xl:px-3")}>
          <div className={cn("flex items-center gap-2.5", isSidebarContentCollapsed && "xl:justify-center")}>
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 1280px)').matches) {
                  setIsDesktopSidebarOpen((current) => !current);
                } else {
                  setIsSidebarOpen(false);
                }
              }}
              className="flex h-14 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-opacity hover:opacity-75"
              title={t('shell.toggle_sidebar')}
              aria-label={t('shell.toggle_sidebar')}
            >
              <img src="/nezu.png" alt="Nezu" className={cn("h-10 w-auto object-contain transition-opacity", !isSidebarContentCollapsed && "xl:opacity-100")} />
            </button>
            <h2 className={cn("font-black tracking-tighter text-body-lg leading-none whitespace-nowrap overflow-hidden transition-[opacity,width] duration-200", isSidebarContentCollapsed && "xl:w-0 xl:opacity-0")}>
              {t('shell.app_title')}
            </h2>
          </div>
          <div className={cn("mt-1 ml-brand-indent flex items-center gap-2 whitespace-nowrap overflow-hidden transition-[opacity,width,height,margin] duration-200", isSidebarContentCollapsed && "xl:w-0 xl:h-0 xl:ml-0 xl:opacity-0")}>
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 1280px)').matches) {
                  setIsDesktopSidebarOpen((current) => !current);
                } else {
                  setIsSidebarOpen(false);
                }
              }}
              className="rounded-lg p-1 text-muted-foreground/45 transition-colors hover:bg-muted hover:text-foreground"
              title={t('shell.toggle_sidebar')}
              aria-label={t('shell.toggle_sidebar')}
            >
              <Menu className="h-3.5 w-3.5" />
            </button>
            <span className="text-nano uppercase font-semibold tracking-label text-muted-foreground/50">{t('shell.sidebar_subtitle')}</span>
          </div>
        </div>
        
        <nav className={cn("flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-0.5 custom-scrollbar transition-all duration-300", isSidebarContentCollapsed && "xl:px-2")}>

          {/* ── PRIMARY ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-0.5">
             <SidebarItem 
               icon={Home} 
               label={t('nav.dashboard')} 
               active={currentView === 'dashboard'} 
               onClick={() => navigateTo('dashboard')} 
               id="demo-nav-dashboard"
               data-demo="nav-dashboard"
               collapsedOnDesktop={isSidebarContentCollapsed}
             />
             {canAccessDashboards && (
               <>
                 <button
                    onClick={() => {
                      setIsDashboardsExpanded(prev => {
                        const next = !prev;
                        if (next) void refreshSidebarDashboards();
                        return next;
                      });
                    }}
                    className={cn(
                      "control-transition group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-body-compact transition-all",
                      activeDashboardsSection
                        ? 'sidebar-item-active text-primary'
                        : 'interactive-lift text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      isSidebarContentCollapsed && "xl:justify-center xl:px-2"
                    )}
                    title={isSidebarContentCollapsed ? t('nav.dashboards') : undefined}
                  >
                    <div className={cn("surface-transition flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", activeDashboardsSection ? "bg-primary/15 text-primary" : "text-muted-foreground/70 group-hover:text-foreground")}>
                        <BarChart2 className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={cn("flex-1 min-w-0 overflow-hidden text-left text-caption font-medium leading-tight tracking-tight transition-[opacity,width] duration-200", activeDashboardsSection && "font-semibold text-primary", isSidebarContentCollapsed && "xl:w-0 xl:opacity-0 xl:flex-none")}>{t('nav.dashboards')}</span>
                    {!isSidebarContentCollapsed && (isDashboardsExpanded
                      ? <ChevronDown className="w-4 h-4 opacity-60" />
                      : <ChevronRight className="w-4 h-4 opacity-60" />
                    )}
                 </button>
                 {isDashboardsExpanded && !isSidebarContentCollapsed && (
                   <div className="mt-1 ml-5 pl-2 border-l-2 border-border/40 flex flex-col gap-1">
                     {sidebarDashboards.length === 0 ? (
                       <span className="px-3 py-2 text-caption font-semibold text-muted-foreground/60">{t('dashboards.sidebar_empty')}</span>
                     ) : sidebarDashboards.map(dashboard => (
                       <SidebarItem
                         key={dashboard.id}
                         icon={LayoutDashboard}
                         label={dashboard.title}
                         active={currentView === 'dashboards' && selectedSidebarDashboardId === dashboard.id}
                         onClick={() => {
                           // Re-clicking the same dashboard you were just on
                           // (e.g. after visiting another sidebar section)
                           // returns to the exact tab, not the default one.
                           const remembered = lastDashboardTabRef.current;
                           const path = remembered && remembered.dashboardId === dashboard.id
                             ? `/dashboards/${remembered.dashboardId}/${remembered.tabId}`
                             : `/dashboards/${dashboard.id}`;
                           navigate(path);
                           setIsSidebarOpen(false);
                           setIsDashboardsExpanded(true);
                         }}
                         nested
                       />
                     ))}
                   </div>
                 )}
               </>
             )}
             <SidebarItem 
               icon={LayoutDashboard} 
               label={t('nav.spaces')} 
               active={currentView === 'spaces'} 
               onClick={() => navigateTo('spaces')} 
               collapsedOnDesktop={isSidebarContentCollapsed}
             />
             {canAccessFamilyControl && (
               <SidebarItem
                 icon={Zap}
                 label={t('nav.routines')}
                 active={currentView === 'routines'}
                 onClick={() => navigateTo('routines')}
                 data-demo="nav-routines"
                 collapsedOnDesktop={isSidebarContentCollapsed}
               />
             )}
             <SidebarItem
               icon={MessageSquare}
               label={t('nav.talk_to_home')}
               active={currentView === 'home-conversation'}
               onClick={() => navigateTo('home-conversation')}
               collapsedOnDesktop={isSidebarContentCollapsed}
               data-demo="nav-home-conversation"
             />
             {canAccessFamilyControl && (
               <SidebarItem
                 icon={Sparkles}
                 label={t('nav.assistant')}
                 active={currentView === 'assistant'}
                 onClick={() => navigateTo('assistant')}
                 badge={assistantSummary?.totalOpen && assistantSummary.totalOpen > 0
                    ? <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-micro font-black">{assistantSummary.totalOpen}</span>
                    : undefined}
                 collapsedOnDesktop={isSidebarContentCollapsed}
               />
             )}
          </div>

          {canAccessAdminControl && (
            <SidebarItem
              icon={Zap}
              label={t('nav.energy')}
              active={currentView === 'energy'}
              onClick={() => navigateTo('energy')}
              collapsedOnDesktop={isSidebarContentCollapsed}
            />
          )}

          <SidebarItem
            icon={ShieldCheck}
            label={t('nav.resilience_showcase')}
            active={currentView === 'resilience-showcase'}
            onClick={() => navigateTo('resilience-showcase')}
            data-demo="nav-resilience"
            collapsedOnDesktop={isSidebarContentCollapsed}
          />

          {canAccessSystem && (
            <>
              <div className="flex flex-col gap-0.5">
                <button
                    onClick={() => setIsSystemExpanded(prev => !prev)}
                    className={cn(
                      "control-transition group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-body-compact transition-all",
                      activeSystemSection
                        ? 'sidebar-item-active text-primary'
                        : 'interactive-lift text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      isSidebarContentCollapsed && "xl:justify-center xl:px-2"
                    )}
                    title={isSidebarContentCollapsed ? t('nav.system') : undefined}
                  >
                    <div className={cn("surface-transition flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", activeSystemSection ? "bg-primary/15 text-primary" : "text-muted-foreground/70 group-hover:text-foreground")}>
                        <Settings className="h-4 w-4 shrink-0" />
                    </div>
                    <span className={cn("flex-1 min-w-0 overflow-hidden text-left text-caption font-medium leading-tight tracking-tight transition-[opacity,width] duration-200", activeSystemSection && "font-semibold text-primary", isSidebarContentCollapsed && "xl:w-0 xl:opacity-0 xl:flex-none")}>{t('nav.system')}</span>
                    {!isSidebarContentCollapsed && (isSystemExpanded
                      ? <ChevronDown className="w-4 h-4 opacity-60" />
                      : <ChevronRight className="w-4 h-4 opacity-60" />
                    )
                    }
                </button>

                {/* System sub-items — inline collapsible */}
                {isSystemExpanded && !isSidebarContentCollapsed && (
                  <div className="mt-1 ml-5 pl-2 border-l-2 border-border/40 flex flex-col gap-1">
                     <SidebarItem
                        icon={Network}
                        label={t('nav.system_devices')}
                        active={currentView === 'system-devices'}
                        onClick={() => navigateTo('system-devices')}
                        nested
                      />
                      <SidebarItem
                        icon={Server}
                        label={t('nav.system_inbox')}
                        active={currentView === 'system-inbox'}
                        onClick={() => navigateTo('system-inbox')}
                        nested
                      />
                      <SidebarItem
                        icon={Activity}
                        label={t('nav.system_diagnostics')}
                        active={currentView === 'system-diagnostics'}
                        onClick={() => navigateTo('system-diagnostics')}
                        nested
                      />
                      <SidebarItem
                        icon={ShieldAlert}
                        label={t('nav.system_audit')}
                        active={currentView === 'system-audit'}
                        onClick={() => navigateTo('system-audit')}
                        nested
                      />
                      <SidebarItem
                        icon={Activity}
                        label={t('nav.system_executions')}
                        active={currentView === 'system-executions'}
                        onClick={() => navigateTo('system-executions')}
                        nested
                      />
                      {user?.role === 'admin' && (
                        <SidebarItem
                          icon={Users}
                          label={t('nav.system_users')}
                          active={currentView === 'system-users'}
                          onClick={() => navigateTo('system-users')}
                          nested
                        />
                      )}
                      <SidebarItem
                        icon={Settings}
                        label={t('nav.system_ha')}
                        active={currentView === 'system-ha'}
                        onClick={() => navigateTo('system-ha')}
                        nested
                      />
                      <SidebarItem
                        icon={Camera}
                        label={t('nav.system_cameras')}
                        active={currentView === 'system-cameras'}
                        onClick={() => navigateTo('system-cameras')}
                        nested
                      />
                      <SidebarItem
                        icon={Monitor}
                        label={t('nav.system_onboarding')}
                        active={currentView === 'system-onboarding'}
                        onClick={() => navigateTo('system-onboarding')}
                        nested
                      />
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
        
        <div className={cn("p-4 border-t mt-auto flex flex-col gap-4 bg-background/40 transition-all duration-300", !isSidebarContentCollapsed && "xl:px-2 xl:py-3")}>
          <button
            onClick={() => startDemo(DEMO_STEPS)}
            className={cn(
              "hidden xl:flex items-center gap-3 w-full rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-primary shadow-sm shadow-primary/5 control-transition interactive-lift group",
              "hover:bg-primary/15 hover:border-primary/30",
              isSidebarContentCollapsed && "xl:justify-center xl:px-2 xl:py-2.5"
            )}
            title={!isSidebarContentCollapsed ? t('demo.start_button') : undefined}
          >
            <div className="p-2 bg-primary rounded-xl text-primary-foreground group-hover:scale-105 transition-transform shadow-sm shadow-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className={cn("flex min-w-0 flex-1 flex-col text-left overflow-hidden transition-[opacity,width] duration-200", isSidebarContentCollapsed && "xl:w-0 xl:opacity-0 xl:flex-none")}>
              <span className="text-micro font-semibold uppercase tracking-control whitespace-nowrap">
                {t('demo.start_button')}
              </span>
              <span className="mt-0.5 truncate text-nano font-semibold uppercase tracking-normal text-primary/70">
                {t('demo.sidebar_summary', { count: DEMO_STEPS.length })}
              </span>
            </div>
          </button>

          <div className="flex flex-col gap-3">
            {/* User Profile Card */}
            <button
              onClick={() => setShowProfileModal(true)}
              className={cn(
                "flex items-center gap-3 w-full p-2 rounded-2xl bg-muted/30 hover:bg-muted/80 border border-border/40 transition-all group",
                isSidebarContentCollapsed && "xl:justify-center"
              )}
              title={t('users.profile.title', 'Mi Perfil')}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border-2 border-background shadow-md overflow-hidden group-hover:border-primary/30 transition-all">
                {localProfile.avatarDataUri
                  ? <img 
                      src={localProfile.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${localProfile.avatarDataUri}` : localProfile.avatarDataUri} 
                      alt="avatar" 
                      className="w-full h-full object-cover shadow-inner" 
                    />
                  : <span className="font-black text-caption uppercase">{(user?.username || '?').substring(0, 2)}</span>
                }
              </div>
              <div className={cn("flex flex-col min-w-0 text-left overflow-hidden transition-[opacity,width] duration-200", isSidebarContentCollapsed && "xl:w-0 xl:opacity-0")}>
                <span className="text-caption font-semibold tracking-tight truncate">{localProfile.displayName || user?.username || t('common.unknown')}</span>
                <span className="text-nano text-muted-foreground truncate uppercase font-semibold tracking-normal opacity-70">
                   {user?.role ? t(`shell.compact_roles.${user.role}`) : t('common.roles.guest')}
                </span>
              </div>
              <ChevronRight className={cn("w-4 h-4 ml-auto text-muted-foreground/40 group-hover:text-primary transition-colors", isSidebarContentCollapsed && "xl:hidden")} />
            </button>

            {/* Quick Actions Row */}
            <div className={cn(
              "flex items-center justify-around px-1 py-1 bg-muted/20 rounded-xl border border-border/30 transition-all duration-300",
              isSidebarContentCollapsed && "xl:flex-col xl:gap-1 xl:px-1"
            )}>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-sm transition-all p-2 rounded-lg"
                title={theme === 'dark' ? t('shell.tooltips.light_mode', 'Modo Claro') : t('shell.tooltips.dark_mode', 'Modo Oscuro')}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button 
                onClick={toggleLanguage}
                className="text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-sm transition-all p-2 rounded-lg"
                title={t('shell.tooltips.switch_language')}
              >
                <Globe className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowPwdModal(true)}
                className="text-muted-foreground hover:text-foreground hover:bg-background hover:shadow-sm transition-all p-2 rounded-lg"
                title={t('shell.tooltips.change_password')}
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <div className={cn("w-px h-4 bg-border/40 mx-0.5", isSidebarContentCollapsed && "xl:w-4 xl:h-px xl:mx-0 xl:my-0.5")} />
              <button 
                onClick={onLogout}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all p-2 rounded-lg"
                title={t('nav.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex min-h-screen-dvh min-w-0 flex-1 flex-col overflow-visible bg-background xl:h-full xl:overflow-hidden">
        
        {currentView !== 'dashboards' && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="fixed left-3 top-3 z-[35] flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/90 text-muted-foreground shadow-depth-1 backdrop-blur-md transition-colors hover:text-foreground xl:hidden"
            title={t('shell.toggle_sidebar')}
            aria-label={t('shell.toggle_sidebar')}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        <section className={cn(
          "flex-1 min-h-0 relative scroll-smooth",
          currentView === 'home-conversation'
            ? "overflow-hidden"
            : currentView === 'dashboards'
              ? "overflow-visible xl:overflow-y-auto"
              : "overflow-visible pt-14 xl:overflow-y-auto xl:pt-0"
        )}>
           {isBackendOffline && (
             <PageFrame className="pb-0 animate-in fade-in slide-in-from-top-4 duration-500">
               <AlertBanner
                 variant="danger"
                 icon={ShieldAlert}
                 title={t('system.connection_lost')}
                 message={t('system.unreachable_msg')}
                 action={
                   <Button variant="danger" size="sm" onClick={() => window.location.reload()}>
                     {t('system.retry')}
                   </Button>
                 }
               />
             </PageFrame>
           )}
           <PageFrame
             immersive={currentView === 'home-conversation' || currentView === 'dashboards'}
             className={currentView === 'home-conversation' ? 'h-full' : undefined}
           >
             <Suspense fallback={<ViewLoadingState />}>
               {currentView === 'dashboard' && (
                  <DashboardView
                    onActionExecute={() => {
                      pulseSyncStatus();
                      void refreshDeviceSnapshot();
                    }}
                    onNavigate={navigateTo}
                    displayName={localProfile.displayName || user?.username || null}
                    canManageAutomations={canAccessAdminControl}
                  />
                )}
               {/* Spaces = TopologyView (user-facing room management) */}
               {currentView === 'spaces' && <TopologyView />}
               {currentView === 'routines' && (
                 <RoutinesView
                   section={canAccessAdminControl && (location.pathname === '/automations' || location.pathname === '/routines/automations')
                     ? 'automations'
                     : 'scenes'}
                   canManageAutomations={canAccessAdminControl}
                   onSectionChange={(section) => navigate(`/routines/${section}`)}
                   onSceneActionExecute={() => {
                     pulseSyncStatus();
                     void refreshDeviceSnapshot();
                   }}
                 />
               )}
               {currentView === 'assistant' && <AssistantView onNavigate={navigateTo} />}
               {currentView === 'resilience-showcase' && <ResilienceShowcaseView />}

                {/* Custom Dashboards */}
                 {currentView === 'dashboards' && (
                  <DashboardsView
                    initialDashboardId={selectedSidebarDashboardId}
                    initialTabId={urlTabId}
                    onOpenMobileMenu={() => setIsSidebarOpen(true)}
                    onDashboardCatalogChange={(dashboards) => {
                      // Just updates the list; the dedicated effect above
                      // (gated on currentView === 'dashboards') handles
                      // redirecting to a fallback when needed.
                      setSidebarDashboards(dashboards.map(dashboard => ({
                        id: dashboard.id,
                        ownerId: dashboard.ownerId,
                        title: dashboard.title
                      })));
                    }}
                  />
                )}

                {currentView === 'energy' && (
                  <EnergyView onNavigate={navigateTo} />
                )}

               {/* System section views */}
               {currentView === 'system-devices' && <InboxView mode="manager" />}
               {currentView === 'system-inbox' && <InboxView mode="discovery" />}
               {currentView === 'system-diagnostics' && <DiagnosticsView />}
               {currentView === 'system-audit' && <AuditLogsView />}
               {currentView === 'system-executions' && <ExecutionLogsView />}
               {currentView === 'system-ha' && <HomeAssistantSettingsView />}
               {currentView === 'system-cameras' && <NativeCamerasView />}
               {currentView === 'system-onboarding' && setupStatus && (
                 <OnboardingView
                   statusProvider={setupStatus}
                   userContext={user}
                   onCompleted={() => setSetupStatus((prev) => prev ? { ...prev, requiresOnboarding: false } : null)}
                 />
               )}
               {currentView === 'system-users' && <UsersView currentUserId={user?.id ?? null} />}
               {currentView === 'home-conversation' && (
                 <HomeConversationView
                   pendingPrompt={pendingHomeConversationPrompt}
                   onPendingPromptConsumed={(id) => {
                     setPendingHomeConversationPrompt(current => current?.id === id ? null : current);
                   }}
                 />
               )}
             </Suspense>
           </PageFrame>
        </section>

      </main>

      <ChangePasswordModal 
        isOpen={showPwdModal} 
        onClose={() => setShowPwdModal(false)}
        onSuccess={handlePasswordChanged}
      />
      <DemoGuideOverlay onNavigate={navigateTo} />
      {globalWakeNotice && (
        <GlobalWakeNotice notice={globalWakeNotice} isProcessing={isGlobalWakeProcessing} />
      )}
      <GlobalWakeListener
        enabled={status === 'authenticated' && !loadingSetup && !setupStatus?.requiresOnboarding}
        interruptOnly={isGlobalWakeProcessing || isGlobalWakeSpeaking}
        onCommand={handleGlobalWakeCommand}
        onWakeInterrupt={handleGlobalWakeInterrupt}
        onStatusChange={handleGlobalWakeStatusChange}
      />
      {showProfileModal && user && (
        <UserProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onSaved={(profile) => setLocalProfile(profile)}
        />
      )}
    </div>
  );
}

export default App;
