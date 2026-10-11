import { useEffect, useState } from 'react';

/** Tracks the on-screen keyboard height through the visual viewport. */
export function useKeyboardInset(): number {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardInset = () => {
      const nextInset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      setKeyboardInset(nextInset);
      if (nextInset > 0 && document.activeElement instanceof HTMLTextAreaElement) {
        window.requestAnimationFrame(() => document.activeElement?.scrollIntoView({ block: 'nearest' }));
      }
    };

    updateKeyboardInset();
    viewport.addEventListener('resize', updateKeyboardInset);
    viewport.addEventListener('scroll', updateKeyboardInset);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset);
      viewport.removeEventListener('scroll', updateKeyboardInset);
    };
  }, []);

  return keyboardInset;
}
