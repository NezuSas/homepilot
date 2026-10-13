import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Scale that makes a preview of its natural size fit a stage, never enlarging it. */
export function fitScale(stageWidth: number, stageHeight: number, naturalWidth: number, naturalHeight: number): number {
  if (stageWidth <= 0 || stageHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return 1;
  return Math.min(1, stageWidth / naturalWidth, stageHeight / naturalHeight);
}

/**
 * A fixed-size stage for a catalog preview. Cards come in very different sizes (a one-cell button, a full
 * camera, a dial); shrinking each to fit the same stage keeps the catalog tiles uniform and shows every card whole.
 */
export function CatalogPreviewStage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const stageNode = stage.current;
      const innerNode = inner.current;
      if (!stageNode || !innerNode) return;
      setScale(fitScale(stageNode.clientWidth, stageNode.clientHeight, innerNode.scrollWidth, innerNode.scrollHeight));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    if (stage.current) observer.observe(stage.current);
    if (inner.current) observer.observe(inner.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={stage} data-catalog-preview-stage="" className="flex h-40 items-center justify-center overflow-hidden rounded-section bg-background/40">
      <div ref={inner} className="grid w-full origin-center justify-items-center" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
