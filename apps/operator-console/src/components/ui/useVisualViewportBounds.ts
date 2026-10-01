import { useEffect, useState, type CSSProperties } from 'react';

/** Keep overlay forms inside the visible area when a touch keyboard opens. */
export function useVisualViewportBounds(isOpen: boolean): CSSProperties | undefined {
  const [bounds, setBounds] = useState<CSSProperties>();

  useEffect(() => {
    if (!isOpen || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateBounds = () => setBounds({
      top: viewport.offsetTop,
      left: viewport.offsetLeft,
      right: 'auto',
      bottom: 'auto',
      width: viewport.width,
      height: viewport.height,
    });

    updateBounds();
    viewport.addEventListener('resize', updateBounds);
    viewport.addEventListener('scroll', updateBounds);
    return () => {
      viewport.removeEventListener('resize', updateBounds);
      viewport.removeEventListener('scroll', updateBounds);
    };
  }, [isOpen]);

  return isOpen ? bounds : undefined;
}
