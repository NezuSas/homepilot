import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { withRefreshMarker, type CameraFeedMode } from './cameraMediaFrameModel';

interface Options {
  active: boolean;
  mode: CameraFeedMode;
  snapshotUrl: string;
  snapshotIntervalMs: number;
  currentObjectUrlRef: MutableRefObject<string | null>;
  staleObjectUrlRef: MutableRefObject<string | null>;
  hasReadyFrameRef: MutableRefObject<boolean>;
  onFailureRef: MutableRefObject<() => void>;
  setSource: Dispatch<SetStateAction<string>>;
}

/**
 * Polls the camera snapshot endpoint while in snapshot mode, rotating blob URLs
 * and reporting a failure after repeated errors before any frame was shown.
 */
export function useSnapshotPolling({
  active, mode, snapshotUrl, snapshotIntervalMs, currentObjectUrlRef, staleObjectUrlRef, hasReadyFrameRef, onFailureRef, setSource,
}: Options) {
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
      if (document.hidden) {
        schedule();
        return;
      }
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
  }, [
    active, currentObjectUrlRef, hasReadyFrameRef, mode, onFailureRef, setSource,
    snapshotIntervalMs, snapshotUrl, staleObjectUrlRef,
  ]);
}
