import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Server, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface DiagnosticDevice {
  id: string;
  integrationSource?: string;
  updatedAt?: string;
}

interface DiagnosticScene {
  id?: string;
  actions?: { deviceId: string }[];
}

interface DiagnosticAutomation {
  trigger?: {
    type?: string;
    deviceId?: string;
  };
  action?: {
    type?: string;
    targetDeviceId?: string;
    sceneId?: string;
  };
}

interface DiagnosticsResilienceSummaryProps {
  devices: DiagnosticDevice[];
  scenes: DiagnosticScene[];
  automations: DiagnosticAutomation[];
}

const isLocalDevice = (device?: DiagnosticDevice): boolean => device?.integrationSource === 'sonoff';

export const DiagnosticsResilienceSummary: React.FC<DiagnosticsResilienceSummaryProps> = ({
  devices,
  scenes,
  automations,
}) => {
  const { t } = useTranslation();
  const onlineLocalCount = devices.filter((device) => {
    const updatedAt = new Date(device.updatedAt || 0).getTime();
    return isLocalDevice(device) && Date.now() - updatedAt < 300000;
  }).length;

  const stats = [
    {
      label: t('diagnostics.metrics.native_local'),
      value: devices.filter(isLocalDevice).length,
      sub: `${onlineLocalCount} ${t('diagnostics.metrics.online')}`,
      icon: Cpu,
      color: 'text-success',
    },
    {
      label: t('diagnostics.metrics.bridged'),
      value: devices.filter((device) => !isLocalDevice(device)).length,
      sub: t('diagnostics.metrics.external_mesh'),
      icon: Server,
      color: 'text-primary',
    },
    {
      label: t('diagnostics.metrics.scenes'),
      value: scenes.length,
      sub: t('diagnostics.metrics.configured'),
      icon: Zap,
      color: 'text-warning',
    },
    {
      label: t('diagnostics.metrics.automations'),
      value: automations.length,
      sub: t('diagnostics.metrics.configured'),
      icon: ShieldCheck,
      color: 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-1000">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card border border-border/60 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/40 transition-all shadow-sm">
          <div className="space-y-1">
            <p className="text-micro font-black uppercase tracking-widest text-muted-foreground opacity-50">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-view-title font-black tabular-nums">{stat.value}</span>
              <span className="text-nano font-bold text-muted-foreground/60 uppercase">{stat.sub}</span>
            </div>
          </div>
          <div className={cn('p-3 rounded-xl bg-muted/50 group-hover:scale-110 transition-transform', stat.color)}>
            <stat.icon className="w-5 h-5" />
          </div>
        </div>
      ))}
    </div>
  );
};
