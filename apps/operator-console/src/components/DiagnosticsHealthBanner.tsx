import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { SearchableSelectField } from './ui/SearchableSelectField';

interface DiagnosticsHealthBannerProps {
  status: 'healthy' | 'degraded' | 'offline';
  issueCount: number;
  systemTimeLocal: string;
  systemTimezone: string;
  lastEventAt: string | null;
  isAdmin: boolean;
  updatingTimezone: boolean;
  timezoneValues: string[];
  onTimezoneChange: (timezone: string) => void;
  formatTime: (iso: string | null) => string;
}

export const DiagnosticsHealthBanner: React.FC<DiagnosticsHealthBannerProps> = ({
  status,
  issueCount,
  systemTimeLocal,
  systemTimezone,
  lastEventAt,
  isAdmin,
  updatingTimezone,
  timezoneValues,
  onTimezoneChange,
  formatTime,
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn(
      'border-2 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6',
      status === 'healthy' ? 'border-success/50 bg-success/5'
        : status === 'degraded' ? 'border-warning/50 bg-warning/5'
        : 'border-danger/50 bg-danger/5'
    )}>
      <div className="flex items-center gap-4">
        {status === 'healthy' ? <CheckCircle2 className="w-10 h-10 text-success" />
          : status === 'degraded' ? <AlertTriangle className="w-10 h-10 text-warning" />
          : <XCircle className="w-10 h-10 text-danger" />}
        <div>
          <h2 className="text-view-title font-bold tracking-tight capitalize">{t('diagnostics.system_status', { status: t(`diagnostics.status.${status}`) })}</h2>
          <p className="text-body text-foreground/60 mt-1">
            {status === 'healthy'
              ? t('diagnostics.messages.healthy')
              : issueCount > 0 ? t('diagnostics.messages.degraded') : t('diagnostics.messages.offline')}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
        <div className="sm:text-right">
          <div className="text-micro uppercase font-bold tracking-widest text-muted-foreground opacity-60">{t('diagnostics.appliance_time')}</div>
          <div className="flex flex-col items-end gap-1 mt-1">
            <div className="font-mono font-bold text-body">
              {systemTimeLocal}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-micro uppercase font-bold text-muted-foreground/50 tracking-tighter">{t('diagnostics.timezone')}</span>
                <SearchableSelectField
                  size="small"
                  fullWidth={false}
                  className="w-auto"
                  value={systemTimezone}
                  disabled={updatingTimezone}
                  onChange={onTimezoneChange}
                  options={timezoneValues.map((timezone) => ({ value: timezone, label: t(`timezones.${timezone}`) }))}
                />
                {updatingTimezone && <RefreshCw className="w-3 h-3 animate-spin text-primary" />}
              </div>
            )}
          </div>
        </div>

        <div className="sm:text-right">
          <div className="text-micro uppercase font-bold tracking-widest text-muted-foreground opacity-60">{t('diagnostics.last_event')}</div>
          <div className="font-mono font-bold mt-1 text-body">{formatTime(lastEventAt)}</div>
        </div>
      </div>
    </div>
  );
};
