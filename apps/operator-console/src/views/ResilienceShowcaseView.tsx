import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, ShieldCheck, Activity, Shield, Layers } from 'lucide-react';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { API_BASE_URL } from '../config';

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
          fetch(`${API_BASE_URL}/api/v1/scenes`),
          fetch(`${API_BASE_URL}/api/v1/automations`)
        ]);
        if (scenesRes.ok) setScenes(await scenesRes.json());
        if (automationsRes.ok) setAutomations(await automationsRes.json());
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
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse">
        <Activity className="w-10 h-10 text-primary/40 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{t('showcase.loading_pulse')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20">
      
      {/* Autonomy Hero Section */}
      <div className="relative overflow-hidden bg-card/40 backdrop-blur-3xl border-2 border-border/40 rounded-[4rem] p-12 transition-all hover:border-primary/20">
        <div className="absolute top-0 right-0 p-12 opacity-5">
           <Shield className="w-64 h-64 text-primary" />
        </div>
        
        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="max-w-xl">
             <div className="flex items-center gap-3 mb-6">
                <div className="px-3 py-1 bg-success/10 border border-success/20 rounded-full">
                    <span className="text-[10px] font-black uppercase tracking-widest text-success">{t('showcase.verified_resilience')}</span>
                </div>
                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('showcase.edge_native')}</span>
                </div>
             </div>
             <h2 className="text-5xl font-black tracking-tighter leading-tight mb-4 text-foreground/90">
               {t('showcase.hero_title_p1')} <br /> {t('showcase.hero_title_p2')}
             </h2>
             <p className="text-lg font-medium text-muted-foreground leading-relaxed">
               {t('showcase.hero_description')}
             </p>
          </div>

          <div className="relative flex items-center justify-center">
             <div className="w-64 h-64 rounded-full border-8 border-muted/20 flex items-center justify-center relative">
                {/* SVG Radial Gauge */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
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
                <div className="text-center bg-background/40 backdrop-blur-md w-48 h-48 rounded-full flex flex-col items-center justify-center border border-border/40 shadow-2xl">
                   <span className="text-6xl font-black tracking-tighter tabular-nums">{metrics.score}%</span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('showcase.autonomy_score')}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Persistence Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Hardware Pillar */}
        <div className="bg-card/40 border border-border/40 rounded-[3rem] p-10 space-y-8 flex flex-col justify-between">
           <div>
              <div className="flex items-center gap-4 mb-8">
                 <div className="p-4 bg-success/10 text-success rounded-2xl">
                    <Cpu className="w-8 h-8" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black tracking-tight tracking-tighter">{t('showcase.infrastructure_title')}</h3>
                    <p className="text-xs font-bold text-muted-foreground opacity-50 uppercase tracking-widest">{t('showcase.infrastructure_subtitle')}</p>
                 </div>
              </div>
              <div className="space-y-6">
                 <div className="flex items-center justify-between p-6 bg-muted/20 rounded-2xl border border-border/20">
                    <span className="font-bold text-lg">{t('showcase.edge_native')}</span>
                    <div className="flex items-center gap-2">
                       <span className="text-2xl font-black tabular-nums">{metrics.localDevices}</span>
                       <span className="text-[10px] font-bold text-success uppercase">{t('showcase.online')}</span>
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-6 bg-muted/20 rounded-2xl border border-border/20">
                    <span className="font-bold text-lg">{t('showcase.bridged_entities')}</span>
                    <div className="flex items-center gap-2">
                       <span className="text-2xl font-black tabular-nums">{metrics.bridgedDevices}</span>
                       <span className="text-[10px] font-bold text-primary opacity-60 uppercase">{t('showcase.mesh')}</span>
                    </div>
                 </div>
              </div>
           </div>
           <p className="text-xs font-medium text-muted-foreground leading-relaxed pt-4">
              {t('showcase.hardware_note')}
           </p>
        </div>

        {/* Intelligence Pillar */}
        <div className="bg-card/40 border border-border/40 rounded-[3rem] p-10 space-y-8 flex flex-col justify-between">
           <div>
              <div className="flex items-center gap-4 mb-8">
                 <div className="p-4 bg-primary/10 text-primary rounded-2xl">
                    <ShieldCheck className="w-8 h-8" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black tracking-tighter">{t('showcase.resilience_title')}</h3>
                    <p className="text-xs font-bold text-muted-foreground opacity-50 uppercase tracking-widest">{t('showcase.resilience_subtitle')}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="p-6 bg-muted/20 rounded-2xl border border-border/20 text-center">
                    <span className="text-3xl font-black tabular-nums block mb-1">{metrics.autonomousAutomations}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{t('showcase.autonomous_rules')}</span>
                 </div>
                 <div className="p-6 bg-muted/20 rounded-2xl border border-border/20 text-center">
                    <span className="text-3xl font-black tabular-nums block mb-1">{metrics.autonomousScenes}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{t('showcase.edge_scenes')}</span>
                 </div>
              </div>
           </div>
           <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="w-5 h-5 text-success" />
                 <span className="text-sm font-bold tracking-tight">{t('showcase.offline_verified')}</span>
              </div>
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                 {t('showcase.intelligence_note')}
              </p>
           </div>
        </div>
      </div>

      {/* System Integrity Map Placeholder / Logic Visualization */}
      <div className="bg-muted/10 border-2 border-dashed border-border/30 rounded-[4rem] p-12 text-center flex flex-col items-center gap-6">
         <Layers className="w-12 h-12 text-muted-foreground opacity-20" />
         <div className="max-w-md">
            <h4 className="text-xl font-bold tracking-tight mb-2 opacity-60">{t('showcase.synergy_title')}</h4>
            <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed uppercase tracking-widest">
              {t('showcase.synergy_stats', { devices: devices.length, scenes: scenes.length, rules: automations.length })}
            </p>
         </div>
      </div>

    </div>
  );
};

export default ResilienceShowcaseView;
