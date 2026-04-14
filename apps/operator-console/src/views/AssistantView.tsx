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
  Copy
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
        onNavigate('inbox'); // Or a specific device edit view if available
        break;
      case 'device_name_technical':
      case 'device_name_duplicate':
        onNavigate('device-manager'); // Assuming a view to edit names exists
        break;
      default:
        break;
    }
  };

  const groupedFindings = findings.reduce((acc, f) => {
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
      default: return <Info className="w-5 h-5 text-primary" />;
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
        <div className="grid gap-6">
          {Object.entries(groupedFindings).map(([type, items]) => (
            <div key={type} className="group overflow-hidden rounded-3xl border border-muted bg-card transition-all hover:border-primary/20">
              <div 
                onClick={() => toggleGroup(type)}
                className="flex items-center justify-between p-6 cursor-pointer select-none"
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 rounded-2xl bg-muted group-hover:bg-primary/5 transition-colors">
                    {getIcon(type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none mb-1.5">
                      {t(`assistant.types.${type}`)}
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      {items.length} {t('assistant.subtitle').toLowerCase()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
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
                      className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-muted"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          {finding.severity === 'high' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                          <span className="font-bold text-sm tracking-tight">
                            {finding.metadata.friendlyName || finding.metadata.deviceName || finding.metadata.name || t(`assistant.types.${finding.type}`)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {finding.description}
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
                            onClick={() => setActiveAction({ findingId: finding.id, action })}
                            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all shadow-sm"
                          >
                            {t(action.label)}
                          </button>
                        ))}

                        <button 
                          onClick={async () => {
                            await fetch(API_ENDPOINTS.assistant.resolve(finding.id), { method: 'POST' });
                            handleResolve(finding);
                          }}
                          className="px-4 py-1.5 rounded-lg border border-primary text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/5 transition-all shadow-sm"
                        >
                          {t('assistant.resolve')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
