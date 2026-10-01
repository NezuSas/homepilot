import React, { type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { SearchableSelectField } from '../../components/ui/SearchableSelectField';
import { Button } from '../../components/ui/Button';
import type { SnapshotHome } from '../../stores/useDeviceSnapshotStore';
import type { NativeCameraFormData } from './types';

interface NativeCameraFormModalProps {
  isModalOpen: boolean;
  isSubmitting: boolean;
  editingDevice: string | null;
  formError: string | null;
  formData: NativeCameraFormData;
  setFormData: Dispatch<SetStateAction<NativeCameraFormData>>;
  homes: SnapshotHome[];
  handleSourceTypeChange: (sourceType: string) => void;
  handleSubmit: (event: React.FormEvent) => void | Promise<void>;
  setIsModalOpen: (open: boolean) => void;
}

export function NativeCameraFormModal({
  isModalOpen, isSubmitting, editingDevice, formError, formData, setFormData,
  homes, handleSourceTypeChange, handleSubmit, setIsModalOpen,
}: NativeCameraFormModalProps) {
  const { t } = useTranslation();
  const needsManualRtspPath = formData.sourceType !== 'onvif-ptz';
  return (
      <Modal 
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingDevice ? t('native_cameras.form.title_edit') : t('native_cameras.form.title_create')}
        description={t('native_cameras.form.subtitle')}
        className="max-w-xl"
        headerAlign="start"
        headerClassName="p-4 pb-3 pr-14 sm:p-5 sm:pb-3 sm:pr-14"
        contentClassName="px-4 pb-4 sm:px-5 sm:pb-5"
      >
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          {formError && (
            <div className="sm:col-span-2 p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-body">
              {formError}
            </div>
          )}

          {!editingDevice && (
            <SearchableSelectField
              label={t('native_cameras.form.field_home')}
              value={formData.homeId}
              onChange={(value) => setFormData({...formData, homeId: value})}
              options={homes.map(h => ({ value: h.id, label: h.name || h.id }))}
            />
          )}

          <SearchableSelectField
            label={t('native_cameras.form.field_source_type')}
            value={formData.sourceType}
            onChange={handleSourceTypeChange}
            options={[
              { value: 'onvif-ptz', label: t('native_cameras.source_types.onvif-ptz') },
              { value: 'rtsp-dvr', label: t('native_cameras.source_types.rtsp-dvr') },
              { value: 'sonoff-rtsp', label: t('native_cameras.source_types.sonoff-rtsp') },
            ]}
            className="sm:col-span-2"
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
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
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

          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
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

          <div className="flex justify-end gap-2 pt-3 border-t border-border sm:col-span-2">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
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
  );
}
