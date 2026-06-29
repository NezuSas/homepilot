import React, { useEffect, useRef, useState } from 'react';

export type CameraFeedMode = 'hls' | 'stream' | 'snapshot';

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
  onReady: () => void;
  onFailure: () => void;
}

const DEFAULT_SNAPSHOT_INTERVAL_MS = 5_000;
const HLS_MAX_RETRIES = 10;
const HLS_RETRY_DELAY_MS = 2_000;

function withRefreshMarker(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}refresh=${Date.now()}`;
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
      setSource(streamUrl);
      return;
    }

    setSource(currentObjectUrlRef.current || '');
  }, [active, hlsUrl, preferredMode, streamUrl]);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!active || mode !== 'hls' || !hlsUrl || !videoElement) return;

    const video = videoElement;
    let player: import('hls.js').default | null = null;
    let cancelled = false;
    let fallbackTriggered = false;

    const fallbackToMjpeg = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      setMode('stream');
      setSource(streamUrl);
      onModeChangeRef.current('stream');
    };

    const tryPlay = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        await video.play();
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Play promise was interrupted (e.g., watchdog destroyed the player). Ignore to allow retry.
          return;
        }
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          // Autoplay policy prevented playback.
          // DO NOT fallback to MJPEG here. The video has loaded the stream and will fire onCanPlay,
          // displaying the first frame as a poster. This is perfectly acceptable for a tile.
          console.warn('[CameraMediaFrame] Autoplay blocked by browser policy. Video will remain paused on first frame.');
          hasReadyFrameRef.current = true;
          onReadyRef.current();
        } else {
          fallbackToMjpeg();
        }
      }
    };

    const initialize = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        await tryPlay();
        return;
      }

      const { default: Hls } = await import('hls.js/light');
      if (cancelled) return;
      if (!Hls.isSupported()) {
        fallbackToMjpeg();
        return;
      }

      let retryCount = 0;

      const createPlayer = () => {
        if (cancelled) return;
        if (player) player.destroy();

        const hlsPlayer = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        player = hlsPlayer;
        hlsPlayer.attachMedia(video);
        
        // Append a cache-buster so that retries fetch a fresh manifest.
        // This is crucial because the initial manifest might be empty while ffmpeg starts.
        const bustUrl = withRefreshMarker(hlsUrl);
        hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => hlsPlayer.loadSource(bustUrl));
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
          void tryPlay();
        });
        
        let watchdog = setTimeout(() => {
          if (cancelled || hasReadyFrameRef.current) return;
          console.warn('[CameraMediaFrame] HLS watchdog timeout, retrying...');
          retryCount += 1;
          if (retryCount < HLS_MAX_RETRIES && !cancelled) {
            hlsPlayer.destroy();
            player = null;
            setTimeout(createPlayer, HLS_RETRY_DELAY_MS);
          } else {
            fallbackToMjpeg();
          }
        }, 8000);

        hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          clearTimeout(watchdog);
          retryCount += 1;
          if (retryCount < HLS_MAX_RETRIES && !cancelled) {
            hlsPlayer.destroy();
            player = null;
            setTimeout(createPlayer, HLS_RETRY_DELAY_MS);
          } else {
            fallbackToMjpeg();
          }
        });
      };

      createPlayer();
    };

    void initialize().catch(fallbackToMjpeg);

    return () => {
      cancelled = true;
      player?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [active, hlsUrl, mode, streamUrl, videoElement]);

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

  if (mode === 'hls' && active && hlsUrl) {
    return (
      <video
        ref={setVideoElement}
        aria-label={alt}
        className={className}
        autoPlay
        muted
        playsInline
        onCanPlay={() => {
          hasReadyFrameRef.current = true;
          onReadyRef.current();
        }}
      />
    );
  }

  if (!source) {
    // Dead-end: no source available after fallback chain — notify failure
    if (mode === 'snapshot' && !currentObjectUrlRef.current && hasReadyFrameRef.current === false) {
      // Schedule onFailure in a microtask to avoid calling during render
      queueMicrotask(() => onFailureRef.current());
    }
    return null;
  }

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
