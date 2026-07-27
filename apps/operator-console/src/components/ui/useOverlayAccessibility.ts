import { useEffect, type KeyboardEvent, type RefObject } from 'react';

let activeOverlayCount = 0;
let savedBodyOverflow: string | null = null;
const overlayStack: HTMLElement[] = [];

interface UseOverlayAccessibilityOptions {
  isOpen: boolean;
  onClose?: () => void;
  containerRef: RefObject<HTMLElement | null>;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Shares the focus, keyboard and scroll-lock contract used by application overlays.
 * The counter preserves document scrolling until the last open overlay closes.
 */
export function useOverlayAccessibility({
  isOpen,
  onClose,
  containerRef,
}: UseOverlayAccessibilityOptions) {
  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const previousFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusOverlay = window.setTimeout(() => {
      if (overlayStack.at(-1) === container) {
        container.focus();
      }
    }, 0);

    if (activeOverlayCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeOverlayCount += 1;
    overlayStack.push(container);

    const retainFocusInTopOverlay = (event: FocusEvent) => {
      const topOverlay = overlayStack.at(-1);
      if (!topOverlay || !(event.target instanceof Node) || topOverlay.contains(event.target)) {
        return;
      }

      const focusableElements = topOverlay.querySelectorAll<HTMLElement>(focusableSelector);
      (focusableElements[0] ?? topOverlay).focus();
    };

    document.addEventListener('focusin', retainFocusInTopOverlay);

    return () => {
      window.clearTimeout(focusOverlay);
      document.removeEventListener('focusin', retainFocusInTopOverlay);
      activeOverlayCount = Math.max(0, activeOverlayCount - 1);
      const stackIndex = overlayStack.lastIndexOf(container);
      if (stackIndex >= 0) {
        overlayStack.splice(stackIndex, 1);
      }

      if (activeOverlayCount === 0) {
        document.body.style.overflow = savedBodyOverflow ?? '';
        savedBodyOverflow = null;
      }

      if (previousFocusedElement && document.contains(previousFocusedElement)) {
        previousFocusedElement.focus();
      }
    };
  }, [containerRef, isOpen]);

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault();
      containerRef.current?.focus();
      return;
    }

    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstFocusableElement) {
      event.preventDefault();
      lastFocusableElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
      event.preventDefault();
      firstFocusableElement.focus();
    }
  };

  return { handleOverlayKeyDown };
}
