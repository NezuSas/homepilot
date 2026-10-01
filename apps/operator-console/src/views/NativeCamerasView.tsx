import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, Edit2, Trash2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NativeCameraSettingsSkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { IconButton } from '../components/ui/IconButton';
import { StatusPill } from '../components/ui/StatusPill';
import { AlertBanner } from '../components/ui/AlertBanner';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from '../components/ConfirmModal';
import { sourceTypeDefaults, type DiscoveredCamera, type NativeCamera, type NativeCameraFormData, type NativeCameraPayload, type NativeCameraSourceType } from './nativeCameras/types';
import { NativeCameraDiscoveryModal } from './nativeCameras/NativeCameraDiscoveryModal';
import { NativeCameraFormModal } from './nativeCameras/NativeCameraFormModal';

export const NativeCamerasView: React.FC = () => {
  const { t } = useTranslation();
  const homes = useDeviceSnapshotStore((state) => state.homes);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  
  const [cameras, setCameras] = useState<NativeCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoading = useInitialLoading(isLoading);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Discovery State
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCamera[]>([]);
  const [selectedDiscoveredCamera, setSelectedDiscoveredCamera] = useState<string>('');
  const [selectedSourceType, setSelectedSourceType] = useState<NativeCameraSourceType>('onvif-ptz');
  
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<NativeCameraFormData>({
    sourceType: 'onvif-ptz',
    name: '',
    host: '',
    rtspPort: 554,
    onvifPort: 8000,
    username: '',
    password: '',
    rtspPath: '',
    homeId: homes[0]?.id || ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'warning' | 'danger'; message: string } | null>(null);

  useEffect(() => {
    if (homes.length > 0 && !formData.homeId) {
      setFormData(prev => ({ ...prev, homeId: homes[0].id }));
    }
  }, [homes, formData.homeId]);

  const activeHomeId = homes[0]?.id ?? null;

  const loadCameras = useCallback(async (showSpinner = true) => {
    if (!activeHomeId) return;

    if (showSpinner) setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras?homeId=${encodeURIComponent(activeHomeId)}`);
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
      }
    } catch (err) {
      console.error('Failed to load cameras', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [activeHomeId]);

  useEffect(() => {
    let active = true;
    void refreshSnapshot().finally(() => {
      if (active && useDeviceSnapshotStore.getState().homes.length === 0) setIsLoading(false);
    });
    return () => { active = false; };
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!activeHomeId) return;
    void loadCameras();
  }, [activeHomeId, loadCameras]);

  const handleOpenDiscoveryModal = async () => {
    setIsDiscoveryModalOpen(true);
    setIsDiscovering(true);
    setSelectedSourceType('onvif-ptz');
    setSelectedDiscoveredCamera('manual');
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras/discover`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredCameras(data.devices || []);
      } else {
        setDiscoveredCameras([]);
      }
    } catch (err) {
      console.error(err);
      setDiscoveredCameras([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleDiscoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDiscoveryModalOpen(false);

    setEditingDevice(null);
    setFormError(null);

    const selectedCamera = discoveredCameras.find(camera => camera.urn === selectedDiscoveredCamera);

    if (selectedSourceType !== 'onvif-ptz') {
      const defaults = sourceTypeDefaults[selectedSourceType];
      setFormData({
        name: selectedCamera?.name || '',
        sourceType: selectedSourceType,
        host: selectedCamera?.host || '',
        rtspPort: defaults.rtspPort,
        onvifPort: selectedCamera?.onvifPort || defaults.onvifPort,
        username: '',
        password: '',
        rtspPath: defaults.rtspPath,
        homeId: homes[0]?.id || ''
      });
    } else if (selectedDiscoveredCamera === 'manual' || !selectedDiscoveredCamera) {
      setFormData({
        name: '',
        sourceType: 'onvif-ptz',
        host: '',
        rtspPort: 554,
        onvifPort: 8000,
        username: '',
        password: '',
        rtspPath: '',
        homeId: homes[0]?.id || ''
      });
    } else {
      if (selectedCamera) {
        setFormData({
          name: selectedCamera.name,
          sourceType: 'onvif-ptz',
          host: selectedCamera.host,
          rtspPort: 554, // usually ONVIF profile provides RTSP, but we set default
          onvifPort: selectedCamera.onvifPort,
          username: '',
          password: '',
          rtspPath: '',
          homeId: homes[0]?.id || ''
        });
      }
    }
    
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (camera: NativeCamera) => {
    setEditingDevice(camera.deviceId);
    setFormData({
      name: camera.name,
      sourceType: camera.sourceType || 'onvif-ptz',
      host: camera.host,
      rtspPort: camera.rtspPort,
      onvifPort: camera.onvifPort,
      username: '', // Deliberately blank for security
      password: '', // Deliberately blank for security
      rtspPath: camera.rtspPath,
      homeId: camera.homeId
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSourceTypeChange = (sourceType: string) => {
    if (!['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'].includes(sourceType)) return;
    const typedSource = sourceType as NativeCameraSourceType;
    const defaults = sourceTypeDefaults[typedSource];
    setFormData(prev => ({
      ...prev,
      sourceType: typedSource,
      rtspPort: defaults.rtspPort,
      onvifPort: defaults.onvifPort,
      rtspPath: prev.rtspPath || defaults.rtspPath,
    }));
  };

  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

  const handleDelete = (deviceId: string) => {
    setDeviceToDelete(deviceId);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    
    // Basic validation
    if (!formData.name.trim()) return setFormError(t('native_cameras.form.errors.name_required'));
    if (!formData.host.trim()) return setFormError(t('native_cameras.form.errors.host_required'));
    if (!editingDevice && !formData.username) return setFormError(t('native_cameras.form.errors.username_required'));
    if (!editingDevice && !formData.password) return setFormError(t('native_cameras.form.errors.password_required'));
    if (formData.sourceType !== 'onvif-ptz' && !formData.rtspPath.trim()) {
      return setFormError(t('native_cameras.form.errors.rtsp_path_required'));
    }
    
    const rtspPortNum = Number(formData.rtspPort);
    const onvifPortNum = Number(formData.onvifPort);
    
    if (isNaN(rtspPortNum) || rtspPortNum < 1 || rtspPortNum > 65535) {
      return setFormError(t('native_cameras.form.errors.port_invalid'));
    }

    setIsSubmitting(true);

    try {
      const payload: NativeCameraPayload = {
        sourceType: formData.sourceType,
        name: formData.name,
        host: formData.host,
        rtspPort: rtspPortNum,
        onvifPort: onvifPortNum,
        rtspPath: formData.rtspPath
      };

      if (formData.username) payload.username = formData.username;
      if (formData.password) payload.password = formData.password;
      
      const url = editingDevice 
        ? `${API_BASE_URL}/api/v1/native-cameras/${editingDevice}`
        : `${API_BASE_URL}/api/v1/native-cameras`;
        
      if (!editingDevice) {
        payload.homeId = formData.homeId;
      }

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
            onClick={handleOpenDiscoveryModal}
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
        className="mb-6"
      />

      {notice && (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[140] w-auto sm:left-auto sm:right-6 sm:top-6 sm:w-native-camera-toast">
          <AlertBanner
            variant={notice.variant}
            icon={AlertTriangle}
            message={notice.message}
            action={(
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="border-current/20 text-current hover:bg-current/10"
                onClick={() => setNotice(null)}
              >
                {t('common.close', 'Cerrar')}
              </Button>
            )}
          />
        </div>
      )}

      {initialLoading ? (
        <NativeCameraSettingsSkeleton label={t('common.loading')} />
      ) : cameras.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 px-4 text-center border-dashed border-border/60 bg-muted/20">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6 border border-border/50">
            <Camera size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-panel-title font-medium text-foreground mb-2">{t('native_cameras.empty_title')}</h3>
          <p className="text-muted-foreground max-w-md mb-8">{t('native_cameras.empty_description')}</p>
          <Button variant="primary" onClick={handleOpenDiscoveryModal}>
            <Plus size={16} /> {t('native_cameras.add_camera')}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map(camera => (
            <Card key={camera.deviceId} className="flex flex-col h-full bg-card border-border/50 overflow-hidden group">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-border/30">
                      <Camera size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-section-title font-medium text-foreground truncate max-w-copy-md">{camera.name}</h3>
                      <div className="flex items-center mt-1">
                        <StatusPill 
                          variant={camera.enabled ? 'success' : 'neutral'}
                        >
                          {camera.enabled ? t('native_cameras.status_active') : t('native_cameras.status_inactive')}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-micro font-bold uppercase tracking-status text-muted-foreground">
                        {t(`native_cameras.source_types.${camera.sourceType || 'onvif-ptz'}`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      icon={Edit2}
                      label={t('common.edit')}
                      onClick={() => handleOpenEditModal(camera)}
                      variant="ghost"
                      size="sm"
                    />
                    <IconButton
                      icon={Trash2}
                      label={t('common.delete')}
                      onClick={() => handleDelete(camera.deviceId)}
                      variant="danger"
                      size="sm"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <div className="flex justify-between text-body">
                    <span className="text-muted-foreground">{t('native_cameras.host_label')}</span>
                    <span className="text-foreground/80 font-mono">{camera.host}</span>
                  </div>
                  <div className="flex justify-between text-body">
                    <span className="text-muted-foreground">{t('native_cameras.rtsp_port_label')}</span>
                    <span className="text-foreground/80 font-mono">{camera.rtspPort}</span>
                  </div>
                  <div className="flex justify-between text-body">
                    <span className="text-muted-foreground">{t('native_cameras.rtsp_path_label')}</span>
                    <span className="text-foreground/80 font-mono truncate max-w-copy-md">{camera.rtspPath || '/'}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NativeCameraDiscoveryModal
        isDiscoveryModalOpen={isDiscoveryModalOpen}
        isDiscovering={isDiscovering}
        discoveredCameras={discoveredCameras}
        selectedDiscoveredCamera={selectedDiscoveredCamera}
        selectedSourceType={selectedSourceType}
        setIsDiscoveryModalOpen={setIsDiscoveryModalOpen}
        setSelectedDiscoveredCamera={setSelectedDiscoveredCamera}
        setSelectedSourceType={setSelectedSourceType}
        handleDiscoverySubmit={handleDiscoverySubmit}
      />

      <NativeCameraFormModal
        isModalOpen={isModalOpen}
        isSubmitting={isSubmitting}
        editingDevice={editingDevice}
        formError={formError}
        formData={formData}
        setFormData={setFormData}
        homes={homes}
        handleSourceTypeChange={handleSourceTypeChange}
        handleSubmit={handleSubmit}
        setIsModalOpen={setIsModalOpen}
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
