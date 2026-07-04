import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin, Thermometer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

interface HomeClimateSummaryProps {
  devices: SnapshotDevice[];
}

const configuredCity = (import.meta.env.VITE_HOME_CITY as string | undefined)?.trim() || 'Cuenca';

const readTemperature = (device: SnapshotDevice): number | null => {
  const state = device.lastKnownState;
  if (!state) return null;

  const attributes = typeof state.attributes === 'object' && state.attributes !== null
    ? state.attributes as Record<string, unknown>
    : {};
  const unit = String(attributes.unit_of_measurement || state.unit_of_measurement || '').toLowerCase();
  const isTemperatureDevice = device.semanticType === 'sensor'
    && (device.name.toLowerCase().includes('temperatur') || unit.includes('°c') || unit === 'c');
  if (!isTemperatureDevice) return null;

  const candidate = state.temperature ?? attributes.temperature ?? state.state;
  const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
};

export const HomeClimateSummary: React.FC<HomeClimateSummaryProps> = ({ devices }) => {
  const { i18n, t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const temperature = useMemo(() => {
    for (const device of devices) {
      const value = readTemperature(device);
      if (value !== null) return value;
    }
    return null;
  }, [devices]);

  const formattedTime = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now), [i18n.language, now]);

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end" aria-label={t('dashboard.home_context')}>
      <div className="col-span-2 flex items-center gap-2 rounded-pill border border-border/60 bg-card/70 px-3 py-2 text-caption text-muted-foreground sm:col-span-1">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground">{configuredCity}</span>
      </div>
      <div className="flex items-center gap-2 rounded-pill border border-border/60 bg-card/70 px-3 py-2 text-caption text-muted-foreground">
        <Clock3 className="h-4 w-4" />
        <time dateTime={now.toISOString()}>{formattedTime}</time>
      </div>
      <div className="flex items-center gap-2 rounded-pill border border-border/60 bg-card/70 px-3 py-2 text-caption text-muted-foreground">
        <Thermometer className="h-4 w-4" />
        <span>{temperature === null ? t('dashboard.temperature_unavailable') : `${Math.round(temperature)} °C`}</span>
      </div>
    </div>
  );
};
