import { useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import type { SectionCardSpan } from './sectionCardCatalog';

const CARD_RESIZE_STEP_PX = 64;

interface CardResizeHandleProps {
  span: SectionCardSpan;
  spanOrder: SectionCardSpan[];
  label: string;
  onResize: (nextSpan: SectionCardSpan) => void;
}

export function CardResizeHandle({ span, spanOrder, label, onResize }: CardResizeHandleProps) {
  const dragStartRef = useRef<{ x: number; index: number } | null>(null);

  return <span role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={spanOrder.length - 1} aria-valuenow={spanOrder.indexOf(span)} aria-valuetext={span} tabIndex={0} title={label} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { const currentIndex = spanOrder.indexOf(span); if (event.key === 'ArrowRight' && currentIndex < spanOrder.length - 1) { event.preventDefault(); onResize(spanOrder[currentIndex + 1]); } else if (event.key === 'ArrowLeft' && currentIndex > 0) { event.preventDefault(); onResize(spanOrder[currentIndex - 1]); } }} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); dragStartRef.current = { x: event.clientX, index: spanOrder.indexOf(span) }; }} onPointerMove={(event) => { const start = dragStartRef.current; if (!start) return; const deltaSteps = Math.round((event.clientX - start.x) / CARD_RESIZE_STEP_PX); const nextIndex = Math.min(spanOrder.length - 1, Math.max(0, start.index + deltaSteps)); const nextSpan = spanOrder[nextIndex]; if (nextSpan !== span) onResize(nextSpan); }} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); dragStartRef.current = null; }} className="absolute bottom-1 right-1 z-20 grid h-6 w-6 cursor-nwse-resize touch-none place-items-center rounded-md bg-background/95 text-muted-foreground opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 [@media(hover:none)]:opacity-100"><Maximize2 className="h-3 w-3 rotate-90" /></span>;
}
