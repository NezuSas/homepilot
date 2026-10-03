import type { ReactNode } from 'react';
import { CARD_EDITOR_MAX_ROWS, getCardGridHeight } from './cardGridResize';

/** Stable full-grid stage; the actual presenter remains top/left aligned.
 * Oversized intrinsic content can be inspected without clipping the card. */
export function CardPreviewFrame({ label, children }: { label: string; children: ReactNode }) {
  return <div role="region" aria-label={label} className="grid min-w-0 max-w-full items-start justify-items-start overflow-auto"
    style={{ height: getCardGridHeight(CARD_EDITOR_MAX_ROWS) }}>
    {children}
  </div>;
}
