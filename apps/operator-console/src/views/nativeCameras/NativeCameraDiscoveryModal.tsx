import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SelectableOptionCard } from '../../components/ui/SelectableOptionCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import type { DiscoveredCamera, NativeCameraSourceType } from './types';

interface NativeCameraDiscoveryModalProps {
  isDiscoveryModalOpen: boolean;
  isDiscovering: boolean;
  discoveredCameras: DiscoveredCamera[];
  selectedDiscoveredCamera: string;
  selectedSourceType: NativeCameraSourceType;
  setIsDiscoveryModalOpen: (open: boolean) => void;
  setSelectedDiscoveredCamera: (urn: string) => void;
  setSelectedSourceType: (sourceType: NativeCameraSourceType) => void;
  handleDiscoverySubmit: (event: React.FormEvent) => void;
}

export function NativeCameraDiscoveryModal({
  isDiscoveryModalOpen, isDiscovering, discoveredCameras, selectedDiscoveredCamera,
  selectedSourceType, setIsDiscoveryModalOpen, setSelectedDiscoveredCamera,
  setSelectedSourceType, handleDiscoverySubmit,
}: NativeCameraDiscoveryModalProps) {
  const { t } = useTranslation();
  return (
      <Modal
        isOpen={isDiscoveryModalOpen}
        onClose={() => !isDiscovering && setIsDiscoveryModalOpen(false)}
        title={t('native_cameras.discovery.title')}
        description={t('native_cameras.discovery.subtitle')}
        className="max-w-native-camera-modal"
      >
        {isDiscovering ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-body text-muted-foreground">{t('native_cameras.discovery.searching', 'Buscando dispositivos ONVIF...')}</p>
          </div>
        ) : (
          <form onSubmit={handleDiscoverySubmit} className="space-y-6">
            <div
              role="radiogroup"
              aria-label={t('native_cameras.form.field_source_type')}
              className="grid gap-3 md:grid-cols-3"
            >
              {(['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'] as NativeCameraSourceType[]).map(sourceType => (
                <SelectableOptionCard
                  key={sourceType}
                  checked={selectedSourceType === sourceType}
                  title={t(`native_cameras.source_types.${sourceType}`)}
                  description={t(`native_cameras.discovery.profile_hints.${sourceType}`)}
                  onClick={() => {
                      setSelectedSourceType(sourceType);
                      setSelectedDiscoveredCamera('manual');
                  }}
                  className="min-h-native-camera-card items-start p-4"
                />
              ))}
            </div>

            <div className="space-y-3">
              {selectedSourceType !== 'onvif-ptz' && (
                <AlertBanner
                  variant="info"
                  message={t(`native_cameras.discovery.manual_profile_notes.${selectedSourceType}`)}
                />
              )}

              <div
                role="radiogroup"
                aria-label={t('native_cameras.discovery.title')}
                className="grid max-h-camera-list gap-3 overflow-y-auto pr-1 custom-scrollbar lg:grid-cols-2"
              >
                  <SelectableOptionCard
                    checked={selectedDiscoveredCamera === 'manual' || discoveredCameras.length === 0}
                    title={selectedSourceType === 'onvif-ptz'
                      ? t('native_cameras.discovery.manual')
                      : t('native_cameras.discovery.manual_rtsp')}
                    description={selectedSourceType !== 'onvif-ptz'
                      ? t(`native_cameras.discovery.manual_rtsp_hints.${selectedSourceType}`)
                      : undefined}
                    onClick={() => setSelectedDiscoveredCamera('manual')}
                  />

                  {discoveredCameras.map(cam => (
                    <SelectableOptionCard
                      key={cam.urn}
                      checked={selectedDiscoveredCamera === cam.urn}
                      title={cam.name}
                      description={selectedSourceType === 'onvif-ptz'
                        ? `${cam.host}:${cam.onvifPort}`
                        : `${cam.host} · ${t('native_cameras.discovery.detected_by_onvif')}`}
                      descriptionClassName="font-mono text-muted-foreground/80"
                      onClick={() => setSelectedDiscoveredCamera(cam.urn)}
                    />
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
  );
}
