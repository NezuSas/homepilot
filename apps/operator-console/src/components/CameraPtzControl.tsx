import React, { useCallback, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { IconButton } from './ui/IconButton';

// Comfortably inside the camera's own move timeout, so a held control never lapses between refreshes.
const PTZ_MOVE_REFRESH_MS = 3000;

interface CameraPtzControlProps {
  deviceId: string;
}

interface PtzVector {
  pan?: number;
  tilt?: number;
  zoom?: number;
}

const PTZ_SPEED = 0.5;

/**
 * Press-and-hold PTZ pad: pointerdown issues a continuous-move command,
 * pointerup/leave stops it. Only rendered when the device's `camera_ptz`
 * capability is present (see CameraDeviceTile), matching the negotiated
 * ONVIF PTZ support surfaced by the backend.
 */
export const CameraPtzControl: React.FC<CameraPtzControlProps> = ({ deviceId }) => {
  const { t } = useTranslation();
  const isMovingRef = useRef(false);
  const refreshRef = useRef<number | undefined>(undefined);

  const sendCommand = useCallback((name: 'ptz_move' | 'ptz_stop', params?: PtzVector) => {
    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: { name, params } }),
    }).catch(() => {
      // Best-effort: a dropped move is simply not performed. A dropped stop is covered by the move
      // timeout the backend sends, after which the camera stops on its own.
    });
  }, [deviceId]);

  // The camera self-stops after the move timeout so a Stop that never arrives cannot leave it panning to
  // its mechanical limit. Refreshing the move while the control is held keeps a long hold working.
  const startMove = useCallback((vector: PtzVector) => {
    isMovingRef.current = true;
    sendCommand('ptz_move', vector);
    window.clearInterval(refreshRef.current);
    refreshRef.current = window.setInterval(() => sendCommand('ptz_move', vector), PTZ_MOVE_REFRESH_MS);
  }, [sendCommand]);

  const stopMove = useCallback(() => {
    window.clearInterval(refreshRef.current);
    refreshRef.current = undefined;
    if (!isMovingRef.current) return;
    isMovingRef.current = false;
    sendCommand('ptz_stop');
  }, [sendCommand]);

  // A control released outside the component, or unmounted mid-hold, must not keep sending moves.
  useEffect(() => () => window.clearInterval(refreshRef.current), []);

  const holdProps = (vector: PtzVector) => ({
    onPointerDown: () => startMove(vector),
    onPointerUp: stopMove,
    onPointerLeave: stopMove,
    onPointerCancel: stopMove,
  });

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('camera.ptz.pan_up')}>
      <span />
      <IconButton icon={ChevronUp} label={t('camera.ptz.pan_up')} variant="ghost" size="md" {...holdProps({ tilt: PTZ_SPEED })} />
      <span />

      <IconButton icon={ChevronLeft} label={t('camera.ptz.pan_left')} variant="ghost" size="md" {...holdProps({ pan: -PTZ_SPEED })} />
      <IconButton icon={ZoomIn} label={t('camera.ptz.zoom_in')} variant="ghost" size="md" {...holdProps({ zoom: PTZ_SPEED })} />
      <IconButton icon={ChevronRight} label={t('camera.ptz.pan_right')} variant="ghost" size="md" {...holdProps({ pan: PTZ_SPEED })} />

      <span />
      <IconButton icon={ChevronDown} label={t('camera.ptz.pan_down')} variant="ghost" size="md" {...holdProps({ tilt: -PTZ_SPEED })} />
      <IconButton icon={ZoomOut} label={t('camera.ptz.zoom_out')} variant="ghost" size="md" {...holdProps({ zoom: -PTZ_SPEED })} />
    </div>
  );
};
