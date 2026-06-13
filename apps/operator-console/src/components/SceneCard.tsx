import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Coffee,
  Edit2,
  Heart,
  Home,
  Leaf,
  Loader2,
  Monitor,
  Moon,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off';
}

export interface SceneCardScene {
  id: string;
  name: string;
  description?: string;
  actions: SceneAction[];
}

interface SceneCardProps {
  scene: SceneCardScene;
  roomName: string | null;
  isFavorite: boolean;
  isExecuting: boolean;
  isSuccessful: boolean;
  onExecute: (scene: SceneCardScene) => void;
  onToggleFavorite: (sceneId: string, event: React.MouseEvent) => void;
  onEdit: (scene: SceneCardScene, event: React.MouseEvent) => void;
  onDelete: (sceneId: string, event: React.MouseEvent) => void;
}

const getSceneIcon = (name: string) => {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('morning') || normalizedName.includes('wake')) return Sun;
  if (normalizedName.includes('night') || normalizedName.includes('sleep') || normalizedName.includes('bed')) return Moon;
  if (normalizedName.includes('relax') || normalizedName.includes('chill')) return Coffee;
  if (normalizedName.includes('work') || normalizedName.includes('focus') || normalizedName.includes('office')) return Monitor;
  if (normalizedName.includes('welcome') || normalizedName.includes('home') || normalizedName.includes('arrive')) return Home;
  if (normalizedName.includes('eco') || normalizedName.includes('saving')) return Leaf;
  return Zap;
};

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  roomName,
  isFavorite,
  isExecuting,
  isSuccessful,
  onExecute,
  onToggleFavorite,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const Icon = getSceneIcon(scene.name);
  const normalizedName = scene.name.toLowerCase();
  const description = scene.description
    || (normalizedName.includes('morning') && t('scenes.descriptions.morning'))
    || (normalizedName.includes('night') && t('scenes.descriptions.night'))
    || (normalizedName.includes('relax') && t('scenes.descriptions.relax'))
    || (normalizedName.includes('work') && t('scenes.descriptions.work'))
    || (normalizedName.includes('welcome') && t('scenes.descriptions.welcome'))
    || t('scenes.descriptions.generic');

  return (
    <div
      onClick={() => onExecute(scene)}
      className={cn(
        'group relative bg-card/40 backdrop-blur-2xl border-2 rounded-[3.5rem] p-8 transition-all duration-700 cursor-pointer overflow-hidden',
        isSuccessful ? 'border-primary bg-primary/5 premium-glow shadow-primary/10 scale-[1.02]' : 'border-border/40 hover:border-primary/40',
        isExecuting && 'animate-premium-pulse'
      )}
    >
      <div className="flex items-start gap-8 relative z-10">
        <div className={cn(
          'p-6 rounded-[2.5rem] transition-all duration-700 transform group-hover:scale-110',
          isSuccessful ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/40' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
        )}>
          {isExecuting ? <Loader2 className="w-8 h-8 animate-spin" /> : <Icon className="w-8 h-8" />}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0 pt-1">
          <h4 className="text-2xl font-black tracking-tighter truncate luxury-text-gradient">{scene.name}</h4>
          <p className="text-sm font-medium text-muted-foreground opacity-60 leading-tight">
            {description}
          </p>
          <div className="flex items-center gap-3 mt-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
              {roomName || t('common.unknown')}
            </span>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">
              {t('scenes.point_count', { count: scene.actions.length })}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={(event) => onToggleFavorite(scene.id, event)}
        className={cn(
          'absolute top-8 right-8 p-3 rounded-full transition-all duration-300 z-20',
          isFavorite ? 'text-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/20' : 'text-muted-foreground/40 hover:bg-muted hover:text-rose-400'
        )}
      >
        <Heart className={cn('w-5 h-5', isFavorite && 'fill-current')} />
      </button>

      <div className="absolute bottom-6 right-8 flex gap-2 transition-all z-20">
        <button
          onClick={(event) => onEdit(scene, event)}
          className="p-3 bg-muted/40 hover:bg-muted border border-border/40 rounded-2xl hover:text-primary transition-all"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={(event) => onDelete(scene.id, event)}
          className="p-3 bg-muted/40 hover:bg-muted border border-border/40 rounded-2xl hover:text-destructive transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
