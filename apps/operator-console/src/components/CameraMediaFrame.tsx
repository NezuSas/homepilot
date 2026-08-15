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
const HLS_MAX_RETRIES = 2;
const HLS_RETRY_DELAY_MS = 1_500;
const HLS_WATCHDOG_MS = 5_000;
// hls.js can silently stop advancing (e.g. the upstream feed stalls without a
// fatal player error) leaving the last frame frozen on screen indefinitely.
// Poll playback progress and force a reconnect if it stops advancing.
const STALL_CHECK_INTERVAL_MS = 3_000;
const STALL_THRESHOLD_MS = 9_000;

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

  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoElementRef.current;
    if (!active || mode !== 'hls' || !hlsUrl || !video) return;
    let player: import('hls.js').default | null = null;
    let cancelled = false;
    let fallbackTriggered = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    let stallCheckTimer: ReturnType<typeof setInterval> | undefined;
    let lastPlaybackTime = -1;
    let lastProgressAt = Date.now();

    hasReadyFrameRef.current = false;

    const clearTimers = () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      if (watchdogTimer) window.clearTimeout(watchdogTimer);
      if (stallCheckTimer) window.clearInterval(stallCheckTimer);
    };

    const fallbackToStream = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      clearTimers();
      player?.destroy();
      player = null;
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
        console.warn('[CameraMediaFrame] video.play() threw an error (likely autoplay blocked or aborted):', err);
        // DO NOT fallback to MJPEG here!
        // If autoplay is blocked or aborted, the video will just remain paused, which is fine.
        // onCanPlay will still fire if the media successfully buffered.
      }
    };

    const initialize = async () => {
      const { default: Hls } = await import('hls.js/light');
      if (cancelled) return;

      if (Hls.isSupported()) {
        let retryCount = 0;

        const resetStallTracking = () => {
          lastPlaybackTime = -1;
          lastProgressAt = Date.now();
        };

        const createPlayer = () => {
          if (cancelled) return;
          if (player) player.destroy();
          resetStallTracking();

          const hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
          });
          player = hlsPlayer;
          hlsPlayer.attachMedia(video);
          
          const bustUrl = withRefreshMarker(hlsUrl);
          hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => hlsPlayer.loadSource(bustUrl));
          hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            void tryPlay();
          });

          watchdogTimer = window.setTimeout(() => {
            if (cancelled || hasReadyFrameRef.current) return;
            console.warn('[CameraMediaFrame] HLS watchdog timeout, retrying...');
            retryCount += 1;
            if (retryCount < HLS_MAX_RETRIES && !cancelled) {
              hlsPlayer.destroy();
              player = null;
              retryTimer = window.setTimeout(createPlayer, HLS_RETRY_DELAY_MS);
            } else {
              console.warn('[CameraMediaFrame] HLS retries exhausted, falling back to direct stream.');
              fallbackToStream();
            }
          }, HLS_WATCHDOG_MS);

          hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            console.warn('[CameraMediaFrame] HLS fatal error:', data.type);
            if (watchdogTimer) window.clearTimeout(watchdogTimer);
            retryCount += 1;
            if (retryCount < HLS_MAX_RETRIES && !cancelled) {
              hlsPlayer.destroy();
              player = null;
              retryTimer = window.setTimeout(createPlayer, HLS_RETRY_DELAY_MS);
            } else {
              console.warn('[CameraMediaFrame] HLS fatal error exhausted retries, falling back to direct stream.');
              fallbackToStream();
            }
          });
        };

        createPlayer();

        stallCheckTimer = window.setInterval(() => {
          if (cancelled || !hasReadyFrameRef.current || video.paused) return;
          if (video.currentTime !== lastPlaybackTime) {
            lastPlaybackTime = video.currentTime;
            lastProgressAt = Date.now();
            retryCount = 0;
            return;
          }
          if (Date.now() - lastProgressAt < STALL_THRESHOLD_MS) return;

          console.warn('[CameraMediaFrame] HLS playback stalled (frozen frame), reconnecting...');
          retryCount += 1;
          if (retryCount < HLS_MAX_RETRIES) {
            createPlayer();
          } else {
            fallbackToStream();
          }
        }, STALL_CHECK_INTERVAL_MS);
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        await tryPlay();

        stallCheckTimer = window.setInterval(() => {
          if (cancelled || !hasReadyFrameRef.current || video.paused) return;
          if (video.currentTime !== lastPlaybackTime) {
            lastPlaybackTime = video.currentTime;
            lastProgressAt = Date.now();
            return;
          }
          if (Date.now() - lastProgressAt < STALL_THRESHOLD_MS) return;

          console.warn('[CameraMediaFrame] Native HLS playback stalled (frozen frame), reloading source...');
          lastProgressAt = Date.now();
          hasReadyFrameRef.current = false;
          video.src = withRefreshMarker(hlsUrl);
          void tryPlay();
        }, STALL_CHECK_INTERVAL_MS);
        return;
      }

      fallbackToStream();
    };

    const markReady = () => {
      hasReadyFrameRef.current = true;
      if (watchdogTimer) window.clearTimeout(watchdogTimer);
    };
    video.addEventListener('canplay', markReady);
    video.addEventListener('error', fallbackToStream);

    void initialize().catch(fallbackToStream);

    return () => {
      cancelled = true;
      clearTimers();
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('error', fallbackToStream);
      player?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [active, hlsUrl, mode, streamUrl]);

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
        ref={videoElementRef}
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

  if (mode === 'stream' && active && streamUrl) {
    return (
      <>
        {source && (
          <img
            src={source}
            alt={alt}
            className={className}
            referrerPolicy="no-referrer"
            onLoad={() => {
              hasReadyFrameRef.current = true;
              onReadyRef.current();
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
          onLoad={() => {
            hasReadyFrameRef.current = true;
            setStreamReady(true);
            onReadyRef.current();
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
