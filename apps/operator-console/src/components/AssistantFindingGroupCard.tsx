import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronDown,
  Copy,
  Hash,
  Info,
  Layers,
  PlusCircle,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface AssistantFindingSubGroup {
  name: string;
  findings: AssistantFinding[];
}

interface AssistantFindingGroup {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  isGroup: true;
  subGroups: AssistantFindingSubGroup[];
  actions: AssistantFindingAction[];
}

interface AssistantFindingGroupCardProps {
  group: AssistantFindingGroup;
  isExpanded: boolean;
  expandedSubGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onToggleSubGroup: (subGroupId: string) => void;
  onImportAll: () => void;
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

const getMetadataText = (
  metadata: Record<string, unknown>,
  keys: string[],
  fallback: string
): string => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
};

const getGroupKey = (type: string): string => {
  if (type === 'new_device_available') return 'new_devices';
  if (type === 'device_missing_room') return 'missing_rooms';
  if (type === 'device_name_duplicate') return 'duplicate_names';
  return 'generic';
};

const getIcon = (type: string) => {
  switch (type) {
    case 'new_device_available':             return <PlusCircle className="w-5 h-5 text-primary" />;
    case 'device_missing_room':              return <Hash className="w-5 h-5 text-warning" />;
    case 'device_name_technical':            return <Type className="w-5 h-5 text-primary" />;
    case 'device_name_duplicate':            return <Copy className="w-5 h-5 text-danger" />;
    case 'automation_suggestion':            return <Sparkles className="w-5 h-5 text-primary" />;
    case 'scene_suggestion':                 return <Sparkles className="w-5 h-5 text-primary" />;
    case 'optimization_suggestion':          return <Zap className="w-5 h-5 text-success" />;
    case 'energy_waste_detected':            return <Zap className="w-5 h-5 text-warning" />;
    case 'habit_pattern_detected':           return <Sparkles className="w-5 h-5 text-primary" />;
    case 'proactive_automation_opportunity': return <Sparkles className="w-5 h-5 text-primary" />;
    case 'optimization_opportunity':         return <Info className="w-5 h-5 text-muted-foreground" />;
    default:                                 return <Info className="w-5 h-5 text-primary" />;
  }
};

export const AssistantFindingGroupCard: React.FC<AssistantFindingGroupCardProps> = ({
  group,
  isExpanded,
  expandedSubGroups,
  onToggleGroup,
  onToggleSubGroup,
  onImportAll,
  onAction,
}) => {
  const { t } = useTranslation();
  const totalCount = group.subGroups.reduce((count, subGroup) => count + subGroup.findings.length, 0);

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3">
      <div className={cn(
        'rounded-[2rem] border bg-card transition-all duration-300 overflow-hidden',
        isExpanded ? 'border-primary/40 shadow-2xl shadow-primary/5' : 'border-border hover:border-primary/20'
      )}>
        <button
          onClick={() => onToggleGroup(group.id)}
          className="w-full flex items-center justify-between p-6 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-body font-black tracking-tight">
                {t(`assistant.types.group.${getGroupKey(group.type)}`, { count: totalCount })}
              </h3>
              <p className="text-micro text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                {t('assistant.group_hint', { count: totalCount })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {group.actions.map((action, index) => (
              <Button
                key={`${group.id}-${action.type}-${index}`}
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  if (action.type === 'import_all') {
                    onImportAll();
                    return;
                  }

                  const fallbackFinding = group.subGroups[0]?.findings[0];
                  const fallbackAction = fallbackFinding?.actions[0];
                  if (fallbackFinding && fallbackAction) {
                    onAction(fallbackFinding, fallbackAction);
                  }
                }}
                className="text-micro font-black uppercase tracking-widest"
              >
                {t(action.label)}
              </Button>
            ))}
            <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform duration-300', isExpanded && 'rotate-180')} />
          </div>
        </button>

        {isExpanded && (
          <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/20">
            <div className="space-y-4">
              {group.subGroups.map((subGroup) => {
                const subGroupId = `${group.id}_${subGroup.name}`;
                const isSubExpanded = expandedSubGroups[subGroupId] || false;
                const count = subGroup.findings.length;
                const primaryFinding = subGroup.findings[0];

                return (
                  <div key={subGroupId} className="space-y-2">
                    <div className={cn(
                      'bg-card p-4 rounded-2xl border border-border/60 flex items-center justify-between group/sub transition-all',
                      isSubExpanded && 'border-primary/30 bg-primary/5'
                    )}>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-muted text-foreground/70 group-hover/sub:text-primary transition-colors">
                          {getIcon(primaryFinding.type)}
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-body font-bold flex items-center gap-2">
                            {subGroup.name}
                            {count > 1 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-micro font-black uppercase tracking-wider">
                                x {count}
                              </span>
                            )}
                          </p>
                          <p className="text-micro text-muted-foreground line-clamp-1">
                            {t(`assistant.types.${primaryFinding.type}_description`, primaryFinding.metadata) as string}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {count > 1 ? (
                          <button
                            onClick={() => onToggleSubGroup(subGroupId)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all flex items-center gap-1 text-micro font-bold uppercase tracking-wider"
                          >
                            {isSubExpanded ? t('common.hide') : t('common.more')}
                            <ChevronDown className={cn('w-3 h-3 transition-transform', isSubExpanded && 'rotate-180')} />
                          </button>
                        ) : (
                          <button
                            onClick={() => primaryFinding.actions[0] && onAction(primaryFinding, primaryFinding.actions[0])}
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-all"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isSubExpanded && (
                      <div className="pl-12 pr-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        {subGroup.findings.map((finding) => (
                          <div key={finding.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 group/item">
                            <span className="text-label font-bold text-foreground">
                              {getMetadataText(finding.metadata, ['friendlyName', 'deviceName'], finding.id)}
                            </span>
                            <button
                              onClick={() => finding.actions[0] && onAction(finding, finding.actions[0])}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
