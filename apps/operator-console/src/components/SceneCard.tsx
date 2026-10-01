import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Coffee,
  Check,
  Edit2,
  Heart,
  Home,
  Leaf,
  Monitor,
  Moon,
  Play,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { getDashboardIconComponent } from '../views/dashboards/components/IconPicker';
import type { RoutineDeviceCommand } from '../lib/deviceCapabilities';

interface SceneAction {
  deviceId: string;
  command: RoutineDeviceCommand;
}

export interface SceneCardScene {
  id: string;
  name: string;
  icon?: string;
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
  const titleId = useId();
  const Icon = scene.icon ? getDashboardIconComponent(scene.icon) : getSceneIcon(scene.name);

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-section border bg-card p-3 surface-transition',
        isSuccessful ? 'border-primary/50' : 'border-border/60'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-control',
          isSuccessful ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-primary'
        )}>
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 id={titleId} title={scene.name} className="truncate text-body-compact font-semibold text-foreground">{scene.name}</h4>
          <p className="mt-0.5 truncate text-caption text-muted-foreground" title={roomName || undefined}>
            {roomName ? `${roomName} · ` : ''}{t('scenes.action_count', { count: scene.actions.length })}
          </p>
        </div>
        <IconButton
          icon={Heart}
          label={t(isFavorite ? 'scenes.remove_favorite' : 'scenes.add_favorite')}
          onClick={(event) => onToggleFavorite(scene.id, event)}
          aria-pressed={isFavorite}
          variant="ghost"
          size="lg"
          className={cn(isFavorite && 'text-primary [&_svg]:fill-current')}
        />
      </div>

      {scene.description && <p className="line-clamp-2 text-caption text-muted-foreground">{scene.description}</p>}

      <div className="mt-auto flex items-center gap-1.5">
        <Button
          type="button"
          aria-label={t(isSuccessful ? 'scenes.executed' : 'scenes.execute')}
          size="lg"
          isLoading={isExecuting}
          className="flex-1"
          onClick={() => onExecute(scene)}
        >
          {!isExecuting && (isSuccessful ? <Check aria-hidden="true" className="size-4 shrink-0" /> : <Play aria-hidden="true" className="size-4 shrink-0" />)}
          <span role="status" aria-live="polite">{t(isSuccessful ? 'scenes.executed' : 'scenes.execute')}</span>
        </Button>
        <IconButton
          icon={Edit2}
          label={t('common.edit')}
          onClick={(event) => onEdit(scene, event)}
          variant="default"
          size="lg"
        />
        <IconButton
          icon={Trash2}
          label={t('common.delete')}
          onClick={(event) => onDelete(scene.id, event)}
          variant="ghost"
          size="lg"
          className="hover:text-danger"
        />
      </div>
    </article>
  );
};
