import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SNAPSHOT_INTERVAL_MS,
  withRefreshMarker,
  type CameraFeedMode,
} from './cameraMediaFrameModel';
import { useHlsPlayback } from './useHlsPlayback';
import { useSnapshotPolling } from './useSnapshotPolling';

export type { CameraFeedMode };

interface CameraMediaFrameProps {
  active: boolean;
  hlsUrl?: string;
  streamUrl: string;
  snapshotUrl: string;
  preferredMode: CameraFeedMode;
  alt: string;
  className?: string;
  snapshotIntervalMs?: number;
  onModeChange: (mode: CameraFeedMode) => void;
  onReady: (dimensions: { width: number; height: number }) => void;
  onFailure: () => void;
}

export const CameraMediaFrame: React.FC<CameraMediaFrameProps> = ({
  active,
  hlsUrl,
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
  const [source, setSource] = useState('');
  const [streamReady, setStreamReady] = useState(false);
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

    if (preferredMode === 'hls') {
      if (!hlsUrl) {
        setMode('stream');
        setSource(streamUrl);
        onModeChangeRef.current('stream');
        return;
      }
      setSource('');
      return;
    }

    if (preferredMode === 'stream') {
      hasReadyFrameRef.current = false;
      setStreamReady(false);
      // Home Assistant cameras can take a few seconds to yield the first MJPEG
      // frame. Keep a fresh snapshot visible while that connection warms up.
      setSource(snapshotUrl ? withRefreshMarker(snapshotUrl) : '');
      return;
    }

    setSource(currentObjectUrlRef.current || '');
  }, [active, hlsUrl, preferredMode, snapshotUrl, streamUrl]);

  const videoElementRef = useHlsPlayback({
    active, mode, hlsUrl, streamUrl, hasReadyFrameRef, onModeChangeRef, setMode, setSource,
  });

  useSnapshotPolling({
    active, mode, snapshotUrl, snapshotIntervalMs, currentObjectUrlRef, staleObjectUrlRef, hasReadyFrameRef, onFailureRef, setSource,
  });

  useEffect(() => () => {
    if (currentObjectUrlRef.current) URL.revokeObjectURL(currentObjectUrlRef.current);
    if (staleObjectUrlRef.current) URL.revokeObjectURL(staleObjectUrlRef.current);
  }, []);

  if (mode === 'hls' && active && hlsUrl) {
    return (
      <video
        ref={videoElementRef}
        aria-label={alt}
        className={className}
        autoPlay
        muted
        playsInline
        onCanPlay={(event) => {
          hasReadyFrameRef.current = true;
          onReadyRef.current({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight });
        }}
      />
    );
  }

  if (mode === 'stream' && active && streamUrl) {
    return (
      <>
        {source && (
          <img
            src={source}
            alt={alt}
            className={className}
            referrerPolicy="no-referrer"
            onLoad={(event) => {
              hasReadyFrameRef.current = true;
              onReadyRef.current({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
            }}
            onError={() => {
              // The direct stream can still complete successfully. A snapshot
              // failure alone must not mark the camera as unavailable.
            }}
          />
        )}
        <img
          src={streamUrl}
          alt=""
          aria-hidden="true"
          className={`${className ?? ''} absolute inset-0 transition-opacity duration-200 ${streamReady ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            hasReadyFrameRef.current = true;
            setStreamReady(true);
            onReadyRef.current({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
          }}
          onError={() => {
            if (streamReady) return;
            setMode('snapshot');
            setSource(currentObjectUrlRef.current || '');
            onModeChangeRef.current('snapshot');
          }}
        />
      </>
    );
  }

  if (!source) {
    return null;
  }

  return (
    <img
      src={source}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onLoad={(event) => {
        hasReadyFrameRef.current = true;
        if (staleObjectUrlRef.current) {
          URL.revokeObjectURL(staleObjectUrlRef.current);
          staleObjectUrlRef.current = null;
        }
        onReadyRef.current({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
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
