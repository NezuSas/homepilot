import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Camera, Maximize2, RefreshCw, VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../../config';
import { apiFetch } from '../../../lib/apiClient';
import { CameraMediaFrame, type CameraFeedMode } from '../../../components/CameraMediaFrame';
import { CameraViewerModal } from '../../../components/CameraViewerModal';
import { Button } from '../../../components/ui/Button';
import { StatusPill } from '../../../components/ui/StatusPill';

interface CameraMediaSession {
  snapshotPath: string;
  streamPath: string;
  hlsPath?: string;
}

function isCameraMediaSession(value: unknown): value is CameraMediaSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return typeof session.snapshotPath === 'string' && typeof session.streamPath === 'string';
}

function absoluteSessionUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

export function SectionCameraCard({ deviceId, title }: { deviceId: string; title: string }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<CameraMediaSession | null>(null);
  const [hasFeedError, setHasFeedError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [feedMode, setFeedMode] = useState<CameraFeedMode>('snapshot');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerSession, setViewerSession] = useState<CameraMediaSession | null>(null);
  const viewerSessionControllerRef = useRef<AbortController | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsConnecting(true);
    setHasFeedError(false);

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/camera/session`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`SESSION_${response.status}`);
      const payload: unknown = await response.json();
      if (!isCameraMediaSession(payload)) throw new Error('INVALID_SESSION');
      setSession(payload);
      setFeedMode('snapshot');
      setIsConnecting(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setHasFeedError(true);
      setIsConnecting(false);
    });

    return () => controller.abort();
  }, [deviceId, retryVersion]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setRetryVersion((version) => version + 1), 25 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => () => viewerSessionControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!isViewerOpen) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/camera/session?includeHls=true`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(`VIEWER_SESSION_RENEWAL_${response.status}`);
        const payload: unknown = await response.json();
        if (!isCameraMediaSession(payload)) throw new Error('INVALID_VIEWER_SESSION');
        if (!controller.signal.aborted) setViewerSession(payload);
      }).catch(() => undefined);
    }, 25 * 60 * 1000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [deviceId, isViewerOpen]);

  const retry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setFeedMode('snapshot');
    setIsConnecting(true);
    setHasFeedError(false);
    setRetryVersion((version) => version + 1);
  };

  if (isConnecting && !session) {
    return <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 bg-black/40"><div className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5"><Camera className="h-5 w-5 animate-pulse text-white/70" /></div><span className="text-caption font-medium text-white/60">{t('camera.connecting')}</span></div>;
  }

  if (hasFeedError || !session) {
    return <div className="relative flex h-full w-full flex-col items-center justify-center gap-2.5 bg-scene-preview"><div className="grid h-11 w-11 place-items-center rounded-full border border-danger/25 bg-danger/10 text-danger"><VideoOff className="h-5 w-5" /></div><span className="text-caption font-medium text-white/60">{t('camera.connection_error')}</span><Button type="button" size="icon" variant="outline" onClick={retry} aria-label={t('camera.retry')} className="absolute bottom-3 right-3 shrink-0 rounded-pill"><RefreshCw className="h-4 w-4" /></Button></div>;
  }

  const openViewer = () => {
    viewerSessionControllerRef.current?.abort();
    const controller = new AbortController();
    viewerSessionControllerRef.current = controller;
    setViewerSession(session);
    setIsViewerOpen(true);
    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/camera/session?includeHls=true`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`VIEWER_SESSION_${response.status}`);
      const payload: unknown = await response.json();
      if (!isCameraMediaSession(payload)) throw new Error('INVALID_VIEWER_SESSION');
      if (!controller.signal.aborted) setViewerSession(payload);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('[SectionCameraCard] Enhanced camera viewer session unavailable, keeping direct stream.', error);
    });
  };
  const closeViewer = () => { viewerSessionControllerRef.current?.abort(); viewerSessionControllerRef.current = null; setIsViewerOpen(false); setViewerSession(null); };
  const streamUrl = absoluteSessionUrl(session.streamPath);
  const snapshotUrl = absoluteSessionUrl(session.snapshotPath);
  const hlsUrl = session.hlsPath ? absoluteSessionUrl(session.hlsPath) : undefined;

  return (
    <>
      <Button type="button" variant="ghost" size="md" className="group relative h-full w-full overflow-hidden text-left" onClick={(event) => { event.stopPropagation(); if (!hasFeedError) openViewer(); }} aria-label={t('camera.open_viewer', { name: title })}>
        <CameraMediaFrame active={!isViewerOpen} hlsUrl={hlsUrl} streamUrl={streamUrl} snapshotUrl={snapshotUrl} preferredMode={feedMode} snapshotIntervalMs={15_000} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onModeChange={setFeedMode} onReady={() => {}} onFailure={() => setHasFeedError(true)} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-pill border border-white/15 bg-black/60 px-2.5 py-1 text-micro font-semibold uppercase tracking-wide text-white backdrop-blur-md">
          <StatusPill variant="primary" dot dotLabel={t('camera.snapshot')} />{t('camera.snapshot')}
        </div>
        <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:scale-110"><Maximize2 className="h-4 w-4" /></span>
      </Button>
      {viewerSession && <CameraViewerModal isOpen={isViewerOpen} name={title} streamUrl={absoluteSessionUrl(viewerSession.streamPath)} hlsUrl={viewerSession.hlsPath ? absoluteSessionUrl(viewerSession.hlsPath) : undefined} snapshotUrl={absoluteSessionUrl(viewerSession.snapshotPath)} preferredMode={viewerSession.hlsPath ? 'hls' : 'snapshot'} onClose={closeViewer} />}
    </>
  );
}
