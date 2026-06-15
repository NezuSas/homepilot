import React from 'react';
import { Activity, Cpu, Gauge, Home, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { HomeMode } from '../types';

interface HomeCommandCenterProps {
  currentMode: HomeMode;
  roomCount: number;
  deviceCount: number;
  activeDeviceCount: number;
  localDeviceCount: number;
  onlineLocalCount: number;
  bridgedCount: number;
  sceneCount: number;
  findingCount: number;
}

const modeTone: Record<HomeMode, string> = {
  relax: 'from-primary/20 via-primary/5 to-accent/10',
  away: 'from-muted/40 via-primary/5 to-success/10',
  night: 'from-primary/15 via-muted/30 to-background',
  energy: 'from-success/20 via-success/5 to-accent/10',
};

export const HomeCommandCenter: React.FC<HomeCommandCenterProps> = ({
  currentMode,
  roomCount,
  deviceCount,
  activeDeviceCount,
  localDeviceCount,
  onlineLocalCount,
  bridgedCount,
  sceneCount,
  findingCount,
}) => {
  const { t } = useTranslation();
  const activeRatio = deviceCount > 0 ? Math.round((activeDeviceCount / deviceCount) * 100) : 0;
  const localRatio = localDeviceCount > 0 ? Math.round((onlineLocalCount / localDeviceCount) * 100) : 100;

  const metrics = [
    {
      label: t('dashboard.command_center.active_devices', { defaultValue: 'Dispositivos activos' }),
      value: activeDeviceCount,
      detail: t('dashboard.command_center.active_ratio', { count: activeRatio, defaultValue: `${activeRatio}% del hogar` }),
      icon: Lightbulb,
      tone: activeDeviceCount > 0 ? 'text-primary bg-primary/10 border-primary/20' : 'text-muted-foreground bg-muted/40 border-border/40',
    },
    {
      label: t('dashboard.command_center.local_control', { defaultValue: 'Control local' }),
      value: `${localRatio}%`,
      detail: t('dashboard.command_center.local_detail', { online: onlineLocalCount, total: localDeviceCount, defaultValue: `${onlineLocalCount}/${localDeviceCount} online` }),
      icon: Cpu,
      tone: localRatio === 100 ? 'text-success bg-success/10 border-success/20' : 'text-warning bg-warning/10 border-warning/20',
    },
    {
      label: t('dashboard.command_center.scenes', { defaultValue: 'Escenas listas' }),
      value: sceneCount,
      detail: t('dashboard.command_center.rooms_detail', { count: roomCount, defaultValue: `${roomCount} espacios` }),
      icon: Sparkles,
      tone: 'text-accent bg-accent/10 border-accent/20',
    },
    {
      label: t('dashboard.command_center.attention', { defaultValue: 'Atencion requerida' }),
      value: findingCount,
      detail: findingCount > 0
        ? t('dashboard.command_center.insights_pending', { count: findingCount, defaultValue: `${findingCount} alertas` })
        : t('dashboard.command_center.stable', { defaultValue: 'Sistema estable' }),
      icon: ShieldCheck,
      tone: findingCount > 0 ? 'text-warning bg-warning/10 border-warning/20' : 'text-success bg-success/10 border-success/20',
    },
  ];

  return (
    <section className={cn(
      'premium-card relative overflow-hidden rounded-[2rem] p-5 md:p-6 shadow-depth-2',
      'bg-gradient-to-br',
      modeTone[currentMode],
    )}
    data-demo="command-center">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-depth-1">
              <Home className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                {t('dashboard.command_center.label', { defaultValue: 'Centro de mando residencial' })}
              </p>
              <h2 className="text-2xl font-black tracking-tight luxury-text-gradient md:text-3xl">
                {t('dashboard.command_center.title', { defaultValue: 'Tu casa esta bajo control' })}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
              {t(`modes.${currentMode}`)}
            </span>
            <span className="rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
              {deviceCount} {t('dashboard.command_center.devices', { defaultValue: 'dispositivos' })}
            </span>
            <span className="rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-muted-foreground">
              {bridgedCount} {t('dashboards.status.bridged')}
            </span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4 xl:max-w-3xl">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div key={metric.label} className="rounded-[1.35rem] border border-border/60 bg-card/70 p-4 shadow-depth-1 backdrop-blur-md">
                <div className={cn('mb-4 flex h-9 w-9 items-center justify-center rounded-xl border', metric.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  {metric.label}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black tracking-tight text-foreground">{metric.value}</span>
                  <span className="min-w-0 truncate text-[10px] font-bold text-muted-foreground">{metric.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-full border border-border/50 bg-background/30 px-3 py-2 text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-md">
        <Activity className="h-3.5 w-3.5 text-success" />
        <span>{t('dashboard.command_center.runtime', { defaultValue: 'Operando con estado local, escenas y asistencia proactiva' })}</span>
        <Gauge className="ml-auto h-3.5 w-3.5 text-primary" />
      </div>
    </section>
  );
};
