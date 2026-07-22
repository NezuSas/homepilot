import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { SceneCard, type SceneCardScene } from './SceneCard';

interface Room {
  id: string;
  name: string;
}

interface ScenesGroupProps<TScene extends SceneCardScene & { roomId: string | null }> {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  scenes: TScene[];
  rooms: Room[];
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
  favorites,
  executingId,
  successId,
  onExecute,
  onToggleFavorite,
  onEdit,
  onDelete,
}: ScenesGroupProps<TScene>) => {
  if (scenes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className={iconClassName} />
        <h3 className="text-micro font-black uppercase tracking-label-wider opacity-40">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene) => {
          const room = scene.roomId ? rooms.find((candidate) => candidate.id === scene.roomId) : null;

          return (
            <SceneCard
              key={scene.id}
              scene={scene}
              roomName={room?.name || null}
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
      </div>
    </div>
  );
};
