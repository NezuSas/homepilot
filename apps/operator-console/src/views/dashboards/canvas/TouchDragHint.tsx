import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SEEN_KEY = '__homepilot_dnd_hint_seen';
const HINT_MS = 7000;

function hintAlreadySeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === 'true'; } catch { return false; }
}

function rememberHint(): void {
  try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* the hint simply shows again next time */ }
}

/**
 * One-time hint for touch screens: moving a section or card needs a short press,
 * which nothing on screen suggests. Hidden after a few seconds, on the first drag,
 * and for good once it has been shown.
 */
export function TouchDragHint({ editing, dragging }: { editing: boolean; dragging: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!editing || hintAlreadySeen() || !window.matchMedia('(pointer: coarse)').matches) return;
    setVisible(true);
    rememberHint();
    const timer = window.setTimeout(() => setVisible(false), HINT_MS);
    return () => {
      window.clearTimeout(timer);
      setVisible(false);
    };
  }, [editing]);

  if (!visible || dragging) return null;
  return (
    <div
      role="status"
      data-dashboard-touch-hint="true"
      className="pointer-events-none fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-pill border border-border/60 bg-background/95 px-4 py-2 text-center text-caption font-semibold text-foreground shadow-depth-3"
    >
      {t('common.reorder_touch_hint')}
    </div>
  );
}
