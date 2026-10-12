import { Cable, Camera, Network, TabletSmartphone, Wifi, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { integrationInfo, type IntegrationKind } from '../../../../packages/devices/domain/integrationCatalog';
import { StatusPill } from './ui/StatusPill';

const KIND_ICONS: Record<IntegrationKind, LucideIcon> = {
  bridge: Network,
  local_network: Wifi,
  camera: Camera,
  plc: Cable,
  display: TabletSmartphone,
};

/** Where a device comes from: the integration's name with a neutral icon for its kind, never a third-party logo. */
export function IntegrationBadge({ source }: { source: string | null | undefined }) {
  const { t } = useTranslation();
  const info = integrationInfo(source);
  if (!info) return source ? <StatusPill variant="neutral" size="sm">{source}</StatusPill> : null;
  const Icon = KIND_ICONS[info.kind];
  const kind = t(`integrations.kinds.${info.kind}`);
  return (
    <StatusPill variant="neutral" size="sm" title={kind} aria-label={`${info.name} · ${kind}`} className="gap-1">
      <Icon aria-hidden="true" className="size-3 shrink-0" />{info.name}
    </StatusPill>
  );
}
