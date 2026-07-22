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
import { IconButton } from './ui/IconButton';

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
        'group relative min-h-40 cursor-pointer overflow-hidden rounded-card border bg-card/55 p-4 shadow-depth-1 surface-transition interactive-lift sm:p-5',
        isSuccessful ? 'border-primary bg-primary/5 premium-glow shadow-primary/10' : 'border-border/60 hover:border-primary/45',
        isExecuting && 'animate-premium-pulse'
      )}
    >
      <div className="relative z-10 flex items-start gap-3">
        <div className={cn(
          'rounded-panel p-3 transition-transform duration-300 group-hover:scale-105',
          isSuccessful ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/40' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
        )}>
          {isExecuting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h4 className="truncate text-card-title font-semibold tracking-tight text-foreground">{scene.name}</h4>
          <p className="mt-1 line-clamp-2 text-caption leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-micro font-semibold uppercase tracking-label text-primary/75">
              {roomName || t('scenes.global_scene')}
            </span>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="text-micro font-semibold uppercase tracking-label text-muted-foreground/70">
              {t('scenes.point_count', { count: scene.actions.length })}
            </span>
          </div>
        </div>
      </div>

      <IconButton
        icon={Heart}
        label={t(isFavorite ? 'scenes.remove_favorite' : 'scenes.add_favorite')}
        onClick={(event) => onToggleFavorite(scene.id, event)}
        variant={isFavorite ? 'danger' : 'ghost'}
        size="md"
        className={cn(
          'absolute right-3 top-3 z-20 rounded-full transition-all duration-300',
          isFavorite ? 'shadow-lg shadow-danger/20' : 'text-muted-foreground/40 hover:text-danger',
          isFavorite && '[&_svg]:fill-current'
        )}
      />

      <div className="absolute bottom-3 right-3 z-20 flex gap-1.5 transition-all">
        <IconButton
          icon={Edit2}
          label={t('common.edit')}
          onClick={(event) => onEdit(scene, event)}
          variant="default"
          size="sm"
          className="rounded-panel bg-muted/50 hover:text-primary"
        />
        <IconButton
          icon={Trash2}
          label={t('common.delete')}
          onClick={(event) => onDelete(scene.id, event)}
          variant="danger"
          size="sm"
          className="rounded-panel"
        />
      </div>
    </div>
  );
};
