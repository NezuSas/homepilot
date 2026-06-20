import { Activity, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

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

function getStatusLabel(status: GlobalWakeStatus | undefined, isProcessing: boolean): string {
  if (isProcessing) return 'Procesando';
  if (status === 'listening') return 'Escuchando';
  if (status === 'capturing') return 'Capturando';
  if (status === 'transcribing') return 'Transcribiendo';
  if (status === 'speaking') return 'Respondiendo';
  if (status === 'unavailable') return 'No disponible';
  return 'Respuesta';
}

function getStatusIcon(status: GlobalWakeStatus | undefined, isProcessing: boolean) {
  if (isProcessing || status === 'transcribing' || status === 'capturing') return Loader2;
  if (status === 'unavailable') return ShieldAlert;
  if (status === 'listening') return Activity;
  return CheckCircle2;
}

export function GlobalWakeNotice({ notice, isProcessing }: GlobalWakeNoticeProps) {
  const StatusIcon = getStatusIcon(notice.status, isProcessing);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-14 left-1/2 z-[70] w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 rounded-[1.35rem] border bg-card/95 p-4 text-card-foreground shadow-2xl shadow-black/10 backdrop-blur-xl transition-colors',
        notice.tone === 'success' && 'border-primary/35',
        notice.tone === 'warning' && 'border-warning/40',
        notice.tone === 'error' && 'border-destructive/40',
        notice.tone === 'info' && 'border-border'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-muted-foreground">
          Nezu Voice
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.18em]',
            isProcessing ? 'border-warning/40 text-warning' : 'border-primary/30 text-primary'
          )}
        >
          <StatusIcon className={cn('h-3 w-3', (isProcessing || notice.status === 'transcribing' || notice.status === 'capturing') && 'animate-spin')} />
          {getStatusLabel(notice.status, isProcessing)}
        </span>
      </div>
      <p className="text-sm font-semibold leading-6 text-foreground">{notice.message}</p>
    </div>
  );
}
