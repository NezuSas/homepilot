import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AssistantActionModal } from '../components/AssistantActionModal';
import { AssistantEmptyState } from '../components/AssistantEmptyState';
import { AssistantFindingCard } from '../components/AssistantFindingCard';
import { AssistantFindingGroupCard } from '../components/AssistantFindingGroupCard';
import { LoadingState } from '../components/ui/LoadingState';
import { AssistantRecommendationsHeader } from '../components/AssistantRecommendationsHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Button } from '../components/ui/Button';
import { useAssistantStore } from '../stores/useAssistantStore';
import type { View } from '../types';
import type { AssistantFinding as Finding, AssistantFindingAction } from '../stores/useAssistantStore';

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

export const AssistantView: React.FC<{
  onNavigate: (view: View, params?: unknown) => void;
}> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [activeAction, setActiveAction] = useState<{ findingId: string; action: AssistantFindingAction; deviceName?: string } | null>(null);
  const findings = useAssistantStore((state) => state.findings);
  const loading = useAssistantStore((state) => state.isLoading);
  const scanning = useAssistantStore((state) => state.isScanning);
  const refreshFindings = useAssistantStore((state) => state.refreshFindings);
  const scanFindings = useAssistantStore((state) => state.scanFindings);
  const dismissFinding = useAssistantStore((state) => state.dismissFinding);
  

  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    if (!initialLoadDone && !loading) {
      setInitialLoadDone(true);
    }
  }, [loading, initialLoadDone]);

  useEffect(() => {
    if (!initialLoadDone) {
      refreshFindings().then(() => {
        // Auto-scan to resolve stale findings (e.g. fixed duplicate names in Inbox)
        scanFindings();
      });
    }
  }, [initialLoadDone, refreshFindings, scanFindings]);

  const handleScan = async () => {
    await scanFindings();
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await dismissFinding(id);
  };

  const handleAction = (finding: Finding, action: AssistantFindingAction) => {
    // 1. Modal-based actions
    const modalActions = ['activate_draft', 'import_device', 'assign_room', 'rename_device'];
    if (modalActions.includes(action.type)) {
      setActiveAction({ 
        findingId: finding.id, 
        action,
        deviceName: getMetadataText(finding.metadata, ['friendlyName', 'deviceName', 'name'], finding.id)
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
    actions: AssistantFindingAction[];
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
          const name = getMetadataText(it.metadata, ['friendlyName', 'deviceName', 'name'], it.id);
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
    return <LoadingState label={t('common.loading')} className="h-assistant-loading" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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


      <AssistantRecommendationsHeader />


      {findings.length === 0 ? (
        <AssistantEmptyState />
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
                    <h2 className="text-micro font-black uppercase tracking-label text-muted-foreground/60">
                      {t(`assistant.sections.${sectionKey}`)}
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-muted to-transparent"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sectionItems.map((item: ProcessedItem) => {
                      if ('isGroup' in item && item.isGroup) {
                        return (
                          <AssistantFindingGroupCard
                            key={item.id}
                            group={item}
                            isExpanded={expandedGroups[item.id] || false}
                            expandedSubGroups={expandedSubGroups}
                            onToggleGroup={toggleGroup}
                            onToggleSubGroup={toggleSubGroup}
                            onImportAll={() => onNavigate('inbox')}
                            onAction={handleAction}
                          />
                        );
                      }

                      const finding = item as Finding;
                      return (
                        <AssistantFindingCard
                          key={finding.id}
                          finding={finding}
                          onAction={handleAction}
                          onDismiss={handleDismiss}
                        />
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
          onSuccess={() => { setActiveAction(null); refreshFindings(); }}
        />
      )}
    </div>
  );
};
