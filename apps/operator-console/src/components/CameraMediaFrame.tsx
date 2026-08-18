import React, { useEffect, useRef, useState } from 'react';

export type CameraFeedMode = 'live' | 'hls' | 'stream' | 'snapshot';

interface CameraMediaFrameProps {
  active: boolean;
  liveUrl?: string;
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
  liveUrl,
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

    if (preferredMode === 'live') {
      if (!liveUrl) {
        if (hlsUrl) {
          setMode('hls');
          onModeChangeRef.current('hls');
        } else {
          setMode('stream');
          setSource(streamUrl);
          onModeChangeRef.current('stream');
        }
        return;
      }
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
  }, [active, liveUrl, hlsUrl, preferredMode, snapshotUrl, streamUrl]);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Live mode: fetch a fragmented-MP4 byte stream and feed it into a
  // MediaSource as it arrives, instead of polling an HLS playlist. No
  // segment-close/playlist-refresh latency — only encode + network time.
  useEffect(() => {
    const video = videoElementRef.current;
    if (!active || mode !== 'live' || !liveUrl || !video) return;

    let cancelled = false;
    let fallbackTriggered = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    let stallCheckTimer: ReturnType<typeof setInterval> | undefined;
    let lastPlaybackTime = -1;
    let lastProgressAt = Date.now();
    let mediaSource: MediaSource | null = null;
    let sourceBuffer: SourceBuffer | null = null;
    let abortController: AbortController | undefined;
    let objectUrl: string | null = null;

    hasReadyFrameRef.current = false;

    const clearTimers = () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      if (watchdogTimer) window.clearTimeout(watchdogTimer);
      if (stallCheckTimer) window.clearInterval(stallCheckTimer);
    };

    const teardown = () => {
      clearTimers();
      abortController?.abort();
      abortController = undefined;
      sourceBuffer = null;
      mediaSource = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const fallbackToHls = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      clearTimers();
      teardown();
      if (hlsUrl) {
        setMode('hls');
        onModeChangeRef.current('hls');
      } else {
        setMode('stream');
        setSource(streamUrl);
        onModeChangeRef.current('stream');
      }
    };

    const tryPlay = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        await video.play();
      } catch (err: unknown) {
        if (cancelled) return;
        console.warn('[CameraMediaFrame] Live video.play() threw an error:', err);
      }
    };

    const pickMimeType = (): string | null => {
      if (typeof window.MediaSource === 'undefined') return null;
      const candidates = [
        'video/mp4; codecs="avc1.42E01F"',
        'video/mp4; codecs="avc1.42e01f"',
        'video/mp4; codecs="avc1.42001F"',
      ];
      return candidates.find((type) => window.MediaSource.isTypeSupported(type)) ?? null;
    };

    const scheduleRetryOrFallback = () => {
      if (cancelled) return;
      retryCount += 1;
      teardown();
      if (retryCount < HLS_MAX_RETRIES) {
        retryTimer = window.setTimeout(start, HLS_RETRY_DELAY_MS);
      } else {
        fallbackToHls();
      }
    };

    const start = () => {
      if (cancelled) return;

      const mimeType = pickMimeType();
      if (!mimeType) {
        fallbackToHls();
        return;
      }

      const ms = new MediaSource();
      mediaSource = ms;
      objectUrl = URL.createObjectURL(ms);
      video.playbackRate = 1;
      video.src = objectUrl;

      watchdogTimer = window.setTimeout(() => {
        if (cancelled || hasReadyFrameRef.current) return;
        console.warn('[CameraMediaFrame] Live watchdog timeout, retrying...');
        scheduleRetryOrFallback();
      }, HLS_WATCHDOG_MS);

      ms.addEventListener('sourceopen', () => {
        if (cancelled || mediaSource !== ms) return;

        let buffer: SourceBuffer;
        try {
          buffer = ms.addSourceBuffer(mimeType);
        } catch (err) {
          console.warn('[CameraMediaFrame] Failed to create MSE source buffer:', err);
          fallbackToHls();
          return;
        }
        sourceBuffer = buffer;

        const queue: Uint8Array[] = [];
        let appending = false;

        const processQueue = () => {
          if (cancelled || appending || sourceBuffer !== buffer || buffer.updating || queue.length === 0) return;
          const chunk = queue.shift()!;
          appending = true;
          try {
            const transferableChunk = new Uint8Array(chunk.byteLength);
            transferableChunk.set(chunk);
            buffer.appendBuffer(transferableChunk);
          } catch (err) {
            appending = false;
            console.warn('[CameraMediaFrame] MSE appendBuffer failed:', err);
            scheduleRetryOrFallback();
          }
        };

        buffer.addEventListener('updateend', () => {
          appending = false;
          if (cancelled || sourceBuffer !== buffer) return;
          // Trim old buffered ranges so a long-running session doesn't grow
          // memory unbounded.
          if (!buffer.updating && video.currentTime > 15) {
            try {
              buffer.remove(0, video.currentTime - 10);
            } catch { /* ignore */ }
          }
          // Without this, any jitter (network burst, brief decode hiccup)
          // permanently adds to the gap between playback and the live edge —
          // there's no HLS-style playlist position to re-sync against. A
          // speed-up alone isn't enough: on weaker hardware (kiosk tablets)
          // the lag often comes from decode falling behind real time, and
          // demanding an even higher decode rate via playbackRate only makes
          // that worse, so the gap keeps growing despite the "fix". Once the
          // gap is more than a couple of seconds, jump straight to the live
          // edge instead — cheap for the decoder (only the current GOP, ~1s,
          // needs decoding to resume there) and it's what actually happens
          // when the user re-opens the camera to "fix" it.
          if (!buffer.updating && buffer.buffered.length > 0 && hasReadyFrameRef.current) {
            const bufferedEnd = buffer.buffered.end(buffer.buffered.length - 1);
            const lagSeconds = bufferedEnd - video.currentTime;
            if (lagSeconds > 2) {
              video.playbackRate = 1;
              try {
                video.currentTime = Math.max(video.currentTime, bufferedEnd - 0.3);
              } catch { /* ignore */ }
            } else {
              video.playbackRate = lagSeconds > 1.2 ? 1.5 : lagSeconds > 0.6 ? 1.15 : 1;
            }
          }
          processQueue();
        });

        abortController = new AbortController();
        fetch(withRefreshMarker(liveUrl), { signal: abortController.signal, cache: 'no-store' })
          .then(async (response) => {
            if (!response.ok || !response.body) throw new Error(`CAMERA_LIVE_${response.status}`);
            const reader = response.body.getReader();
            const pump = async (): Promise<void> => {
              const { done, value } = await reader.read();
              if (cancelled) return;
              if (done) {
                // A live camera feed should never legitimately "end" while
                // this component is mounted and active — the backend closes
                // the response when the RTSP source stalls (see the
                // FfmpegMediaTranscoder stall watchdog) or the connection
                // otherwise drops. Reconnect instead of leaving the last
                // decoded frame frozen on screen forever.
                if (cancelled || abortController?.signal.aborted) return;
                console.warn('[CameraMediaFrame] Live stream ended unexpectedly, reconnecting...');
                scheduleRetryOrFallback();
                return;
              }
              if (value) queue.push(value);
              processQueue();
              return pump();
            };
            await pump();
          })
          .catch((err: unknown) => {
            if (cancelled || abortController?.signal.aborted) return;
            console.warn('[CameraMediaFrame] Live stream fetch failed:', err);
            scheduleRetryOrFallback();
          });
      });

      void tryPlay();
    };

    const markReady = () => {
      hasReadyFrameRef.current = true;
      if (watchdogTimer) window.clearTimeout(watchdogTimer);
    };
    video.addEventListener('canplay', markReady);
    video.addEventListener('error', fallbackToHls);

    start();

    stallCheckTimer = window.setInterval(() => {
      if (cancelled || !hasReadyFrameRef.current || video.paused) return;
      if (video.currentTime !== lastPlaybackTime) {
        lastPlaybackTime = video.currentTime;
        lastProgressAt = Date.now();
        retryCount = 0;
        return;
      }
      if (Date.now() - lastProgressAt < STALL_THRESHOLD_MS) return;

      console.warn('[CameraMediaFrame] Live playback stalled (frozen frame), reconnecting...');
      lastProgressAt = Date.now();
      hasReadyFrameRef.current = false;
      scheduleRetryOrFallback();
    }, STALL_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimers();
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('error', fallbackToHls);
      teardown();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [active, liveUrl, hlsUrl, mode, streamUrl]);

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
            // Native camera segments are ~1s; without these, hls.js's default
            // liveSyncDurationCount (3 segments) starts playback ~6-8s behind
            // the live edge (regular HLS, no LL-HLS partial segments to give
            // lowLatencyMode above anything to work with).
            liveSyncDurationCount: 2,
            maxLiveSyncPlaybackRate: 1.3,
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

  if ((mode === 'live' && active && liveUrl) || (mode === 'hls' && active && hlsUrl)) {
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
