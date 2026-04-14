import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  RefreshCw,
  PlusCircle,
  Hash,
  Type,
  Copy,
  Zap
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
}

export const AssistantView: React.FC<{
  onNavigate: (view: any, params?: any) => void;
}> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
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

  const topRecommendations = findings
    .filter(f => f.score >= 80)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const remainingFindings = findings.filter(f => !topRecommendations.find(t => t.id === f.id));

  const groupedFindings = remainingFindings.reduce((acc, f) => {
    if (!acc[f.type]) acc[f.type] = [];
    acc[f.type].push(f);
    return acc;
  }, {} as Record<string, Finding[]>);

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_device_available': return <PlusCircle className="w-5 h-5 text-blue-500" />;
      case 'device_missing_room': return <Hash className="w-5 h-5 text-amber-500" />;
      case 'device_name_technical': return <Type className="w-5 h-5 text-indigo-500" />;
      case 'device_name_duplicate': return <Copy className="w-5 h-5 text-rose-500" />;
      case 'automation_suggestion': return <Sparkles className="w-5 h-5 text-purple-500" />;
      case 'scene_suggestion': return <Sparkles className="w-5 h-5 text-pink-500" />;
      case 'optimization_suggestion': return <Zap className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const isPremiumType = (type: string) => 
    ['automation_suggestion', 'scene_suggestion', 'optimization_suggestion'].includes(type);

  const handleImportAll = async (items: Finding[]) => {
    try {
      setLoading(true);
      for (const item of items) {
        if (item.type === 'new_device_available') {
          const action = item.actions.find(a => a.type === 'import_device');
          if (action) {
            await fetch(API_ENDPOINTS.assistant.executeAction, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                findingId: item.id,
                actionType: 'import_device',
                payload: action.payload
              })
            });
          }
        }
      }
      await fetchFindings();
    } catch (e) {
      console.error('[Assistant] Bulk import failed:', e);
    } finally {
      setLoading(false);
    }
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
          <h3 className="text-xl font-bold mb-2 tracking-tight">{t('assistant.no_findings')}</h3>
          <p className="text-muted-foreground max-w-sm text-center">
            {t('assistant.subtitle')}
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {topRecommendations.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-primary">
                  {t('assistant.top_recommendations') || 'Top Recommendations'}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topRecommendations.map(finding => (
                  <div 
                    key={finding.id}
                    className="relative group overflow-hidden p-6 rounded-[2rem] border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-xl shadow-primary/5 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 rounded-2xl bg-primary/20 text-primary">
                        {getIcon(finding.type)}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] font-black tracking-tighter bg-primary text-white px-2 py-0.5 rounded-full uppercase">
                           Priority {finding.score}
                        </span>
                        <button 
                          onClick={(e) => handleDismiss(finding.id, e)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <AlertCircle className="w-4 h-4 rotate-45" />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-lg mb-2 leading-tight">
                      {t(`assistant.types.${finding.type}`, finding.metadata) as string}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-6 line-clamp-2">
                      {t(`assistant.types.${finding.type}_description`, finding.metadata) as string}
                    </p>

                    <div className="flex gap-2">
                      {(finding.actions || []).slice(0, 1).map((action: any) => (
                        <button
                          key={action.type}
                          onClick={() => {
                            if (isPremiumType(finding.type)) {
                              onNavigate(action.type === 'configure_automation' ? 'automations' : 'inbox');
                            } else {
                              setActiveAction({ findingId: finding.id, action });
                            }
                          }}
                          className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                        >
                          {t(action.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6">
          {Object.entries(groupedFindings).map(([type, items]) => {
            const premium = isPremiumType(type);
            return (
              <div 
                key={type} 
                className={cn(
                  "group overflow-hidden rounded-3xl border transition-all",
                  premium 
                    ? "border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent shadow-lg shadow-primary/5" 
                    : "border-muted bg-card hover:border-primary/20"
                )}
              >
                <div 
                  onClick={() => toggleGroup(type)}
                  className="flex items-center justify-between p-6 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "p-3 rounded-2xl transition-colors",
                      premium ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"
                    )}>
                      {getIcon(type)}
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-bold text-lg leading-none mb-1.5 flex items-center gap-2",
                        premium && "text-primary"
                      )}>
                        {t(`assistant.types.${type}`)}
                        {premium && (
                          <span className="text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            Premium
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium">
                        {items.length} {t('assistant.subtitle').toLowerCase()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {type === 'new_device_available' && items.length > 1 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleImportAll(items); }}
                        className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                      >
                        {t('assistant.actions.import_all')}
                      </button>
                    )}

                    <div className="flex -space-x-2">
                      {items.slice(0, 3).map((it, idx) => (
                        <div key={it.id} className="w-8 h-8 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold">
                          +{items.length - 3}
                        </div>
                      )}
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform duration-300",
                      expandedGroups[type] && "rotate-90"
                    )} />
                  </div>
                </div>

                {expandedGroups[type] && (
                  <div className="px-6 pb-6 pt-0 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {items.map(finding => (
                      <div 
                        key={finding.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-colors",
                          premium ? "bg-primary/5 border-primary/10" : "bg-muted/30 border-muted"
                        )}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            {finding.severity === 'high' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                            <span className="font-bold text-sm tracking-tight">
                              {t(`assistant.types.${finding.type}`, finding.metadata) as string}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {t(`assistant.types.${finding.type}_description`, finding.metadata) as string}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={(e) => handleDismiss(finding.id, e)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors"
                          >
                            {t('assistant.dismiss')}
                          </button>
                          
                          {(finding.actions || []).map((action: any) => (
                            <button
                              key={action.type}
                              onClick={() => {
                                if (premium) {
                                  // Suggestions lead to configuration/review
                                  onNavigate(action.type === 'configure_automation' ? 'automations' : 'inbox');
                                } else {
                                  setActiveAction({ findingId: finding.id, action });
                                }
                              }}
                              className={cn(
                                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm",
                                premium 
                                  ? "bg-primary text-white hover:opacity-90" 
                                  : "bg-primary text-primary-foreground hover:opacity-90"
                              )}
                            >
                              {t(action.label)}
                            </button>
                          ))}

                          {!premium && (
                            <button 
                              onClick={async () => {
                                await fetch(API_ENDPOINTS.assistant.resolve(finding.id), { method: 'POST' });
                                await fetchFindings();
                                handleResolve(finding);
                              }}
                              className="px-4 py-1.5 rounded-lg border border-primary text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/5 transition-all shadow-sm"
                            >
                              {t('assistant.resolve')}
                            </button>
                          )}
                        </div>
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
