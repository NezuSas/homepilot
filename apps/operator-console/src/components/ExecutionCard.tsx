import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExecutionRecord } from '../types/executions';
import { cn } from '../lib/utils';
import { Clock, Zap, ChevronDown, ChevronUp, Play, Cog, Fingerprint } from 'lucide-react';
import { ExecutionDetail } from './ExecutionDetail';
import { IconButton } from './ui/IconButton';

interface ExecutionCardProps {
  record: ExecutionRecord;
  onRetrySuccess?: () => void;
}

export const ExecutionCard: React.FC<ExecutionCardProps> = ({ record, onRetrySuccess }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusColors = {
    success: 'border-success/30 bg-success/5 text-success',
    partial: 'border-warning/30 bg-warning/5 text-warning',
    failed: 'border-danger/30 bg-danger/5 text-danger'
  };

  const sourceTypeIcons = {
    scene: Play,
    automation: Cog,
    manual: Fingerprint
  };

  const SourceIcon = sourceTypeIcons[record.sourceType] || Zap;

  return (
    <div className={cn(
      "group relative min-w-0 overflow-hidden rounded-card border bg-card",
      "p-3",
      statusColors[record.status],
      "text-foreground"
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0 basis-48">
          {/* Source Icon Bubble */}
          <div className="shrink-0 p-2 bg-primary/10 text-primary rounded-control">
            <SourceIcon className="w-5 h-5 opacity-70" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-micro font-black uppercase tracking-control opacity-40">
                {t(`diagnostics.filters.${record.sourceType === 'manual' ? 'command' : record.sourceType}`)}
              </span>
              <span className="text-micro font-mono opacity-20">/</span>
              <span className="text-micro font-mono font-bold truncate opacity-60">
                {record.sourceId}
              </span>
            </div>
            <h3 className="text-body font-black tracking-tight text-foreground/90 truncate">
              {record.summary || t('execution_logs.execution_fallback', { id: record.id.slice(0, 8) })}
            </h3>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="hidden md:flex items-center gap-6 px-6 border-x border-border/10">
          <div className="flex flex-col items-center">
            <span className="text-micro font-black opacity-30 uppercase tracking-widest">{t('execution_logs.total')}</span>
            <span className="text-caption font-black">{record.actionCount}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={cn("text-caption font-black", record.successCount > 0 ? "text-success" : "opacity-30")}>
              {record.successCount}
            </span>
            <span className="text-nano font-bold opacity-30 uppercase tracking-tighter">{t('execution_logs.success')}</span>
          </div>
          {record.failedCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-caption font-black text-danger">
                {record.failedCount}
              </span>
              <span className="text-nano font-bold opacity-30 uppercase tracking-tighter">{t('execution_logs.failed')}</span>
            </div>
          )}
          {record.skippedCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-caption font-black opacity-60">
                {record.skippedCount}
              </span>
              <span className="text-nano font-bold opacity-30 uppercase tracking-tighter">{t('execution_logs.skipped')}</span>
            </div>
          )}
        </div>

        {/* Time & Performance */}
        <div className="flex flex-col items-end gap-1 min-w-execution-time shrink-0">
          <div className="flex items-center gap-2 text-foreground/70">
            <Clock className="w-3.5 h-3.5 opacity-40" />
            <span className="text-label font-mono font-bold tracking-tight">
              {new Date(record.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-micro font-black uppercase tracking-tighter opacity-40">
              {(record.durationMs / 1000).toFixed(2)}s
            </div>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              record.status === 'success' ? "bg-success animate-pulse" :
              record.status === 'failed' ? "bg-danger shadow-danger-dot" : "bg-warning"
            )} />
          </div>
        </div>

        {/* Interaction Trigger */}
        <IconButton
          onClick={() => setIsExpanded(!isExpanded)}
          icon={isExpanded ? ChevronUp : ChevronDown}
          label={isExpanded ? t('execution_logs.collapse_details') : t('execution_logs.expand_details')}
          variant="ghost"
          size="md"
          className="ml-2 rounded-2xl hover:border-border/40"
        />
      </div>

      {/* Expandable Action History */}
      {isExpanded && (
        <ExecutionDetail 
          executionId={record.id} 
          actions={record.actions} 
          onRetrySuccess={onRetrySuccess} 
        />
      )}
    </div>
  );
};
