import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Zap } from 'lucide-react';
import type { View } from '../types';
import { useEnergyStore } from '../stores/useEnergyStore';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { getAssignedEnergyPresentation } from '../lib/assignedEnergyPresentation';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { EnergyDataSkeleton } from '../components/ui/ComponentSkeletons';

interface EnergyViewProps { onNavigate?: (view: View) => void }

export const EnergyView: React.FC<EnergyViewProps> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const entities = useEnergyStore(state => state.entities);
  const isLoading = useEnergyStore(state => state.isLoading);
  const refreshEnergy = useEnergyStore(state => state.refreshEnergy);
  const devices = useDeviceSnapshotStore(state => state.devices);
  const roomsByHome = useDeviceSnapshotStore(state => state.roomsByHome);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);
  const [initialSettled, setInitialSettled] = useState(false);
  const initialLoading = useInitialLoading(!initialSettled || isLoading);
  const data = useMemo(() => getAssignedEnergyPresentation(entities, devices, Object.values(roomsByHome).flat()), [entities, devices, roomsByHome]);
  const format = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 });
  useEffect(() => {
    let active = true;
    void Promise.allSettled([refreshEnergy(), refreshSnapshot()]).then(() => { if (active) setInitialSettled(true); });
    return () => { active = false; };
  }, [refreshEnergy, refreshSnapshot]);
  return <div className="space-y-5">
    <SectionHeader level="view" icon={Zap} title={t('energy.title')} subtitle={t('energy.subtitle')}
      action={<Button variant="secondary" disabled={isLoading} onClick={() => { void Promise.allSettled([refreshEnergy(), refreshSnapshot()]); }}>
        <RefreshCw aria-hidden className="size-4" />{t('energy.refresh')}
      </Button>} />
    {initialLoading ? <EnergyDataSkeleton label={t('common.loading')} /> : data.readings.length ? <>
      <dl className="grid grid-cols-2 divide-x divide-border rounded-card border border-border bg-card">
        {[{ label: 'energy.total_power', value: data.totalPower, unit: 'W' }, { label: 'energy.total_energy', value: data.totalEnergy, unit: 'kWh' }].map(metric =>
          <div key={metric.unit} className="min-w-0 px-4 py-3 sm:px-5">
            <dt className="text-caption text-muted-foreground">{t(metric.label)}</dt>
            <dd className="mt-1 break-words text-section-title font-semibold tabular-nums text-foreground">
              {metric.value === null ? t('common.not_available') : <>{format.format(metric.value)} <span className="text-body font-normal text-muted-foreground">{metric.unit}</span></>}
            </dd>
          </div>)}
      </dl>
      <section aria-label={t('energy.live_consumption')} className="space-y-4">
        <h2 className="text-section-title font-semibold">{t('energy.live_consumption')}</h2>
        {data.groups.map(group => <section key={group.id} aria-label={group.name} className="overflow-hidden rounded-card border border-border bg-card">
          <h3 className="border-b border-border bg-muted/20 px-4 py-2 text-body-compact font-semibold">{group.name}</h3>
          <ul className="divide-y divide-border/60">
            {group.readings.map(reading => <li key={reading.entity_id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0 break-words text-body-compact">{reading.name}</span>
              <span className="shrink-0 text-body font-semibold tabular-nums text-foreground">{format.format(reading.state)} <span className="text-caption font-normal text-muted-foreground">{reading.unit}</span></span>
            </li>)}
          </ul>
        </section>)}
      </section>
    </> : <EmptyState icon={Zap} title={t('energy.empty_title')} description={t('energy.assigned_readings_hint')} />}
    {onNavigate && <Button variant="ghost" onClick={() => onNavigate('assistant')}>{t('energy.go_to_assistant')}</Button>}
  </div>;
};
