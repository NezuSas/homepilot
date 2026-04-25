import React, { useState } from 'react';
import type { SceneActionResult } from '../types/executions';
import { cn } from '../lib/utils';
import { CheckCircle2, XCircle, Slash, RefreshCcw, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

interface ExecutionDetailProps {
  executionId: string;
  actions: SceneActionResult[];
  onRetrySuccess?: () => void;
}

export const ExecutionDetail: React.FC<ExecutionDetailProps> = ({ executionId, actions, onRetrySuccess }) => {
  const [retryingIdx, setRetryingIdx] = useState<number | null>(null);
  const [retryErrorByIndex, setRetryErrorByIndex] = useState<Record<number, string>>({});

  const handleRetry = async (idx: number) => {
    if (retryingIdx !== null) return;
    setRetryingIdx(idx);
    setRetryErrorByIndex(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/executions/${executionId}/actions/${idx}/retry`, {
        method: 'POST'
      });
      if (res.ok) {
        if (onRetrySuccess) onRetrySuccess();
      } else {
        const errorData = await res.json().catch(() => ({ message: 'API error' }));
        setRetryErrorByIndex(prev => ({ ...prev, [idx]: errorData.message || 'Retry failed' }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setRetryErrorByIndex(prev => ({ ...prev, [idx]: message }));
    } finally {
      setRetryingIdx(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-4 p-4 bg-background/50 rounded-[1.5rem] border border-border/40 animate-in slide-in-from-top-2 duration-300">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
        Action Details
      </h4>
      <div className="grid gap-2">
        {actions.map((action, idx) => (
          <div 
            key={`${action.deviceId}-${idx}`}
            className="flex items-center justify-between p-3 bg-card/40 rounded-xl border border-border/30 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-1.5 rounded-full",
                action.status === 'success' ? "bg-success/10 text-success" :
                action.status === 'failed' ? "bg-destructive/10 text-destructive" :
                "bg-muted/20 text-muted-foreground"
              )}>
                {action.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {action.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                {action.status === 'skipped' && <Slash className="w-3.5 h-3.5" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight truncate">{action.commandName}</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 truncate uppercase tracking-tighter">
                  {action.deviceId}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {retryErrorByIndex[idx] && (
                <span className="text-[9px] font-bold text-destructive animate-pulse truncate max-w-[100px]" title={retryErrorByIndex[idx]}>
                  {retryErrorByIndex[idx]}
                </span>
              )}

              {action.error && (
                <span className="text-[10px] font-medium text-destructive/80 italic max-w-[80px] sm:max-w-[200px] truncate" title={action.error}>
                  {action.error}
                </span>
              )}

              {action.status === 'failed' && (
                <button
                  onClick={() => handleRetry(idx)}
                  disabled={retryingIdx !== null}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all text-[9px] font-black uppercase tracking-widest",
                    retryingIdx === idx && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {retryingIdx === idx ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-3 h-3" />
                  )}
                  Retry
                </button>
              )}
              
              <div className={cn(
                "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border",
                action.status === 'success' ? "text-success border-success/20 bg-success/5" :
                action.status === 'failed' ? "text-destructive border-destructive/20 bg-destructive/5" :
                "text-muted-foreground border-border bg-muted/5"
              )}>
                {action.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
