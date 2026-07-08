import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetConfig } from '../types';
import { PlaySquare, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

const API = `${API_BASE_URL}/api/v1`;

export function SceneShortcutWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'executing' | 'success'>('idle');
  const sceneName = config.appearance.title || t('dashboards.widgets.scenes_shortcut.label');

  if (!config.binding.entityId) {
    return (
      <DormantWidgetPlaceholder
        title={t('dashboards.widgets.scenes_shortcut.label')}
        icon={PlaySquare}
        message={t('dashboards.widgets.scenes_shortcut.placeholder')}
        isEditing={isEditing}
        onConfigure={onConfigure}
        variant={config.appearance.variant}
      />
    );
  }

  const handleTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status !== 'idle') return;
    
    setStatus('executing');
    try {
      await apiFetch(`${API}/scenes/${config.binding.entityId}/trigger`, {
        method: 'POST'
      });
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to trigger scene:', err);
      setStatus('idle');
    }
  };

  return (
    <div 
      className={cn(
        "relative h-full w-full min-h-0 flex flex-col justify-center items-center p-4 @md:p-6 transition-all duration-500",
        status === 'executing' ? "bg-primary/10" : "hover:bg-primary/[0.02]"
      )}
    >
      <div className={cn(
        "w-12 h-12 @md:w-16 @md:h-16 rounded-[1.5rem] @md:rounded-[2rem] flex items-center justify-center border transition-all duration-500 mb-2 @md:mb-4",
        status === 'executing' ? "bg-primary border-primary shadow-xl shadow-primary/30 rotate-12" : 
        status === 'success' ? "bg-success border-success text-success-foreground" :
        "bg-primary/10 border-primary/20"
      )}>
        {status === 'executing' ? (
          <Loader2 className="w-6 h-6 @md:w-8 @md:h-8 text-primary-foreground animate-spin" />
        ) : status === 'success' ? (
          <CheckCircle2 className="w-6 h-6 @md:w-8 @md:h-8" />
        ) : (
          <PlaySquare className="w-6 h-6 @md:w-8 @md:h-8 text-primary" />
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50 mb-1">
          {t('dashboards.widgets.scenes_shortcut.label')}
        </p>
        <h4 className="text-xs @md:text-sm font-black tracking-tight text-foreground line-clamp-2 text-center leading-tight">{sceneName}</h4>
      </div>

      <Sparkles className="absolute top-4 left-4 w-3 h-3 text-primary/20" />
      
      <button 
        onClick={handleTrigger}
        disabled={status !== 'idle'}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
