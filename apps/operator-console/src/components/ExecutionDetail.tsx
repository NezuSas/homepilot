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
    <div className="flex flex-col gap-2 mt-4 p-4 bg-background/50 rounded-section border border-border/40 animate-in slide-in-from-top-2 duration-300">
      <h4 className="text-micro font-black uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
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
                <span className="text-caption font-bold tracking-tight truncate">{action.commandName}</span>
                <span className="text-micro font-mono text-muted-foreground/50 truncate uppercase tracking-tighter">
                  {action.deviceId}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {retryErrorByIndex[idx] && (
                <span className="text-micro font-bold text-destructive animate-pulse truncate max-w-copy-2xs" title={retryErrorByIndex[idx]}>
                  {retryErrorByIndex[idx]}
                </span>
              )}

              {action.status === 'failed' && (action.userMessage || action.error) && (
                <div className="flex flex-col items-end text-right">
                  <span className={cn(
                    "text-label font-bold max-w-copy-md sm:max-w-copy-2xl truncate",
                    action.severity === 'warning' ? "text-warning" : "text-destructive"
                  )} title={action.userMessage || action.error}>
                    {action.userMessage || action.error}
                  </span>
                  {action.suggestedAction && (
                    <span className="text-micro font-medium text-muted-foreground max-w-copy-md sm:max-w-copy-2xl truncate" title={action.suggestedAction}>
                      {action.suggestedAction}
                    </span>
                  )}
                  {(action.technicalMessage || action.error) && (
                    <span className="text-nano font-mono text-muted-foreground/30 max-w-copy-2xs truncate hover:text-muted-foreground/70 transition-colors" title={action.technicalMessage || action.error}>
                      {action.technicalMessage || action.error}
                    </span>
                  )}
                </div>
              )}

              {action.status === 'failed' && (
                <button
                  onClick={() => handleRetry(idx)}
                  disabled={retryingIdx !== null}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all text-micro font-black uppercase tracking-widest",
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
                "text-micro font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border",
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
