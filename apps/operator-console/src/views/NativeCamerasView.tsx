import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, ShieldAlert } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { NativeCameraSettingsCard } from '../components/NativeCameraSettingsCard';
import { Button } from '../components/ui/Button';
import { NativeCameraSettingsSkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { AlertBanner } from '../components/ui/AlertBanner';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from '../components/ConfirmModal';
import type { NativeCameraNotice } from './nativeCameras/types';
import { formDataFromDiscovery } from './nativeCameras/nativeCameraForm';
import { NativeCameraDiscoveryModal } from './nativeCameras/NativeCameraDiscoveryModal';
import { NativeCameraFormModal } from './nativeCameras/NativeCameraFormModal';
import { NativeCameraNoticeToast } from './nativeCameras/NativeCameraNoticeToast';
import { useNativeCameraList } from './nativeCameras/useNativeCameraList';
import { useNativeCameraDelete } from './nativeCameras/useNativeCameraDelete';
import { useNativeCameraDiscovery } from './nativeCameras/useNativeCameraDiscovery';
import { useNativeCameraForm } from './nativeCameras/useNativeCameraForm';

export const NativeCamerasView: React.FC = () => {
  const { t } = useTranslation();
  const homes = useDeviceSnapshotStore((state) => state.homes);
  const activeHomeId = homes[0]?.id ?? null;

  const [notice, setNotice] = useState<NativeCameraNotice | null>(null);

  const { cameras, setCameras, isLoading, loadCameras } = useNativeCameraList(activeHomeId);
  const initialLoading = useInitialLoading(isLoading);
  const discovery = useNativeCameraDiscovery();
  const form = useNativeCameraForm(homes, loadCameras, setNotice);
  const { deviceToDelete, setDeviceToDelete, confirmDelete } = useNativeCameraDelete(setCameras, setNotice);

  const handleDiscoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    discovery.setIsDiscoveryModalOpen(false);

    const selectedCamera = discovery.discoveredCameras.find(camera => camera.urn === discovery.selectedDiscoveredCamera);
    form.openCreateModal(formDataFromDiscovery(
      selectedCamera,
      discovery.selectedDiscoveredCamera,
      discovery.selectedSourceType,
      homes[0]?.id || '',
    ));
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <SectionHeader
        level="view"
        icon={Camera}
        title={t('native_cameras.title')}
        subtitle={t('native_cameras.subtitle')}
        action={
          <Button
            variant="primary"
            onClick={discovery.handleOpenDiscoveryModal}
            disabled={homes.length === 0}
          >
            <Plus size={16} /> {t('native_cameras.add_camera')}
          </Button>
        }
      />

      <AlertBanner
        variant="info"
        icon={ShieldAlert}
        title={t('ha_settings.security.title')}
        message={t('native_cameras.security_note')}
        className="text-caption"
      />

      {notice && <NativeCameraNoticeToast notice={notice} onDismiss={() => setNotice(null)} />}

      {initialLoading ? (
        <NativeCameraSettingsSkeleton label={t('common.loading')} />
      ) : cameras.length === 0 ? (
        <EmptyState icon={Camera} variant="collection" title={t('native_cameras.empty_title')} description={t('native_cameras.empty_description')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cameras.map(camera => <NativeCameraSettingsCard key={camera.deviceId} camera={camera}
            onEdit={form.handleOpenEditModal} onDelete={setDeviceToDelete} />)}
        </div>
      )}

      <NativeCameraDiscoveryModal
        isDiscoveryModalOpen={discovery.isDiscoveryModalOpen}
        isDiscovering={discovery.isDiscovering}
        discoveredCameras={discovery.discoveredCameras}
        selectedDiscoveredCamera={discovery.selectedDiscoveredCamera}
        selectedSourceType={discovery.selectedSourceType}
        setIsDiscoveryModalOpen={discovery.setIsDiscoveryModalOpen}
        setSelectedDiscoveredCamera={discovery.setSelectedDiscoveredCamera}
        setSelectedSourceType={discovery.setSelectedSourceType}
        handleDiscoverySubmit={handleDiscoverySubmit}
      />

      <NativeCameraFormModal
        isModalOpen={form.isModalOpen}
        isSubmitting={form.isSubmitting}
        editingDevice={form.editingDevice}
        formError={form.formError}
        formData={form.formData}
        setFormData={form.setFormData}
        homes={homes}
        handleSourceTypeChange={form.handleSourceTypeChange}
        handleSubmit={form.handleSubmit}
        setIsModalOpen={form.setIsModalOpen}
      />

      <ConfirmModal
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirm={confirmDelete}
        title={t('native_cameras.delete_confirm_title')}
        description={t('native_cameras.delete_confirm_description')}
        confirmText={t('common.delete', 'Eliminar')}
      />
    </div>
  );
};
