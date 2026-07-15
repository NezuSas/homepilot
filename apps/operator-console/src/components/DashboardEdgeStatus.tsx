import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, ShieldCheck } from 'lucide-react';

interface DashboardEdgeStatusProps {
  localDeviceCount: number;
  onlineLocalCount: number;
  bridgedCount: number;
}

export const DashboardEdgeStatus: React.FC<DashboardEdgeStatusProps> = ({
  localDeviceCount,
  onlineLocalCount,
  bridgedCount,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center -mt-6 gap-4">
      <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-micro font-black uppercase tracking-widest text-primary/80 backdrop-blur-md shadow-sm">
        <Cpu className="w-3.5 h-3.5" />
        <span>{t('shell.status.edge_active')}</span>
        <div className="w-1 h-1 bg-primary rounded-full animate-pulse mx-1" />
        <span className="text-muted-foreground/60 tracking-wider">{t('shell.subtitle')}</span>
      </div>

      <div className="flex items-center gap-8 py-1">
        <div className="flex flex-col items-center gap-1 group">
          <span className="text-body font-black text-foreground tracking-tight">{localDeviceCount}</span>
          <span className="text-nano font-black uppercase tracking-label text-success/60">
            {t('dashboards.status.local')} {onlineLocalCount < localDeviceCount && `(${onlineLocalCount} ${t('common.online')})`}
          </span>
        </div>
        <div className="w-px h-6 bg-border/40" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-body font-black text-foreground tracking-tight">{bridgedCount}</span>
          <span className="text-nano font-black uppercase tracking-label text-muted-foreground/40">
            {t('dashboards.status.bridged')}
          </span>
        </div>
        <div className="w-px h-6 bg-border/40" />
        <div className="flex flex-col gap-1 items-start max-w-copy-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-2.5 h-2.5 text-primary opacity-60" />
            <span className="text-nano font-black uppercase tracking-widest text-primary/60">
              {t('dashboards.status.resilient')}
            </span>
          </div>
          <p className="text-nano font-bold leading-tight text-muted-foreground/40 uppercase italic">
            {t('dashboard.resilience_hint')}
          </p>
        </div>
      </div>
    </div>
  );
};
