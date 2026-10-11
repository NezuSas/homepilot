import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { useMeasuredRowSpan } from './useMeasuredRowSpan';

/** Non-reorderable flow item (title widget, add-title/add-section placeholders). */
export function CanvasFlowItem({
  span,
  gap,
  className,
  style,
  children,
}: {
  span: number;
  gap: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { nodeRef, rowSpan } = useMeasuredRowSpan(gap);

  return (
    <div
      ref={(node) => { nodeRef.current = node; }}
      style={{ gridColumn: `span ${span}`, gridRow: `span ${rowSpan}`, ...style }}
      className={cn("min-w-0", className)}
    >
      {children}
    </div>
  );
}
