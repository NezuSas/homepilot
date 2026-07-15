import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, ShieldCheck, Activity, Shield, Layers } from 'lucide-react';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

const ResilienceShowcaseView: React.FC = () => {
  const { t } = useTranslation();
  const devices = useDeviceSnapshotStore(state => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);
  
  const [scenes, setScenes] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scenesRes, automationsRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/v1/scenes`),
          apiFetch(`${API_BASE_URL}/api/v1/automations`)
        ]);
        if (scenesRes.ok) { const d = await scenesRes.json(); if (Array.isArray(d)) setScenes(d); }
        if (automationsRes.ok) { const d = await automationsRes.json(); if (Array.isArray(d)) setAutomations(d); }
        await refreshSnapshot();
      } catch (e) {
        console.error('Failed to fetch metrics for showcase', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [refreshSnapshot]);

  const metrics = useMemo(() => {
    const localDevices = devices.filter(d => d.integrationSource === 'sonoff');
    const bridgedDevices = devices.filter(d => d.integrationSource !== 'sonoff');
    
    const autonomousScenes = scenes.filter(s => {
      const actions = s.actions || [];
      return actions.length > 0 && actions.every((a: any) => 
        devices.find(d => d.id === a.deviceId)?.integrationSource === 'sonoff'
      );
    });

    const autonomousAutomations = automations.filter(rule => {
      const isLocal = (id?: string) => devices.find(d => d.id === id)?.integrationSource === 'sonoff';
      const triggerIsLocal = rule.trigger?.type === 'time' || isLocal(rule.trigger?.deviceId);
      
      let actionIsLocal = false;
      if (rule.action?.type === 'device_command') {
        actionIsLocal = isLocal(rule.action?.targetDeviceId);
      } else if (rule.action?.type === 'execute_scene') {
        const targetScene = scenes.find(s => s.id === rule.action?.sceneId);
        actionIsLocal = targetScene?.actions?.every((a: any) => isLocal(a.deviceId)) ?? false;
      }
      return triggerIsLocal && actionIsLocal;
    });

    const totalCalculable = devices.length + scenes.length + automations.length;
    const totalAutonomous = localDevices.length + autonomousScenes.length + autonomousAutomations.length;
    const score = totalCalculable > 0 ? Math.round((totalAutonomous / totalCalculable) * 100) : 0;

    return {
      localDevices: localDevices.length,
      onlineLocal: localDevices.filter(d => (Date.now() - new Date(d.updatedAt || 0).getTime() < 300000)).length,
      bridgedDevices: bridgedDevices.length,
      autonomousScenes: autonomousScenes.length,
      autonomousAutomations: autonomousAutomations.length,
      score
    };
  }, [devices, scenes, automations]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-empty-sm animate-pulse">
        <Activity className="w-10 h-10 text-primary/40 mb-4" />
        <p className="text-micro font-black uppercase tracking-widest text-muted-foreground opacity-40">{t('showcase.loading_pulse')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-1000 sm:space-y-8 sm:pb-16 lg:space-y-12 lg:pb-20">
      
      {/* Autonomy Hero Section */}
      <div className="relative overflow-hidden rounded-panel border-2 border-border/40 bg-card/40 p-5 backdrop-blur-3xl transition-all hover:border-primary/20 sm:p-8 lg:rounded-showcase lg:p-12">
        <div className="absolute right-0 top-0 p-5 opacity-5 sm:p-8 lg:p-12">
           <Shield className="h-32 w-32 text-primary sm:h-48 sm:w-48 lg:h-64 lg:w-64" />
        </div>
        
        <div className="relative flex flex-col items-center justify-between gap-6 lg:flex-row lg:gap-12">
          <div className="max-w-xl">
             <div className="mb-5 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
                <div className="px-3 py-1 bg-success/10 border border-success/20 rounded-full">
                    <span className="text-micro font-black uppercase tracking-widest text-success">{t('showcase.verified_resilience')}</span>
                </div>
                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                    <span className="text-micro font-black uppercase tracking-widest text-primary">{t('showcase.edge_native')}</span>
                </div>
             </div>
             <h2 className="mb-3 text-view-title font-black leading-tight tracking-tight text-foreground/90 sm:mb-4 sm:text-hero-title">
               {t('showcase.hero_title_p1')} <br /> {t('showcase.hero_title_p2')}
             </h2>
             <p className="text-body font-medium leading-relaxed text-muted-foreground sm:text-section-title">
               {t('showcase.hero_description')}
             </p>
          </div>

          <div className="relative flex items-center justify-center">
             <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-4 border-muted/20 sm:h-56 sm:w-56 sm:border-6 lg:h-64 lg:w-64 lg:border-8">
                {/* SVG Radial Gauge */}
                <svg viewBox="0 0 256 256" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                  <circle 
                    cx="128" cy="128" r="120" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8"
                    className="text-primary/10"
                  />
                  <circle 
                    cx="128" cy="128" r="120" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8"
                    strokeDasharray="753.98"
                    strokeDashoffset={753.98 - (753.98 * metrics.score) / 100}
                    className="text-primary transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-border/40 bg-background/40 text-center shadow-2xl backdrop-blur-md sm:h-44 sm:w-44 lg:h-48 lg:w-48">
                   <span className="text-display-title font-black tracking-tighter tabular-nums sm:text-hero-title-lg">{metrics.score}%</span>
                   <span className="text-micro font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('showcase.autonomy_score')}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Persistence Matrix */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
        
        {/* Hardware Pillar */}
        <div className="flex flex-col justify-between space-y-5 rounded-panel border border-border/40 bg-card/40 p-5 sm:space-y-6 sm:p-6 lg:rounded-hero lg:p-10 lg:space-y-8">
           <div>
              <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4 lg:mb-8">
                 <div className="rounded-xl bg-success/10 p-3 text-success sm:rounded-2xl sm:p-4">
                    <Cpu className="w-8 h-8" />
                 </div>
                 <div>
                    <h3 className="text-panel-title font-black tracking-tight">{t('showcase.infrastructure_title')}</h3>
                    <p className="text-caption font-bold text-muted-foreground opacity-50 uppercase tracking-widest">{t('showcase.infrastructure_subtitle')}</p>
                 </div>
              </div>
              <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                 <div className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 p-4 sm:rounded-2xl sm:p-5 lg:p-6">
                    <span className="font-bold text-section-title">{t('showcase.edge_native')}</span>
                    <div className="flex items-center gap-2">
                       <span className="text-view-title font-black tabular-nums">{metrics.localDevices}</span>
                       <span className="text-micro font-bold text-success uppercase">{t('showcase.online')}</span>
                    </div>
                 </div>
                 <div className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 p-4 sm:rounded-2xl sm:p-5 lg:p-6">
                    <span className="font-bold text-section-title">{t('showcase.bridged_entities')}</span>
                    <div className="flex items-center gap-2">
                       <span className="text-view-title font-black tabular-nums">{metrics.bridgedDevices}</span>
                       <span className="text-micro font-bold text-primary opacity-60 uppercase">{t('showcase.mesh')}</span>
                    </div>
                 </div>
              </div>
           </div>
           <p className="text-caption font-medium text-muted-foreground leading-relaxed pt-4">
              {t('showcase.hardware_note')}
           </p>
        </div>

        {/* Intelligence Pillar */}
        <div className="flex flex-col justify-between space-y-5 rounded-panel border border-border/40 bg-card/40 p-5 sm:space-y-6 sm:p-6 lg:rounded-hero lg:p-10 lg:space-y-8">
           <div>
              <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4 lg:mb-8">
                 <div className="rounded-xl bg-primary/10 p-3 text-primary sm:rounded-2xl sm:p-4">
                    <ShieldCheck className="w-8 h-8" />
                 </div>
                 <div>
                    <h3 className="text-panel-title font-black tracking-tight">{t('showcase.resilience_title')}</h3>
                    <p className="text-caption font-bold text-muted-foreground opacity-50 uppercase tracking-widest">{t('showcase.resilience_subtitle')}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                 <div className="rounded-xl border border-border/20 bg-muted/20 p-4 text-center sm:rounded-2xl sm:p-5 lg:p-6">
                    <span className="text-display-title font-black tabular-nums block mb-1">{metrics.autonomousAutomations}</span>
                    <span className="text-micro font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{t('showcase.autonomous_rules')}</span>
                 </div>
                 <div className="rounded-xl border border-border/20 bg-muted/20 p-4 text-center sm:rounded-2xl sm:p-5 lg:p-6">
                    <span className="text-display-title font-black tabular-nums block mb-1">{metrics.autonomousScenes}</span>
                    <span className="text-micro font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{t('showcase.edge_scenes')}</span>
                 </div>
              </div>
           </div>
           <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="w-5 h-5 text-success" />
                 <span className="text-body font-bold tracking-tight">{t('showcase.offline_verified')}</span>
              </div>
              <p className="text-caption font-medium text-muted-foreground leading-relaxed">
                 {t('showcase.intelligence_note')}
              </p>
           </div>
        </div>
      </div>

      {/* System Integrity Map Placeholder / Logic Visualization */}
      <div className="flex flex-col items-center gap-5 rounded-panel border-2 border-dashed border-border/30 bg-muted/10 p-5 text-center sm:p-8 lg:gap-6 lg:rounded-showcase lg:p-12">
         <Layers className="w-12 h-12 text-muted-foreground opacity-20" />
         <div className="max-w-md">
            <h4 className="text-panel-title font-bold tracking-tight mb-2 opacity-60">{t('showcase.synergy_title')}</h4>
            <p className="text-body font-medium text-muted-foreground/60 leading-relaxed uppercase tracking-widest">
              {t('showcase.synergy_stats', { devices: devices.length, scenes: scenes.length, rules: automations.length })}
            </p>
         </div>
      </div>

    </div>
  );
};

export default ResilienceShowcaseView;
