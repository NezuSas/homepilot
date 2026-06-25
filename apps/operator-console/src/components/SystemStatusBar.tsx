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
    <div className="relative flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/40 bg-card/20 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] backdrop-blur-xl sm:px-4 sm:py-3 sm:text-[10px] sm:tracking-[0.2em] md:px-8">
      {/* Left: Mode Context */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          isAllSynced ? "status-dot-synced" : "status-dot-warning"
        )} />
        <span className="min-w-0 truncate text-foreground/60">
          {t('shell.status.mode_label', { 
            mode: t(`modes.${safeMode}`, { defaultValue: safeMode.toUpperCase() }) 
          })}
        </span>
      </div>

      {/* Center: System Confidence (Responsive) */}
      <div className="hidden items-center gap-3 rounded-full border border-border/40 bg-muted/20 px-4 py-1.5 sm:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:gap-4 lg:px-6">
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
      <div className="flex shrink-0 items-center gap-3 text-foreground/40 sm:gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span className="hidden xs:inline">{t('shell.status.updated_now')}</span>
        </div>
      </div>
    </div>
  );
};
