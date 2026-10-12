import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  Box,
  Database,
  RefreshCw,
  Settings,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { mapDeviceCommand } from '../lib/i18n-mapping-utils';
import { getRoutineDeviceCommands } from '../lib/deviceCapabilities';
import type { SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import { AlertBanner } from './ui/AlertBanner';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { ToggleSwitch } from './ui/ToggleSwitch';
import type { DeviceCommand, InspectableDevice } from './deviceInspectorTypes';
import { IntegrationBadge } from './IntegrationBadge';

export function DeviceInspectorUnavailableNotice() {
  const { t } = useTranslation();
  return (
    <AlertBanner
      variant="danger"
      icon={AlertCircle}
      title={t('common.unavailable')}
      message={t('common.device_unavailable_hint')}
    />
  );
}

interface IdentitySectionProps {
  device: InspectableDevice;
  isOnline: boolean;
  isActionLoading: boolean;
  onSemanticTypeChange: (semanticType: string) => void;
  onInvertStateChange: (invertState: boolean) => void;
}

export function DeviceInspectorIdentitySection({
  device, isOnline, isActionLoading, onSemanticTypeChange, onInvertStateChange,
}: IdentitySectionProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="p-3 bg-muted/20 border border-border rounded-section flex flex-col gap-2 shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-micro font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
            <Database className="w-3 h-3" /> {t('inbox.device_inspector.entity_id')}
          </span>
        </div>
        <span className="font-mono text-caption font-bold break-all">{device.externalId || device.id}</span>
      </div>
      <div className="p-3 bg-muted/20 border border-border rounded-section flex flex-col gap-2 shadow-inner">
        <span className="text-micro font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
          <Settings className="w-3 h-3" /> {t('inbox.device_inspector.technical_origin')}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-2 mt-1">
          <span className="min-w-0 break-words text-caption font-bold uppercase">{device.type}</span>
          <IntegrationBadge source={device.integrationSource} />
          {device.integrationSource === 'sonoff' && (
            <div className="flex items-center gap-1 ml-auto">
              <div className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-success animate-pulse' : 'bg-danger')} />
              <span className={cn('text-nano font-black uppercase', isOnline ? 'text-success' : 'text-danger')}>
                {isOnline ? t('common.online') : t('common.offline')}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="p-3 bg-muted/20 border border-border rounded-section flex flex-col gap-2 shadow-inner relative">
        <span className="text-micro font-black uppercase tracking-widest flex items-center gap-1.5 text-primary">
          <Zap className="w-3 h-3" /> {t('inbox.device_inspector.device_function')}
        </span>
        <SearchableSelectField
          disabled={isActionLoading}
          loading={isActionLoading}
          value={device.semanticType || 'automatic'}
          onChange={onSemanticTypeChange}
          options={[
            { value: 'automatic', label: t('inbox.device_inspector.semantic.automatic') },
            { value: 'light', label: t('inbox.device_inspector.semantic.light') },
            { value: 'switch', label: t('inbox.device_inspector.semantic.switch') },
            { value: 'outlet', label: t('inbox.device_inspector.semantic.outlet') },
            { value: 'cover', label: t('inbox.device_inspector.semantic.cover') },
            { value: 'camera', label: t('inbox.device_inspector.semantic.camera') },
            { value: 'sensor', label: t('inbox.device_inspector.semantic.sensor') },
            { value: 'unknown', label: t('inbox.device_inspector.semantic.unknown') },
          ]}
        />
        <p className="text-nano text-muted-foreground/50 px-2 leading-relaxed">
          {t('inbox.device_inspector.semantic_hint')}
        </p>
      </div>

      {device.type === 'cover' && (
        <div className="p-3 bg-muted/20 border border-border rounded-section flex flex-col gap-3 shadow-inner">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-micro font-black uppercase tracking-widest text-primary">
                {t('inbox.device_inspector.cover_inverted')}
              </span>
              <p className="mt-1 text-nano text-muted-foreground/50 leading-relaxed">
                {t('inbox.device_inspector.cover_inverted_hint')}
              </p>
            </div>
            <ToggleSwitch
              checked={device.invertState === true}
              onCheckedChange={onInvertStateChange}
              label={t('inbox.device_inspector.cover_inverted')}
              disabled={isActionLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionsSectionProps {
  configurationOnly: boolean;
  device: InspectableDevice;
  unavailable: boolean;
  isActionLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  onCommand: (command: DeviceCommand) => void;
  onRefresh: () => void;
}

export function DeviceInspectorActionsSection({
  configurationOnly, device, unavailable, isActionLoading, isRefreshing, error, onCommand, onRefresh,
}: ActionsSectionProps) {
  const { t } = useTranslation();
  const supportedCommands = Array.from(new Set(device.capabilities?.length ? device.capabilities.flatMap(capability => capability.commands?.map(command => command.name) ?? []) : getRoutineDeviceCommands(device)));
  return (
    <div className="p-4 bg-muted/10 border border-border/50 rounded-section flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-micro font-black uppercase tracking-widest opacity-50">{t('inbox.inspector.actions_header')}</span>
        <Activity className="w-4 h-4 opacity-20" />
      </div>

      {configurationOnly && (
        <p className="break-words text-caption text-muted-foreground">
          {supportedCommands.length ? supportedCommands.map(command => mapDeviceCommand(command, t)).join(' · ') : t('inbox.discovery.read_only')}
        </p>
      )}
      {!configurationOnly && (device.type === 'light' || device.type === 'switch') && (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button disabled={unavailable || isActionLoading} onClick={() => onCommand('turn_on')} className="flex-1">
            {t('inbox.inspector.actions.force_on')}
          </Button>
          <Button disabled={unavailable || isActionLoading} variant="secondary" onClick={() => onCommand('turn_off')} className="flex-1">
            {t('inbox.inspector.actions.force_off')}
          </Button>
          <Button disabled={unavailable || isActionLoading} variant="outline" onClick={() => onCommand('toggle')} className="flex-1">
            {t('inbox.inspector.actions.toggle')}
          </Button>
        </div>
      )}

      {!configurationOnly && device.type === 'cover' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button disabled={unavailable || isActionLoading} onClick={() => onCommand('open')} className="flex-1">
            {t('inbox.inspector.actions.open')}
          </Button>
          <Button disabled={unavailable || isActionLoading} variant="secondary" onClick={() => onCommand('stop')} className="flex-1">
            {t('inbox.inspector.actions.stop')}
          </Button>
          <Button disabled={unavailable || isActionLoading} variant="outline" onClick={() => onCommand('close')} className="flex-1">
            {t('inbox.inspector.actions.close')}
          </Button>
        </div>
      )}

      {device.externalId.startsWith('ha:') && (
        <div className="pt-3 border-t border-border/20 flex flex-col gap-3">
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="secondary"
            className="w-full"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? t('inbox.discovery.importing') : t('inbox.discovery.refresh_hint')}
          </Button>
          {error && (
            <AlertBanner variant="danger" size="sm" icon={AlertCircle} message={error} />
          )}
        </div>
      )}
    </div>
  );
}

interface PlacementSectionProps {
  device: InspectableDevice;
  rooms: Room[];
  isActionLoading: boolean;
  onMove: (roomId: string) => void;
  onUnassign: () => void;
}

export function DeviceInspectorPlacementSection({ device, rooms, isActionLoading, onMove, onUnassign }: PlacementSectionProps) {
  const { t } = useTranslation();
  const assignedRoom = rooms.find((room) => room.id === device.roomId);
  return (
    <div className="grid grid-cols-1 gap-3">
      <Card variant="flat" radius="section" className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 opacity-40 text-primary" />
              <span className="text-micro font-black uppercase tracking-widest opacity-40">{t('inbox.inspector.placement')}</span>
            </div>
            <span className="text-body font-bold break-words">{assignedRoom?.name ?? t('common.unassigned')}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border/10 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <SearchableSelectField
              size="small"
              fullWidth
              value={device.roomId || ''}
              onChange={onMove}
              disabled={isActionLoading}
              loading={isActionLoading}
              options={Array.isArray(rooms) ? rooms.map((room) => ({ value: room.id, label: room.name })) : []}
              placeholder={t('common.unassigned')}
            />
          </div>

          {device.status === 'ASSIGNED' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onUnassign()}
              disabled={isActionLoading}
              className="w-full bg-danger/5 text-danger border-danger/10 hover:bg-danger/10"
            >
              <X className="w-3.5 h-3.5" />
              {t('inbox.inspector.actions.unassign')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

interface RemoveImportSectionProps {
  isActionLoading: boolean;
  onDelete: () => void;
}

export function DeviceInspectorRemoveImportSection({ isActionLoading, onDelete }: RemoveImportSectionProps) {
  const { t } = useTranslation();
  return (
    <Card variant="flat" className="p-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Heading variant="item" as="h3">
            {t('inbox.inspector.remove_import_title')}
          </Heading>
          <p className="mt-1 text-body text-muted-foreground">
            {t('inbox.inspector.remove_import_description')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => onDelete()}
          disabled={isActionLoading}
          className="shrink-0 text-danger hover:bg-danger/5"
        >
          <Trash2 className="h-4 w-4" />
          {t('common.delete')}
        </Button>
      </div>
    </Card>
  );
}
