import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { SceneCard, type SceneCardScene } from './SceneCard';
import { RoutineCardGrid } from './RoutineCardGrid';
import { Heading } from './ui/Heading';

interface Room {
  id: string;
  name: string;
}

interface ScenesGroupProps<TScene extends SceneCardScene & { roomId: string | null }> {
  canManage?: (scene: TScene) => boolean;
  title?: string;
  icon?: LucideIcon;
  iconClassName: string;
  scenes: TScene[];
  rooms: Room[];
  summarize?: (scene: TScene) => string;
  favorites: string[];
  executingId: string | null;
  successId: string | null;
  onExecute: (scene: TScene) => void;
  onToggleFavorite: (sceneId: string, event: React.MouseEvent) => void;
  onEdit: (scene: TScene, event: React.MouseEvent) => void;
  onDelete: (sceneId: string, event: React.MouseEvent) => void;
}

export const ScenesGroup = <TScene extends SceneCardScene & { roomId: string | null }>({
  title,
  icon: Icon,
  iconClassName,
  scenes,
  rooms,
  summarize,
  favorites,
  executingId,
  successId,
  onExecute,
  onToggleFavorite,
  onEdit,
  onDelete,
  canManage,
}: ScenesGroupProps<TScene>) => {
  if (scenes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {title && <div className="flex items-center gap-2">
        {Icon && <Icon className={iconClassName} />}
        <Heading as="h3" variant="label">{title}</Heading>
      </div>}
      <RoutineCardGrid>
        {scenes.map((scene) => {
          const room = scene.roomId ? rooms.find((candidate) => candidate.id === scene.roomId) : null;

          return (
            <SceneCard
              key={scene.id}
              scene={scene}
              canManage={canManage?.(scene)}
              roomName={room?.name || null}
              summary={summarize?.(scene)}
              isFavorite={favorites.includes(scene.id)}
              isExecuting={executingId === scene.id}
              isSuccessful={successId === scene.id}
              onExecute={() => onExecute(scene)}
              onToggleFavorite={onToggleFavorite}
              onEdit={(_, event) => onEdit(scene, event)}
              onDelete={onDelete}
            />
          );
        })}
      </RoutineCardGrid>
    </div>
  );
};
