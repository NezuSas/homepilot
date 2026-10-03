import { useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import type { CardGridOptions } from '../types';
import { resizeCardGrid } from './cardGridResize';
import { MASONRY_ROW_GAP_PX, MASONRY_ROW_UNIT_PX } from './useMasonryRowSpans';

interface CardResizeHandleProps {
  gridOptions: CardGridOptions;
  measuredRows: number;
  label: string;
  onPreview: (size: CardGridOptions | null) => void;
  onResize: (size: CardGridOptions) => void;
}

export function CardResizeHandle({ gridOptions, measuredRows, label, onPreview, onResize }: CardResizeHandleProps) {
  const drag = useRef<{ x: number; y: number; step: number; next: CardGridOptions } | null>(null);
  const cancel = () => { drag.current = null; onPreview(null); };
  return <span
    role="slider" aria-label={label} aria-valuemin={gridOptions.minColumns ?? 1} aria-valuemax={gridOptions.maxColumns ?? 12}
    aria-valuenow={gridOptions.columns === 'full' ? 12 : gridOptions.columns} tabIndex={0} title={label}
    onClick={event => event.stopPropagation()}
    onMouseDown={event => event.stopPropagation()}
    onTouchStart={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
      const x = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const y = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (!x && !y) return;
      event.preventDefault();
      const next = resizeCardGrid(gridOptions, x, y, measuredRows);
      if (next.columns !== gridOptions.columns || next.rows !== gridOptions.rows) onResize(next);
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      const grid = event.currentTarget.parentElement?.parentElement;
      drag.current = { x: event.clientX, y: event.clientY, step: Math.max(1, ((grid?.getBoundingClientRect().width ?? 1) + MASONRY_ROW_GAP_PX) / 12), next: gridOptions };
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start) return;
      start.next = resizeCardGrid(gridOptions, Math.round((event.clientX - start.x) / start.step), Math.round((event.clientY - start.y) / (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX)), measuredRows);
      onPreview(start.next);
    }}
    onPointerUp={event => {
      const next = drag.current?.next;
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      onPreview(null);
      if (next && (next.columns !== gridOptions.columns || next.rows !== gridOptions.rows)) onResize(next);
    }}
    onPointerCancel={cancel}
    onLostPointerCapture={cancel}
    className="absolute bottom-1 right-1 z-20 grid h-6 w-6 cursor-nwse-resize touch-none place-items-center rounded-md bg-background/95 text-muted-foreground opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 [@media(hover:none)]:opacity-100"
  ><Maximize2 className="h-3 w-3 rotate-90" /></span>;
}
