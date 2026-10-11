import { Activity, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { StatusPill } from './ui/StatusPill';
import { useTranslation } from 'react-i18next';

export type GlobalWakeNoticeTone = 'info' | 'success' | 'warning' | 'error';
export type GlobalWakeStatus = 'listening' | 'capturing' | 'transcribing' | 'processing' | 'speaking' | 'idle' | 'unavailable';

export type GlobalWakeNoticeModel = {
  id: string;
  message: string;
  tone: GlobalWakeNoticeTone;
  status?: GlobalWakeStatus;
};

interface GlobalWakeNoticeProps {
  notice: GlobalWakeNoticeModel;
  isProcessing: boolean;
}

function getStatusIcon(status: GlobalWakeStatus | undefined, isProcessing: boolean) {
  if (isProcessing || status === 'transcribing' || status === 'capturing') return Loader2;
  if (status === 'unavailable') return ShieldAlert;
  if (status === 'listening') return Activity;
  return CheckCircle2;
}

export function GlobalWakeNotice({ notice, isProcessing }: GlobalWakeNoticeProps) {
  const { t } = useTranslation();
  const StatusIcon = getStatusIcon(notice.status, isProcessing);
  const statusKey = isProcessing
    ? 'processing'
    : notice.status === 'listening'
      ? 'listening'
      : notice.status === 'capturing'
        ? 'capturing'
        : notice.status === 'transcribing'
          ? 'transcribing'
          : notice.status === 'speaking'
            ? 'speaking'
            : notice.status === 'unavailable'
              ? 'unavailable'
              : 'response';

  return (
    <Card
      role="status"
      aria-live="polite"
      variant="elevated"
      radius="section"
      className={cn(
        'fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-toast-responsive -translate-x-1/2 p-3.5 text-card-foreground sm:bottom-6 sm:w-toast-responsive sm:p-4',
        notice.tone === 'success' && 'border-primary/35',
        notice.tone === 'warning' && 'border-warning/40',
        notice.tone === 'error' && 'border-danger/40',
        notice.tone === 'info' && 'border-border'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-micro font-black uppercase tracking-label text-muted-foreground">
          {t('assistant.voice_notice.label')}
        </span>
        <StatusPill variant={isProcessing ? 'warning' : 'primary'} uppercase>
          <StatusIcon className={cn('h-3 w-3', (isProcessing || notice.status === 'transcribing' || notice.status === 'capturing') && 'animate-spin')} />
          {t(`assistant.voice_notice.${statusKey}`)}
        </StatusPill>
      </div>
      <p className="text-body font-semibold leading-6 text-foreground">{notice.message}</p>
    </Card>
  );
}
