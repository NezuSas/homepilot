import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, 
  Info,
  RefreshCw,
  PlusCircle,
  Hash,
  Type,
  Copy,
  Zap,
  CheckCircle2,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_ENDPOINTS } from '../config';
import { AssistantActionModal } from '../components/AssistantActionModal';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Button } from '../components/ui/Button';
import { StatusPill } from '../components/ui/StatusPill';

interface Finding {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: 'open' | 'dismissed' | 'resolved';
  actions: { type: string; label: string; payload?: any }[];
  metadata: Record<string, any>;
  score: number;
  explanation?: string;
}

export const AssistantView: React.FC<{
  onNavigate: (view: any, params?: any) => void;
}> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: any; deviceName?: string } | null>(null);

  const fetchFindings = async () => {
    try {
      const resp = await fetch(API_ENDPOINTS.assistant.findings);
      
      // -- ROBUST HANDLING --
      const contentType = resp.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('SERVER_RETURNED_NON_JSON');
      }

      if (resp.ok) {
        const data = await resp.json();
        setFindings(data);
      } else {
        throw new Error(`SERVER_ERROR_${resp.status}`);
      }
    } catch (e: any) {
      console.error('[Assistant] Failed to fetch findings:', e);
      // Optional: set some UI error state if needed
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const resp = await fetch(API_ENDPOINTS.assistant.scan, { method: 'POST' });
      if (!resp.ok) throw new Error(`SCAN_FAILED_${resp.status}`);
      await fetchFindings();
    } catch (e) {
      console.error('[Assistant] Scan failed:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await fetch(API_ENDPOINTS.assistant.dismiss(id), { method: 'POST' });
      if (!resp.ok) throw new Error(`DISMISS_FAILED_${resp.status}`);
      setFindings(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      console.error('[Assistant] Dismiss failed:', e);
    }
  };

  const handleAction = (finding: Finding, action: any) => {
    // 1. Modal-based actions
    const modalActions = ['activate_draft', 'import_device', 'assign_room', 'rename_device'];
    if (modalActions.includes(action.type)) {
      setActiveAction({ 
        findingId: finding.id, 
        action,
        deviceName: finding.metadata.friendlyName || finding.metadata.deviceName || finding.metadata.name || finding.id
      });
      return;
    }

    // 2. Navigation-based actions
    if (action.type === 'configure_automation' || action.type === 'configure_energy_rule') {
      onNavigate('automations');
      return;
    }
    
    if (action.type === 'review_device') {
      onNavigate('inbox');
      return;
    }

    // 3. Fallback or generic navigation based on type
    switch (finding.type) {
      case 'new_device_available':
      case 'device_missing_room':
      case 'device_name_technical':
      case 'device_name_duplicate':
        onNavigate('inbox');
        break;
      default:
        console.warn('[Assistant] Unhandled action/type:', action.type, finding.type);
        break;
    }
  };


  const getSection = (type: string) => {
    if ([
      'habit_pattern_detected', 
      'proactive_automation_opportunity', 
      'automation_suggestion', 
      'scene_suggestion'
    ].includes(type)) return 'proactive';
    
    if (['energy_waste_detected'].includes(type)) return 'usage';
    
    if ([
      'optimization_opportunity', 
      'optimization_suggestion'
    ].includes(type)) return 'opportunities';
    
    return 'system';
  };

  const isProactiveType = (type: string) => 
    [
      'habit_pattern_detected', 
      'proactive_automation_opportunity', 
      'automation_suggestion', 
      'scene_suggestion', 
      'energy_waste_detected', 
      'optimization_opportunity', 
      'optimization_suggestion'
    ].includes(type);

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


  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleSubGroup = (subGroupId: string) => {
    setExpandedSubGroups(prev => ({ ...prev, [subGroupId]: !prev[subGroupId] }));
  };

  const GROUPABLE_TYPES = ['new_device_available', 'device_missing_room', 'device_name_duplicate'];

  interface SubGroup {
    name: string;
    findings: Finding[];
  }

  interface GroupItem {
    id: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    isGroup: true;
    subGroups: SubGroup[];
    actions: { type: string; label: string; payload?: any }[];
  }

  type ProcessedItem = Finding | GroupItem;

  const processFindings = (rawFindings: Finding[]): Record<string, ProcessedItem[]> => {
    const sections: Record<string, ProcessedItem[]> = {
      proactive: [],
      usage: [],
      opportunities: [],
      system: []
    };

    const typeGroups: Record<string, Finding[]> = {};
    
    rawFindings.forEach(f => {
      if (GROUPABLE_TYPES.includes(f.type)) {
        if (!typeGroups[f.type]) typeGroups[f.type] = [];
        typeGroups[f.type].push(f);
      } else {
        const section = getSection(f.type);
        sections[section].push(f);
      }
    });

    Object.entries(typeGroups).forEach(([type, items]) => {
      const section = getSection(type);
      if (items.length === 1) {
        sections[section].push(items[0]);
      } else {
        // Nested grouping by visible identity
        const subGroupMap: Record<string, Finding[]> = {};
        items.forEach(it => {
          const name = it.metadata.friendlyName || it.metadata.deviceName || it.metadata.name || it.id;
          if (!subGroupMap[name]) subGroupMap[name] = [];
          subGroupMap[name].push(it);
        });

        const subGroups: SubGroup[] = Object.entries(subGroupMap).map(([name, findings]) => ({
          name,
          findings
        }));

        sections[section].push({
          id: `group_${type}`,
          type,
          severity: items[0].severity,
          isGroup: true,
          subGroups,
          actions: type === 'new_device_available' 
            ? [{ type: 'import_all', label: 'assistant.actions.import_all' }]
            : []
        });
      }
    });

    return sections;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 animate-pulse">
        <Sparkles className="w-12 h-12 text-primary/20" />
        <div className="h-4 w-48 bg-muted rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader 
        title={t('assistant.title')}
        subtitle={t('assistant.subtitle')}
        icon={Sparkles}
        action={
          <Button 
            onClick={handleScan}
            disabled={scanning}
            variant="secondary"
            isLoading={scanning}
          >
            {scanning ? t('assistant.scanning') : <><RefreshCw className="w-4 h-4" /> {t('assistant.scan_trigger')}</>}
          </Button>
        }
      />


      {findings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 border-2 border-dashed border-muted rounded-3xl bg-muted/5">
          <CheckCircle2 className="w-16 h-16 text-primary mb-6 opacity-20" />
          <h3 className="text-xl font-black mb-2 tracking-tight">{t('assistant.no_findings')}</h3>
          <p className="text-muted-foreground max-w-sm text-center font-medium">
            {t('assistant.subtitle')}
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {(() => {
            const processed = processFindings(findings);
            return (['proactive', 'usage', 'opportunities', 'system'] as const).map(sectionKey => {
              const sectionItems = processed[sectionKey];
              if (sectionItems.length === 0) return null;

              return (
                <div key={sectionKey} className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                      {t(`assistant.sections.${sectionKey}`)}
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-muted to-transparent"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sectionItems.map((item: ProcessedItem) => {
                      if ('isGroup' in item && item.isGroup) {
                        const isExpanded = expandedGroups[item.id] || false;
                        const subGroups = item.subGroups;
                        const totalCount = subGroups.reduce((acc, sg) => acc + sg.findings.length, 0);
                        const groupType = item.type;
                        
                        const getGroupKey = (type: string) => {
                          if (type === 'new_device_available') return 'new_devices';
                          if (type === 'device_missing_room') return 'missing_rooms';
                          if (type === 'device_name_duplicate') return 'duplicate_names';
                          return 'generic';
                        };

                        return (
                          <div key={item.id} className="col-span-1 md:col-span-2 lg:col-span-3">
                            <div className={cn(
                              "rounded-[2rem] border bg-card transition-all duration-300 overflow-hidden",
                              isExpanded ? "border-primary/40 shadow-2xl shadow-primary/5" : "border-border hover:border-primary/20"
                            )}>
                              {/* Group Header */}
                              <button 
                                onClick={() => toggleGroup(item.id)}
                                className="w-full flex items-center justify-between p-6 hover:bg-primary/5 transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                    <Layers className="w-5 h-5" />
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-sm font-black tracking-tight">
                                      {t(`assistant.types.group.${getGroupKey(groupType)}`, { count: totalCount })}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                      {t('assistant.group_hint', { count: totalCount })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {item.actions.map((action, idx) => (
                                    <Button
                                      key={idx}
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (action.type === 'import_all') onNavigate('inbox');
                                        else if (item.subGroups[0]?.findings[0]?.actions[0]) 
                                          handleAction(item.subGroups[0].findings[0], item.subGroups[0].findings[0].actions[0]);
                                      }}
                                      className="text-[9px] font-black uppercase tracking-widest"
                                    >
                                      {t(action.label)}
                                    </Button>
                                  ))}
                                  <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-180")} />
                                </div>
                              </button>

                              {/* Group Content */}
                              {isExpanded && (
                                <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/20">
                                  <div className="space-y-4">
                                    {item.subGroups.map((subGroup) => {
                                      const subGroupId = `${item.id}_${subGroup.name}`;
                                      const isSubExpanded = expandedSubGroups[subGroupId] || false;
                                      const count = subGroup.findings.length;
                                      const primaryFinding = subGroup.findings[0];

                                      return (
                                        <div key={subGroupId} className="space-y-2">
                                          {/* SubGroup Row */}
                                          <div className={cn(
                                            "bg-card p-4 rounded-2xl border border-border/60 flex items-center justify-between group/sub transition-all",
                                            isSubExpanded && "border-primary/30 bg-primary/5"
                                          )}>
                                            <div className="flex items-center gap-3 flex-1">
                                              <div className="p-2 rounded-lg bg-muted text-foreground/70 group-hover/sub:text-primary transition-colors">
                                                {getIcon(primaryFinding.type)}
                                              </div>
                                              <div className="text-left flex-1">
                                                <p className="text-sm font-bold flex items-center gap-2">
                                                  {subGroup.name}
                                                  {count > 1 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
                                                       × {count}
                                                    </span>
                                                  )}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                                  {t(`assistant.types.${primaryFinding.type}_description`, primaryFinding.metadata) as string}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                              {count > 1 ? (
                                                <button 
                                                  onClick={() => toggleSubGroup(subGroupId)}
                                                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                                >
                                                  {isSubExpanded ? t('common.hide') : t('common.more')}
                                                  <ChevronDown className={cn("w-3 h-3 transition-transform", isSubExpanded && "rotate-180")} />
                                                </button>
                                              ) : (
                                                <button 
                                                  onClick={() => primaryFinding.actions[0] && handleAction(primaryFinding, primaryFinding.actions[0])}
                                                  className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-all"
                                                >
                                                  <ArrowRight className="w-4 h-4" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Individual Findings in SubGroup */}
                                          {isSubExpanded && (
                                            <div className="pl-12 pr-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                              {subGroup.findings.map(finding => (
                                                <div key={finding.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 group/item">
                                                  <span className="text-[11px] font-bold text-foreground">
                                                    {finding.metadata.friendlyName || finding.metadata.deviceName || finding.id}
                                                  </span>
                                                  <button 
                                                    onClick={() => finding.actions[0] && handleAction(finding, finding.actions[0])}
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
                      }

                      const finding = item as Finding;
                      return (
                        <div 
                          key={finding.id}
                          className={cn(
                            "group relative flex flex-col p-6 rounded-[2rem] border transition-all duration-500",
                            isProactiveType(finding.type) 
                              ? "bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-xl shadow-primary/5 hover:shadow-primary/10 hover:-translate-y-1" 
                              : "bg-card border-border hover:border-primary/30"
                          )}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 rounded-2xl bg-muted/50 text-foreground group-hover:scale-110 transition-transform">
                              {getIcon(finding.type)}
                            </div>
                            <StatusPill 
                              variant={finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'success'}
                            >
                              {t(`assistant.severities.${finding.severity}`)}
                            </StatusPill>
                          </div>

                          <h3 className="text-sm font-black tracking-tight mb-2 group-hover:text-primary transition-colors">
                            {t(`assistant.types.${finding.type}`)}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-medium">
                            {(t(`assistant.types.${finding.type}_description`, finding.metadata) as string)}
                          </p>

                          {finding.metadata.reasonKey && (
                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 mb-6 font-primary">
                              <p className="text-[10px] font-bold text-primary italic leading-normal flex items-center gap-2">
                                <Info className="w-3 h-3" />
                                {t(`assistant.types.reasons.${finding.metadata.reasonKey}`)}
                              </p>
                            </div>
                          )}

                          {finding.metadata.ready && (
                            <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl bg-success/10 border border-success/20 text-success">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                {t('assistant.draft.ready')}
                              </span>
                            </div>
                          )}

                          <div className="mt-auto flex items-center gap-2">
                            {finding.actions.map((action, idx) => (
                              <Button
                                key={idx}
                                variant={idx === 0 ? "primary" : "secondary"}
                                onClick={() => handleAction(finding, action)}
                                className="flex-1 text-[10px] uppercase tracking-widest h-auto py-3"
                              >
                                {t(action.label)}
                              </Button>
                            ))}
                            <Button 
                              variant="ghost"
                              onClick={(e) => handleDismiss(finding.id, e)}
                              className="px-3 hover:text-danger hover:bg-danger/10"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {activeAction && (
        <AssistantActionModal 
          findingId={activeAction.findingId}
          action={activeAction.action}
          deviceName={activeAction.deviceName}
          onClose={() => setActiveAction(null)}
          onSuccess={() => fetchFindings()}
        />
      )}
    </div>
  );
};
