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
        'group relative bg-card/40 backdrop-blur-2xl border-2 rounded-panel p-4 transition-all duration-700 cursor-pointer overflow-hidden sm:rounded-hero sm:p-6 lg:rounded-scene lg:p-8',
        isSuccessful ? 'border-primary bg-primary/5 premium-glow shadow-primary/10 scale-[1.02]' : 'border-border/40 hover:border-primary/40',
        isExecuting && 'animate-premium-pulse'
      )}
    >
      <div className="relative z-10 flex items-start gap-4 sm:gap-6 lg:gap-8">
        <div className={cn(
          'rounded-section p-4 transition-all duration-700 transform group-hover:scale-110 sm:rounded-panel sm:p-5 lg:rounded-dashboard lg:p-6',
          isSuccessful ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/40' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
        )}>
          {isExecuting ? <Loader2 className="h-6 w-6 animate-spin sm:h-8 sm:w-8" /> : <Icon className="h-6 w-6 sm:h-8 sm:w-8" />}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0 pt-1">
          <h4 className="truncate text-section-title font-black tracking-tight luxury-text-gradient sm:text-panel-title">{scene.name}</h4>
          <p className="line-clamp-2 text-body font-medium leading-tight text-muted-foreground opacity-60">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
            <span className="text-micro font-black uppercase tracking-label text-primary/60">
              {roomName || t('common.unknown')}
            </span>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="text-micro font-black uppercase tracking-label text-muted-foreground opacity-40">
              {t('scenes.point_count', { count: scene.actions.length })}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={(event) => onToggleFavorite(scene.id, event)}
        className={cn(
          'absolute right-4 top-4 z-20 rounded-full p-2.5 transition-all duration-300 sm:right-6 sm:top-6 sm:p-3 lg:right-8 lg:top-8',
          isFavorite ? 'text-danger bg-danger/10 shadow-lg shadow-danger/20' : 'text-muted-foreground/40 hover:bg-muted hover:text-danger'
        )}
      >
        <Heart className={cn('w-5 h-5', isFavorite && 'fill-current')} />
      </button>

      <div className="absolute bottom-4 right-4 z-20 flex gap-2 transition-all sm:bottom-6 sm:right-6 lg:right-8">
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
