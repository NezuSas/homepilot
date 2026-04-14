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
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: any } | null>(null);

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

  const handleResolve = (finding: Finding) => {
    switch (finding.type) {
      case 'new_device_available':
        onNavigate('inbox');
        break;
      case 'device_missing_room':
        onNavigate('inbox'); 
        break;
      case 'device_name_technical':
      case 'device_name_duplicate':
        onNavigate('inbox'); // Device manager is the place to fix names
        break;
      default:
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
      case 'new_device_available': return <PlusCircle className="w-5 h-5 text-blue-500" />;
      case 'device_missing_room': return <Hash className="w-5 h-5 text-amber-500" />;
      case 'device_name_technical': return <Type className="w-5 h-5 text-indigo-500" />;
      case 'device_name_duplicate': return <Copy className="w-5 h-5 text-rose-500" />;
      case 'automation_suggestion': return <Sparkles className="w-5 h-5 text-purple-500" />;
      case 'scene_suggestion': return <Sparkles className="w-5 h-5 text-pink-500" />;
      case 'optimization_suggestion': return <Zap className="w-5 h-5 text-emerald-500" />;
      case 'energy_waste_detected': return <Zap className="w-5 h-5 text-rose-500" />;
      case 'habit_pattern_detected': return <Sparkles className="w-5 h-5 text-primary" />;
      case 'proactive_automation_opportunity': return <Sparkles className="w-5 h-5 text-primary" />;
      case 'optimization_opportunity': return <Info className="w-5 h-5 text-muted-foreground" />;
      default: return <Info className="w-5 h-5 text-primary" />;
    }
  };


  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const GROUPABLE_TYPES = ['new_device_available', 'device_missing_room', 'device_name_duplicate'];

  interface GroupItem {
    id: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    isGroup: true;
    findings: Finding[];
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
        sections[section].push({
          id: `group_${type}`,
          type,
          severity: items[0].severity,
          isGroup: true,
          findings: items,
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
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">{t('assistant.title')}</h1>
          </div>
          <p className="text-muted-foreground font-medium">{t('assistant.subtitle')}</p>
        </div>
        
        <button 
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-5 py-2.5 bg-muted hover:bg-muted/80 rounded-xl transition-all font-bold text-sm"
        >
          <RefreshCw className={cn("w-4 h-4", scanning && "animate-spin")} />
          {scanning ? t('assistant.scanning') : t('assistant.scan_trigger')}
        </button>
      </header>


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
                        const count = item.findings.length;
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
                                      {t(`assistant.types.group.${getGroupKey(groupType)}`, { count })}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                      {t('assistant.group_hint', { count })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {item.actions.map((action, idx) => (
                                    <button
                                      key={idx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (action.type === 'import_all') onNavigate('inbox');
                                        else handleResolve(item.findings[0]);
                                      }}
                                      className="px-4 py-2 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                                    >
                                      {t(action.label)}
                                    </button>
                                  ))}
                                  <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-180")} />
                                </div>
                              </button>

                              {/* Group Content */}
                              {isExpanded && (
                                <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/20">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {item.findings.map((finding: Finding) => (
                                      <div key={finding.id} className="bg-card p-4 rounded-2xl border border-border/60 flex items-center justify-between group/item">
                                        <div className="flex items-center gap-3">
                                          <div className="p-2 rounded-lg bg-muted text-foreground/70 group-hover/item:text-primary transition-colors">
                                            {getIcon(finding.type)}
                                          </div>
                                          <div className="text-left">
                                            <p className="text-xs font-bold truncate max-w-[120px]">
                                              {finding.metadata.friendlyName || finding.metadata.deviceName || finding.id}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground line-clamp-1">
                                              {finding.description}
                                            </p>
                                          </div>
                                        </div>
                                        <button 
                                          onClick={() => handleResolve(finding)}
                                          className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                        >
                                          <ArrowRight className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
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
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                              finding.severity === 'high' ? "text-rose-500 border-rose-500/20 bg-rose-500/5" :
                              finding.severity === 'medium' ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
                              "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                            )}>
                              {t(`assistant.severities.${finding.severity}`)}
                            </span>
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
                            <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                {t('assistant.draft.ready')}
                              </span>
                            </div>
                          )}

                          <div className="mt-auto flex items-center gap-2">
                            {finding.actions.map((action, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (action.type === 'activate_draft') setActiveAction({ findingId: finding.id, action });
                                  else if (action.type === 'configure_automation') onNavigate('automations');
                                  else if (action.type === 'review_device') onNavigate('inbox');
                                  else if (action.type === 'configure_energy_rule') onNavigate('automations');
                                  else handleResolve(finding);
                                }}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                  idx === 0 ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                              >
                                {t(action.label)}
                              </button>
                            ))}
                            <button 
                              onClick={(e) => handleDismiss(finding.id, e)}
                              className="p-3 rounded-xl bg-muted/30 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
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
          onClose={() => setActiveAction(null)}
          onSuccess={() => fetchFindings()}
        />
      )}
    </div>
  );
};
