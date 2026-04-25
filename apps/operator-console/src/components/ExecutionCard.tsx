import React, { useState } from 'react';
import type { ExecutionRecord } from '../types/executions';
import { cn } from '../lib/utils';
import { Clock, Zap, ChevronDown, ChevronUp, Play, Cog, Fingerprint } from 'lucide-react';
import { ExecutionDetail } from './ExecutionDetail';

interface ExecutionCardProps {
  record: ExecutionRecord;
  onRetrySuccess?: () => void;
}

export const ExecutionCard: React.FC<ExecutionCardProps> = ({ record, onRetrySuccess }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusColors = {
    success: 'border-success/30 bg-success/5 text-success',
    partial: 'border-warning/30 bg-warning/5 text-warning',
    failed: 'border-destructive/30 bg-destructive/5 text-destructive'
  };

  const sourceTypeIcons = {
    scene: Play,
    automation: Cog,
    manual: Fingerprint
  };

  const SourceIcon = sourceTypeIcons[record.sourceType] || Zap;

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-[2.5rem] border transition-all duration-500 bg-card/40 backdrop-blur-xl",
      isExpanded ? "p-6" : "p-5",
      statusColors[record.status],
      isExpanded ? "shadow-2xl scale-[1.01]" : "shadow-md hover:shadow-lg hover:-translate-y-0.5"
    )}>
      {/* Dynamic Background Glow */}
      <div className={cn(
        "absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 rounded-full blur-[80px] opacity-20 transition-opacity duration-1000",
        record.status === 'success' ? "bg-success" :
        record.status === 'failed' ? "bg-destructive" : "bg-warning"
      )} />

      <div className="flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Source Icon Bubble */}
          <div className="p-3 bg-background/60 rounded-2xl border border-border/40 shadow-inner group-hover:scale-110 transition-transform duration-500">
            <SourceIcon className="w-5 h-5 opacity-70" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] opacity-40">
                {record.sourceType}
              </span>
              <span className="text-[10px] font-mono opacity-20">/</span>
              <span className="text-[10px] font-mono font-bold truncate opacity-60">
                {record.sourceId}
              </span>
            </div>
            <h3 className="text-sm font-black tracking-tight text-foreground/90 truncate">
              {record.summary || `Execution ID ${record.id.slice(0, 8)}`}
            </h3>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="hidden md:flex items-center gap-6 px-6 border-x border-border/10">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black opacity-30 uppercase tracking-widest">Total</span>
            <span className="text-xs font-black">{record.actionCount}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={cn("text-xs font-black", record.successCount > 0 ? "text-success" : "opacity-30")}>
              {record.successCount}
            </span>
            <span className="text-[8px] font-bold opacity-30 uppercase tracking-tighter">Success</span>
          </div>
          {record.failedCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-destructive">
                {record.failedCount}
              </span>
              <span className="text-[8px] font-bold opacity-30 uppercase tracking-tighter">Failed</span>
            </div>
          )}
          {record.skippedCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-xs font-black opacity-60">
                {record.skippedCount}
              </span>
              <span className="text-[8px] font-bold opacity-30 uppercase tracking-tighter">Skip</span>
            </div>
          )}
        </div>

        {/* Time & Performance */}
        <div className="flex flex-col items-end gap-1 min-w-[110px] shrink-0">
          <div className="flex items-center gap-2 text-foreground/70">
            <Clock className="w-3.5 h-3.5 opacity-40" />
            <span className="text-[11px] font-mono font-bold tracking-tight">
              {new Date(record.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-black uppercase tracking-tighter opacity-40">
              {(record.durationMs / 1000).toFixed(2)}s
            </div>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              record.status === 'success' ? "bg-success animate-pulse" :
              record.status === 'failed' ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]" : "bg-warning"
            )} />
          </div>
        </div>

        {/* Interaction Trigger */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2.5 hover:bg-foreground/5 rounded-2xl transition-all ml-2 border border-transparent hover:border-border/40"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
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
