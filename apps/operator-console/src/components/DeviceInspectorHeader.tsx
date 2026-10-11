import React from 'react';
import { useTranslation } from 'react-i18next';
import { RadioTower, Settings, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Heading } from './ui/Heading';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';
import { SegmentedControl } from './ui/SegmentedControl';
import { StatusPill } from './ui/StatusPill';
import type { InspectableDevice } from './DeviceInspectorTabs';

export type DeviceInspectorTab = 'info' | 'logs' | 'state';

const INSPECTOR_TABS = ['info', 'logs', 'state'] as const;

interface DeviceInspectorHeaderProps {
  device: InspectableDevice;
  activeTab: DeviceInspectorTab;
  isRenaming: boolean;
  newName: string;
  onNewNameChange: (name: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onTabChange: (tab: DeviceInspectorTab) => void;
  onClose: () => void;
}

/** Title, rename form and tab switcher at the top of the inspector drawer. */
export const DeviceInspectorHeader: React.FC<DeviceInspectorHeaderProps> = ({
  device, activeTab, isRenaming, newName, onNewNameChange, onStartRename, onSaveRename, onCancelRename, onTabChange, onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className="relative border-b border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3 sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <RadioTower className="w-6 h-6" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-micro font-black uppercase tracking-widest text-primary">{t('inbox.inspector.title')}</span>
              {device.integrationSource === 'sonoff' ? (
                <StatusPill variant="success" size="sm" uppercase>{t('inbox.inspector.verified_edge')}</StatusPill>
              ) : null}
            </div>
            {isRenaming ? (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <Input
                  containerClassName="min-w-0 flex-1 basis-40"
                  aria-label={t('devices.new_name')}
                  value={newName}
                  onChange={(e) => onNewNameChange(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && onSaveRename()}
                />
                <Button size="xs" onClick={onSaveRename}>{t('common.save')}</Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={onCancelRename}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2 group/title">
                <Heading variant="section" as="h2">{device.name}</Heading>
                <IconButton
                  icon={Settings}
                  label={t('common.edit')}
                  variant="ghost"
                  size="sm"
                  onClick={onStartRename}
                  className="opacity-0 group-hover/title:opacity-100"
                />
              </div>
            )}
          </div>
        </div>
        <IconButton
          icon={X}
          label={t('common.close')}
          variant="ghost"
          size="lg"
          onClick={onClose}
          className="hover:bg-danger/10 hover:text-danger"
        />
      </div>

      <SegmentedControl
        value={activeTab}
        onChange={onTabChange}
        label={t('inbox.inspector.title')}
        tone="primary"
        options={INSPECTOR_TABS.map((value) => ({
          value,
          label: t(`inbox.inspector.tabs.${value}`),
        }))}
      />
    </div>
  );
};
