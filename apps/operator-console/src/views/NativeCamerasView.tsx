import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react';
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
  name: string;
  host: string;
  onvifPort: number;
  rtspPort: number;
  rtspPath: string;
  enabled: boolean;
  createdAt: string;
}

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
  const [discoveredCameras, setDiscoveredCameras] = useState<any[]>([]);
  const [selectedDiscoveredCamera, setSelectedDiscoveredCamera] = useState<string>('');
  
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
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
    setSelectedDiscoveredCamera('');
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

    if (selectedDiscoveredCamera === 'manual' || !selectedDiscoveredCamera) {
      setFormData({
        name: '',
        host: '',
        rtspPort: 554,
        onvifPort: 8000,
        username: '',
        password: '',
        rtspPath: '',
        homeId: homes[0]?.id || ''
      });
    } else {
      const cam = discoveredCameras.find(c => c.urn === selectedDiscoveredCamera);
      if (cam) {
        setFormData({
          name: cam.name,
          host: cam.host,
          rtspPort: 554, // usually ONVIF profile provides RTSP, but we set default
          onvifPort: cam.onvifPort,
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
    
    // Basic validation
    if (!formData.name.trim()) return setFormError(t('native_cameras.form.errors.name_required'));
    if (!formData.host.trim()) return setFormError(t('native_cameras.form.errors.host_required'));
    if (!editingDevice && !formData.username) return setFormError(t('native_cameras.form.errors.username_required'));
    if (!editingDevice && !formData.password) return setFormError(t('native_cameras.form.errors.password_required'));
    
    const rtspPortNum = Number(formData.rtspPort);
    const onvifPortNum = Number(formData.onvifPort);
    
    if (isNaN(rtspPortNum) || rtspPortNum < 1 || rtspPortNum > 65535) {
      return setFormError(t('native_cameras.form.errors.port_invalid'));
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
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

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : cameras.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 px-4 text-center border-dashed border-border/60 bg-muted/20">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6 border border-border/50">
            <Camera size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium text-foreground mb-2">{t('native_cameras.empty_title')}</h3>
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
                      <h3 className="text-lg font-medium text-foreground truncate max-w-[150px]">{camera.name}</h3>
                      <div className="flex items-center mt-1">
                        <StatusPill 
                          variant={camera.enabled ? 'success' : 'neutral'}
                        >
                          {camera.enabled ? t('native_cameras.status_active') : t('native_cameras.status_inactive')}
                        </StatusPill>
                      </div>
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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('native_cameras.host_label')}</span>
                    <span className="text-foreground/80 font-mono">{camera.host}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('native_cameras.rtsp_port_label')}</span>
                    <span className="text-foreground/80 font-mono">{camera.rtspPort}</span>
                  </div>
                  <div className="flex justify-between text-sm">
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
        title={t('native_cameras.discovery.title', 'Seleccionar dispositivo ONVIF')}
        description={t('native_cameras.discovery.subtitle', 'Seleccione el dispositivo ONVIF descubierto en la red.')}
      >
        {isDiscovering ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-muted-foreground">{t('native_cameras.discovery.searching', 'Buscando dispositivos ONVIF...')}</p>
          </div>
        ) : (
          <form onSubmit={handleDiscoverySubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors shadow-sm">
                <input 
                  type="radio" 
                  name="discovered_camera" 
                  value="manual"
                  checked={selectedDiscoveredCamera === 'manual' || discoveredCameras.length === 0}
                  onChange={() => setSelectedDiscoveredCamera('manual')}
                  className="w-4 h-4 text-primary bg-background border-input focus:ring-primary focus:ring-2 focus:ring-offset-background"
                />
                <span className="text-sm font-medium text-foreground">{t('native_cameras.discovery.manual', 'Configurar dispositivo ONVIF manualmente')}</span>
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
                    <span className="text-sm font-medium text-foreground">{cam.name}</span>
                    <span className="text-xs text-muted-foreground/80 font-mono">{cam.host}:{cam.onvifPort}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Button 
                type="submit" 
                variant="primary"
                disabled={!selectedDiscoveredCamera && discoveredCameras.length > 0}
              >
                {t('native_cameras.discovery.submit', 'Enviar')}
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
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {formError}
            </div>
          )}

          {!editingDevice && (
            <SelectField
              label={t('native_cameras.form.field_home')}
              value={formData.homeId}
              onChange={(e: any) => setFormData({...formData, homeId: e.target.value})}
              options={homes.map(h => ({ value: h.id, label: h.name || h.id }))}
            />
          )}

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
            helperText={t('native_cameras.form.field_host_hint', 'La IP o nombre de host del dispositivo ONVIF.')}
            required
          />

          <Input
            label={t('native_cameras.form.field_onvif_port')}
            value={formData.onvifPort}
            onChange={(e) => setFormData({...formData, onvifPort: parseInt(e.target.value) || 8000})}
            type="number"
            min="1"
            max="65535"
            required
          />

          <div className="grid grid-cols-2 gap-4">
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
        title={t('native_cameras.delete_confirm_title', 'Eliminar cámara')}
        description={t('native_cameras.delete_confirm_description', '¿Está seguro de que desea eliminar esta cámara? Esta acción no se puede deshacer.')}
        confirmText={t('common.delete', 'Eliminar')}
      />
    </PageFrame>
  );
};
