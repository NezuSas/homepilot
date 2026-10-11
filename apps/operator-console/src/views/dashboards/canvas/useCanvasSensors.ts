import { useMemo } from 'react';
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { isKeyboardDropTarget } from './canvasCollision';

/** Mouse, touch and keyboard sensors; keyboard movement only visits valid drop targets. */
export function useCanvasSensors(useSectionSlots: boolean) {
  const sensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 8,
    },
  }), []);

  return useSensors(
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, args) => {
        const activeKind = args.context.active?.data.current?.kind;
        const droppableRects = new Map(args.context.droppableRects);

        for (const container of args.context.droppableContainers.getEnabled()) {
          if (!isKeyboardDropTarget(activeKind, useSectionSlots, String(container.id), container.data.current)) {
            droppableRects.delete(container.id);
          }
        }

        return sortableKeyboardCoordinates(event, {
          ...args,
          context: { ...args.context, droppableRects },
        });
      },
    }),
  );
}
