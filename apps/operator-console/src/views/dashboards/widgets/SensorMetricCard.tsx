import { Activity, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

type SensorPresentation = 'battery' | 'measurement' | 'status';

interface SensorReading {
  value: string | null;
  unit: string | null;
  presentation: SensorPresentation;
  percentage: number | null;
}

interface SensorMetricCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
}

const unavailableStates = new Set(['', 'none', 'null', 'unknown', 'unavailable']);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return String(value);
  }
  return null;
}

function numericPercentage(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, numeric));
}

export function getSensorReading(device?: SnapshotDevice, isPreview = false): SensorReading {
  if (!device && isPreview) {
    return { value: '50', unit: '%', presentation: 'battery', percentage: 50 };
  }

  const state = asRecord(device?.lastKnownState);
  const attributes = asRecord(state.attributes);
  const value = firstText([
    state.state,
    state.value,
    state.native_value,
    state.level,
    state.battery,
    attributes.state,
    attributes.value,
    attributes.native_value,
    attributes.battery_level,
  ]);
  const unit = firstText([
    state.unit_of_measurement,
    state.unit,
    attributes.unit_of_measurement,
    attributes.unit,
  ]);
  const classifier = [
    device?.name,
    device?.externalId,
    state.device_class,
    attributes.device_class,
  ].filter((item): item is string => typeof item === 'string').join(' ').toLocaleLowerCase();
  const presentation: SensorPresentation = classifier.includes('battery') || classifier.includes('bater')
    ? 'battery'
    : numericPercentage(value) !== null
      ? 'measurement'
      : 'status';

  return {
    value: value && !unavailableStates.has(value.toLocaleLowerCase()) ? value : null,
    unit,
    presentation,
    percentage: presentation === 'battery' ? numericPercentage(value) : null,
  };
}

function BatteryIcon({ percentage }: { percentage: number | null }) {
  const iconClassName = 'h-5 w-5';
  if (percentage === null || percentage <= 20) return <BatteryLow className={iconClassName} />;
  if (percentage < 60) return <BatteryMedium className={iconClassName} />;
  if (percentage < 95) return <BatteryCharging className={iconClassName} />;
  return <BatteryFull className={iconClassName} />;
}

export function SensorMetricCard({ device, title, isPreview = false }: SensorMetricCardProps) {
  const { t } = useTranslation();
  const reading = getSensorReading(device, isPreview);
  const isBattery = reading.presentation === 'battery';
  const isUnavailable = reading.value === null;
  const percentage = reading.percentage ?? 0;
  const circumference = 2 * Math.PI * 42;
  const strokeOffset = circumference - (circumference * percentage) / 100;
  const toneClassName = percentage <= 20
    ? 'text-destructive'
    : percentage < 50
      ? 'text-amber-500'
      : 'text-emerald-500';

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-border/60 bg-card/95 p-4 text-foreground shadow-surface-card ring-1 ring-background/45">
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border/60 bg-muted/60 text-muted-foreground',
          isBattery && !isUnavailable && toneClassName,
        )}>
          {isBattery ? <BatteryIcon percentage={reading.percentage} /> : <Activity className="h-5 w-5" />}
        </span>
        <span className="rounded-full border border-border/55 bg-background/80 px-2.5 py-1 text-micro font-black uppercase tracking-control text-muted-foreground">
          {t('dashboard.editor.sections.sensor_label')}
        </span>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 items-center gap-4">
        {isBattery ? (
          <div className="relative grid h-24 w-24 shrink-0 place-items-center" aria-label={t('dashboard.editor.sections.sensor_battery')}>
            <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="52" cy="52" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-muted/80" />
              <circle
                cx="52"
                cy="52"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className={cn('transition-[stroke-dashoffset] duration-500', toneClassName)}
              />
            </svg>
            <span className="absolute text-body-lg font-black tabular-nums text-foreground">
              {isUnavailable ? '—' : `${Math.round(percentage)}%`}
            </span>
          </div>
        ) : (
          <div className="min-w-0 shrink-0">
            <span className="block text-hero-title font-black leading-none tabular-nums text-foreground">
              {reading.value ?? '—'}
            </span>
            {reading.unit ? (
              <span className="mt-1 block text-caption font-black uppercase tracking-control text-primary">{reading.unit}</span>
            ) : null}
          </div>
        )}

        <div className="min-w-0">
          <span className="block line-clamp-2 text-card-title font-black leading-tight text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-caption font-semibold leading-snug text-muted-foreground">
            {isUnavailable
              ? t('dashboard.editor.sections.sensor_unavailable')
              : isBattery
                ? t('dashboard.editor.sections.sensor_battery')
                : reading.presentation === 'measurement'
                  ? t('dashboard.editor.sections.sensor_measurement')
                  : t('dashboard.editor.sections.sensor_status')}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/45 bg-background/40 px-3 py-2">
        <span className="text-micro font-black uppercase tracking-status text-muted-foreground">
          {t('dashboard.editor.sections.sensor_live_reading')}
        </span>
        <span className={cn('text-micro font-black uppercase tracking-status', isUnavailable ? 'text-muted-foreground' : 'text-primary')}>
          {isUnavailable ? t('dashboard.editor.sections.sensor_unavailable') : t('dashboard.editor.sections.ready')}
        </span>
      </div>
    </div>
  );
}
