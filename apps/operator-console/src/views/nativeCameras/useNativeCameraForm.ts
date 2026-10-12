import { useEffect, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { SnapshotHome } from '../../stores/useDeviceSnapshotStore';
import {
  applySourceTypeDefaults,
  buildNativeCameraPayload,
  createEmptyFormData,
  formDataFromCamera,
  isNativeCameraSourceType,
  validateNativeCameraForm,
} from './nativeCameraForm';
import type { NativeCamera, NativeCameraFormData, NativeCameraNotice } from './types';

/** Create/edit form state, validation and submission for native cameras. */
export function useNativeCameraForm(
  homes: SnapshotHome[],
  loadCameras: () => Promise<void>,
  setNotice: (notice: NativeCameraNotice | null) => void,
) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [formData, setFormData] = useState<NativeCameraFormData>(createEmptyFormData(homes[0]?.id || ''));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (homes.length > 0 && !formData.homeId) {
      setFormData(prev => ({ ...prev, homeId: homes[0].id }));
    }
  }, [homes, formData.homeId]);

  const handleOpenEditModal = (camera: NativeCamera) => {
    setEditingDevice(camera.deviceId);
    setFormData(formDataFromCamera(camera));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSourceTypeChange = (sourceType: string) => {
    if (!isNativeCameraSourceType(sourceType)) return;
    setFormData(prev => applySourceTypeDefaults(prev, sourceType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const validationKey = validateNativeCameraForm(formData, Boolean(editingDevice));
    if (validationKey) return setFormError(t(validationKey));

    setIsSubmitting(true);

    try {
      const payload = buildNativeCameraPayload(formData, Boolean(editingDevice));
      const url = editingDevice
        ? `${API_BASE_URL}/api/v1/native-cameras/${editingDevice}`
        : `${API_BASE_URL}/api/v1/native-cameras`;

      const res = await apiFetch(url, {
        method: editingDevice ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        await loadCameras();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errorMsg = errData?.error?.message || errData?.message || t('native_cameras.form.errors.save_failed');
        if (errData?.error?.code === 'NATIVE_CAMERA_ALREADY_EXISTS') {
          setNotice({ variant: 'warning', message: errorMsg || t('native_cameras.messages.already_exists') });
        }
        setFormError(errorMsg);
      }
    } catch (err) {
      console.error(err);
      setFormError(t('native_cameras.form.errors.save_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isModalOpen,
    isSubmitting,
    editingDevice,
    formError,
    formData,
    setFormData,
    setIsModalOpen,
    handleOpenEditModal,
    handleSourceTypeChange,
    handleSubmit,
  };
}
