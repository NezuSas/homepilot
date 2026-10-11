import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { NativeCamera, NativeCameraNotice } from './types';

/** Tracks the camera pending deletion and performs the confirmed DELETE request. */
export function useNativeCameraDelete(
  setCameras: Dispatch<SetStateAction<NativeCamera[]>>,
  setNotice: (notice: NativeCameraNotice | null) => void,
) {
  const { t } = useTranslation();
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deviceToDelete) return;

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras/${deviceToDelete}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setCameras(prev => prev.filter(c => c.deviceId !== deviceToDelete));
      } else {
        setNotice({ variant: 'danger', message: t('native_cameras.messages.delete_failed') });
      }
    } catch (err) {
      console.error(err);
      setNotice({ variant: 'danger', message: t('native_cameras.messages.delete_failed') });
    } finally {
      setDeviceToDelete(null);
    }
  };

  return { deviceToDelete, setDeviceToDelete, confirmDelete };
}
