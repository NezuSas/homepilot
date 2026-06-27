import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Maximize2, RefreshCw, VideoOff } from 'lucide-react';
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

interface CameraDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  isDuplicateName?: boolean;
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

export const CameraDeviceTile: React.FC<CameraDeviceTileProps> = ({ device, roomName, isDuplicateName }) => {
  const { t } = useTranslation();
  const reportedUnavailable = isDeviceUnavailable(device);
  const [media, setMedia] = useState<CameraMediaSession | null>(null);
  const mediaRef = useRef<CameraMediaSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(!reportedUnavailable);
  const [hasFeedError, setHasFeedError] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [feedMode, setFeedMode] = useState<CameraFeedMode>('stream');
  const displayName = isDuplicateName
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  useEffect(() => {
    const controller = new AbortController();
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
      if (isInitialLoad) setFeedMode(payload.hlsPath ? 'hls' : 'stream');
      sessionReady = true;
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (reportedUnavailable) setMedia(null);
      setHasFeedError(true);
    }).finally(() => {
      if (!controller.signal.aborted && !sessionReady) setIsConnecting(false);
    });

    return () => controller.abort();
  }, [device.id, reportedUnavailable, retryVersion]);

  useEffect(() => {
    if (!media) return;
    const timer = window.setInterval(() => setRetryVersion((version) => version + 1), 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [media]);

  const unavailable = reportedUnavailable && !media;

  const openViewer = useCallback(() => {
    if (!unavailable && media && !hasFeedError) setIsViewerOpen(true);
  }, [hasFeedError, media, unavailable]);

  const closeViewer = useCallback(() => setIsViewerOpen(false), []);
  const handleFeedModeChange = useCallback((mode: CameraFeedMode) => {
    setFeedMode(mode);
    setIsConnecting(true);
    setHasFeedError(false);
  }, []);
  const handleFeedReady = useCallback(() => {
    setIsConnecting(false);
    setHasFeedError(false);
  }, []);
  const handleFeedFailure = useCallback(() => {
    setIsConnecting(false);
    setHasFeedError(true);
  }, []);
  const retry = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setFeedMode(media?.hlsPath ? 'hls' : 'stream');
    setIsConnecting(true);
    setHasFeedError(false);
    setRetryVersion((version) => version + 1);
  };

  const hlsUrl = media?.hlsPath ? absoluteApiUrl(media.hlsPath) : undefined;
  const streamUrl = media ? absoluteApiUrl(media.streamPath) : '';
  const snapshotUrl = media ? absoluteApiUrl(media.snapshotPath) : '';
  const statusLabel = unavailable
    ? t('camera.unavailable')
    : hasFeedError
      ? t('camera.connection_error')
      : isConnecting || !media
        ? t('camera.connecting')
        : feedMode === 'snapshot'
          ? t('camera.snapshot')
          : t('camera.live');

  return (
    <>
      <DeviceTileShell
        active={Boolean(media) && !unavailable && !hasFeedError}
        interactive={Boolean(media) && !unavailable && !hasFeedError}
        onClick={openViewer}
        aria-label={t('camera.open_viewer', { name: displayName })}
        className="min-h-0 p-0"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted/70">
          {media && !hasFeedError && !unavailable && (
            <CameraMediaFrame
              active={!isViewerOpen}
              hlsUrl={hlsUrl}
              streamUrl={streamUrl}
              snapshotUrl={snapshotUrl}
              preferredMode={feedMode}
              alt={t('camera.feed_alt', { name: displayName })}
              className="h-full w-full object-cover"
              onModeChange={handleFeedModeChange}
              onReady={handleFeedReady}
              onFailure={handleFeedFailure}
            />
          )}
          {(!media || hasFeedError || unavailable || isConnecting) && (
            <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/70 text-muted-foreground">
              {isConnecting ? <Camera className="h-7 w-7 animate-pulse" /> : <VideoOff className="h-7 w-7" />}
              <span className="text-caption font-medium">{statusLabel}</span>
            </div>
          )}

          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-pill border border-white/15 bg-black/65 px-2.5 py-1 text-micro font-semibold text-white backdrop-blur-md">
            <span className={cn('h-1.5 w-1.5 rounded-full', unavailable || hasFeedError ? 'bg-danger' : feedMode === 'snapshot' ? 'bg-warning' : media ? 'animate-pulse bg-success' : 'bg-warning')} />
            {statusLabel}
          </div>

          {media && !unavailable && !hasFeedError && (
            <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-pill border border-white/15 bg-black/65 text-white backdrop-blur-md">
              <Maximize2 className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="min-w-0">
            <span className="block truncate text-card-title font-semibold tracking-tight text-foreground">{displayName}</span>
            <span className="mt-1 block truncate text-caption text-muted-foreground">{roomName || t('common.unassigned')}</span>
          </div>
          {(hasFeedError || unavailable) && (
            <Button size="icon" variant="outline" onClick={retry} aria-label={t('camera.retry')} className="shrink-0 rounded-pill">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DeviceTileShell>

      {media && (
        <CameraViewerModal
          isOpen={isViewerOpen}
          name={displayName}
          roomName={roomName}
          streamUrl={streamUrl}
          hlsUrl={hlsUrl}
          snapshotUrl={snapshotUrl}
          preferredMode={feedMode}
          onClose={closeViewer}
        />
      )}
    </>
  );
};
