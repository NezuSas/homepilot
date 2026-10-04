import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_EDITOR_MAX_ROWS, getCardGridHeight } from './cardGridResize';

/** Stable full-grid stage; the actual presenter remains top/left aligned.
 * Oversized intrinsic content can be inspected without clipping the card. */
export function getPreviewScale(availableWidth: number, sectionWidth: number, contentHeight: number, availableHeight = getCardGridHeight(CARD_EDITOR_MAX_ROWS) ?? 216): number {
  return Math.min(1, availableWidth / Math.max(1, sectionWidth), availableHeight / Math.max(216, contentHeight));
}

export function CardPreviewFrame({ label, children, sectionWidth = 0, fitHeight = false, fitCard = false }: { label: string; children: ReactNode; sectionWidth?: number; fitHeight?: boolean; fitCard?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => {
      if (frame.current && content.current) setScale(getPreviewScale(frame.current.clientWidth, fitCard ? (content.current.firstElementChild as HTMLElement | null)?.offsetWidth || sectionWidth || frame.current.clientWidth : sectionWidth || frame.current.clientWidth, content.current.scrollHeight, fitHeight ? frame.current.clientHeight : undefined));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    if (frame.current) observer.observe(frame.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [sectionWidth, fitHeight, fitCard]);
  return <div ref={frame} role="region" aria-label={label} className="relative min-w-0 max-w-full overflow-hidden"
    style={{ height: fitHeight ? '100%' : getCardGridHeight(CARD_EDITOR_MAX_ROWS) }}>
    <div ref={content} className="absolute left-0 top-0 grid items-start justify-items-start"
      style={{ width: sectionWidth || '100%', minHeight: getCardGridHeight(CARD_EDITOR_MAX_ROWS), transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
  </div>;
}
