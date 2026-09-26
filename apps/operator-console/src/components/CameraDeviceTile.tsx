import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Maximize2, MoveDiagonal, RefreshCw, VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import { disambiguate, humanize } from '../lib/naming-utils';
import { cn } from '../lib/utils';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { CameraMediaFrame, type CameraFeedMode } from './CameraMediaFrame';
import { CameraViewerModal } from './CameraViewerModal';
import { Button } from './ui/Button';
import { DeviceTileShell } from './ui/DeviceTileShell';
import { StatusPill } from './ui/StatusPill';

interface CameraDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  isDuplicateName?: boolean;
  title?: string;
  dashboard?: boolean;
}

interface CameraMediaSession {
  snapshotPath: string;
  streamPath: string;
  hlsPath?: string;
}

function absoluteApiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function isCameraMediaSession(value: unknown): value is CameraMediaSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return typeof session.snapshotPath === 'string'
    && typeof session.streamPath === 'string'
    && (session.hlsPath === undefined || typeof session.hlsPath === 'string');
}

export const CameraDeviceTile: React.FC<CameraDeviceTileProps> = ({ device, roomName, isDuplicateName, title, dashboard = false }) => {
  const { t } = useTranslation();
  const reportedUnavailable = isDeviceUnavailable(device);
  const [media, setMedia] = useState<CameraMediaSession | null>(null);
  const mediaRef = useRef<CameraMediaSession | null>(null);
  const mediaDeviceIdRef = useRef(device.id);
  const [isConnecting, setIsConnecting] = useState(!reportedUnavailable);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const [hasFeedError, setHasFeedError] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<CameraMediaSession | null>(null);
  const viewerSessionControllerRef = useRef<AbortController | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [feedMode, setFeedMode] = useState<CameraFeedMode>(device.integrationSource === 'native-camera' ? 'snapshot' : 'stream');
  const displayName = title?.trim() || (isDuplicateName
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name));

  useEffect(() => {
    const controller = new AbortController();
    if (mediaDeviceIdRef.current !== device.id) {
      mediaDeviceIdRef.current = device.id;
      mediaRef.current = null;
      setMedia(null);
      setHasRenderedFrame(false);
    }
    const isInitialLoad = mediaRef.current === null;
    let sessionReady = false;
    if (isInitialLoad) {
      setIsConnecting(true);
      setHasFeedError(false);
    }

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/camera/session`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`CAMERA_SESSION_${response.status}`);
      const payload: unknown = await response.json();
      if (!isCameraMediaSession(payload)) throw new Error('INVALID_CAMERA_SESSION');
      mediaRef.current = payload;
      setMedia(payload);
      if (isInitialLoad) setFeedMode(device.integrationSource === 'native-camera' ? 'snapshot' : 'stream');
      sessionReady = true;
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (reportedUnavailable) setMedia(null);
      setHasFeedError(true);
    }).finally(() => {
      if (!controller.signal.aborted && !sessionReady) setIsConnecting(false);
    });

    return () => controller.abort();
  }, [device.id, device.integrationSource, reportedUnavailable, retryVersion]);

  useEffect(() => {
    if (!media) return;
    const timer = window.setInterval(() => setRetryVersion((version) => version + 1), 25 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [media]);

  useEffect(() => () => viewerSessionControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!isViewerOpen) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/camera/session?includeHls=true`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(`CAMERA_VIEWER_RENEWAL_${response.status}`);
        const payload: unknown = await response.json();
        if (!isCameraMediaSession(payload)) throw new Error('INVALID_CAMERA_VIEWER_SESSION');
        if (!controller.signal.aborted) setViewerMedia(payload);
      }).catch(() => undefined);
    }, 25 * 60 * 1000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [device.id, isViewerOpen]);

  const unavailable = reportedUnavailable && !media;
  const ptzSupported = useMemo(
    () => device.capabilities?.some((capability) => capability.type === 'camera_ptz') ?? false,
    [device.capabilities]
  );

  const openViewer = useCallback(() => {
    if (unavailable || !media || hasFeedError) return;

    viewerSessionControllerRef.current?.abort();
    const controller = new AbortController();
    viewerSessionControllerRef.current = controller;
    setViewerMedia(media);
    setIsViewerOpen(true);

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/camera/session?includeHls=true`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`CAMERA_VIEWER_SESSION_${response.status}`);
      const payload: unknown = await response.json();
      if (!isCameraMediaSession(payload)) throw new Error('INVALID_CAMERA_VIEWER_SESSION');
      if (!controller.signal.aborted) setViewerMedia(payload);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('[CameraDeviceTile] Enhanced camera viewer session unavailable, keeping direct stream.', error);
      }
    });
  }, [device.id, hasFeedError, media, unavailable]);

  const closeViewer = useCallback(() => {
    viewerSessionControllerRef.current?.abort();
    viewerSessionControllerRef.current = null;
    setIsViewerOpen(false);
    setViewerMedia(null);
  }, []);
  const handleFeedModeChange = useCallback((mode: CameraFeedMode) => {
    setFeedMode(mode);
    setIsConnecting(true);
    setHasFeedError(false);
  }, []);
  const handleFeedReady = useCallback(() => {
    setHasRenderedFrame(true);
    setIsConnecting(false);
    setHasFeedError(false);
  }, []);
  const handleFeedFailure = useCallback(() => {
    setIsConnecting(false);
    setHasFeedError(true);
  }, []);
  const retry = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setFeedMode(device.integrationSource === 'native-camera' ? 'snapshot' : 'stream');
    setIsConnecting(true);
    setHasFeedError(false);
    setRetryVersion((version) => version + 1);
  };

  const hlsUrl = media?.hlsPath ? absoluteApiUrl(media.hlsPath) : undefined;
  const streamUrl = media ? absoluteApiUrl(media.streamPath) : '';
  const snapshotUrl = media ? absoluteApiUrl(media.snapshotPath) : '';
  const isLive = Boolean(media) && !unavailable && !hasFeedError && !isConnecting;
  const statusLabel = unavailable
    ? t('camera.unavailable')
    : hasFeedError
      ? t('camera.connection_error')
      : isConnecting || !media
        ? t('camera.connecting')
        : '';

  return (
    <>
      <DeviceTileShell
        active={Boolean(media) && !unavailable && !hasFeedError}
        aria-busy={isConnecting && !hasRenderedFrame || undefined}
        className="min-h-0 p-0"
      >
        <div className={cn('relative aspect-video w-full overflow-hidden bg-muted/70', dashboard && 'max-h-[22rem]')}>
          {media && !hasFeedError && !unavailable && (
            <CameraMediaFrame
              active={!isViewerOpen}
              hlsUrl={hlsUrl}
              streamUrl={streamUrl}
              snapshotUrl={snapshotUrl}
              preferredMode={feedMode}
              snapshotIntervalMs={15_000}
              alt={t('camera.feed_alt', { name: displayName })}
              className="absolute inset-0 block h-full w-full object-cover"
              onModeChange={handleFeedModeChange}
              onReady={handleFeedReady}
              onFailure={handleFeedFailure}
            />
          )}
          {(isConnecting && !hasRenderedFrame || !media || hasFeedError || unavailable) && (
            <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2.5 bg-muted text-muted-foreground" role="status" aria-live="polite">
              {isConnecting && !hasFeedError && !unavailable
                ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                : <VideoOff className="h-6 w-6 text-danger" aria-hidden="true" />}
              {statusLabel}
            </div>
          )}

          {ptzSupported && isLive && (
            <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-pill border border-white/15 bg-black/60 text-white backdrop-blur-md" title={t('camera.ptz.badge')}>
              <MoveDiagonal className="h-3.5 w-3.5" />
            </div>
          )}

        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/50 p-3 sm:p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-card-title font-semibold tracking-tight text-foreground">{displayName}</span>
              {device.vendor === 'matter' && <StatusPill variant="primary">{t('camera.matter_badge')}</StatusPill>}
            </div>
            <span className="mt-1 block truncate text-caption text-muted-foreground">{roomName || t('common.unassigned')}</span>
          </div>
          {isLive && (
            <Button type="button" size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); openViewer(); }} aria-label={t('camera.open_viewer', { name: displayName })} className="h-10 w-10 shrink-0 rounded-control text-muted-foreground hover:text-primary">
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {(hasFeedError || unavailable) && (
            <Button size="icon" variant="outline" onClick={retry} aria-label={t('camera.retry')} className="shrink-0 rounded-pill">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DeviceTileShell>

      {viewerMedia && (
        <CameraViewerModal
          isOpen={isViewerOpen}
          name={displayName}
          roomName={roomName}
          streamUrl={absoluteApiUrl(viewerMedia.streamPath)}
          hlsUrl={viewerMedia.hlsPath ? absoluteApiUrl(viewerMedia.hlsPath) : undefined}
          snapshotUrl={absoluteApiUrl(viewerMedia.snapshotPath)}
          preferredMode={viewerMedia.hlsPath ? 'hls' : device.integrationSource === 'native-camera' ? 'snapshot' : 'stream'}
          onClose={closeViewer}
          deviceId={device.id}
          ptzSupported={ptzSupported}
        />
      )}
    </>
  );
};
