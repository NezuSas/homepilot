import { useTranslation } from 'react-i18next';
import { IntegrationBadge } from '../../../components/IntegrationBadge';
import { Modal } from '../../../components/ui/Modal';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import type { SectionCardIcon, SensorScale, SensorVisualStyle } from './sectionCardCatalog';
import { SensorMetricCard } from './SensorMetricCard';

interface SensorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: SnapshotDevice;
  title: string;
  icon?: SectionCardIcon;
  roomName?: string;
  sensorScale?: SensorScale;
  sensorDecimals?: boolean;
  visualStyle?: SensorVisualStyle;
}

/** The sensor at full size with where it comes from and when it last reported. */
export function SensorDetailModal({ isOpen, onClose, device, title, icon, roomName, sensorScale, sensorDecimals, visualStyle }: SensorDetailModalProps) {
  const { t, i18n } = useTranslation();
  const updated = device.updatedAt ? new Date(device.updatedAt) : null;
  const updatedText = updated && !Number.isNaN(updated.getTime())
    ? new Intl.DateTimeFormat(i18n?.language, { dateStyle: 'medium', timeStyle: 'medium' }).format(updated)
    : t('dashboards.sensor_detail.unknown');
  const range = sensorScale ? `${sensorScale.min} – ${sensorScale.max}` : null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={t('dashboards.sensor_detail.title')} headerAlign="start" closeLabel={t('common.close')} dismissible>
      <div className="grid gap-5" data-sensor-detail="">
        <div className="mx-auto h-[26rem] w-full max-w-sm">
          <SensorMetricCard device={device} title={title} icon={icon} roomName={roomName} sensorScale={sensorScale} sensorDecimals={sensorDecimals} visualStyle={visualStyle} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
          {roomName ? <><dt className="text-muted-foreground">{t('dashboards.sensor_detail.room')}</dt><dd className="text-foreground">{roomName}</dd></> : null}
          <dt className="text-muted-foreground">{t('dashboards.sensor_detail.origin')}</dt><dd><IntegrationBadge source={device.integrationSource} /></dd>
          {range ? <><dt className="text-muted-foreground">{t('dashboards.sensor_detail.range')}</dt><dd className="text-foreground">{range}</dd></> : null}
          <dt className="text-muted-foreground">{t('dashboards.sensor_detail.updated')}</dt><dd className="text-foreground">{updatedText}</dd>
        </dl>
      </div>
    </Modal>
  );
}
