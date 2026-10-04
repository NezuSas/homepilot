import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { useVisualViewportBounds } from './useVisualViewportBounds';

export interface ActionMenuItem { label: string; icon: LucideIcon; onSelect: () => void; disabled?: boolean; danger?: boolean }

export function shouldDismissActionMenu(target: Node | null, trigger: Pick<Node, 'contains'> | null, popup: Pick<Node, 'contains'> | null): boolean {
  return target !== null && !trigger?.contains(target) && !popup?.contains(target);
}

export function getActionMenuPosition(anchor: { top: number; bottom: number; right: number }, height: number,
  viewport: { top: number; left: number; width: number; height: number }, contentWidth = 224) {
  const width = Math.min(contentWidth, Math.max(0, viewport.width - 16));
  const below = Math.max(0, viewport.top + viewport.height - anchor.bottom - 16);
  const above = Math.max(0, anchor.top - viewport.top - 16);
  const useAbove = below < height && above > below;
  const maxHeight = useAbove ? above : below;
  return { width, maxHeight,
    left: Math.max(viewport.left + 8, Math.min(anchor.right - width, viewport.left + viewport.width - width - 8)),
    top: useAbove ? Math.max(viewport.top + 8, anchor.top - Math.min(height, maxHeight) - 8) : anchor.bottom + 8 };
}

/** Shared dashboard/Section actions: portal, outside dismissal and keyboard.
 * This is a non-modal popup: it never locks scrolling or traps page focus. */
export function ActionMenu({ label, items, compact = false }: { label: string; items: ActionMenuItem[]; compact?: boolean }) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 224, maxHeight: 320 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<'first' | 'last'>('first');
  const bounds = useVisualViewportBounds(isOpen);
  const viewportTop = Number(bounds?.top ?? 0);
  const viewportLeft = Number(bounds?.left ?? 0);
  const viewportWidth = typeof bounds?.width === 'number' ? bounds.width : undefined;
  const viewportHeight = typeof bounds?.height === 'number' ? bounds.height : undefined;
  const close = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      if (anchor.bottom < viewportTop || anchor.top > viewportTop + (viewportHeight ?? window.innerHeight)) { setIsOpen(false); return; }
      if (compact && popup.current) popup.current.style.width = 'max-content';
      const contentWidth = compact ? popup.current?.getBoundingClientRect().width ?? 224 : 224;
      setPosition(getActionMenuPosition(anchor, popup.current?.scrollHeight ?? 0, {
        top: viewportTop, left: viewportLeft, width: viewportWidth ?? window.innerWidth, height: viewportHeight ?? window.innerHeight,
      }, contentWidth));
    };
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && shouldDismissActionMenu(event.target, trigger.current, popup.current)) setIsOpen(false);
    };
    update();
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, viewportTop, viewportLeft, viewportWidth, viewportHeight, compact]);

  useLayoutEffect(() => {
    if (isOpen) {
      const controls = popup.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
      controls?.[initialFocus.current === 'last' ? controls.length - 1 : 0]?.focus();
    }
  }, [isOpen]);

  return <>
    <IconButton ref={trigger} icon={MoreVertical} label={label} variant="ghost" size="lg"
      aria-haspopup="menu" aria-expanded={isOpen} aria-controls={isOpen ? id : undefined}
      onPointerDown={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); initialFocus.current = 'first'; setIsOpen(value => !value); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first'; setIsOpen(true); }
        if (event.key === 'Escape') { event.stopPropagation(); close(true); }
      }} />
    {isOpen && createPortal(<div id={id} ref={popup} role="menu" aria-label={label} style={position}
      className="fixed z-[100] overflow-y-auto rounded-panel border border-border/70 bg-card p-1.5 text-foreground shadow-depth-3"
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
        if (event.key === 'Tab') { close(true); return; }
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
        const current = controls.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
          : event.key === 'ArrowDown' ? (current + 1) % controls.length : event.key === 'ArrowUp' ? (current - 1 + controls.length) % controls.length : undefined;
        if (next !== undefined && controls[next]) { event.preventDefault(); controls[next].focus(); }
      }}>
      {items.map((item, index) => <Button key={index} role="menuitem" variant="ghost" size="md" disabled={item.disabled}
        className={`min-h-11 w-full whitespace-nowrap justify-start${item.danger ? ' text-danger' : ''}`}
        onClick={() => { close(true); item.onSelect(); }}>
        <item.icon className="h-4 w-4" aria-hidden="true" />{item.label}
      </Button>)}
    </div>, document.body)}
  </>;
}
