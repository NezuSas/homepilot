import React, { useEffect, useRef, useState } from 'react';

export type CameraFeedMode = 'stream' | 'snapshot';

interface CameraMediaFrameProps {
  active: boolean;
  streamUrl: string;
  snapshotUrl: string;
  preferredMode: CameraFeedMode;
  alt: string;
  className?: string;
  snapshotIntervalMs?: number;
  onModeChange: (mode: CameraFeedMode) => void;
  onReady: () => void;
  onFailure: () => void;
}

const DEFAULT_SNAPSHOT_INTERVAL_MS = 5_000;

function withRefreshMarker(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}refresh=${Date.now()}`;
}

export const CameraMediaFrame: React.FC<CameraMediaFrameProps> = ({
  active,
  streamUrl,
  snapshotUrl,
  preferredMode,
  alt,
  className,
  snapshotIntervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS,
  onModeChange,
  onReady,
  onFailure,
}) => {
  const [mode, setMode] = useState<CameraFeedMode>(preferredMode);
  const [source, setSource] = useState(preferredMode === 'stream' && active ? streamUrl : '');
  const currentObjectUrlRef = useRef<string | null>(null);
  const staleObjectUrlRef = useRef<string | null>(null);
  const hasReadyFrameRef = useRef(false);
  const onModeChangeRef = useRef(onModeChange);
  const onReadyRef = useRef(onReady);
  const onFailureRef = useRef(onFailure);

  useEffect(() => {
    onModeChangeRef.current = onModeChange;
    onReadyRef.current = onReady;
    onFailureRef.current = onFailure;
  }, [onFailure, onModeChange, onReady]);

  useEffect(() => {
    setMode(preferredMode);
    if (!active) {
      setSource('');
      return;
    }

    if (preferredMode === 'stream') {
      hasReadyFrameRef.current = false;
      setSource(streamUrl);
      return;
    }

    setSource(currentObjectUrlRef.current || '');
  }, [active, preferredMode, streamUrl]);

  useEffect(() => {
    if (!active || mode !== 'snapshot' || !snapshotUrl) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let consecutiveFailures = 0;

    const schedule = () => {
      if (!cancelled) timer = setTimeout(refresh, snapshotIntervalMs);
    };

    const refresh = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(withRefreshMarker(snapshotUrl), {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`CAMERA_SNAPSHOT_${response.status}`);

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('CAMERA_SNAPSHOT_INVALID_CONTENT');
        if (cancelled) return;

        const nextObjectUrl = URL.createObjectURL(blob);
        if (staleObjectUrlRef.current) URL.revokeObjectURL(staleObjectUrlRef.current);
        staleObjectUrlRef.current = currentObjectUrlRef.current;
        currentObjectUrlRef.current = nextObjectUrl;
        consecutiveFailures = 0;
        setSource(nextObjectUrl);
      } catch (error: unknown) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        consecutiveFailures += 1;
        if (!hasReadyFrameRef.current && consecutiveFailures >= 2) onFailureRef.current();
      } finally {
        schedule();
      }
    };

    void refresh();
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [active, mode, snapshotIntervalMs, snapshotUrl]);

  useEffect(() => () => {
    if (currentObjectUrlRef.current) URL.revokeObjectURL(currentObjectUrlRef.current);
    if (staleObjectUrlRef.current) URL.revokeObjectURL(staleObjectUrlRef.current);
  }, []);

  if (!source) return null;

  return (
    <img
      src={source}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onLoad={() => {
        hasReadyFrameRef.current = true;
        if (staleObjectUrlRef.current) {
          URL.revokeObjectURL(staleObjectUrlRef.current);
          staleObjectUrlRef.current = null;
        }
        onReadyRef.current();
      }}
      onError={() => {
        if (mode === 'stream') {
          setSource(currentObjectUrlRef.current || '');
          setMode('snapshot');
          onModeChangeRef.current('snapshot');
          return;
        }
        if (!hasReadyFrameRef.current) onFailureRef.current();
      }}
    />
  );
};
