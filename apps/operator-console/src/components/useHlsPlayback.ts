import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  HLS_MAX_RETRIES,
  HLS_RETRY_DELAY_MS,
  HLS_WATCHDOG_MS,
  STALL_CHECK_INTERVAL_MS,
  classifyPlaybackProgress,
  withRefreshMarker,
  type CameraFeedMode,
} from './cameraMediaFrameModel';

interface Options {
  active: boolean;
  mode: CameraFeedMode;
  hlsUrl?: string;
  streamUrl: string;
  hasReadyFrameRef: MutableRefObject<boolean>;
  onModeChangeRef: MutableRefObject<(mode: CameraFeedMode) => void>;
  setMode: Dispatch<SetStateAction<CameraFeedMode>>;
  setSource: Dispatch<SetStateAction<string>>;
}

/**
 * Drives an HLS session on the returned video ref (hls.js or native playback),
 * with retries, a first-frame watchdog and frozen-frame detection. Falls back to
 * the direct stream when the session cannot be sustained.
 */
export function useHlsPlayback({
  active, mode, hlsUrl, streamUrl, hasReadyFrameRef, onModeChangeRef, setMode, setSource,
}: Options) {
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
          const progress = classifyPlaybackProgress(video.currentTime, lastPlaybackTime, lastProgressAt);
          if (progress === 'advanced') {
            lastPlaybackTime = video.currentTime;
            lastProgressAt = Date.now();
            retryCount = 0;
            return;
          }
          if (progress === 'waiting') return;

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
          const progress = classifyPlaybackProgress(video.currentTime, lastPlaybackTime, lastProgressAt);
          if (progress === 'advanced') {
            lastPlaybackTime = video.currentTime;
            lastProgressAt = Date.now();
            return;
          }
          if (progress === 'waiting') return;

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
  }, [active, hasReadyFrameRef, hlsUrl, mode, onModeChangeRef, setMode, setSource, streamUrl]);

  return videoElementRef;
}
