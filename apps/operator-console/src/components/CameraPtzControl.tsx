import React, { useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { IconButton } from './ui/IconButton';

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

  const sendCommand = useCallback((name: 'ptz_move' | 'ptz_stop', params?: PtzVector) => {
    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: { name, params } }),
    }).catch(() => {
      // Best-effort: a dropped PTZ command has no persistent state to reconcile.
    });
  }, [deviceId]);

  const startMove = useCallback((vector: PtzVector) => {
    isMovingRef.current = true;
    sendCommand('ptz_move', vector);
  }, [sendCommand]);

  const stopMove = useCallback(() => {
    if (!isMovingRef.current) return;
    isMovingRef.current = false;
    sendCommand('ptz_stop');
  }, [sendCommand]);

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
