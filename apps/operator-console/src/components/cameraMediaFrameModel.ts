export type CameraFeedMode = 'hls' | 'stream' | 'snapshot';

export const DEFAULT_SNAPSHOT_INTERVAL_MS = 5_000;
export const HLS_MAX_RETRIES = 2;
export const HLS_RETRY_DELAY_MS = 1_500;
export const HLS_WATCHDOG_MS = 5_000;
// hls.js can silently stop advancing (e.g. the upstream feed stalls without a
// fatal player error) leaving the last frame frozen on screen indefinitely.
// Poll playback progress and force a reconnect if it stops advancing.
export const STALL_CHECK_INTERVAL_MS = 3_000;
export const STALL_THRESHOLD_MS = 9_000;

export function withRefreshMarker(url: string, now: number = Date.now()): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}refresh=${now}`;
}

export type PlaybackProgress = 'advanced' | 'waiting' | 'stalled';

/** Classifies one stall-check tick: the playhead moved, is still within the grace period, or froze. */
export function classifyPlaybackProgress(
  currentTime: number,
  lastPlaybackTime: number,
  lastProgressAt: number,
  now: number = Date.now(),
): PlaybackProgress {
  if (currentTime !== lastPlaybackTime) return 'advanced';
  return now - lastProgressAt < STALL_THRESHOLD_MS ? 'waiting' : 'stalled';
}
