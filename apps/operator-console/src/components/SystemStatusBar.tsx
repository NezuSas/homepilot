import { ShieldCheck, Clock, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSafeHomeMode } from '../types';
import type { HomeMode } from '../types';
import { cn } from '../lib/utils';

interface SystemStatusBarProps {
  currentMode: HomeMode;
  isAllSynced: boolean;
  lastAction?: string;
}

export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ currentMode, isAllSynced }) => {
  const { t } = useTranslation();
  const safeMode = getSafeHomeMode(currentMode);

  return (
    <div className="w-full shrink-0 px-4 md:px-8 py-3 flex items-center justify-between border-t border-border/40 text-[10px] font-black uppercase tracking-[0.2em] bg-card/20 backdrop-blur-xl">
      {/* Left: Mode Context */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          isAllSynced ? "status-dot-synced" : "status-dot-warning"
        )} />
        <span className="text-foreground/60">
          {t('shell.status.mode_label', { 
            mode: t(`modes.${safeMode}`, { defaultValue: safeMode.toUpperCase() }) 
          })}
        </span>
      </div>

      {/* Center: System Confidence (Responsive) */}
      <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-4 bg-muted/20 px-6 py-1.5 rounded-full border border-border/40">
        {isAllSynced ? (
          <>
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-primary/80">{t('shell.status.stable')}</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-3 h-3 text-warning" />
            <span className="text-warning">{t('shell.status.syncing')}</span>
          </>
        )}
      </div>

      {/* Right: Temporal Context (Responsive) */}
      <div className="flex items-center gap-6 text-foreground/40">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span className="hidden xs:inline">{t('shell.status.updated_now')}</span>
        </div>
      </div>
    </div>
  );
};
