import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, Edit2, Trash2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { PageFrame } from '../components/ui/PageFrame';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { SelectField } from '../components/ui/SelectField';
import { StatusPill } from '../components/ui/StatusPill';
import { AlertBanner } from '../components/ui/AlertBanner';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from '../components/ConfirmModal';

interface NativeCamera {
  deviceId: string;
  homeId: string;
  sourceType: NativeCameraSourceType;
  name: string;
  host: string;
  onvifPort: number;
  rtspPort: number;
  rtspPath: string;
  enabled: boolean;
  createdAt: string;
}

type NativeCameraSourceType = 'onvif-ptz' | 'rtsp-dvr' | 'sonoff-rtsp';

interface DiscoveredCamera {
  urn: string;
  name: string;
  host: string;
  onvifPort: number;
}

interface NativeCameraPayload {
  sourceType: NativeCameraSourceType;
  name: string;
  host: string;
  rtspPort: number;
  onvifPort: number;
  rtspPath: string;
  username?: string;
  password?: string;
  homeId?: string;
}

const sourceTypeDefaults: Record<NativeCameraSourceType, { rtspPort: number; onvifPort: number; rtspPath: string }> = {
  'onvif-ptz': { rtspPort: 554, onvifPort: 8000, rtspPath: '' },
  'rtsp-dvr': { rtspPort: 554, onvifPort: 80, rtspPath: '' },
  'sonoff-rtsp': { rtspPort: 554, onvifPort: 80, rtspPath: '/av_stream/ch0' },
};

export const NativeCamerasView: React.FC = () => {
  const { t } = useTranslation();
  const { homes } = useDeviceSnapshotStore();
  
  const [cameras, setCameras] = useState<NativeCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [formData, setFormData] = useState({
    sourceType: 'onvif-ptz' as NativeCameraSourceType,
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
  const needsManualRtspPath = formData.sourceType !== 'onvif-ptz';

  useEffect(() => {
    if (homes.length > 0 && !formData.homeId) {
      setFormData(prev => ({ ...prev, homeId: homes[0].id }));
    }
  }, [homes, formData.homeId]);

  const loadCameras = async (showSpinner = true) => {
    if (!homes.length) {
      setIsLoading(false);
      return;
    }
    
    if (showSpinner) setIsLoading(true);
    try {
      // For now, load for the first home
      const homeId = homes[0].id;
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras?homeId=${homeId}`);
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
      }
    } catch (err) {
      console.error('Failed to load cameras', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCameras(cameras.length === 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homes[0]?.id]);

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
        alert(t('native_cameras.messages.delete_failed'));
      }
    } catch (err) {
      console.error(err);
      alert(t('native_cameras.messages.delete_failed'));
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
    <PageFrame>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <SectionHeader 
          title={t('native_cameras.title')} 
          subtitle={t('native_cameras.subtitle')}
        />
        <Button 
          variant="primary" 
          onClick={handleOpenDiscoveryModal}
          disabled={homes.length === 0}
        >
          <Plus size={16} /> {t('native_cameras.add_camera')}
        </Button>
      </div>

      <AlertBanner
        variant="info"
        icon={ShieldAlert}
        title={t('ha_settings.security.title')}
        message={t('native_cameras.security_note')}
        className="mb-6"
      />

      {notice && (
        <div className="fixed right-4 top-4 z-[140] w-[min(420px,calc(100vw-2rem))]">
          <AlertBanner
            variant={notice.variant}
            icon={AlertTriangle}
            message={notice.message}
            action={(
              <button
                type="button"
                className="rounded-pill border border-current/20 px-3 py-1 text-caption font-semibold"
                onClick={() => setNotice(null)}
              >
                {t('common.close', 'Cerrar')}
              </button>
            )}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
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
                      <h3 className="text-section-title font-medium text-foreground truncate max-w-[150px]">{camera.name}</h3>
                      <div className="flex items-center mt-1">
                        <StatusPill 
                          variant={camera.enabled ? 'success' : 'neutral'}
                        >
                          {camera.enabled ? t('native_cameras.status_active') : t('native_cameras.status_inactive')}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-micro font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {t(`native_cameras.source_types.${camera.sourceType || 'onvif-ptz'}`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenEditModal(camera)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(camera.deviceId)}
                      className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
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
                    <span className="text-foreground/80 font-mono truncate max-w-[150px]">{camera.rtspPath || '/'}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isDiscoveryModalOpen}
        onClose={() => !isDiscovering && setIsDiscoveryModalOpen(false)}
        title={t('native_cameras.discovery.title')}
        description={t('native_cameras.discovery.subtitle')}
        className="max-w-[min(1120px,calc(100vw-2rem))]"
      >
        {isDiscovering ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-body text-muted-foreground">{t('native_cameras.discovery.searching', 'Buscando dispositivos ONVIF...')}</p>
          </div>
        ) : (
          <form onSubmit={handleDiscoverySubmit} className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {(['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'] as NativeCameraSourceType[]).map(sourceType => (
                <label
                  key={sourceType}
                  className={`flex min-h-[136px] cursor-pointer flex-col gap-2 rounded-card border p-4 transition-colors ${
                    selectedSourceType === sourceType
                      ? 'border-primary/60 bg-primary/10 text-foreground'
                      : 'border-border/50 bg-card hover:bg-muted/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="native_camera_source_type"
                    value={sourceType}
                    checked={selectedSourceType === sourceType}
                    onChange={() => {
                      setSelectedSourceType(sourceType);
                      setSelectedDiscoveredCamera('manual');
                    }}
                    className="sr-only"
                  />
                  <span className="text-body font-semibold">{t(`native_cameras.source_types.${sourceType}`)}</span>
                  <span className="text-caption leading-relaxed text-muted-foreground">{t(`native_cameras.discovery.profile_hints.${sourceType}`)}</span>
                </label>
              ))}
            </div>

            <div className="space-y-3">
              {selectedSourceType !== 'onvif-ptz' && (
                <AlertBanner
                  variant="info"
                  message={t(`native_cameras.discovery.manual_profile_notes.${selectedSourceType}`)}
                />
              )}

              <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 custom-scrollbar lg:grid-cols-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors shadow-sm">
                    <input
                      type="radio"
                      name="discovered_camera"
                      value="manual"
                      checked={selectedDiscoveredCamera === 'manual' || discoveredCameras.length === 0}
                      onChange={() => setSelectedDiscoveredCamera('manual')}
                      className="w-4 h-4 text-primary bg-background border-input focus:ring-primary focus:ring-2 focus:ring-offset-background"
                    />
                    <div className="flex flex-col">
                      <span className="text-body font-medium text-foreground">
                        {selectedSourceType === 'onvif-ptz'
                          ? t('native_cameras.discovery.manual')
                          : t('native_cameras.discovery.manual_rtsp')}
                      </span>
                      {selectedSourceType !== 'onvif-ptz' && (
                        <span className="text-caption text-muted-foreground">
                          {t(`native_cameras.discovery.manual_rtsp_hints.${selectedSourceType}`)}
                        </span>
                      )}
                    </div>
                  </label>

                  {discoveredCameras.map(cam => (
                    <label key={cam.urn} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors shadow-sm">
                      <input
                        type="radio"
                        name="discovered_camera"
                        value={cam.urn}
                        checked={selectedDiscoveredCamera === cam.urn}
                        onChange={() => setSelectedDiscoveredCamera(cam.urn)}
                        className="w-4 h-4 text-primary bg-background border-input focus:ring-primary focus:ring-2 focus:ring-offset-background"
                      />
                      <div className="flex flex-col">
                        <span className="text-body font-medium text-foreground">{cam.name}</span>
                        <span className="text-caption text-muted-foreground/80 font-mono">
                          {selectedSourceType === 'onvif-ptz'
                            ? `${cam.host}:${cam.onvifPort}`
                            : `${cam.host} · ${t('native_cameras.discovery.detected_by_onvif')}`}
                        </span>
                      </div>
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Button 
                type="submit" 
                variant="primary"
                disabled={!selectedDiscoveredCamera && discoveredCameras.length > 0}
              >
                {t('native_cameras.discovery.submit')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal 
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingDevice ? t('native_cameras.form.title_edit') : t('native_cameras.form.title_create')}
        description={t('native_cameras.form.subtitle')}
        className="max-w-[min(960px,calc(100vw-2rem))]"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-body">
              {formError}
            </div>
          )}

          {!editingDevice && (
            <SelectField
              label={t('native_cameras.form.field_home')}
              value={formData.homeId}
              onChange={(value) => setFormData({...formData, homeId: value})}
              options={homes.map(h => ({ value: h.id, label: h.name || h.id }))}
            />
          )}

          <SelectField
            label={t('native_cameras.form.field_source_type')}
            value={formData.sourceType}
            onChange={handleSourceTypeChange}
            options={[
              { value: 'onvif-ptz', label: t('native_cameras.source_types.onvif-ptz') },
              { value: 'rtsp-dvr', label: t('native_cameras.source_types.rtsp-dvr') },
              { value: 'sonoff-rtsp', label: t('native_cameras.source_types.sonoff-rtsp') },
            ]}
            helperText={t(`native_cameras.source_type_hints.${formData.sourceType}`)}
          />

          <Input
            label={t('native_cameras.form.field_name')}
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder={t('native_cameras.form.field_name_placeholder')}
            required
          />

          <Input
            label={t('native_cameras.form.field_host')}
            value={formData.host}
            onChange={(e) => setFormData({...formData, host: e.target.value})}
            placeholder={t('native_cameras.form.field_host_placeholder')}
            helperText={t(`native_cameras.form.field_host_hints.${formData.sourceType}`)}
            required
          />

          {formData.sourceType === 'onvif-ptz' && (
            <Input
              label={t('native_cameras.form.field_onvif_port')}
              value={formData.onvifPort}
              onChange={(e) => setFormData({...formData, onvifPort: parseInt(e.target.value, 10) || 8000})}
              type="number"
              min="1"
              max="65535"
              required
            />
          )}

          {needsManualRtspPath && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('native_cameras.form.field_rtsp_port')}
                value={formData.rtspPort}
                onChange={(e) => setFormData({...formData, rtspPort: parseInt(e.target.value, 10) || 554})}
                type="number"
                min="1"
                max="65535"
                helperText={t('native_cameras.form.field_rtsp_port_hint')}
                required
              />
              <Input
                label={t('native_cameras.form.field_rtsp_path')}
                value={formData.rtspPath}
                onChange={(e) => setFormData({...formData, rtspPath: e.target.value})}
                placeholder={t(`native_cameras.form.field_rtsp_path_placeholders.${formData.sourceType}`)}
                helperText={t(`native_cameras.form.field_rtsp_path_hints.${formData.sourceType}`)}
                required
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('native_cameras.form.field_username')}
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder={t('native_cameras.form.field_username_placeholder')}
              required={!editingDevice}
            />
            <Input
              label={t('native_cameras.form.field_password')}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder={editingDevice ? '••••••••' : t('native_cameras.form.field_password_placeholder')}
              type="password"
              required={!editingDevice}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('native_cameras.form.saving') : 
                (editingDevice ? t('native_cameras.form.submit_edit') : t('native_cameras.form.submit_create'))}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirm={confirmDelete}
        title={t('native_cameras.delete_confirm_title')}
        description={t('native_cameras.delete_confirm_description')}
        confirmText={t('common.delete', 'Eliminar')}
      />
    </PageFrame>
  );
};
